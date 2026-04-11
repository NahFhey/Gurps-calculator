/**
 * Socket.IO protocol — event names and payload types shared between client and server.
 */

import type { Role } from './session.js';

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
} as const;

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface JoinRoomPayload {
  campaignId: string;
  role: Role;
  displayName: string;
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
