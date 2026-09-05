import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { setupApiMiddleware } from '../index.js';
import { MAX_ASSET_SIZE, MAX_CAMPAIGN_ASSET_TOTAL, setupRoutes } from '../routes.js';
import { createCampaign, getAssetMeta, getCampaignAssetTotal, getDB, initDB, listAssets, putAsset, readAssetBytes, saveDB, setDataDir } from '../db.js';
import { signToken } from '../auth.js';
import { Role } from '../../../shared/session.js';
import { campaignAssetPath, campaignAssetsPath } from '../../../shared/protocol.js';

const bytes = Buffer.from([137, 80, 78, 71, 0, 255, 1, 2]);
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const id = hash(bytes);
let tmpDir: string;
let app: express.Express;
let io: SocketServer;
let gm: string;
let player: string;
let other: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-assets-test-'));
  setDataDir(tmpDir);
  await initDB();
  createCampaign('camp-a', 'A', '{}');
  createCampaign('camp-b', 'B', '{}');
  gm = await signToken({ campaignId: 'camp-a', role: Role.GM, displayName: 'GM' });
  player = await signToken({ campaignId: 'camp-a', role: Role.Player, displayName: 'Player' });
  other = await signToken({ campaignId: 'camp-b', role: Role.Player, displayName: 'Other' });
  app = express();
  io = new SocketServer(createServer(app));
  setupApiMiddleware(app);
  app.use('/api', setupRoutes(io));
});

