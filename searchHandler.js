import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { isVipOrAdmin } from '../utils/credits.js';
import { getDB } from '../utils/database.js';

const BUILTIN_TYPES = {
  email:      { label: 'Email',            placeholder: 'exemple@gmail.com',      vip: false },
  phone:      { label: 'Numéro de téléphone', placeholder: '+33612345678',        vip: false },
  name:       { label: 'Prénom et/ou Nom', placeholder: 'Jean Dupont',            vip: false },
  username:   { label: 'Username',         placeholder: 'john_doe',               vip: false },
  discord_id: { label: 'Discord ID',       placeholder: '123456789012345678',     vip: false },
  ip:         { label: 'Adresse IP',       placeholder: '192.168.1.1',            vip: false },
  city:       { label: 'Ville',            placeholder: 'Paris',                  vip: false },
  postal:     { label: 'Code Postal',      placeholder: '75001',                  vip: false },
  address:    { label: 'Adresse',          placeholder: '1 rue de la Paix',       vip: false },
  iban:       { label: 'IBAN',             placeholder: 'FR76 3000 6000 0112…',   vip: false },
  password:   { label: 'Mot de passe',     placeholder: 'motdepasse123',          vip: false },
  intelx:     { label: 'Recherche Intel_X', placeholder: 'email, domaine, IP…',  vip: true  },
  nazapi:     { label: 'Recherche Nazapi', placeholder: 'email, username, IP…',   vip: true  },
};

export async function handleSearchSelect(interaction) {
  const selected = interaction.values[0];
  const db = getDB();

  // ── Custom option ──────────────────────────────────────────────────────────
  if (selected.startsWith('custom_')) {
    const customValue = selected.replace('custom_', '');
    const opt = db.prepare('SELECT * FROM custom_options WHERE value = ?').get(customValue);
    if (!opt) {
      return interaction.reply({ content: '❌ Option introuvable.', ephemeral: true });
    }

    // VIP check
    if (opt.vip_only && !isVipOrAdmin(interaction.member)) {
      return interaction.reply({
        content: '🔒 **Accès restreint** — Cette option est réservée aux **VIP** et **Admins**.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`search_modal_${selected}`)
      .setTitle(`🔍 ${opt.label}`);

    const input = new TextInputBuilder()
      .setCustomId('search_query')
      .setLabel(opt.modal_label)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(opt.modal_placeholder || opt.label)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(300);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ── Built-in option ────────────────────────────────────────────────────────
  const typeInfo = BUILTIN_TYPES[selected];
  if (!typeInfo) {
    return interaction.reply({ content: '❌ Type de recherche invalide.', ephemeral: true });
  }

  if (typeInfo.vip && !isVipOrAdmin(interaction.member)) {
    return interaction.reply({
      content: '🔒 **Accès restreint** — Cette option est réservée aux **VIP** et **Admins**.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`search_modal_${selected}`)
    .setTitle(`🔍 ${typeInfo.label}`);

  const input = new TextInputBuilder()
    .setCustomId('search_query')
    .setLabel(typeInfo.label)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(typeInfo.placeholder)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(300);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}
