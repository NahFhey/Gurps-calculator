/**
 * SQLite database layer via sql.js (pure JS, no native deps).
 *
 * Stores campaigns and sessions. Campaign state is stored as an opaque
 * JSON string — the server does not need to understand its structure.
 */

// The ambient types for sql.js; referenced here so any program that reaches
// this file (the root tsc does, through serverIntegration.test.ts) loads them.
/// <reference path="./sql-js.d.ts" />
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import type { AssetMeta } from '../../shared/protocol.js';

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

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      campaign_id TEXT NOT NULL,
      id TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  `);

  // Persist on init
  saveDB();

  return db;
}

/**
 * Persist the in-memory database to disk using atomic write.
 *
 * Writes to a temporary file first, then renames over the target.
 * This prevents corruption if the process crashes mid-write, since
 * rename() is atomic on most filesystems.
 */
export function saveDB(): void {
  if (!db) return;
  const data = db.export();
  const tmpPath = DB_PATH + '.tmp';
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, DB_PATH);
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

/** Columns read one by one (sql.js rows are untyped records); every campaign column is NOT NULL. */
function readCampaignRow(row: Record<string, SqlValue>): CampaignRow {
  return {
    id: String(row.id),
    name: String(row.name),
    state_json: String(row.state_json),
    version: Number(row.version),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
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
    const row = readCampaignRow(stmt.getAsObject());
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export type UpdateStateResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'version-conflict'; currentVersion: number }
  | { ok: false; reason: 'not-found' };

/**
 * Compare-and-swap the campaign state: the write lands only while the stored
 * version equals `expectedVersion`. sql.js is single-threaded, so the one
 * UPDATE is atomic; `getRowsModified()` must read it before any other statement.
 * A refused write touches neither the row nor the file on disk.
 */
export function updateCampaignState(id: string, stateJson: string, expectedVersion: number): UpdateStateResult {
  db.run(
    `UPDATE campaigns SET state_json = ?, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ?`,
    [stateJson, id, expectedVersion]
  );
  if (db.getRowsModified() === 1) {
    saveDB();
    return { ok: true, version: expectedVersion + 1 };
  }
  const current = getCampaign(id);
  return current
    ? { ok: false, reason: 'version-conflict', currentVersion: current.version }
    : { ok: false, reason: 'not-found' };
}

export function isValidAssetId(id: string): boolean {
  return /^[a-f0-9]{64}$/.test(id);
}

function validateAssetCampaign(campaignId: string): void {
  // Campaign ids normally come from nanoid; also reject unsafe existing row ids.
  if (!/^[A-Za-z0-9_-]+$/.test(campaignId) || !getCampaign(campaignId)) {
    throw new Error('Invalid asset campaign');
  }
}

function validateAssetKey(campaignId: string, id: string): void {
  if (!isValidAssetId(id)) throw new Error('Invalid asset id');
  validateAssetCampaign(campaignId);
}

export function getAssetMeta(campaignId: string, id: string): Omit<AssetMeta, 'id'> & { createdAt: string } | null {
  validateAssetKey(campaignId, id);
  const stmt = db.prepare('SELECT mime, size, created_at AS createdAt FROM assets WHERE campaign_id = ? AND id = ?');
  try {
    stmt.bind([campaignId, id]);
    if (!stmt.step()) return null;
    const row = stmt.getAsObject();
    return { mime: String(row.mime), size: Number(row.size), createdAt: String(row.createdAt) };
  } finally {
    stmt.free();
  }
}

export function putAsset(campaignId: string, id: string, mime: string, bytes: Uint8Array): { created: boolean } {
  validateAssetKey(campaignId, id);
  if (getAssetMeta(campaignId, id)) return { created: false };
  const dir = path.join(DATA_DIR, 'assets', campaignId);
  const file = path.join(dir, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file + '.tmp', bytes);
  fs.renameSync(file + '.tmp', file);
  db.run('INSERT INTO assets (campaign_id, id, mime, size, created_at) VALUES (?, ?, ?, ?, ?)',
    [campaignId, id, mime, bytes.byteLength, new Date().toISOString()]);
  saveDB();
  return { created: true };
}

export function readAssetBytes(campaignId: string, id: string): Uint8Array | null {
  if (!getAssetMeta(campaignId, id)) return null;
  // getAssetMeta validates both path components before any filesystem access.
  const file = path.join(DATA_DIR, 'assets', campaignId, id);
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export function listAssets(campaignId: string): AssetMeta[] {
  validateAssetCampaign(campaignId);
  const stmt = db.prepare('SELECT id, mime, size FROM assets WHERE campaign_id = ? ORDER BY id');
  const assets: AssetMeta[] = [];
  try {
    stmt.bind([campaignId]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      assets.push({ id: String(row.id), mime: String(row.mime), size: Number(row.size) });
    }
    return assets;
  } finally {
    stmt.free();
  }
}

export function getCampaignAssetTotal(campaignId: string): number {
  validateAssetCampaign(campaignId);
  const stmt = db.prepare('SELECT COALESCE(SUM(size), 0) AS total FROM assets WHERE campaign_id = ?');
  try {
    stmt.bind([campaignId]);
    return stmt.step() ? Number(stmt.getAsObject().total) : 0;
  } finally {
    stmt.free();
  }
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

/** Columns read one by one; every session column is NOT NULL. */
function readSessionRow(row: Record<string, SqlValue>): SessionRow {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    join_code: String(row.join_code),
    is_active: Number(row.is_active),
    created_at: String(row.created_at),
  };
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
    const row = readSessionRow(stmt.getAsObject());
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
    const row = readSessionRow(stmt.getAsObject());
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}
