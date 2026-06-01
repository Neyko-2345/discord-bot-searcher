import { AttachmentBuilder } from 'discord.js';
import { getDB } from '../utils/database.js';
import { exportResults } from '../utils/searcher.js';

export async function handleExportButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split('_');
  const format = parts[1]; // json or txt
  const resultId = parts.slice(2).join('_');

  const db = getDB();
  const row = db.prepare('SELECT results FROM temp_results WHERE id = ?').get(resultId);

  if (!row) {
    return interaction.editReply({ content: '❌ Résultats expirés ou introuvables.' });
  }

  const results = JSON.parse(row.results);
  const exported = exportResults(results, format);

  const buffer = Buffer.from(exported.content, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: exported.filename });

  await interaction.editReply({
    content: `✅ Export **${format.toUpperCase()}** prêt ! (${results.length} entrées)`,
    files: [attachment]
  });
}
