import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { EVENTS, type PlayerInfo } from '../../../shared/protocol';
import { Role } from '../../../shared/session';

type SocketListener = (...args: unknown[]) => void;

interface MockSocket {
  listeners: Map<string, Set<SocketListener>>;
  on: Mock<(event: string, listener: SocketListener) => MockSocket>;
  off: Mock<(event: string) => MockSocket>;
  emit: Mock<(event: string, payload: unknown) => MockSocket>;
  removeAllListeners: Mock<() => MockSocket>;
  disconnect: Mock<() => MockSocket>;
  trigger: (event: string, ...args: unknown[]) => void;
}

interface SocketOptions {
  transports: string[];
  auth: {
    token: string | null;
  };
}

const { ioMock } = vi.hoisted(() => ({
  ioMock: vi.fn<(options: SocketOptions) => MockSocket>(),
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

import { connectionManager } from '../ConnectionManager';

function makeSocket(): MockSocket {
  const listeners = new Map<string, Set<SocketListener>>();
  const socket: MockSocket = {
    listeners,
    on: vi.fn((event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set<SocketListener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return socket;
    }),
    off: vi.fn((event) => {
      listeners.delete(event);
      return socket;
    }),
    emit: vi.fn(() => socket),
    removeAllListeners: vi.fn(() => {
      listeners.clear();
      return socket;
    }),
    disconnect: vi.fn(() => socket),
    trigger: (event, ...args) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
  return socket;
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = { status: 200 },
): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function campaignResponse(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    id: 'campaign-1',
    name: 'Bridge Ambush',
    state: '{"round":1}',
    version: 4,
    token: 'gm-token',
    ...overrides,
  });
}

function sessionResponse(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    sessionId: 'session-1',
    joinCode: 'ABCD12',
    ...overrides,
  });
}

const cleanupListeners: Array<() => void> = [];
let fetchMock: Mock<typeof fetch>;
let socket: MockSocket;

beforeEach(() => {
  connectionManager.disconnect();
  vi.clearAllMocks();
  cleanupListeners.splice(0).forEach((cleanup) => cleanup());

  socket = makeSocket();
  ioMock.mockReturnValue(socket);
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanupListeners.splice(0).forEach((cleanup) => cleanup());
  connectionManager.disconnect();
  vi.unstubAllGlobals();
});

describe('ConnectionManager REST and socket authentication', () => {
  it('stores the host token for authenticated REST calls and the socket handshake', async () => {
    fetchMock
      .mockResolvedValueOnce(campaignResponse())
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(jsonResponse({ version: 5 }));

    const info = await connectionManager.hostGame(
      'Bridge Ambush',
      '{"round":1}',
      'Morgan',
    );
    const version = await connectionManager.pushState('{"round":2}');

    expect(info).toEqual({
      sessionId: 'session-1',
      campaignId: 'campaign-1',
      joinCode: 'ABCD12',
      role: Role.GM,
    });
    expect(connectionManager.token).toBe('gm-token');
    expect(connectionManager.role).toBe(Role.GM);
    expect(connectionManager.isGM).toBe(true);
    expect(version).toBe(5);
    expect(connectionManager.serverVersion).toBe(5);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/sessions',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer gm-token',
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/campaigns/campaign-1/state',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer gm-token',
        },
      }),
    );
    expect(ioMock).toHaveBeenCalledWith({
      transports: ['websocket', 'polling'],
      auth: { token: 'gm-token' },
    });

    socket.trigger('connect');

    expect(connectionManager.status).toBe('connected');
    expect(connectionManager.isConnected).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith(EVENTS.JOIN_ROOM, {
      campaignId: 'campaign-1',
      role: Role.GM,
      displayName: 'Morgan',
    });
  });

  it('stores a joined player token before fetching state and connecting the socket', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'player-token',
          sessionId: 'session-2',
          campaignId: 'campaign-2',
          joinCode: 'PLAY12',
          version: 7,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          state: '{"round":7}',
          version: 8,
        }),
      );

    const result = await connectionManager.joinGame('PLAY12', 'Riley');

    expect(result).toEqual({
      sessionInfo: {
        sessionId: 'session-2',
        campaignId: 'campaign-2',
        joinCode: 'PLAY12',
        role: Role.Player,
      },
      stateJson: '{"round":7}',
    });
    expect(connectionManager.token).toBe('player-token');
    expect(connectionManager.displayName).toBe('Riley');
    expect(connectionManager.campaignId).toBe('campaign-2');
    expect(connectionManager.sessionInfo).toEqual(result.sessionInfo);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/campaigns/campaign-2',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer player-token',
        },
      },
    );
    expect(ioMock).toHaveBeenCalledWith({
      transports: ['websocket', 'polling'],
      auth: { token: 'player-token' },
    });
  });
});

