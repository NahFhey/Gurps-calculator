import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDB,
  saveDB,
  getDB,
  setDataDir,
  createCampaign,
  getCampaign,
  updateCampaignState,
  createSession,
  getSession,
  getSessionByJoinCode,
} from '../db.js';

let tmpDir: string;

beforeEach(async () => {
  // Use a fresh temp directory for each test
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-db-test-'));
  setDataDir(tmpDir);
  await initDB();
});

afterEach(() => {
  // Clean up temp directory
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Database initialization', () => {
  it('creates the database file on disk', () => {
    expect(fs.existsSync(path.join(tmpDir, 'campaigns.db'))).toBe(true);
  });

  it('creates campaigns and sessions tables', () => {
    const db = getDB();
    // Query sqlite_master for table names
    const stmt = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('campaigns', 'sessions') ORDER BY name`
    );
    const tables: string[] = [];
    while (stmt.step()) {
      tables.push(stmt.getAsObject().name as string);
    }
    stmt.free();
    expect(tables).toEqual(['campaigns', 'sessions']);
  });

  it('can reinitialize from an existing database file', async () => {
    createCampaign('c1', 'Test Campaign', '{}');

    // Re-init from the saved file
    await initDB();

    const campaign = getCampaign('c1');
    expect(campaign).not.toBeNull();
    expect(campaign!.name).toBe('Test Campaign');
  });
});

describe('getDB', () => {
  it('returns the database instance after init', () => {
    const db = getDB();
    expect(db).toBeDefined();
  });
});

describe('saveDB', () => {
  it('persists data to disk', () => {
    createCampaign('save-test', 'Save Test', '{"a":1}');
    saveDB();

    const fileSize = fs.statSync(path.join(tmpDir, 'campaigns.db')).size;
    expect(fileSize).toBeGreaterThan(0);
  });
});

describe('Campaign CRUD', () => {
  it('creates a campaign and returns it', () => {
    const campaign = createCampaign('c1', 'My Campaign', '{"state":true}');

    expect(campaign.id).toBe('c1');
    expect(campaign.name).toBe('My Campaign');
    expect(campaign.state_json).toBe('{"state":true}');
    expect(campaign.version).toBe(1);
    expect(campaign.created_at).toBeDefined();
    expect(campaign.updated_at).toBeDefined();
  });

  it('getCampaign returns the campaign by id', () => {
    createCampaign('c2', 'Another', '{}');
    const result = getCampaign('c2');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('c2');
    expect(result!.name).toBe('Another');
  });

  it('getCampaign returns null for non-existent id', () => {
    expect(getCampaign('nonexistent')).toBeNull();
  });

  it('updateCampaignState at the current version bumps it and returns the new one', () => {
    createCampaign('c3', 'Versioned', '{"v":1}');

    expect(updateCampaignState('c3', '{"v":2}', 1)).toEqual({ ok: true, version: 2 });
    expect(updateCampaignState('c3', '{"v":3}', 2)).toEqual({ ok: true, version: 3 });

    const row = getCampaign('c3')!;
    expect(row.version).toBe(3);
    expect(row.state_json).toBe('{"v":3}');
  });

  it('updateCampaignState persists a successful write to disk', async () => {
    createCampaign('c4', 'Stateful', '{"old":true}');
    expect(updateCampaignState('c4', '{"new":true}', 1)).toEqual({ ok: true, version: 2 });

    await initDB();

    const campaign = getCampaign('c4')!;
    expect(campaign.state_json).toBe('{"new":true}');
    expect(campaign.version).toBe(2);
  });

  it('updateCampaignState at a stale version is a conflict that changes nothing, in memory or on disk', async () => {
    createCampaign('c5', 'Contested', '{"v":1}');
    expect(updateCampaignState('c5', '{"v":2}', 1)).toEqual({ ok: true, version: 2 });
    getDB().run(`UPDATE campaigns SET updated_at = '2000-01-01 00:00:00' WHERE id = 'c5'`);
    saveDB();
    const dbFile = path.join(tmpDir, 'campaigns.db');
    const bytesBefore = fs.readFileSync(dbFile);
    const statBefore = fs.statSync(dbFile);
    // An in-memory change that is NOT saved: if the conflict path saved the
    // database, this row would reach the disk with it.
    getDB().run(`INSERT INTO campaigns (id, name, state_json) VALUES ('unsaved', 'Unsaved', '{}')`);

    expect(updateCampaignState('c5', '{"stale":true}', 1)).toEqual({
      ok: false,
      reason: 'version-conflict',
      currentVersion: 2,
    });

    const row = getCampaign('c5')!;
    expect(row.version).toBe(2);
    expect(row.state_json).toBe('{"v":2}');
    expect(row.updated_at).toBe('2000-01-01 00:00:00');
    expect(fs.readFileSync(dbFile).equals(bytesBefore)).toBe(true);
    const statAfter = fs.statSync(dbFile);
    expect(statAfter.ino).toBe(statBefore.ino);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);

    await initDB();
    expect(getCampaign('unsaved')).toBeNull();
    const reread = getCampaign('c5')!;
    expect(reread.version).toBe(2);
    expect(reread.state_json).toBe('{"v":2}');
    expect(reread.updated_at).toBe('2000-01-01 00:00:00');
  });

  it('updateCampaignState at a version ahead of the row is a conflict too', () => {
    createCampaign('c6', 'Ahead', '{"v":1}');

    expect(updateCampaignState('c6', '{"v":9}', 5)).toEqual({
      ok: false,
      reason: 'version-conflict',
      currentVersion: 1,
    });
    expect(getCampaign('c6')!.state_json).toBe('{"v":1}');
  });

  it('updateCampaignState on an unknown id is not-found', () => {
    expect(updateCampaignState('nonexistent', '{}', 1)).toEqual({ ok: false, reason: 'not-found' });
    expect(getCampaign('nonexistent')).toBeNull();
  });

  it('reads every campaign column with its SQL type', () => {
    createCampaign('typed', 'Typed', '{"t":1}');
    const row = getCampaign('typed')!;

    expect(Object.keys(row).sort()).toEqual(['created_at', 'id', 'name', 'state_json', 'updated_at', 'version']);
    expect(typeof row.version).toBe('number');
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(row.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('handles large state JSON', () => {
    const largeState = JSON.stringify({ data: 'x'.repeat(100_000) });
    createCampaign('big', 'Big Campaign', largeState);

    const campaign = getCampaign('big');
    expect(campaign!.state_json).toBe(largeState);
  });
});

describe('Session CRUD', () => {
  beforeEach(() => {
    // Sessions need a campaign due to foreign key
    createCampaign('camp1', 'Campaign for Sessions', '{}');
  });

  it('creates a session and returns it', () => {
    const session = createSession('s1', 'camp1', 'ABC123');

    expect(session.id).toBe('s1');
    expect(session.campaign_id).toBe('camp1');
    expect(session.join_code).toBe('ABC123');
    expect(session.is_active).toBe(1);
    expect(session.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(Object.keys(session).sort()).toEqual(['campaign_id', 'created_at', 'id', 'is_active', 'join_code']);
  });

  it('getSession returns the session by id', () => {
    createSession('s2', 'camp1', 'DEF456');
    const result = getSession('s2');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('s2');
  });

  it('getSession returns null for non-existent id', () => {
    expect(getSession('nonexistent')).toBeNull();
  });

  it('getSessionByJoinCode finds active session', () => {
    createSession('s3', 'camp1', 'GHI789');
    const result = getSessionByJoinCode('GHI789');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('s3');
    expect(result!.campaign_id).toBe('camp1');
  });

  it('getSessionByJoinCode returns null for unknown code', () => {
    expect(getSessionByJoinCode('XXXXXX')).toBeNull();
  });

  it('enforces unique join codes', () => {
    createSession('s4', 'camp1', 'UNIQUE1');
    expect(() => createSession('s5', 'camp1', 'UNIQUE1')).toThrow();
  });
});
