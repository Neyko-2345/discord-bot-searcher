import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';
import { getDB } from '../utils/database.js';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../../data/databases');

mkdirSync(DB_DIR, { recursive: true });

export const data = new SlashCommandBuilder()
  .setName('database')
  .setDescription('[ADMIN] Gérer les bases de données de recherche')
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Ajouter une base de données (fichier JSON ou TXT)')
    .addAttachmentOption(opt => opt.setName('fichier').setDescription('Fichier de base de données (.json, .txt, .csv)').setRequired(true))
    .addStringOption(opt => opt.setName('nom').setDescription('Nom de la base de données').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Description de la base de données'))
  )
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Lister toutes les bases de données')
  )
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Supprimer une base de données')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom de la base de données à supprimer').setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName('info')
    .setDescription('Voir les infos d\'une base de données')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom de la base de données').setRequired(true))
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const db = getDB();
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const attachment = interaction.options.getAttachment('fichier');
    const nom = interaction.options.getString('nom').toLowerCase().replace(/\s+/g, '_');
    const description = interaction.options.getString('description') || 'Aucune description';

    const allowedTypes = ['.json', '.txt', '.csv', '.log'];
    const ext = attachment.name.substring(attachment.name.lastIndexOf('.'));
    if (!allowedTypes.includes(ext)) {
      return interaction.editReply({ content: `❌ Type de fichier non supporté. Formats acceptés: ${allowedTypes.join(', ')}` });
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (attachment.size > maxSize) {
      return interaction.editReply({ content: '❌ Fichier trop volumineux (max 50MB).' });
    }

    try {
      const response = await fetch(attachment.url);
      const content = await response.text();
      const filename = `${nom}_${Date.now()}${ext}`;
      const filePath = join(DB_DIR, filename);
      writeFileSync(filePath, content, 'utf-8');

      // Count entries
      let entryCount = 0;
      if (ext === '.json') {
        try {
          const parsed = JSON.parse(content);
          entryCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        } catch {}
      } else {
        entryCount = content.split('\n').filter(l => l.trim()).length;
      }

      db.prepare('INSERT OR REPLACE INTO databases (name, filename, description, added_by, entry_count) VALUES (?, ?, ?, ?, ?)').run(
        nom, filename, description, interaction.user.id, entryCount
      );

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Base de données ajoutée')
          .addFields(
            { name: 'Nom', value: nom, inline: true },
            { name: 'Fichier', value: attachment.name, inline: true },
            { name: 'Entrées', value: entryCount.toLocaleString(), inline: true },
            { name: 'Description', value: description }
          )
          .setTimestamp()
        ]
      });
    } catch (e) {
      console.error('DB add error:', e);
      return interaction.editReply({ content: `❌ Erreur lors de l'ajout: ${e.message}` });
    }
  }

  if (sub === 'list') {
    const databases = db.prepare('SELECT * FROM databases ORDER BY added_at DESC').all();
    if (databases.length === 0) {
      return interaction.editReply({ content: '📭 Aucune base de données ajoutée.' });
    }

    const fields = databases.map(d => ({
      name: `📁 ${d.name}`,
      value: `${d.description}\n**Entrées:** ${d.entry_count.toLocaleString()} • **Ajoutée:** ${d.added_at.split(' ')[0]}`,
      inline: false
    }));

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📚 Bases de données (${databases.length})`)
        .addFields(fields.slice(0, 10))
        .setTimestamp()
      ]
    });
  }

  if (sub === 'remove') {
    const nom = interaction.options.getString('nom');
    const database = db.prepare('SELECT * FROM databases WHERE name = ?').get(nom);
    if (!database) {
      return interaction.editReply({ content: `❌ Base de données "${nom}" introuvable.` });
    }

    const filePath = join(DB_DIR, database.filename);
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {}
    }

    db.prepare('DELETE FROM databases WHERE name = ?').run(nom);
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🗑️ Base de données supprimée')
        .setDescription(`La base **${nom}** a été supprimée.`)
        .setTimestamp()
      ]
    });
  }

  if (sub === 'info') {
    const nom = interaction.options.getString('nom');
    const database = db.prepare('SELECT * FROM databases WHERE name = ?').get(nom);
    if (!database) {
      return interaction.editReply({ content: `❌ Base de données "${nom}" introuvable.` });
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📁 ${database.name}`)
        .addFields(
          { name: 'Description', value: database.description, inline: false },
          { name: 'Fichier', value: database.filename, inline: true },
          { name: 'Entrées', value: database.entry_count.toLocaleString(), inline: true },
          { name: 'Ajoutée le', value: database.added_at, inline: true },
          { name: 'Ajoutée par', value: `<@${database.added_by}>`, inline: true }
        )
        .setTimestamp()
      ]
    });
  }
}
