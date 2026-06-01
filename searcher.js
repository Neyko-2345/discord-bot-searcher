import { getDB } from './database.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../../data/databases');

// Fields to check per search type
const TYPE_FIELDS = {
  email:      ['email', 'mail', 'e-mail', 'Email', 'EMAIL'],
  phone:      ['phone', 'telephone', 'tel', 'mobile', 'Phone', 'PHONE', 'number'],
  name:       ['name', 'nom', 'prenom', 'firstname', 'lastname', 'fullname', 'first_name', 'last_name', 'pseudo'],
  username:   ['username', 'pseudo', 'login', 'nick', 'Username', 'user', 'name', 'discord_name'],
  discord_id: ['discord_id', 'discordid', 'discord', 'id', 'user_id', 'uid'],
  ip:         ['ip', 'ip_address', 'ipv4', 'ipv6', 'last_ip', 'IP'],
  city:       ['city', 'ville', 'City', 'CITY'],
  postal:     ['postal', 'zip', 'code_postal', 'zipcode', 'postcode'],
  address:    ['address', 'adresse', 'rue', 'street', 'Address'],
  iban:       ['iban', 'IBAN', 'bank'],
  password:   ['password', 'pass', 'passwd', 'mdp', 'pwd', 'PASSWORD'],
};

export function searchInLocalDatabases(query, searchType) {
  const db = getDB();
  const databases = db.prepare('SELECT * FROM databases').all();
  const results = [];
  const queryLower = query.toLowerCase().trim();
  const relevantFields = TYPE_FIELDS[searchType] || [];

  for (const database of databases) {
    const filePath = join(DB_DIR, database.filename);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, 'utf-8');
      let entries = [];

      if (database.filename.endsWith('.json')) {
        const parsed = JSON.parse(content);
        entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
      } else {
        // TXT / CSV / LOG: try JSON lines first, then plain lines
        entries = content.split('\n').filter(l => l.trim()).map(line => {
          try { return JSON.parse(line); } catch { return { raw: line }; }
        });
      }

      for (const entry of entries) {
        if (results.length >= 100) break;
        let matched = false;

        if (typeof entry === 'object' && entry !== null) {
          // Try to match on relevant fields first
          if (relevantFields.length > 0) {
            for (const field of relevantFields) {
              const val = entry[field];
              if (val && String(val).toLowerCase().includes(queryLower)) {
                matched = true;
                break;
              }
            }
          }
          // Fallback: full entry string match
          if (!matched) {
            matched = JSON.stringify(entry).toLowerCase().includes(queryLower);
          }
        } else {
          matched = String(entry).toLowerCase().includes(queryLower);
        }

        if (matched) {
          results.push({ source: database.name, data: entry });
        }
      }
    } catch (e) {
      console.error(`[SEARCH] Error reading database ${database.name}:`, e.message);
    }
    if (results.length >= 100) break;
  }

  return results;
}

export function formatResults(results, query, searchType) {
  if (results.length === 0) return null;

  const fields = results.slice(0, 10).map((r, i) => {
    const data = r.data;
    let lines = [];

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data).slice(0, 10);
      for (const key of keys) {
        const val = data[key];
        if (val !== null && val !== undefined && val !== '') {
          lines.push(`**${key}:** \`${String(val).substring(0, 120)}\``);
        }
      }
    } else {
      lines.push(`\`${String(data).substring(0, 300)}\``);
    }

    return {
      name: `📄 #${i + 1} — ${r.source}`,
      value: lines.join('\n') || '*Données vides*',
      inline: false
    };
  });

  return { fields, total: results.length };
}

export function exportResults(results, format) {
  if (format === 'json') {
    return {
      content: JSON.stringify(results.map(r => ({ source: r.source, ...r.data })), null, 2),
      filename: `export_${Date.now()}.json`
    };
  } else {
    const lines = results.map(r => {
      const d = r.data;
      const prefix = `[${r.source}]`;
      if (typeof d === 'object' && d !== null) {
        return prefix + ' ' + Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' | ');
      }
      return prefix + ' ' + String(d);
    });
    return {
      content: lines.join('\n'),
      filename: `export_${Date.now()}.txt`
    };
  }
}
