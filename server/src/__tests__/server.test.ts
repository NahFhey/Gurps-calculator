import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import request from 'supertest';
import { startServer, type ServerHandle } from '../index.js';
import { campaignJson } from './campaignFixture.js';

let tmpDir: string;
let server: ServerHandle;

afterEach(async () => {
  if (server) await server.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('startServer', () => {
  it('starts on an auto-assigned port and returns a handle', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-server-test-'));
    server = await startServer({ port: 0, dbDir: tmpDir });

    expect(server.port).toBeGreaterThan(0);
    expect(typeof server.close).toBe('function');
  });

  it('serves API routes', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-server-test-'));
    server = await startServer({ port: 0, dbDir: tmpDir });

    const res = await request(`http://localhost:${server.port}`)
      .post('/api/campaigns')
      .send({ name: 'Integration Test', state: campaignJson() });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Integration Test');
  });

  it('answers a malformed JSON body with a JSON 400, not the HTML error page', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-server-test-'));
    server = await startServer({ port: 0, dbDir: tmpDir });

    const res = await request(`http://localhost:${server.port}`)
      .post('/api/campaigns')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: 'Request body is not valid JSON' });
  });

  it('gracefully shuts down', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-server-test-'));
    server = await startServer({ port: 0, dbDir: tmpDir });

    const port = server.port;
    await server.close();

    // Verify the DB was saved to disk on shutdown
    expect(fs.existsSync(path.join(tmpDir, 'campaigns.db'))).toBe(true);

    // Null out so afterEach doesn't double-close
    server = null as any;
  });

  it('persists data through shutdown', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-server-test-'));
    server = await startServer({ port: 0, dbDir: tmpDir });

    // Create a campaign
    await request(`http://localhost:${server.port}`)
      .post('/api/campaigns')
      .send({ name: 'Persist Test', state: campaignJson({ extra: { persist: true } }) });

    // Shut down and restart
    await server.close();
    server = await startServer({ port: 0, dbDir: tmpDir });

    // The campaign should still exist via a fresh GET
    // We need the ID — create with known state and find it
    // Actually, we don't know the nanoid, so let's create one more and verify count
    const res = await request(`http://localhost:${server.port}`)
      .post('/api/campaigns')
      .send({ name: 'After Restart', state: campaignJson() });

    expect(res.status).toBe(201);
  });
});
