import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';
import { initDB, setDataDir, createCampaign, createSession } from '../db.js';
import { setupRoutes } from '../routes.js';
import { signToken } from '../auth.js';
import { Role } from '../../../shared/session.js';

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
      .send({ name: 'Test Campaign', state: '{"foo":"bar"}' });

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
      .send({ state: '{}' });

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
});

// ---------------------------------------------------------------------------
// PUT /api/campaigns/:id/state (requires auth + GM role + campaign membership)
// ---------------------------------------------------------------------------
describe('PUT /api/campaigns/:id/state', () => {
  it('updates state and returns new version with GM auth', async () => {
    createCampaign('put-test', 'Put Test', '{"v":1}');
    const token = await gmToken('put-test');

    const res = await request(app)
      .put('/api/campaigns/put-test/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"v":2}' });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });

  it('returns 401 without auth', async () => {
    createCampaign('no-auth-put', 'No Auth', '{}');

    const res = await request(app)
      .put('/api/campaigns/no-auth-put/state')
      .send({ state: '{}' });

    expect(res.status).toBe(401);
  });

  it('returns 403 with player role', async () => {
    createCampaign('player-put', 'Player Put', '{}');
    const token = await playerToken('player-put');

    const res = await request(app)
      .put('/api/campaigns/player-put/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"hacked":true}' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when GM accesses different campaign', async () => {
    createCampaign('gm-camp', 'GM Camp', '{}');
    createCampaign('other-camp', 'Other', '{}');
    const token = await gmToken('gm-camp');

    const res = await request(app)
      .put('/api/campaigns/other-camp/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"cross":true}' });

    expect(res.status).toBe(403);
  });

  it('rejects invalid JSON state', async () => {
    createCampaign('bad-json', 'Bad JSON', '{}');
    const token = await gmToken('bad-json');

    const res = await request(app)
      .put('/api/campaigns/bad-json/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'not valid json {{{' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid json/i);
  });

  it('emits STATE_UPDATED event to the campaign room', async () => {
    createCampaign('emit-test', 'Emit Test', '{}');
    const token = await gmToken('emit-test');

    const emitSpy = vi.spyOn(io, 'to');

    await request(app)
      .put('/api/campaigns/emit-test/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"updated":true}' });

    expect(emitSpy).toHaveBeenCalledWith('emit-test');
  });

  it('returns 400 when state is missing', async () => {
    createCampaign('no-state', 'No State', '{}');
    const token = await gmToken('no-state');

    const res = await request(app)
      .put('/api/campaigns/no-state/state')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 404 for non-existent campaign', async () => {
    const token = await gmToken('nonexistent');

    const res = await request(app)
      .put('/api/campaigns/nonexistent/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{}' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('increments version on successive updates', async () => {
    createCampaign('multi-put', 'Multi Put', '{}');
    const token = await gmToken('multi-put');

    const res1 = await request(app)
      .put('/api/campaigns/multi-put/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"v":2}' });
    expect(res1.body.version).toBe(2);

    const res2 = await request(app)
      .put('/api/campaigns/multi-put/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: '{"v":3}' });
    expect(res2.body.version).toBe(3);
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

  it('returns 404 for invalid join code', async () => {
    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'BADCODE123' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
