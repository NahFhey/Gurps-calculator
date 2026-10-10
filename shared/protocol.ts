/**
 * Wire protocol shared between client and server: REST request/response
 * contracts, Socket.IO event names and payload types.
 *
 * Request bodies and the room-join payload are zod schemas, so the server
 * parses what crosses the boundary instead of trusting it
 * (docs/TYPED_BOUNDARIES_PLAN.md §2.4). Schemas are loose: unknown keys pass.
 */

import { z } from 'zod';
import { Role } from './session.js';

/** Paths relative to the /api router. */
export const ASSET_ROUTES = {
  list: '/campaigns/:id/assets',
  item: '/campaigns/:id/assets/:assetId',
} as const;

export function campaignAssetsPath(campaignId: string): string {
  return `/api${ASSET_ROUTES.list.replace(':id', encodeURIComponent(campaignId))}`;
}

export function campaignAssetPath(campaignId: string, assetId: string): string {
  return `${campaignAssetsPath(campaignId)}/${encodeURIComponent(assetId)}`;
}

export interface AssetMeta {
  id: string;
  mime: string;
  size: number;
}

export interface AssetUploadResponse {
  id: string;
  size: number;
  created: boolean;
}

export interface AssetListResponse {
  assets: AssetMeta[];
}

// ---------------------------------------------------------------------------
// REST contracts
// ---------------------------------------------------------------------------

/** Every error response body carries at least this. */
export interface ErrorResponse {
  error: string;
}

/** POST /api/campaigns. `state` is the campaign JSON as a string, stored byte for byte. */
export const CreateCampaignRequestSchema = z.looseObject({
  name: z.string().min(1),
  state: z.string(),
});
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

/** PUT /api/campaigns/:id/state. The write succeeds only while the stored version equals `expectedVersion`. */
export const UpdateStateRequestSchema = z.looseObject({
  state: z.string(),
  expectedVersion: z.number().int(),
});
export type UpdateStateRequest = z.infer<typeof UpdateStateRequestSchema>;

/** POST /api/sessions (GM only; must be the GM's own campaign). */
export const CreateSessionRequestSchema = z.looseObject({
  campaignId: z.string().min(1),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

/** POST /api/sessions/join. The join code is matched case-insensitively. */
export const JoinSessionRequestSchema = z.looseObject({
  joinCode: z.string().min(1),
  displayName: z.string().optional(),
});
export type JoinSessionRequest = z.infer<typeof JoinSessionRequestSchema>;

/** The `error` tag of a 409 from PUT /api/campaigns/:id/state. */
export const VERSION_CONFLICT = 'version-conflict';

/** 409 body: the write lost the compare-and-swap; `currentVersion` is what the server holds now. */
export const VersionConflictResponseSchema = z.object({
  error: z.literal(VERSION_CONFLICT),
  currentVersion: z.number().int(),
});
export type VersionConflictResponse = z.infer<typeof VersionConflictResponseSchema>;

/** 200 body of PUT /api/campaigns/:id/state. */
export const UpdateStateResponseSchema = z.looseObject({
  version: z.number().int(),
});
export type UpdateStateResponse = z.infer<typeof UpdateStateResponseSchema>;

/** Outcome of a client state push: the new version, or the server's version after a conflict. */
export type PushStateResult = { ok: true; version: number } | { ok: false; currentVersion: number };

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

export const EVENTS = {
  /** Client → Server: join a campaign room */
  JOIN_ROOM: 'room:join',
  /** Server → Client: confirm room joined */
  ROOM_JOINED: 'room:joined',
  /** Server → Room: campaign state was updated */
  STATE_UPDATED: 'state:updated',
  /** Server → Room: a player connected */
  PLAYER_JOINED: 'player:joined',
  /** Server → Room: a player disconnected */
  PLAYER_LEFT: 'player:left',
  /** Server → Room: current player count */
  PLAYER_COUNT: 'player:count',
  /** Server → GM: full player list */
  PLAYER_LIST: 'player:list',
  /** Server → Client: a request on this socket was refused (bad payload, wrong campaign) */
  ERROR: 'error',
} as const;

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

/**
 * Client → Server room join. The server takes role and display name from the
 * verified token, so both are optional here; when present they must be well-typed.
 */
export const JoinRoomPayloadSchema = z.looseObject({
  campaignId: z.string().min(1),
  role: z.enum(Role).optional(),
  displayName: z.string().optional(),
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export interface ErrorPayload {
  message: string;
}

export interface RoomJoinedPayload {
  campaignId: string;
  playerCount: number;
}

export interface StateUpdatedPayload {
  version: number;
  updatedAt: string;
}

export interface PlayerJoinedPayload {
  displayName: string;
  role: Role;
  playerCount: number;
}

export interface PlayerLeftPayload {
  displayName: string;
  playerCount: number;
}

export interface PlayerCountPayload {
  count: number;
}

export interface PlayerInfo {
  socketId: string;
  displayName: string;
  role: Role;
}

export interface PlayerListPayload {
  players: PlayerInfo[];
}
