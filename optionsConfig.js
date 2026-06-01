import { getDB } from './database.js';

export const DEFAULT_OPTIONS = [
  { value: 'email',      label: 'Email',         defaultEmoji: '📧' },
  { value: 'phone',      label: 'Téléphone',     defaultEmoji: '📞' },
  { value: 'name',       label: 'Nom / Prénom',  defaultEmoji: '👤' },
  { value: 'username',   label: 'Username',      defaultEmoji: '🎮' },
  { value: 'discord_id', label: 'Discord ID',    defaultEmoji: '🆔' },
  { value: 'ip',         label: 'Adresse IP',    defaultEmoji: '🌐' },
  { value: 'city',       label: 'Ville',         defaultEmoji: '🏙️' },
  { value: 'postal',     label: 'Code Postal',   defaultEmoji: '📮' },
  { value: 'address',    label: 'Adresse',       defaultEmoji: '🏠' },
  { value: 'iban',       label: 'IBAN',          defaultEmoji: '🏦' },
  { value: 'password',   label: 'Mot de passe',  defaultEmoji: '🔑' },
];

export const VIP_OPTIONS = [
  { value: 'intelx', label: 'Intel_X', defaultEmoji: '🔓' },
  { value: 'nazapi', label: 'Nazapi',  defaultEmoji: '🔍' },
];

// Parse Discord emoji string into SelectMenu emoji object
export function parseEmoji(emojiStr) {
  if (!emojiStr) return null;
  const animated = /^<a:/.test(emojiStr);
  const custom = emojiStr.match(/^<a?:(\w+):(\d+)>$/);
  if (custom) {
    return { id: custom[2], name: custom[1], animated };
  }
  // Unicode emoji
  return { name: emojiStr };
}

export function getOptionsConfig() {
  const db = getDB();
  const row = db.prepare("SELECT value FROM guild_config WHERE key = 'options_emojis'").get();
  if (!row) return {};
  try { return JSON.parse(row.value); } catch { return {}; }
}

export function saveOptionsConfig(config) {
  const db = getDB();
  db.prepare("INSERT OR REPLACE INTO guild_config (key, value) VALUES ('options_emojis', ?)").run(JSON.stringify(config));
}

export function buildSelectOptions(includeVip = false) {
  const config = getOptionsConfig();
  const all = includeVip ? [...DEFAULT_OPTIONS, ...VIP_OPTIONS] : DEFAULT_OPTIONS;

  return all.map(opt => {
    const emojiStr = config[opt.value] || opt.defaultEmoji;
    const emoji = parseEmoji(emojiStr);
    const built = {
      label: opt.label,
      value: opt.value,
    };
    if (emoji) built.emoji = emoji;
    return built;
  });
}
