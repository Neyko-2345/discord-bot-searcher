import { handleSearchSelect } from '../handlers/searchHandler.js';
import { handleSearchModal } from '../handlers/modalHandler.js';
import { handleExportButton } from '../handlers/exportHandler.js';
import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { isVipOrAdmin } from '../utils/credits.js';
import { buildSelectOptions, DEFAULT_OPTIONS, VIP_OPTIONS } from '../utils/optionsConfig.js';
import { getDB } from '../utils/database.js';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction, client) {
  // ── Slash commands ─────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[CMD ERROR] ${interaction.commandName}:`, err);
      const reply = { content: '❌ Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  // ── Button ─────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId === 'launch_search') {
      const vip = isVipOrAdmin(interaction.member);
      const db = getDB();

      // Load custom options from DB
      const customOpts = db.prepare(
        'SELECT * FROM custom_options ORDER BY position ASC, id ASC'
      ).all();

      // Filter custom options: non-VIP sees only non-vip-only customs
      const visibleCustomOpts = customOpts.filter(o => vip || o.vip_only === 0);

      // Count total options
      const fixedCount = vip
        ? DEFAULT_OPTIONS.length + VIP_OPTIONS.length
        : DEFAULT_OPTIONS.length;
      const totalCount = fixedCount + visibleCustomOpts.length;

      // Build fixed options (with saved emojis)
      const fixedOptions = buildSelectOptions(vip);

      // Build custom options for select menu
      const customSelectOptions = visibleCustomOpts.map(o => {
        const opt = { label: o.label, value: `custom_${o.value}`, description: o.description };
        if (o.emoji) {
          const animated = o.emoji.startsWith('<a:');
          const custom = o.emoji.match(/^<a?:(\w+):(\d+)>$/);
          opt.emoji = custom
            ? { id: custom[2], name: custom[1], animated }
            : { name: o.emoji };
        }
        return opt;
      });

      // Merge and cap at 25
      const allOptions = [...fixedOptions, ...customSelectOptions].slice(0, 25);

      const select = new StringSelectMenuBuilder()
        .setCustomId('search_type_select')
        .setPlaceholder('Choisir une catégorie...')
        .addOptions(allOptions);

      const row = new ActionRowBuilder().addComponents(select);

      const embed = new EmbedBuilder()
        .setColor(0x3B3B44)
        .setDescription(
          `# NΞXUS™ - S€archer\n` +
          `<:whitearrow:1510580999614894172> **${totalCount}** types de critères\n` +
          `<:whitearrow:1510580999614894172> Multi-critères\n` +
          `<:whitearrow:1510580999614894172> Export JSON`
        );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith('export_')) {
      await handleExportButton(interaction);
    }
    return;
  }

  // ── Select menu ────────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'search_type_select') {
      await handleSearchSelect(interaction);
    }
    return;
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('search_modal_')) {
      await handleSearchModal(interaction);
    }
    return;
  }
}
