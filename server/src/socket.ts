/**
 * Socket.IO event handlers for real-time communication.
 *
 * Socket.IO is used only for lightweight notifications (state version bumps,
 * player join/leave). Actual state payloads are fetched via HTTP to avoid
 * blocking the event loop with multi-MB WebSocket frames.
 *
 * Auth: Clients must provide a valid JWT in the Socket.IO `auth` handshake.
 * The server verifies the token on connection and uses it for room joining.
 */

import type { Server as SocketServer, Socket } from 'socket.io';
import { EVENTS, type JoinRoomPayload, type PlayerInfo } from '../../shared/protocol.js';
import { verifyToken, type TokenPayload } from './auth.js';

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

/** Send the current player list to all sockets in the room. */
function broadcastPlayerList(io: SocketServer, campaignId: string): void {
  const players = roomPlayers.get(campaignId);
  if (!players) return;
  const list = getPlayerList(campaignId);
  io.to(campaignId).emit(EVENTS.PLAYER_LIST, { players: list });
}

export function setupSocket(io: SocketServer): void {
  // ---------------------------------------------------------------------------
  // Socket.IO auth middleware — verify JWT before allowing connection
  // ---------------------------------------------------------------------------
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    // Attach verified payload to socket data for later use
    socket.data.auth = payload;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const auth = socket.data.auth as TokenPayload;
    console.log(`[Socket] Client connected: ${socket.id} (${auth.displayName}, ${auth.role})`);

    socket.on(EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const { campaignId } = payload;
      if (!campaignId) return;

      // Verify the client is joining the campaign they're authenticated for
      if (campaignId !== auth.campaignId) {
        socket.emit('error', { message: 'Cannot join a campaign you are not authenticated for' });
        return;
      }

      // Use the role and displayName from the verified token, not from the client payload
      const role = auth.role;
      const displayName = auth.displayName;

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
