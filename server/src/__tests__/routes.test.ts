import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';
import { initDB, setDataDir, createCampaign, createSession, getCampaign, getDB } from '../db.js';
import { setupRoutes } from '../routes.js';
import { signToken } from '../auth.js';
import { Role } from '../../../shared/session.js';
import { campaignDoc, campaignJson } from './campaignFixture.js';

let tmpDir: string;
let app: express.Express;
let io: SocketServer;
let httpServer: ReturnType<typeof createServer>;

/** Helper: get a valid GM token for a campaign. */
async function gmToken(campaignId: string): Promise<string> {
  return signToken({ campaignId, role: Role.GM, displayName: 'GM' });
}

/** Helper: get a valid player token for a campaign. */
async function playerToken(campaignId: string): Promise<string> {
  return signToken({ campaignId, role: Role.Player, displayName: 'Player' });
}

/** Number of campaign rows (a refused POST must create none). */
function countCampaigns(): number {
  const stmt = getDB().prepare('SELECT COUNT(*) AS n FROM campaigns');
  try {
    stmt.step();
    return Number(stmt.getAsObject().n);
  } finally {
    stmt.free();
  }
}

/** A document with unknown keys at root, slice and nested level, pretty-printed so re-serialization would show. */
const unknownKeysJson = JSON.stringify(campaignDoc({
  extra: {
    futureRoot: { added: 'later', list: [1, 2, 3] },
    ui: { futurePanel: { open: true } },
    entities: { characters: { c1: { id: 'c1', futureField: { nested: ['a', { deeper: null }] } } } },
  },
}), null, 2);

/** A campaign whose meta.schemaVersion is an array nested 20,000 deep: JSON.parse reads it, a recursive JSON.stringify overflows. */
const deepVersionJson = `{"ui":{},"meta":{"schemaVersion":${'['.repeat(20_000)}${']'.repeat(20_000)}},"entities":{},"time":{}}`;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-routes-test-'));
  setDataDir(tmpDir);
  await initDB();

  app = express();
  httpServer = createServer(app);
  io = new SocketServer(httpServer);

  app.use(express.json());
  app.use('/api', setupRoutes(io));
});

