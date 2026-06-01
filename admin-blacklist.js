import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';
import { getDB } from '../utils/database.js';
import { getOrCreateUser } from '../utils/credits.js';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('[ADMIN] Gérer la blacklist des utilisateurs')
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Blacklister un utilisateur')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur à blacklister').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison du blacklist'))
  )
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Retirer un utilisateur de la blacklist')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur à déblacklister').setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Voir la liste des utilisateurs blacklistés')
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
  }

  const db = getDB();
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const target = interaction.options.getUser('user');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    getOrCreateUser(target.id, target.username);
    db.prepare('UPDATE users SET blacklisted = 1 WHERE id = ?').run(target.id);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Utilisateur blacklisté')
        .addFields(
          { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Raison', value: raison, inline: true },
          { name: 'Par', value: interaction.user.tag, inline: true }
        )
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (sub === 'remove') {
    const target = interaction.options.getUser('user');
    db.prepare('UPDATE users SET blacklisted = 0 WHERE id = ?').run(target.id);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Blacklist retirée')
        .setDescription(`**${target.tag}** n'est plus blacklisté.`)
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (sub === 'list') {
    const blacklisted = db.prepare('SELECT * FROM users WHERE blacklisted = 1').all();
    if (blacklisted.length === 0) {
      return interaction.reply({ content: '✅ Aucun utilisateur blacklisté.', ephemeral: true });
    }

    const list = blacklisted.map(u => `• <@${u.id}> (${u.username || u.id})`).join('\n');
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Utilisateurs blacklistés')
        .setDescription(list)
        .setFooter({ text: `${blacklisted.length} utilisateur(s)` })
      ],
      ephemeral: true
    });
  }
}