describe('ConnectionManager listener lifecycle', () => {
  it('calls off before on and keeps one listener per event after reconnecting', async () => {
    fetchMock
      .mockResolvedValueOnce(campaignResponse())
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        campaignResponse({
          id: 'campaign-2',
          token: 'replacement-token',
          version: 10,
        }),
      )
      .mockResolvedValueOnce(
        sessionResponse({
          sessionId: 'session-2',
          joinCode: 'EFGH34',
        }),
      );
    const stateUpdated = vi.fn();
    cleanupListeners.push(connectionManager.onStateUpdated(stateUpdated));

    await connectionManager.hostGame('First', '{}');
    await connectionManager.hostGame('Second', '{}');

    const registeredEvents = [
      'connect',
      'disconnect',
      'connect_error',
      EVENTS.STATE_UPDATED,
      EVENTS.ROOM_JOINED,
      EVENTS.PLAYER_JOINED,
      EVENTS.PLAYER_LEFT,
      EVENTS.PLAYER_LIST,
    ];
    for (const event of registeredEvents) {
      let lastOffIndex = -1;
      socket.off.mock.calls.forEach(([calledEvent], index) => {
        if (calledEvent === event) lastOffIndex = index;
      });
      let lastOnIndex = -1;
      socket.on.mock.calls.forEach(([calledEvent], index) => {
        if (calledEvent === event) lastOnIndex = index;
      });

      expect(lastOffIndex).toBeGreaterThanOrEqual(0);
      expect(lastOnIndex).toBeGreaterThanOrEqual(0);
      expect(socket.off.mock.invocationCallOrder[lastOffIndex]).toBeLessThan(
        socket.on.mock.invocationCallOrder[lastOnIndex],
      );
      expect(socket.listeners.get(event)?.size).toBe(1);
    }
    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();

    socket.trigger(EVENTS.STATE_UPDATED, {
      version: 11,
      updatedAt: '2026-07-27T12:00:00.000Z',
    });

    expect(stateUpdated).toHaveBeenCalledOnce();
    expect(connectionManager.serverVersion).toBe(11);
  });

  it('publishes socket state and clears connection state and handlers on disconnect', async () => {
    fetchMock
      .mockResolvedValueOnce(campaignResponse())
      .mockResolvedValueOnce(sessionResponse());
    const statusChanged = vi.fn();
    const playerCountChanged = vi.fn();
    const playerListChanged = vi.fn();
    const players: PlayerInfo[] = [
      {
        socketId: 'socket-player',
        displayName: 'Riley',
        role: Role.Player,
      },
    ];
    cleanupListeners.push(
      connectionManager.onStatusChange(statusChanged),
      connectionManager.onPlayerCountChange(playerCountChanged),
      connectionManager.onPlayerListChange(playerListChanged),
    );
    await connectionManager.hostGame('Bridge Ambush', '{}');

    socket.trigger(EVENTS.ROOM_JOINED, {
      campaignId: 'campaign-1',
      playerCount: 2,
    });
    socket.trigger(EVENTS.PLAYER_LIST, { players });

    expect(connectionManager.playerCount).toBe(2);
    expect(connectionManager.playerList).toEqual(players);
    expect(playerCountChanged).toHaveBeenLastCalledWith(2);
    expect(playerListChanged).toHaveBeenLastCalledWith(players);

    connectionManager.disconnect();

    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socket.listeners.size).toBe(0);
    expect(connectionManager.status).toBe('offline');
    expect(connectionManager.isConnected).toBe(false);
    expect(connectionManager.role).toBeNull();
    expect(connectionManager.campaignId).toBeNull();
    expect(connectionManager.sessionInfo).toBeNull();
    expect(connectionManager.serverVersion).toBe(0);
    expect(connectionManager.playerCount).toBe(0);
    expect(connectionManager.playerList).toEqual([]);
    expect(connectionManager.displayName).toBeNull();
    expect(connectionManager.token).toBeNull();
    expect(statusChanged).toHaveBeenLastCalledWith('offline');
    expect(playerCountChanged).toHaveBeenLastCalledWith(0);
    expect(playerListChanged).toHaveBeenLastCalledWith([]);
  });
});

