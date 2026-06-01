import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/adminCheck.js';
import { DEFAULT_OPTIONS, VIP_OPTIONS, getOptionsConfig, saveOptionsConfig } from '../utils/optionsConfig.js';

const ALL_OPTIONS = [...DEFAULT_OPTIONS, ...VIP_OPTIONS];

export const data = new SlashCommandBuilder()
  .setName('options')
  .setDescription('[ADMIN] Gérer les emojis des options de recherche')
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Modifier l\'emoji d\'une option')
    .addStringOption(opt => opt
      .setName('option')
      .setDescription('Nom de l\'option à modifier')
      .setRequired(true)
      .addChoices(
        { name: 'Email',        value: 'email'      },
        { name: 'Téléphone',    value: 'phone'      },
        { name: 'Nom / Prénom', value: 'name'       },
        { name: 'Username',     value: 'username'   },
        { name: 'Discord ID',   value: 'discord_id' },
        { name: 'Adresse IP',   value: 'ip'         },
        { name: 'Ville',        value: 'city'       },
        { name: 'Code Postal',  value: 'postal'     },
        { name: 'Adresse',      value: 'address'    },
        { name: 'IBAN',         value: 'iban'       },
        { name: 'Mot de passe', value: 'password'   },
        { name: 'Intel_X',      value: 'intelx'     },
        { name: 'Nazapi',       value: 'nazapi'     }
      )
    )
    .addStringOption(opt => opt
      .setName('emoji')
      .setDescription('Emoji à utiliser (unicode ou format Discord <:nom:id> ou <a:nom:id>)')
      .setRequired(true)
    )
  )
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Voir tous les emojis actuels des options')
  )
  .addSubcommand(sub => sub
    .setName('reset')
    .setDescription('Remettre tous les emojis par défaut')
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const optionKey = interaction.options.getString('option');
    const emoji = interaction.options.getString('emoji').trim();
    const optInfo = ALL_OPTIONS.find(o => o.value === optionKey);

    const config = getOptionsConfig();
    config[optionKey] = emoji;
    saveOptionsConfig(config);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3B3B44)
        .setTitle('✅ Emoji mis à jour')
        .addFields(
          { name: 'Option', value: optInfo?.label || optionKey, inline: true },
          { name: 'Nouvel emoji', value: emoji, inline: true }
        )
        .setFooter({ text: 'L\'emoji s\'applique immédiatement au prochain clic sur le bouton.' })
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (sub === 'list') {
    const config = getOptionsConfig();
    const fields = ALL_OPTIONS.map(opt => ({
      name: opt.label,
      value: config[opt.value] || opt.defaultEmoji,
      inline: true
    }));

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3B3B44)
        .setTitle('🎨 Emojis des options')
        .addFields(fields)
        .setFooter({ text: 'Utilise /options set pour modifier un emoji.' })
        .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (sub === 'reset') {
    saveOptionsConfig({});
    return interaction.reply({
      content: '✅ Tous les emojis ont été réinitialisés aux valeurs par défaut.',
      ephemeral: true
    });
  }
}
