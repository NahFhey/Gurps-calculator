/**
 * REST API routes for campaign and session management.
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import type { Server as SocketServer } from 'socket.io';
import {
  createCampaign,
  getCampaign,
  updateCampaignState,
  createSession,
  getSessionByJoinCode,
} from './db.js';
import { EVENTS } from '../../shared/protocol.js';

export function setupRoutes(io: SocketServer): Router {
  const router = Router();

  // ---------------------------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------------------------

  /**
   * POST /api/campaigns — Create a new campaign.
   * Body: { name: string, state: string (JSON) }
   */
  router.post('/campaigns', (req, res) => {
    const { name, state } = req.body;
    if (!name || !state) {
      res.status(400).json({ error: 'Missing name or state' });
      return;
    }

    const id = nanoid(12);
    const campaign = createCampaign(id, name, state);

    res.status(201).json({
      id: campaign.id,
      name: campaign.name,
      version: campaign.version,
      createdAt: campaign.created_at,
    });
  });

  /**
   * GET /api/campaigns/:id — Get campaign state and metadata.
   */
  router.get('/campaigns/:id', (req, res) => {
    const campaign = getCampaign(req.params.id);
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
   * PUT /api/campaigns/:id/state — Update campaign state (GM only for now).
   * Body: { state: string (JSON) }
   */
  router.put('/campaigns/:id/state', (req, res) => {
    const { state } = req.body;
    if (!state) {
      res.status(400).json({ error: 'Missing state' });
      return;
    }

    const campaign = getCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const newVersion = updateCampaignState(req.params.id, state);

    // Notify all clients in the campaign room
    io.to(req.params.id).emit(EVENTS.STATE_UPDATED, {
      version: newVersion,
      updatedAt: new Date().toISOString(),
    });

    res.json({ version: newVersion });
  });

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /**
   * POST /api/sessions — Create a session for a campaign.
   * Body: { campaignId: string }
   */
  router.post('/sessions', (req, res) => {
    const { campaignId } = req.body;
    if (!campaignId) {
      res.status(400).json({ error: 'Missing campaignId' });
      return;
    }

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const id = nanoid(12);
    const joinCode = nanoid(6).toUpperCase();
    const session = createSession(id, campaignId, joinCode);

    res.status(201).json({
      sessionId: session.id,
      campaignId: session.campaign_id,
      joinCode: session.join_code,
    });
  });

  /**
   * POST /api/sessions/join — Join a session by code.
   * Body: { joinCode: string }
   */
  router.post('/sessions/join', (req, res) => {
    const { joinCode } = req.body;
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

    res.json({
      sessionId: session.id,
      campaignId: session.campaign_id,
      joinCode: session.join_code,
      campaignName: campaign.name,
      version: campaign.version,
    });
  });

  return router;
}
