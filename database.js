import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'bot.db');

mkdirSync(DATA_DIR, { recursive: true });

let db;

export function initDB() {
  db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      credits INTEGER DEFAULT 5,
      max_daily_credits INTEGER DEFAULT 5,
      plan TEXT DEFAULT 'free',
      blacklisted INTEGER DEFAULT 0,
      last_claim TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      query TEXT,
      search_type TEXT,
      timestamp TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
    );

    CREATE TABLE IF NOT EXISTS databases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      filename TEXT,
      description TEXT,
      added_by TEXT,
      added_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
      entry_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plans (
      role_id TEXT PRIMARY KEY,
      plan_name TEXT,
      daily_credits INTEGER,
      unlimited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS temp_results (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      results TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
    );

    CREATE TABLE IF NOT EXISTS custom_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT UNIQUE,
      label TEXT,
      description TEXT,
      emoji TEXT,
      modal_label TEXT,
      modal_placeholder TEXT,
      modal_hint TEXT,
      vip_only INTEGER DEFAULT 0,
      position INTEGER DEFAULT 99,
      added_by TEXT,
      added_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
    );
  `);

  console.log('[DB] Database initialized at', DB_PATH);
  return db;
}

export function getDB() {
  if (!db) initDB();
  return db;
}
