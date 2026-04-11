/**
 * Socket.IO event handlers for real-time communication.
 *
 * Socket.IO is used only for lightweight notifications (state version bumps,
 * player join/leave). Actual state payloads are fetched via HTTP to avoid
 * blocking the event loop with multi-MB WebSocket frames.
 */

import type { Server as SocketServer, Socket } from 'socket.io';
import { EVENTS, type JoinRoomPayload, type PlayerInfo } from '../../shared/protocol.js';

/** Track connected players per campaign room. */
const roomPlayers = new Map<string, Map<string, { displayName: string; role: string }>>();

/** Build a player list payload for a campaign room. */
function getPlayerList(campaignId: string): PlayerInfo[] {
  const players = roomPlayers.get(campaignId);
  if (!players) return [];
  return Array.from(players.entries()).map(([socketId, info]) => ({
    socketId,
    displayName: info.displayName,
    role: info.role as PlayerInfo['role'],
  }));
}

/** Send the current player list to all GM sockets in the room. */
function broadcastPlayerList(io: SocketServer, campaignId: string): void {
  const players = roomPlayers.get(campaignId);
  if (!players) return;
  const list = getPlayerList(campaignId);
  // Send to all clients in the room — clients can filter based on their role
  io.to(campaignId).emit(EVENTS.PLAYER_LIST, { players: list });
}

export function setupSocket(io: SocketServer): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on(EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const { campaignId, role, displayName } = payload;
      if (!campaignId) return;

      // Join the Socket.IO room
      socket.join(campaignId);

      // Track this player
      if (!roomPlayers.has(campaignId)) {
        roomPlayers.set(campaignId, new Map());
      }
      roomPlayers.get(campaignId)!.set(socket.id, { displayName, role });

      const playerCount = roomPlayers.get(campaignId)!.size;

      console.log(`[Socket] ${displayName} (${role}) joined campaign ${campaignId} — ${playerCount} connected`);

      // Confirm to the joining client
      socket.emit(EVENTS.ROOM_JOINED, {
        campaignId,
        playerCount,
      });

      // Notify others in the room
      socket.to(campaignId).emit(EVENTS.PLAYER_JOINED, {
        displayName,
        role,
        playerCount,
      });

      // Broadcast updated player list
      broadcastPlayerList(io, campaignId);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      // Find and clean up from all rooms
      for (const [campaignId, players] of roomPlayers.entries()) {
        const player = players.get(socket.id);
        if (player) {
          players.delete(socket.id);
          const playerCount = players.size;

          // Notify remaining players
          io.to(campaignId).emit(EVENTS.PLAYER_LEFT, {
            displayName: player.displayName,
            playerCount,
          });

          console.log(`[Socket] ${player.displayName} left campaign ${campaignId} — ${playerCount} remaining`);

          // Broadcast updated player list
          broadcastPlayerList(io, campaignId);

          // Clean up empty rooms
          if (players.size === 0) {
            roomPlayers.delete(campaignId);
          }
        }
      }
    });
  });
}
