/**
 * REST API routes for campaign and session management.
 *
 * Auth flow:
 *   - POST /campaigns (create) → returns JWT (role=gm) — no auth required
 *   - POST /sessions (create session) → requires GM auth
 *   - POST /sessions/join → returns JWT (role=player) — no auth required (join code is the credential)
 *   - GET /campaigns/:id → requires auth + campaign membership
 *   - PUT /campaigns/:id/state → requires auth + GM role + campaign membership
 */

import { Router, raw } from 'express';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { createHash } from 'node:crypto';

/** Extract a single string param (Express 5 params can be string | string[]). */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}
import { nanoid } from 'nanoid';
import type { Server as SocketServer } from 'socket.io';
import {
  createCampaign,
  getCampaign,
  updateCampaignState,
  createSession,
  getSessionByJoinCode,
  getAssetMeta,
  getCampaignAssetTotal,
  isValidAssetId,
  listAssets,
  putAsset,
  readAssetBytes,
} from './db.js';
import { signToken, authMiddleware, requireRole, requireCampaignAccess } from './auth.js';
import { Role } from '../../shared/session.js';
import { ASSET_ROUTES, EVENTS } from '../../shared/protocol.js';
import type { AssetListResponse, AssetUploadResponse } from '../../shared/protocol.js';

/** Maximum state payload size in bytes (10 MB). */
const MAX_STATE_SIZE = 10 * 1024 * 1024;
export const MAX_ASSET_SIZE = 8 * 1024 * 1024;
export const MAX_CAMPAIGN_ASSET_TOTAL = 256 * 1024 * 1024;

const validateAssetRequest: RequestHandler = (req, res, next) => {
  if (req.params.assetId !== undefined && !isValidAssetId(param(req, 'assetId'))) {
    res.status(400).json({ error: 'Invalid asset id' });
    return;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(param(req, 'id'))) {
    res.status(400).json({ error: 'Invalid campaign id' });
    return;
  }
  if (!getCampaign(param(req, 'id'))) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  next();
};

