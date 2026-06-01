import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';
import { getDB } from '../utils/database.js';
import { parseEmoji } from '../utils/optionsConfig.js';

// Slugify label into a unique value key
function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 32);
}

export const data = new SlashCommandBuilder()
  .setName('addoption')
  .setDescription('[ADMIN] Gérer les options personnalisées du menu de recherche')

  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Ajouter une nouvelle option au menu de recherche')
    .addStringOption(o => o.setName('label').setDescription('Nom affiché dans le menu (ex: Steam ID)').setRequired(true).setMaxLength(25))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji de l\'option (unicode ou <:nom:id> ou <a:nom:id>)').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Sous-titre affiché dans le menu (max 50 caractères)').setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName('modal_label').setDescription('Titre du champ dans le formulaire (ex: Ton Steam ID)').setRequired(true).setMaxLength(45))
    .addStringOption(o => o.setName('modal_placeholder').setDescription('Texte d\'exemple dans le formulaire (ex: STEAM_0:0:123456)').setMaxLength(100))
    .addStringOption(o => o.setName('modal_hint').setDescription('Message d\'aide affiché sous le formulaire').setMaxLength(100))
    .addBooleanOption(o => o.setName('vip_only').setDescription('Réserver aux VIP et Admins ?'))
    .addIntegerOption(o => o.setName('position').setDescription('Position dans le menu (défaut: 99 = fin de liste)').setMinValue(1).setMaxValue(99))
  )

  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Supprimer une option personnalisée')
    .addStringOption(o => o.setName('label').setDescription('Nom exact de l\'option à supprimer').setRequired(true))
  )

  .addSubcommand(sub => sub
    .setName('edit')
    .setDescription('Modifier une option existante')
    .addStringOption(o => o.setName('label').setDescription('Nom exact de l\'option à modifier').setRequired(true))
    .addStringOption(o => o.setName('new_label').setDescription('Nouveau nom').setMaxLength(25))
    .addStringOption(o => o.setName('emoji').setDescription('Nouvel emoji'))
    .addStringOption(o => o.setName('description').setDescription('Nouvelle description').setMaxLength(50))
    .addStringOption(o => o.setName('modal_label').setDescription('Nouveau titre du formulaire').setMaxLength(45))
    .addStringOption(o => o.setName('modal_placeholder').setDescription('Nouveau placeholder').setMaxLength(100))
    .addStringOption(o => o.setName('modal_hint').setDescription('Nouveau message d\'aide').setMaxLength(100))
    .addBooleanOption(o => o.setName('vip_only').setDescription('Réserver aux VIP ?'))
    .addIntegerOption(o => o.setName('position').setDescription('Nouvelle position').setMinValue(1).setMaxValue(99))
  )

  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Voir toutes les options personnalisées')
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
  }

  const db = getDB();
  const sub = interaction.options.getSubcommand();

  // ── ADD ─────────────────────────────────────────────────────────────────────
  if (sub === 'add') {
    const label       = interaction.options.getString('label');
    const emoji       = interaction.options.getString('emoji').trim();
    const description = interaction.options.getString('description');
    const modalLabel  = interaction.options.getString('modal_label');
    const placeholder = interaction.options.getString('modal_placeholder') || label;
    const hint        = interaction.options.getString('modal_hint') || '';
    const vipOnly     = interaction.options.getBoolean('vip_only') ?? false;
    const position    = interaction.options.getInteger('position') ?? 99;

    const value = toSlug(label);

    // Check emoji is parseable
    const parsed = parseEmoji(emoji);
    if (!parsed) {
      return interaction.reply({ content: `❌ Emoji invalide : \`${emoji}\``, ephemeral: true });
    }

    // Check total options count (Discord max = 25)
    const totalFixed = 13; // 11 defaults + 2 VIP
    const customCount = db.prepare('SELECT COUNT(*) as c FROM custom_options').get().c;
    if (totalFixed + customCount >= 25) {
      return interaction.reply({ content: '❌ Limite atteinte : le menu Discord accepte maximum 25 options au total.', ephemeral: true });
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM custom_options WHERE value = ? OR label = ?').get(value, label);
    if (existing) {
      return interaction.reply({ content: `❌ Une option avec ce nom existe déjà (\`${label}\`).`, ephemeral: true });
    }

    db.prepare(`
      INSERT INTO custom_options (value, label, description, emoji, modal_label, modal_placeholder, modal_hint, vip_only, position, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(value, label, description, emoji, modalLabel, placeholder, hint, vipOnly ? 1 : 0, position, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x3B3B44)
      .setTitle('✅ Option ajoutée au menu')
      .addFields(
        { name: '🏷️ Label',       value: `${emoji} ${label}`,       inline: true  },
        { name: '📋 Description', value: description,                inline: true  },
        { name: '📝 Formulaire',  value: `**${modalLabel}**\n*${placeholder}*`, inline: false },
        { name: '🔒 VIP only',    value: vipOnly ? 'Oui' : 'Non',   inline: true  },
        { name: '📍 Position',    value: `#${position}`,             inline: true  }
      )
      .setFooter({ text: 'L\'option apparaît immédiatement dans le menu.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── REMOVE ──────────────────────────────────────────────────────────────────
  if (sub === 'remove') {
    const label = interaction.options.getString('label');
    const opt = db.prepare('SELECT * FROM custom_options WHERE label = ?').get(label);
    if (!opt) {
      return interaction.reply({ content: `❌ Option introuvable : \`${label}\``, ephemeral: true });
    }
    db.prepare('DELETE FROM custom_options WHERE label = ?').run(label);
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🗑️ Option supprimée')
        .setDescription(`L'option **${opt.emoji} ${opt.label}** a été retirée du menu.`)
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  // ── EDIT ────────────────────────────────────────────────────────────────────
  if (sub === 'edit') {
    const label = interaction.options.getString('label');
    const opt = db.prepare('SELECT * FROM custom_options WHERE label = ?').get(label);
    if (!opt) {
      return interaction.reply({ content: `❌ Option introuvable : \`${label}\``, ephemeral: true });
    }

    const newLabel      = interaction.options.getString('new_label')         ?? opt.label;
    const newEmoji      = interaction.options.getString('emoji')?.trim()     ?? opt.emoji;
    const newDesc       = interaction.options.getString('description')       ?? opt.description;
    const newModalLabel = interaction.options.getString('modal_label')       ?? opt.modal_label;
    const newPlaceholder= interaction.options.getString('modal_placeholder') ?? opt.modal_placeholder;
    const newHint       = interaction.options.getString('modal_hint')        ?? opt.modal_hint;
    const newVip        = interaction.options.getBoolean('vip_only')         ?? (opt.vip_only === 1);
    const newPos        = interaction.options.getInteger('position')         ?? opt.position;
    const newValue      = toSlug(newLabel);

    db.prepare(`
      UPDATE custom_options SET
        value = ?, label = ?, description = ?, emoji = ?,
        modal_label = ?, modal_placeholder = ?, modal_hint = ?,
        vip_only = ?, position = ?
      WHERE label = ?
    `).run(newValue, newLabel, newDesc, newEmoji, newModalLabel, newPlaceholder, newHint, newVip ? 1 : 0, newPos, label);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3B3B44)
        .setTitle('✏️ Option modifiée')
        .addFields(
          { name: 'Label',       value: `${newEmoji} ${newLabel}`, inline: true },
          { name: 'Description', value: newDesc,                   inline: true },
          { name: 'VIP only',    value: newVip ? 'Oui' : 'Non',   inline: true }
        )
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  // ── LIST ────────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const opts = db.prepare('SELECT * FROM custom_options ORDER BY position ASC, id ASC').all();
    if (opts.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x3B3B44)
          .setTitle('📋 Options personnalisées')
          .setDescription('Aucune option personnalisée ajoutée pour l\'instant.\nUtilise `/addoption add` pour en créer une.')
        ],
        ephemeral: true
      });
    }

    const fields = opts.map(o => ({
      name: `#${o.position} — ${o.emoji} ${o.label}`,
      value: [
        `📋 *${o.description}*`,
        `📝 Formulaire : **${o.modal_label}**`,
        o.modal_placeholder ? `💡 Placeholder : \`${o.modal_placeholder}\`` : '',
        `🔒 VIP only : ${o.vip_only ? 'Oui' : 'Non'}`,
        `📅 Ajoutée le : ${o.added_at.split(' ')[0]}`
      ].filter(Boolean).join('\n'),
      inline: false
    }));

    const embed = new EmbedBuilder()
      .setColor(0x3B3B44)
      .setTitle(`📋 Options personnalisées (${opts.length})`)
      .addFields(fields.slice(0, 10))
      .setFooter({ text: 'Utilise /addoption edit ou /addoption remove pour modifier.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
