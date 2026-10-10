/**
 * JSON body errors: `express.json` runs at app level (setupApiMiddleware), so
 * its parse and size errors never reach the router's own error handler.
 * `apiErrorHandler` keeps them on the `{ error }` JSON contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { apiErrorHandler, setupApiMiddleware } from '../index.js';
import { setupRoutes } from '../routes.js';
import { getDB, initDB, setDataDir } from '../db.js';
import { campaignJson } from './campaignFixture.js';

let tmpDir: string;
let app: express.Express;
let io: SocketServer;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-api-errors-test-'));
  setDataDir(tmpDir);
  await initDB();
  app = express();
  io = new SocketServer(createServer(app));
  setupApiMiddleware(app);
  app.use('/api', setupRoutes(io));
  app.use('/api', apiErrorHandler);
});

afterEach(() => {
  io.close();
  getDB().close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('JSON body errors', () => {
  it('a malformed JSON body is a 400 with a JSON error, not the HTML error page', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: 'Request body is not valid JSON' });
  });

  it('a JSON body over the size limit is a 413 with a JSON error', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Big', state: campaignJson({ extra: { padding: 'x'.repeat(11 * 1024 * 1024) } }) });

    expect(res.status).toBe(413);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: 'Request body exceeds the size limit' });
  });
});

describe('other errors under /api', () => {
  it('a JSON body in an unsupported charset is a 415 with a JSON error', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"name":"x","state":"{}"}');

    expect(res.status).toBe(415);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: expect.stringMatching(/charset/i) });
  });

  /** A tiny app with the production middleware and handler around routes that fail on purpose. */
  function failingApp(): express.Express {
    const tiny = express();
    setupApiMiddleware(tiny);
    tiny.get('/api/boom', () => {
      throw new Error('kaboom: secret detail at /home/someone/app.ts');
    });
    tiny.get('/api/teapot-hidden', () => {
      throw Object.assign(new Error('internal teapot detail'), { status: 418, expose: false });
    });
    tiny.get('/api/teapot-shown', () => {
      throw Object.assign(new Error('I am a teapot'), { statusCode: 418, expose: true });
    });
    tiny.use('/api', apiErrorHandler);
    return tiny;
  }

  it('an unexpected error is a 500 JSON body with no message or stack, and is logged', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(failingApp()).get('/api/boom');

      expect(res.status).toBe(500);
      expect(res.type).toBe('application/json');
      expect(res.body).toEqual({ error: 'Internal server error' });
      expect(res.text).not.toMatch(/Error|kaboom|\/home\/|at /);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  it('a 4xx http error keeps its status; its message is shown only when it is marked expose', async () => {
    const hidden = await request(failingApp()).get('/api/teapot-hidden');
    expect(hidden.status).toBe(418);
    expect(hidden.type).toBe('application/json');
    expect(hidden.body).toEqual({ error: 'Bad request' });

    const shown = await request(failingApp()).get('/api/teapot-shown');
    expect(shown.status).toBe(418);
    expect(shown.body).toEqual({ error: 'I am a teapot' });
  });
});