afterEach(() => {
  vi.restoreAllMocks();
  io.close();
  httpServer.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns (no auth required — entry point)
// ---------------------------------------------------------------------------
describe('POST /api/campaigns', () => {
  it('creates a campaign and returns 201 with a token', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Test Campaign', state: campaignJson() });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Campaign');
    expect(res.body.version).toBe(1);
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ state: campaignJson() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 400 when state is missing', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'No State' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) when there is no body at all', async () => {
    const res = await request(app).post('/api/campaigns');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
    expect(countCampaigns()).toBe(0);
  });

  it.each([
    ['an object', campaignDoc()],
    ['a number', 42],
    ['an array', [campaignJson()]],
  ])('returns 400 when state is %s', async (_label, state) => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Typed', state });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid state/);
    expect(countCampaigns()).toBe(0);
  });

  it.each([
    ['a number', 42],
    ['empty', ''],
    ['an array', ['Name']],
    ['an object', { first: 'Name' }],
  ])('returns 400 when name is %s', async (_label, name) => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name, state: campaignJson() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid name/);
    expect(countCampaigns()).toBe(0);
  });

  it('returns 422 for a state saved by a newer version, and creates nothing', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Future', state: campaignJson({ schemaVersion: '1.99.0' }) });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: expect.stringMatching(/newer version/), reason: 'future-version' });
    expect(countCampaigns()).toBe(0);
  });

  it('returns 400 JSON (not 500) for a deeply nested schemaVersion, and creates nothing', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Deep', state: deepVersionJson });

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: expect.stringMatching(/^This campaign has a malformed schema version: /), reason: 'malformed-version' });
    expect(countCampaigns()).toBe(0);
  });

  it.each([
    ['malformed-version', campaignJson({ schemaVersion: '1.7' })],
    ['not-json', 'not json {{{'],
    ['not-a-campaign', '{}'],
    ['not-a-campaign', '42'],
  ])('returns 400 with reason %s for a state that is not a readable campaign', async (reason, state) => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Broken', state });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String), reason });
    expect(countCampaigns()).toBe(0);
  });

  it('stores a valid state byte for byte, unknown keys included', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Exact', state: unknownKeysJson });

    expect(res.status).toBe(201);
    expect(getCampaign(res.body.id)!.state_json).toBe(unknownKeysJson);
  });

  it('rejects state larger than 10MB', async () => {
    const bigState = JSON.stringify({ data: 'x'.repeat(11 * 1024 * 1024) });
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Big', state: bigState });

    // Express body-parser rejects before our handler with 413 or our handler catches it
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(413);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:id (requires auth + campaign membership)
// ---------------------------------------------------------------------------
describe('GET /api/campaigns/:id', () => {
  it('returns the campaign with valid auth', async () => {
    createCampaign('get-test', 'Get Test', '{"data":1}');
    const token = await gmToken('get-test');

    const res = await request(app)
      .get('/api/campaigns/get-test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('get-test');
    expect(res.body.name).toBe('Get Test');
    expect(res.body.version).toBe(1);
    expect(res.body.state).toBe('{"data":1}');
    expect(res.body.updatedAt).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    createCampaign('no-auth', 'No Auth', '{}');

    const res = await request(app).get('/api/campaigns/no-auth');

    expect(res.status).toBe(401);
  });

  it('returns 403 when accessing a different campaign', async () => {
    createCampaign('camp-a', 'A', '{}');
    createCampaign('camp-b', 'B', '{}');
    const token = await gmToken('camp-a');

    const res = await request(app)
      .get('/api/campaigns/camp-b')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent campaign', async () => {
    const token = await gmToken('doesnotexist');

    const res = await request(app)
      .get('/api/campaigns/doesnotexist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  describe('player-safe state (review claim D)', () => {
    const gmState = JSON.stringify({
      ui: { activeModule: 'map', gmModeEnabled: true, gmSessionUnlocked: true, pendingIntent: null },
      meta: { schemaVersion: '1.6.5' },
      time: { day: 42 },
      entities: {
        alchemyReagents: { r: { id: 'r', name: 'Grey Dust', quantity: 1, identificationLevel: 0,
          aspects: { primary: 'SECRET-fire' }, notes: 'SECRET note' } },
      },
      checkpoints: { maxSize: 10, entries: [{ id: 'cp', label: 'SECRET', snapshot: {} }] },
      logs: { entries: [
        { id: 'gm', visibility: 'gmOnly', payload: { message: 'SECRET ambush' } },
        { id: 'pub', visibility: 'player', payload: { message: 'The party set out' } },
      ] },
    });

    async function getAs(token: string) {
      return request(app).get('/api/campaigns/vis').set('Authorization', `Bearer ${token}`);
    }

    it('a player receives the projection, not the raw state', async () => {
      createCampaign('vis', 'Visibility', gmState);
      const res = await getAs(await playerToken('vis'));

      expect(res.status).toBe(200);
      expect(res.body.state).not.toContain('SECRET');
      const state = JSON.parse(res.body.state);
      expect(state.ui.gmModeEnabled).toBe(false);
      expect(state.time.day).toBe(42);
      expect(state.entities.alchemyReagents.r.name).toBe('Grey Dust');
      expect(state.logs.entries.map((e: { id: string }) => e.id)).toEqual(['pub']);
    });

    it('a spectator receives the projection too', async () => {
      createCampaign('vis', 'Visibility', gmState);
      const token = await signToken({ campaignId: 'vis', role: Role.Spectator, displayName: 'Watcher' });
      const res = await getAs(token);

      expect(res.status).toBe(200);
      expect(res.body.state).not.toContain('SECRET');
    });

    it('the GM still receives the stored state byte for byte', async () => {
      createCampaign('vis', 'Visibility', gmState);
      const res = await getAs(await gmToken('vis'));

      expect(res.status).toBe(200);
      expect(res.body.state).toBe(gmState);
    });

    it('unparseable stored state is a 500 for players, never the raw text', async () => {
      createCampaign('vis', 'Visibility', '{"SECRET": ');
      const player = await getAs(await playerToken('vis'));
      expect(player.status).toBe(500);
      expect(JSON.stringify(player.body)).not.toContain('SECRET');

      const gm = await getAs(await gmToken('vis'));
      expect(gm.status).toBe(200);
      expect(gm.body.state).toBe('{"SECRET": ');
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/campaigns/:id/state (requires auth + GM role + campaign membership)
// ---------------------------------------------------------------------------
describe('PUT /api/campaigns/:id/state', () => {
  const initial = campaignJson();
  const dayJson = (day: number) => campaignJson({ extra: { time: { day, slot: 0 } } });

  /** PUT as the campaign's GM; with no body argument nothing is sent at all. */
  async function put(id: string, body?: object) {
    const req = request(app)
      .put(`/api/campaigns/${id}/state`)
      .set('Authorization', `Bearer ${await gmToken(id)}`);
    return body === undefined ? req : req.send(body);
  }

  /** The stored row is exactly what it was at creation. */
  function expectUnchanged(id: string) {
    const row = getCampaign(id)!;
    expect(row.version).toBe(1);
    expect(row.state_json).toBe(initial);
  }

  it('updates state and returns new version with GM auth', async () => {
    createCampaign('put-test', 'Put Test', initial);
    const next = dayJson(2);

    const res = await put('put-test', { state: next, expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: 2 });
    expect(getCampaign('put-test')!.state_json).toBe(next);
  });

  it('returns 401 without auth', async () => {
    createCampaign('no-auth-put', 'No Auth', initial);

    const res = await request(app)
      .put('/api/campaigns/no-auth-put/state')
      .send({ state: dayJson(2), expectedVersion: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 403 with player role', async () => {
    createCampaign('player-put', 'Player Put', initial);
    const token = await playerToken('player-put');

    const res = await request(app)
      .put('/api/campaigns/player-put/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: dayJson(2), expectedVersion: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 403 when GM accesses different campaign', async () => {
    createCampaign('gm-camp', 'GM Camp', initial);
    createCampaign('other-camp', 'Other', initial);
    const token = await gmToken('gm-camp');

    const res = await request(app)
      .put('/api/campaigns/other-camp/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: dayJson(2), expectedVersion: 1 });

    expect(res.status).toBe(403);
  });

  it('rejects invalid JSON state', async () => {
    createCampaign('bad-json', 'Bad JSON', initial);

    const res = await put('bad-json', { state: 'not valid json {{{', expectedVersion: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid json/i);
    expect(res.body.reason).toBe('not-json');
    expectUnchanged('bad-json');
  });

  it('emits STATE_UPDATED event to the campaign room', async () => {
    createCampaign('emit-test', 'Emit Test', initial);
    const toSpy = vi.spyOn(io, 'to');

    const res = await put('emit-test', { state: dayJson(2), expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(toSpy).toHaveBeenCalledOnce();
    expect(toSpy).toHaveBeenCalledWith('emit-test');
  });

  it('a second PUT at the same expectedVersion is a 409 with currentVersion; the first write stands and nothing is broadcast', async () => {
    createCampaign('cas', 'CAS', initial);
    const first = dayJson(2);
    const second = dayJson(3);

    const ok = await put('cas', { state: first, expectedVersion: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ version: 2 });

    const toSpy = vi.spyOn(io, 'to');
    const conflict = await put('cas', { state: second, expectedVersion: 1 });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'version-conflict', currentVersion: 2 });
    expect(toSpy).not.toHaveBeenCalled();
    const row = getCampaign('cas')!;
    expect(row.version).toBe(2);
    expect(row.state_json).toBe(first);
  });

  it('returns 400 when expectedVersion is missing', async () => {
    createCampaign('no-ev', 'No Expected Version', initial);

    const res = await put('no-ev', { state: dayJson(2) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Missing expectedVersion/);
    expectUnchanged('no-ev');
  });

  it.each([
    ['a fraction', 1.5],
    ['a numeric string', '1'],
    ['null', null],
    ['a boolean', true],
    ['an array', []],
  ])('returns 400 when expectedVersion is %s', async (_label, expectedVersion) => {
    createCampaign('bad-ev', 'Bad Expected Version', initial);

    const res = await put('bad-ev', { state: dayJson(2), expectedVersion });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid expectedVersion/);
    expectUnchanged('bad-ev');
  });

  it('returns 422 for a state saved by a newer version; version and stored state unchanged', async () => {
    createCampaign('future', 'Future', initial);

    const res = await put('future', { state: campaignJson({ schemaVersion: '1.99.0' }), expectedVersion: 1 });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: expect.stringMatching(/newer version/), reason: 'future-version' });
    expectUnchanged('future');
  });

  it('returns 400 JSON (not 500) for a deeply nested schemaVersion; version and stored state unchanged', async () => {
    createCampaign('deep', 'Deep', initial);

    const res = await put('deep', { state: deepVersionJson, expectedVersion: 1 });

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: expect.stringMatching(/^This campaign has a malformed schema version: /), reason: 'malformed-version' });
    expectUnchanged('deep');
  });

  it.each([
    ['malformed-version', campaignJson({ schemaVersion: '1.7' })],
    ['not-json', 'not json {{{'],
    ['not-a-campaign', '{}'],
    ['not-a-campaign', '42'],
  ])('returns 400 with reason %s for a state that is not a readable campaign', async (reason, state) => {
    createCampaign('malformed', 'Malformed', initial);

    const res = await put('malformed', { state, expectedVersion: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String), reason });
    expectUnchanged('malformed');
  });

  it.each([
    ['no meta', campaignJson({ schemaVersion: null })],
    ['schemaVersion 1.6.5', campaignJson({ schemaVersion: '1.6.5' })],
  ])('accepts a pre-contract state (%s)', async (_label, state) => {
    createCampaign('pre', 'Pre-contract', initial);

    const res = await put('pre', { state, expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: 2 });
    expect(getCampaign('pre')!.state_json).toBe(state);
  });

  it.each([
    ['an object', campaignDoc()],
    ['a number', 42],
    ['an array', [campaignJson()]],
    ['null', null],
  ])('returns 400 when state is %s', async (_label, state) => {
    createCampaign('typed', 'Typed', initial);

    const res = await put('typed', { state, expectedVersion: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid state/);
    expectUnchanged('typed');
  });

  it('returns 400 when state is missing', async () => {
    createCampaign('no-state', 'No State', initial);

    const res = await put('no-state', {});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 400 (not 500) when there is no body at all', async () => {
    createCampaign('no-body', 'No Body', initial);

    const res = await put('no-body');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
    expectUnchanged('no-body');
  });

  it('stores the state byte for byte, unknown keys at three depths included', async () => {
    createCampaign('exact', 'Exact', initial);

    const res = await put('exact', { state: unknownKeysJson, expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(getCampaign('exact')!.state_json).toBe(unknownKeysJson);
    const got = await request(app).get('/api/campaigns/exact').set('Authorization', `Bearer ${await gmToken('exact')}`);
    expect(got.body.state).toBe(unknownKeysJson);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await put('nonexistent', { state: dayJson(2), expectedVersion: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('validates the body before looking up the campaign', async () => {
    const res = await put('nonexistent', { state: campaignJson({ schemaVersion: '1.99.0' }), expectedVersion: 1 });

    expect(res.status).toBe(422);
  });

  it('increments version on successive updates', async () => {
    createCampaign('multi-put', 'Multi Put', initial);

    const res1 = await put('multi-put', { state: dayJson(2), expectedVersion: 1 });
    expect(res1.body).toEqual({ version: 2 });

    const res2 = await put('multi-put', { state: dayJson(3), expectedVersion: 2 });
    expect(res2.body).toEqual({ version: 3 });
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions (requires auth + GM role)
// ---------------------------------------------------------------------------
describe('POST /api/sessions', () => {
  it('creates a session with GM auth', async () => {
    createCampaign('sess-camp', 'Session Campaign', '{}');
    const token = await gmToken('sess-camp');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: 'sess-camp' });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.campaignId).toBe('sess-camp');
    expect(res.body.joinCode).toBeDefined();
    // Join codes are now 10 characters (up from 6)
    expect(res.body.joinCode).toHaveLength(10);
  });

  it('returns 401 without auth', async () => {
    createCampaign('no-auth-sess', 'No Auth', '{}');

    const res = await request(app)
      .post('/api/sessions')
      .send({ campaignId: 'no-auth-sess' });

    expect(res.status).toBe(401);
  });

  it('returns 403 with player role', async () => {
    createCampaign('player-sess', 'Player Sess', '{}');
    const token = await playerToken('player-sess');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: 'player-sess' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when GM creates session for different campaign', async () => {
    createCampaign('my-camp', 'My Camp', '{}');
    createCampaign('not-my-camp', 'Not Mine', '{}');
    const token = await gmToken('my-camp');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: 'not-my-camp' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when campaignId is missing', async () => {
    const token = await gmToken('any-camp');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it.each([
    ['a number', 42],
    ['an array', ['sess-camp']],
    ['an object', { id: 'sess-camp' }],
  ])('returns 400 when campaignId is %s', async (_label, campaignId) => {
    createCampaign('sess-camp', 'Session Campaign', '{}');
    const token = await gmToken('sess-camp');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid campaignId/);
  });

  it('returns 404 when campaign does not exist', async () => {
    const token = await gmToken('nonexistent');

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/join (no auth required — join code is the credential)
// ---------------------------------------------------------------------------
describe('POST /api/sessions/join', () => {
  it('joins a session and returns a player token', async () => {
    createCampaign('join-camp', 'Join Campaign', '{}');
    createSession('join-sess', 'join-camp', 'ABCDEFGHIJ');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'ABCDEFGHIJ', displayName: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('join-sess');
    expect(res.body.campaignId).toBe('join-camp');
    expect(res.body.joinCode).toBe('ABCDEFGHIJ');
    expect(res.body.campaignName).toBe('Join Campaign');
    expect(res.body.version).toBe(1);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('join code is case-insensitive', async () => {
    createCampaign('case-camp', 'Case Campaign', '{}');
    createSession('case-sess', 'case-camp', 'XYZABCDEFG');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'xyzabcdefg' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('case-sess');
  });

  it('returns 400 when joinCode is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/join')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it.each([
    ['a number', 42],
    ['an array', ['ABCDEFGHIJ']],
    ['an object', { code: 'ABCDEFGHIJ' }],
  ])('returns 400 (not 500) when joinCode is %s', async (_label, joinCode) => {
    createCampaign('join-camp', 'Join Campaign', '{}');
    createSession('join-sess', 'join-camp', 'ABCDEFGHIJ');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid joinCode/);
  });

  it('returns 400 when displayName is not a string', async () => {
    createCampaign('join-camp', 'Join Campaign', '{}');
    createSession('join-sess', 'join-camp', 'ABCDEFGHIJ');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'ABCDEFGHIJ', displayName: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid displayName/);
  });

  it('returns 404 for invalid join code', async () => {
    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'BADCODE123' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