describe('ConnectionManager errors', () => {
  it('rejects an invalid join code with the documented error and error status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: 'not found' },
        {
          status: 404,
          statusText: 'Not Found',
        },
      ),
    );

    await expect(
      connectionManager.joinGame('BADCODE', 'Riley'),
    ).rejects.toThrow('Invalid or expired join code');

    expect(connectionManager.status).toBe('error');
    expect(connectionManager.token).toBeNull();
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('rejects state operations when no campaign is connected', async () => {
    await expect(connectionManager.fetchState()).rejects.toThrow(
      'No campaign ID',
    );
    await expect(connectionManager.pushState('{}')).rejects.toThrow(
      'Not connected to a campaign',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ConnectionManager asset transport', () => {
  it('uses campaign auth for uploads, downloads and inventory', async () => {
    const id = 'a'.repeat(64);
    const bytes = new Uint8Array([0, 255, 42]);
    fetchMock.mockResolvedValueOnce(campaignResponse()).mockResolvedValueOnce(sessionResponse());
    await connectionManager.hostGame('Assets', '{}');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id, size: 3, created: true }, { status: 201 }))
      .mockResolvedValueOnce(new Response(bytes.buffer, { headers: { 'Content-Type': 'image/webp' } }))
      .mockResolvedValueOnce(jsonResponse({ assets: [{ id, mime: 'image/webp', size: 3 }] }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await connectionManager.uploadAsset(id, bytes, 'image/webp')).toEqual({ created: true });
    expect(fetchMock).toHaveBeenNthCalledWith(3, `/api/campaigns/campaign-1/assets/${id}`, {
      method: 'PUT', headers: { Authorization: 'Bearer gm-token', 'Content-Type': 'image/webp' }, body: bytes.buffer,
    });
    expect(await connectionManager.fetchAsset(id)).toEqual({ bytes, mime: 'image/webp' });
    expect(fetchMock).toHaveBeenNthCalledWith(4, `/api/campaigns/campaign-1/assets/${id}`, {
      headers: { Authorization: 'Bearer gm-token', 'Content-Type': 'application/json' },
    });
    expect(await connectionManager.listRemoteAssets()).toEqual([{ id, mime: 'image/webp', size: 3 }]);
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/campaigns/campaign-1/assets', {
      headers: { Authorization: 'Bearer gm-token', 'Content-Type': 'application/json' },
    });
    expect(await connectionManager.fetchAsset(id)).toBeNull();
  });

  it('rejects disconnected operations and HTTP failures other than a download 404', async () => {
    const id = 'b'.repeat(64);
    const bytes = new Uint8Array([1]);
    await expect(connectionManager.uploadAsset(id, bytes, 'image/png')).rejects.toThrow('Not connected');
    await expect(connectionManager.fetchAsset(id)).rejects.toThrow('Not connected');
    await expect(connectionManager.listRemoteAssets()).rejects.toThrow('Not connected');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(campaignResponse()).mockResolvedValueOnce(sessionResponse());
    await connectionManager.hostGame('Assets', '{}');
    fetchMock.mockResolvedValue(new Response(null, { status: 403, statusText: 'Forbidden' }));
    await expect(connectionManager.uploadAsset(id, bytes, 'image/png')).rejects.toThrow('Forbidden');
    await expect(connectionManager.fetchAsset(id)).rejects.toThrow('Forbidden');
    await expect(connectionManager.listRemoteAssets()).rejects.toThrow('Forbidden');
  });
});
