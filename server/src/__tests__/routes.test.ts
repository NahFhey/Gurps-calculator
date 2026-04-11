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

let tmpDir: string;
let app: express.Express;
let io: SocketServer;
let httpServer: ReturnType<typeof createServer>;

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
// POST /api/campaigns
// ---------------------------------------------------------------------------
describe('POST /api/campaigns', () => {
  it('creates a campaign and returns 201', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Test Campaign', state: '{"foo":"bar"}' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Campaign');
    expect(res.body.version).toBe(1);
    expect(res.body.createdAt).toBeDefined();
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
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:id
// ---------------------------------------------------------------------------
describe('GET /api/campaigns/:id', () => {
  it('returns the campaign', async () => {
    createCampaign('get-test', 'Get Test', '{"data":1}');

    const res = await request(app).get('/api/campaigns/get-test');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('get-test');
    expect(res.body.name).toBe('Get Test');
    expect(res.body.version).toBe(1);
    expect(res.body.state).toBe('{"data":1}');
    expect(res.body.updatedAt).toBeDefined();
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app).get('/api/campaigns/doesnotexist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/campaigns/:id/state
// ---------------------------------------------------------------------------
describe('PUT /api/campaigns/:id/state', () => {
  it('updates state and returns new version', async () => {
    createCampaign('put-test', 'Put Test', '{"v":1}');

    const res = await request(app)
      .put('/api/campaigns/put-test/state')
      .send({ state: '{"v":2}' });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });

  it('emits STATE_UPDATED event to the campaign room', async () => {
    createCampaign('emit-test', 'Emit Test', '{}');

    const emitSpy = vi.spyOn(io, 'to');

    await request(app)
      .put('/api/campaigns/emit-test/state')
      .send({ state: '{"updated":true}' });

    expect(emitSpy).toHaveBeenCalledWith('emit-test');
  });

  it('returns 400 when state is missing', async () => {
    createCampaign('no-state', 'No State', '{}');

    const res = await request(app)
      .put('/api/campaigns/no-state/state')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app)
      .put('/api/campaigns/nonexistent/state')
      .send({ state: '{}' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('increments version on successive updates', async () => {
    createCampaign('multi-put', 'Multi Put', '{}');

    const res1 = await request(app)
      .put('/api/campaigns/multi-put/state')
      .send({ state: '{"v":2}' });
    expect(res1.body.version).toBe(2);

    const res2 = await request(app)
      .put('/api/campaigns/multi-put/state')
      .send({ state: '{"v":3}' });
    expect(res2.body.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------
describe('POST /api/sessions', () => {
  it('creates a session for an existing campaign', async () => {
    createCampaign('sess-camp', 'Session Campaign', '{}');

    const res = await request(app)
      .post('/api/sessions')
      .send({ campaignId: 'sess-camp' });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.campaignId).toBe('sess-camp');
    expect(res.body.joinCode).toBeDefined();
    expect(res.body.joinCode).toHaveLength(6);
  });

  it('returns 400 when campaignId is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('returns 404 when campaign does not exist', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ campaignId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/join
// ---------------------------------------------------------------------------
describe('POST /api/sessions/join', () => {
  it('joins a session by join code', async () => {
    createCampaign('join-camp', 'Join Campaign', '{}');
    createSession('join-sess', 'join-camp', 'ABCDEF');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'ABCDEF' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('join-sess');
    expect(res.body.campaignId).toBe('join-camp');
    expect(res.body.joinCode).toBe('ABCDEF');
    expect(res.body.campaignName).toBe('Join Campaign');
    expect(res.body.version).toBe(1);
  });

  it('join code is case-insensitive', async () => {
    createCampaign('case-camp', 'Case Campaign', '{}');
    createSession('case-sess', 'case-camp', 'XYZABC');

    const res = await request(app)
      .post('/api/sessions/join')
      .send({ joinCode: 'xyzabc' });

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
      .send({ joinCode: 'BADCODE' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
