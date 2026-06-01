import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isBlacklisted, hasCredits, consumeCredit, getOrCreateUser, getCreditsInfo, isVipOrAdmin } from '../utils/credits.js';
import { searchInLocalDatabases, formatResults } from '../utils/searcher.js';
import { searchIntelX, searchNazAPI } from '../utils/apiIntegrations.js';
import { getDB } from '../utils/database.js';

const TYPE_LABELS = {
  email: 'Email', phone: 'Téléphone', name: 'Nom / Prénom',
  username: 'Username', discord_id: 'Discord ID', ip: 'Adresse IP',
  city: 'Ville', postal: 'Code Postal', address: 'Adresse',
  iban: 'IBAN', password: 'Mot de passe',
  intelx: 'Intel_X', nazapi: 'Nazapi'
};

export async function handleSearchModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId   = interaction.user.id;
  const username = interaction.user.username;
  const rawType  = interaction.customId.replace('search_modal_', '');
  const query    = interaction.fields.getTextInputValue('search_query').trim();
  const db       = getDB();

  // ── Blacklist ──────────────────────────────────────────────────────────────
  if (isBlacklisted(userId)) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Accès refusé')
        .setDescription('Tu as été blacklisté et ne peux plus effectuer de recherches.')
      ]
    });
  }

  getOrCreateUser(userId, username);

  // ── Resolve type: custom or built-in ──────────────────────────────────────
  let searchType = rawType;
  let typeLabel  = TYPE_LABELS[rawType] || rawType;
  let isCustom   = false;
  let customOpt  = null;

  if (rawType.startsWith('custom_')) {
    const customValue = rawType.replace('custom_', '');
    customOpt = db.prepare('SELECT * FROM custom_options WHERE value = ?').get(customValue);
    if (!customOpt) {
      return interaction.editReply({ content: '❌ Option introuvable.' });
    }
    // VIP check
    if (customOpt.vip_only && !isVipOrAdmin(interaction.member)) {
      return interaction.editReply({ content: '🔒 Accès restreint.' });
    }
    isCustom   = true;
    searchType = customValue;
    typeLabel  = customOpt.label;
  }

  // ── VIP check for API types ────────────────────────────────────────────────
  const VIP_TYPES = ['intelx', 'nazapi'];
  if (VIP_TYPES.includes(rawType) && !isVipOrAdmin(interaction.member)) {
    return interaction.editReply({ content: '🔒 Accès restreint — VIP & Admins uniquement.' });
  }

  // ── Credits check ──────────────────────────────────────────────────────────
  if (!hasCredits(userId)) {
    const info = getCreditsInfo(userId);
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('⚡ Crédits épuisés')
        .setDescription(
          `Tu n'as plus de crédits de recherche pour aujourd'hui.\n\n` +
          `⏳ **Prochain renouvellement :** ${info.nextReset}`
        )
        .addFields({ name: '📊 Plan actuel', value: info.plan === 'free' ? '🆓 Gratuit (5/24h)' : `✨ ${info.plan}`, inline: true })
        .setFooter({ text: 'Les crédits se renouvellent automatiquement toutes les 24h' })
      ]
    });
  }

  consumeCredit(userId);
  db.prepare('INSERT INTO search_logs (user_id, query, search_type) VALUES (?, ?, ?)').run(userId, query, searchType);

  // ── Search ─────────────────────────────────────────────────────────────────
  let results  = [];
  let apiError = null;
  let source   = 'local';

  if (rawType === 'intelx') {
    const r = await searchIntelX(query, searchType);
    if (r.error) { apiError = r.error; }
    else { results = (r.results || []).map(d => ({ source: 'Intel_X', data: d })); source = 'Intel_X'; }

  } else if (rawType === 'nazapi') {
    const r = await searchNazAPI(query, searchType);
    if (r.error) { apiError = r.error; }
    else { results = (r.results || []).map(d => ({ source: 'Nazapi', data: d })); source = 'Nazapi'; }

  } else {
    results = searchInLocalDatabases(query, searchType);
  }

  const creditsInfo    = getCreditsInfo(userId);
  const creditsDisplay = creditsInfo.unlimited ? '♾️' : `${creditsInfo.credits} restants`;

  // ── API error ──────────────────────────────────────────────────────────────
  if (apiError) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle(`⚠️ Erreur API — ${typeLabel}`)
        .setDescription(apiError)
        .setFooter({ text: `Crédits : ${creditsDisplay}` })
        .setTimestamp()
      ]
    });
  }

  const formatted = formatResults(results, query, searchType);

  // ── No results ─────────────────────────────────────────────────────────────
  if (!formatted) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🔍 Aucun résultat')
        .setDescription(`Aucune donnée trouvée pour **${query}** — catégorie **${typeLabel}**.`)
        .setFooter({ text: `Crédits : ${creditsDisplay}` })
        .setTimestamp()
      ]
    });
  }

  // ── Store for export ───────────────────────────────────────────────────────
  const resultId = `${userId}_${Date.now()}`;
  db.prepare('INSERT OR REPLACE INTO temp_results (id, user_id, results) VALUES (?, ?, ?)').run(
    resultId, userId, JSON.stringify(results)
  );

  // ── Results embed ──────────────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x3B3B44)
    .setTitle(`🔍 ${typeLabel} — \`${query}\``)
    .setDescription(
      `**${formatted.total}** résultat(s)` +
      (formatted.total > 10 ? ' — 10 premiers affichés' : '')
    )
    .addFields(formatted.fields)
    .setFooter({ text: `Crédits : ${creditsDisplay} • Source : ${source}` })
    .setTimestamp();

  const exportRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`export_json_${resultId}`)
      .setLabel('Export JSON')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`export_txt_${resultId}`)
      .setLabel('Export TXT')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [exportRow] });
}
