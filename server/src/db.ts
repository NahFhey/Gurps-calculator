/**
 * SQLite database layer via sql.js (pure JS, no native deps).
 *
 * Stores campaigns and sessions. Campaign state is stored as an opaque
 * JSON string — the server does not need to understand its structure.
 */

import initSqlJs, { type Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

// When compiled, db.js lives at server/dist/server/src/db.js
// When run via tsx (dev), import.meta.dirname is server/src/
const defaultDataDir = import.meta.dirname.includes('dist')
  ? path.join(import.meta.dirname, '../../../../data')
  : path.join(import.meta.dirname, '../../data');
let DATA_DIR = process.env.DB_DIR || defaultDataDir;
let DB_PATH = path.join(DATA_DIR, 'campaigns.db');

/**
 * Override the data directory (call before initDB).
 * Used by Electron to redirect storage to app.getPath('userData').
 */
export function setDataDir(dir: string): void {
  DATA_DIR = dir;
  DB_PATH = path.join(dir, 'campaigns.db');
}

let db: Database;

/**
 * Initialize the database. Must be called before any queries.
 */
export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs();

  // Load existing DB file or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new SQL.Database();
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  `);

  // Persist on init
  saveDB();

  return db;
}

/**
 * Persist the in-memory database to disk.
 * sql.js operates in-memory — we must manually write to file.
 */
export function saveDB(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Get the database instance.
 */
export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

// ---------------------------------------------------------------------------
// Campaign queries
// ---------------------------------------------------------------------------

export interface CampaignRow {
  id: string;
  name: string;
  state_json: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export function createCampaign(id: string, name: string, stateJson: string): CampaignRow {
  db.run(
    `INSERT INTO campaigns (id, name, state_json) VALUES (?, ?, ?)`,
    [id, name, stateJson]
  );
  saveDB();
  return getCampaign(id)!;
}

export function getCampaign(id: string): CampaignRow | null {
  const stmt = db.prepare(`SELECT * FROM campaigns WHERE id = ?`);
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as CampaignRow;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function updateCampaignState(id: string, stateJson: string): number {
  db.run(
    `UPDATE campaigns SET state_json = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
    [stateJson, id]
  );
  saveDB();
  const campaign = getCampaign(id);
  return campaign?.version ?? 0;
}

// ---------------------------------------------------------------------------
// Session queries
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  campaign_id: string;
  join_code: string;
  is_active: number;
  created_at: string;
}

export function createSession(id: string, campaignId: string, joinCode: string): SessionRow {
  db.run(
    `INSERT INTO sessions (id, campaign_id, join_code) VALUES (?, ?, ?)`,
    [id, campaignId, joinCode]
  );
  saveDB();
  return getSession(id)!;
}

export function getSession(id: string): SessionRow | null {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SessionRow;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function getSessionByJoinCode(joinCode: string): SessionRow | null {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE join_code = ? AND is_active = 1`);
  stmt.bind([joinCode]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SessionRow;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}