afterEach(() => {
  vi.restoreAllMocks();
  io.close();
  getDB().close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function upload(value = bytes, assetId = hash(value), mime = 'image/png', token = gm) {
  return request(app).put(campaignAssetPath('camp-a', assetId))
    .set('Authorization', `Bearer ${token}`).set('Content-Type', mime).send(value);
}

describe('campaign assets', () => {
  it('stores bytes in the configured directory and is idempotent', async () => {
    expect((await upload()).status).toBe(201);
    const meta = getAssetMeta('camp-a', id);
    expect(meta).toEqual({ mime: 'image/png', size: bytes.length, createdAt: expect.any(String) });
    const again = await upload();
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id, size: bytes.length, created: false });
    expect(getAssetMeta('camp-a', id)).toEqual(meta);
    expect(getCampaignAssetTotal('camp-a')).toBe(bytes.length);
    const dir = path.join(tmpDir, 'assets', 'camp-a');
    expect(fs.readdirSync(dir)).toEqual([id]);
    expect(fs.readFileSync(path.join(dir, id))).toEqual(bytes);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', async (mime) => {
    const response = await upload(bytes, id, mime);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id, size: bytes.length, created: true });
  });

  it('rejects hash mismatches', async () => {
    expect((await upload(bytes, '0'.repeat(64))).status).toBe(400);
    expect(listAssets('camp-a')).toEqual([]);
  });

  it.each(['image/svg+xml', 'application/json'])('rejects unsupported MIME %s before parsing the body', async (mime) => {
    expect((await upload(bytes, id, mime)).status).toBe(415);
  });

  it('rejects bodies larger than 8 MiB', async () => {
    const oversize = await upload(Buffer.alloc(MAX_ASSET_SIZE + 1));
    expect(oversize.status).toBe(413);
    expect(oversize.body).toEqual({ error: 'Asset exceeds size limit' });
    expect(listAssets('camp-a')).toEqual([]);
  });

  it('accepts the per-asset boundary', async () => {
    expect((await upload(Buffer.alloc(MAX_ASSET_SIZE))).status).toBe(201);
  });

  it('enforces the campaign total while permitting existing assets at capacity', async () => {
    await upload();
    // Seed metadata near the quota without allocating 256 MiB for this test.
    getDB().run('UPDATE assets SET size = ? WHERE campaign_id = ?', [MAX_CAMPAIGN_ASSET_TOTAL - 1, 'camp-a']);
    expect((await upload(Buffer.from([42]))).status).toBe(201);
    expect(getCampaignAssetTotal('camp-a')).toBe(MAX_CAMPAIGN_ASSET_TOTAL);
    expect((await upload(Buffer.from([43]))).status).toBe(413);
    expect((await upload()).status).toBe(200);
  });

  it('requires authentication and the GM role for upload', async () => {
    expect((await upload(bytes, id, 'image/png', player)).status).toBe(403);
    expect((await request(app).put(campaignAssetPath('camp-a', id)).set('Content-Type', 'image/png').send(bytes)).status).toBe(401);
    expect(listAssets('camp-a')).toEqual([]);
  });

  it('serves bytes and immutable private headers to a player, including HEAD', async () => {
    await upload();
    const response = await request(app).get(campaignAssetPath('camp-a', id)).set('Authorization', `Bearer ${player}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(bytes);
    const head = await request(app).head(campaignAssetPath('camp-a', id)).set('Authorization', `Bearer ${player}`);
    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    for (const result of [response, head]) {
      expect(result.headers['content-type']).toBe('image/png');
      expect(result.headers['content-length']).toBe(String(bytes.length));
      expect(result.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    }
  });

  it('returns 404 for unknown assets and lists campaign metadata', async () => {
    for (const method of ['get', 'head'] as const) {
      expect((await request(app)[method](campaignAssetPath('camp-a', id)).set('Authorization', `Bearer ${player}`)).status).toBe(404);
    }
    await upload();
    const response = await request(app).get(campaignAssetsPath('camp-a')).set('Authorization', `Bearer ${player}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ assets: [{ id, mime: 'image/png', size: bytes.length }] });
  });

  it('isolates campaigns for byte reads, HEAD, inventory, and writes', async () => {
    await upload();
    for (const method of ['get', 'head'] as const) {
      expect((await request(app)[method](campaignAssetPath('camp-a', id)).set('Authorization', `Bearer ${other}`)).status).toBe(403);
    }
    expect((await request(app).get(campaignAssetsPath('camp-a')).set('Authorization', `Bearer ${other}`)).status).toBe(403);
    expect((await request(app).get(campaignAssetPath('camp-b', id)).set('Authorization', `Bearer ${other}`)).status).toBe(404);
    const otherGM = await signToken({ campaignId: 'camp-b', role: Role.GM, displayName: 'GM' });
    expect((await upload(bytes, id, 'image/png', otherGM)).status).toBe(403);
  });

  it.each(['invalid', 'A'.repeat(64), '../escape', 'a'.repeat(63)])('rejects invalid id %s without filesystem access', async (invalid) => {
    const reads = vi.spyOn(fs, 'readFileSync');
    const writes = vi.spyOn(fs, 'writeFileSync');
    const mkdir = vi.spyOn(fs, 'mkdirSync');
    const rename = vi.spyOn(fs, 'renameSync');
    const exists = vi.spyOn(fs, 'existsSync');
    expect((await upload(bytes, invalid)).status).toBe(400);
    for (const method of ['get', 'head'] as const) {
      expect((await request(app)[method](campaignAssetPath('camp-a', invalid)).set('Authorization', `Bearer ${player}`)).status).toBe(400);
    }
    for (const spy of [reads, writes, mkdir, rename, exists]) expect(spy).not.toHaveBeenCalled();
  });

  it('validates database helper path inputs even when called directly', () => {
    createCampaign('../escape', 'Unsafe old row', '{}');
    const writes = vi.spyOn(fs, 'writeFileSync');
    const reads = vi.spyOn(fs, 'readFileSync');
    for (const campaign of ['unknown', '../escape']) {
      expect(() => putAsset(campaign, id, 'image/png', bytes)).toThrow('Invalid asset campaign');
      expect(() => readAssetBytes(campaign, id)).toThrow('Invalid asset campaign');
      expect(() => listAssets(campaign)).toThrow('Invalid asset campaign');
    }
    expect(() => putAsset('camp-a', '../escape', 'image/png', bytes)).toThrow('Invalid asset id');
    expect(writes).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
  });

  it('writes helper bytes atomically, deduplicates metadata, and isolates campaign totals', () => {
    const write = vi.spyOn(fs, 'writeFileSync');
    const rename = vi.spyOn(fs, 'renameSync');
    expect(putAsset('camp-a', id, 'image/png', bytes)).toEqual({ created: true });
    const file = path.join(tmpDir, 'assets', 'camp-a', id);
    expect(write).toHaveBeenCalledWith(file + '.tmp', bytes);
    expect(rename).toHaveBeenCalledWith(file + '.tmp', file);
    const meta = getAssetMeta('camp-a', id);
    expect(meta).toEqual({ mime: 'image/png', size: bytes.length, createdAt: expect.any(String) });
    expect(putAsset('camp-a', id, 'image/webp', bytes)).toEqual({ created: false });
    expect(getAssetMeta('camp-a', id)).toEqual(meta);
    expect(readAssetBytes('camp-a', id)).toEqual(bytes);
    expect(readAssetBytes('camp-b', id)).toBeNull();
    expect(getCampaignAssetTotal('camp-a')).toBe(bytes.length);
    expect(getCampaignAssetTotal('camp-b')).toBe(0);
    expect(fs.readdirSync(path.dirname(file))).toEqual([id]);
  });

  it('creates the asset table when opening a pre-asset database and persists metadata', async () => {
    getDB().run('DROP TABLE assets');
    saveDB();
    getDB().close();
    await initDB();
    expect(putAsset('camp-a', id, 'image/png', bytes)).toEqual({ created: true });
    getDB().close();
    await initDB();
    expect(readAssetBytes('camp-a', id)).toEqual(bytes);
    expect(listAssets('camp-a')).toEqual([{ id, mime: 'image/png', size: bytes.length }]);
  });

  it('gives assets a 600/min budget separate from the general 100/min budget', async () => {
    for (let count = 0; count < 101; count++) {
      const response = await request(app).get(campaignAssetsPath('camp-a')).set('Authorization', `Bearer ${player}`);
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('600');
    }
    const general = await request(app).get('/api/campaigns/camp-a').set('Authorization', `Bearer ${player}`);
    expect(general.status).toBe(200);
    expect(general.headers['ratelimit-limit']).toBe('100');
    expect(general.headers['ratelimit-remaining']).toBe('99');
  });
});
