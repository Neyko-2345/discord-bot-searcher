import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';
import { getDB } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('[ADMIN] Configurer l\'embed de recherche')
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Modifier l\'embed de recherche')
    .addStringOption(opt => opt.setName('title').setDescription('Titre de l\'embed'))
    .addStringOption(opt => opt.setName('description').setDescription('Description de l\'embed'))
    .addStringOption(opt => opt.setName('color').setDescription('Couleur hex (ex: #5865f2)'))
    .addStringOption(opt => opt.setName('footer').setDescription('Texte du footer'))
    .addStringOption(opt => opt.setName('thumbnail').setDescription('URL de la miniature'))
  )
  .addSubcommand(sub => sub
    .setName('preview')
    .setDescription('Prévisualiser l\'embed actuel')
  )
  .addSubcommand(sub => sub
    .setName('reset')
    .setDescription('Réinitialiser l\'embed par défaut')
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
  }

  const db = getDB();
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const current = db.prepare("SELECT value FROM guild_config WHERE key = 'embed_config'").get();
    let config = {};
    if (current) {
      try { config = JSON.parse(current.value); } catch {}
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const thumbnail = interaction.options.getString('thumbnail');

    if (title) config.title = title;
    if (description) config.description = description;
    if (color) config.color = color;
    if (footer) config.footer = footer;
    if (thumbnail) config.thumbnail = thumbnail;

    db.prepare("INSERT OR REPLACE INTO guild_config (key, value) VALUES ('embed_config', ?)").run(JSON.stringify(config));

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Embed mis à jour')
        .setDescription('L\'embed de recherche a été modifié. Utilise `/embed preview` pour voir le résultat.')
        .addFields(
          { name: 'Titre', value: config.title || '*(inchangé)*', inline: true },
          { name: 'Couleur', value: config.color || '*(inchangée)*', inline: true },
          { name: 'Footer', value: config.footer || '*(inchangé)*', inline: true }
        )
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (sub === 'preview') {
    const current = db.prepare("SELECT value FROM guild_config WHERE key = 'embed_config'").get();
    let config = {};
    if (current) {
      try { config = JSON.parse(current.value); } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(config.color ? parseInt(config.color.replace('#', ''), 16) : 0x5865f2)
      .setTitle(config.title || '🔍 Recherche de Données')
      .setDescription(config.description || 'Sélectionne une catégorie dans le menu ci-dessous pour effectuer ta recherche.')
      .setTimestamp();

    if (config.footer) embed.setFooter({ text: config.footer });
    if (config.thumbnail) embed.setThumbnail(config.thumbnail);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'reset') {
    db.prepare("DELETE FROM guild_config WHERE key = 'embed_config'").run();
    return interaction.reply({
      content: '✅ L\'embed a été réinitialisé aux valeurs par défaut.',
      ephemeral: true
    });
  }
}
