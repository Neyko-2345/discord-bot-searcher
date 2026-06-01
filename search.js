import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('[ADMIN] Envoie l\'embed de recherche dans ce salon');

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3B3B44)
    .setDescription(
      `## <a:dsclookup:1510618934909599865> NΞXUS™ - L00kup\n\n` +
      `- Recherche & infos en un clic.\n` +
      `Choisis un outil dans le menu ci-dessous.\n\n` +
      `**<a:online:1508490406357110825> Services**\n` +
      `\`\`\`En ligne\`\`\`` +
      `**<:white_emoji_1453224614456201306_:1510618345106571395> Outils**\n` +
      `\`\`\`Email\nTéléphone\nNom / Prénom\nUsername\nAdresse IP\nDiscord ID\`\`\``
    )
    .setImage('https://i.postimg.cc/3R5HjX9P/IMG-4685.jpg')
    .setFooter({ text: 'discord.gg/Nexus' });

  const button = new ButtonBuilder()
    .setCustomId('launch_search')
    .setLabel('Lancer une recherche')
    .setEmoji({ id: '1508501771750871142', name: 'arrow', animated: true })
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  await interaction.reply({ embeds: [embed], components: [row] });
}