export function setupRoutes(io: SocketServer): Router {
  const router = Router();

  router.put(ASSET_ROUTES.item, authMiddleware, requireRole(Role.GM), requireCampaignAccess,
    validateAssetRequest,
    (req: Request, res: Response, next: NextFunction) => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(req.get('Content-Type') ?? '')) {
        res.status(415).json({ error: 'Unsupported asset mime type' });
        return;
      }
      next();
    },
    raw({ type: () => true, limit: MAX_ASSET_SIZE }),
    (req: Request, res: Response<AssetUploadResponse | { error: string }>) => {
      const id = param(req, 'assetId');
      const campaignId = param(req, 'id');
      const bytes: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (createHash('sha256').update(bytes).digest('hex') !== id) {
        res.status(400).json({ error: 'Asset hash mismatch' });
        return;
      }
      const existing = getAssetMeta(campaignId, id);
      if (!existing && getCampaignAssetTotal(campaignId) + bytes.byteLength > MAX_CAMPAIGN_ASSET_TOTAL) {
        res.status(413).json({ error: 'Campaign asset storage limit exceeded' });
        return;
      }
      const { created } = putAsset(campaignId, id, req.get('Content-Type')!, bytes);
      res.status(created ? 201 : 200).json({ id, size: existing?.size ?? bytes.byteLength, created });
    });

  const sendAsset: RequestHandler = (req, res) => {
    const campaignId = param(req, 'id');
    const id = param(req, 'assetId');
    const meta = getAssetMeta(campaignId, id);
    const bytes = meta ? readAssetBytes(campaignId, id) : null;
    if (!meta || !bytes) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.set({
      'Content-Type': meta.mime,
      'Content-Length': String(meta.size),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.send(Buffer.from(bytes));
  };
  router.head(ASSET_ROUTES.item, authMiddleware, requireCampaignAccess, validateAssetRequest, sendAsset);
  router.get(ASSET_ROUTES.item, authMiddleware, requireCampaignAccess, validateAssetRequest, sendAsset);
  router.get(ASSET_ROUTES.list, authMiddleware, requireCampaignAccess, validateAssetRequest,
    (req: Request, res: Response<AssetListResponse>) => {
      res.json({ assets: listAssets(param(req, 'id')) });
    });

  // ---------------------------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------------------------

  /**
   * POST /api/campaigns — Create a new campaign.
   * Body: { name: string, state: string (JSON) }
   * Returns a JWT with role=gm.
   * No auth required — this is the entry point for GMs.
   */
  router.post('/campaigns', async (req: Request, res: Response) => {
    const { name, state } = req.body;
    if (!name || !state) {
      res.status(400).json({ error: 'Missing name or state' });
      return;
    }

    // Validate payload size
    if (typeof state === 'string' && Buffer.byteLength(state, 'utf8') > MAX_STATE_SIZE) {
      res.status(413).json({ error: `State payload exceeds ${MAX_STATE_SIZE / 1024 / 1024}MB limit` });
      return;
    }

    const id = nanoid(12);
    const campaign = createCampaign(id, name, state);

    // Sign a GM token for the creator
    const token = await signToken({
      campaignId: campaign.id,
      role: Role.GM,
      displayName: 'GM',
    });

    res.status(201).json({
      id: campaign.id,
      name: campaign.name,
      version: campaign.version,
      createdAt: campaign.created_at,
      token,
    });
  });

  /**
   * GET /api/campaigns/:id — Get campaign state and metadata.
   * Requires: auth + campaign membership.
   */
  router.get('/campaigns/:id', authMiddleware, requireCampaignAccess, (req: Request, res: Response) => {
    const campaign = getCampaign(param(req, 'id'));
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({
      id: campaign.id,
      name: campaign.name,
      version: campaign.version,
      state: campaign.state_json,
      updatedAt: campaign.updated_at,
    });
  });

  /**
   * PUT /api/campaigns/:id/state — Update campaign state.
   * Requires: auth + GM role + campaign membership.
   * Body: { state: string (JSON) }
   */
  router.put(
    '/campaigns/:id/state',
    authMiddleware,
    requireRole(Role.GM),
    requireCampaignAccess,
    (req: Request, res: Response) => {
      const { state } = req.body;
      if (!state) {
        res.status(400).json({ error: 'Missing state' });
        return;
      }

      // Validate payload size
      if (typeof state === 'string' && Buffer.byteLength(state, 'utf8') > MAX_STATE_SIZE) {
        res.status(413).json({ error: `State payload exceeds ${MAX_STATE_SIZE / 1024 / 1024}MB limit` });
        return;
      }

      // Validate state is parseable JSON
      try {
        JSON.parse(state);
      } catch {
        res.status(400).json({ error: 'State is not valid JSON' });
        return;
      }

      const campaign = getCampaign(param(req, 'id'));
      if (!campaign) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      const newVersion = updateCampaignState(param(req, 'id'), state);

      // Notify all clients in the campaign room
      io.to(param(req, 'id')).emit(EVENTS.STATE_UPDATED, {
        version: newVersion,
        updatedAt: new Date().toISOString(),
      });

      res.json({ version: newVersion });
    },
  );

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /**
   * POST /api/sessions — Create a session for a campaign.
   * Requires: auth + GM role.
   * Body: { campaignId: string }
   */
  router.post('/sessions', authMiddleware, requireRole(Role.GM), async (req: Request, res: Response) => {
    const { campaignId } = req.body;
    if (!campaignId) {
      res.status(400).json({ error: 'Missing campaignId' });
      return;
    }

    // GM must be creating a session for their own campaign
    if (req.auth!.campaignId !== campaignId) {
      res.status(403).json({ error: 'Cannot create session for a different campaign' });
      return;
    }

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const id = nanoid(12);
    // 10-character join code (up from 6) for brute-force resistance
    const joinCode = nanoid(10).toUpperCase();
    const session = createSession(id, campaignId, joinCode);

    res.status(201).json({
      sessionId: session.id,
      campaignId: session.campaign_id,
      joinCode: session.join_code,
    });
  });

  /**
   * POST /api/sessions/join — Join a session by code.
   * Body: { joinCode: string, displayName?: string }
   * Returns a JWT with role=player.
   * No auth required — the join code is the credential.
   */
  router.post('/sessions/join', async (req: Request, res: Response) => {
    const { joinCode, displayName } = req.body;
    if (!joinCode) {
      res.status(400).json({ error: 'Missing joinCode' });
      return;
    }

    const session = getSessionByJoinCode(joinCode.toUpperCase());
    if (!session) {
      res.status(404).json({ error: 'Invalid or expired join code' });
      return;
    }

    const campaign = getCampaign(session.campaign_id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const playerName = displayName || 'Player';

    // Sign a player token
    const token = await signToken({
      campaignId: session.campaign_id,
      role: Role.Player,
      displayName: playerName,
    });

    res.json({
      sessionId: session.id,
      campaignId: session.campaign_id,
      joinCode: session.join_code,
      campaignName: campaign.name,
      version: campaign.version,
      token,
    });
  });

  // Body-parser rejections (e.g. express.raw over MAX_ASSET_SIZE) must keep the JSON error contract.
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const type = typeof err === 'object' && err !== null && 'type' in err ? (err as { type?: string }).type : undefined;
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'Asset exceeds size limit' });
      return;
    }
    next(err);
  });
  return router;
}
