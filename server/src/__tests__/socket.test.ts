import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { setupSocket } from '../socket.js';
import { EVENTS } from '../../../shared/protocol.js';

let httpServer: ReturnType<typeof createServer>;
let io: SocketServer;
let port: number;

function connectClient(): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });
}

function waitForEvent<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (data: T) => resolve(data));
  });
}

beforeEach(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer();
      io = new SocketServer(httpServer, { cors: { origin: '*' } });
      setupSocket(io);

      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    })
);

afterEach(
  () =>
    new Promise<void>((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    })
);

describe('Socket connection', () => {
  it('accepts a client connection', async () => {
    const client = connectClient();
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe('JOIN_ROOM', () => {
  it('confirms room join with ROOM_JOINED event', async () => {
    const client = connectClient();
    await waitForEvent(client, 'connect');

    const joinPromise = waitForEvent<{ campaignId: string; playerCount: number }>(
      client,
      EVENTS.ROOM_JOINED
    );

    client.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-1',
      role: 'gm',
      displayName: 'GM Alice',
    });

    const data = await joinPromise;
    expect(data.campaignId).toBe('camp-1');
    expect(data.playerCount).toBe(1);

    client.disconnect();
  });

  it('sends PLAYER_LIST after join', async () => {
    const client = connectClient();
    await waitForEvent(client, 'connect');

    const listPromise = waitForEvent<{ players: Array<{ displayName: string; role: string }> }>(
      client,
      EVENTS.PLAYER_LIST
    );

    client.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-list',
      role: 'gm',
      displayName: 'GM Bob',
    });

    const data = await listPromise;
    expect(data.players).toHaveLength(1);
    expect(data.players[0].displayName).toBe('GM Bob');
    expect(data.players[0].role).toBe('gm');

    client.disconnect();
  });

  it('notifies existing clients when a new player joins', async () => {
    const client1 = connectClient();
    await waitForEvent(client1, 'connect');

    // Client 1 joins
    client1.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-notify',
      role: 'gm',
      displayName: 'GM',
    });
    await waitForEvent(client1, EVENTS.ROOM_JOINED);

    // Set up listener for PLAYER_JOINED on client1
    const joinedPromise = waitForEvent<{ displayName: string; role: string; playerCount: number }>(
      client1,
      EVENTS.PLAYER_JOINED
    );

    // Client 2 joins same room
    const client2 = connectClient();
    await waitForEvent(client2, 'connect');
    client2.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-notify',
      role: 'player',
      displayName: 'Player1',
    });

    const data = await joinedPromise;
    expect(data.displayName).toBe('Player1');
    expect(data.role).toBe('player');
    expect(data.playerCount).toBe(2);

    client1.disconnect();
    client2.disconnect();
  });

  it('ignores JOIN_ROOM with no campaignId', async () => {
    const client = connectClient();
    await waitForEvent(client, 'connect');

    // Send bad payload — should not crash or emit ROOM_JOINED
    client.emit(EVENTS.JOIN_ROOM, { role: 'gm', displayName: 'Bad' });

    // Wait a short time; if ROOM_JOINED fires, the test fails
    const result = await Promise.race([
      waitForEvent(client, EVENTS.ROOM_JOINED).then(() => 'joined'),
      new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 500)),
    ]);

    expect(result).toBe('timeout');
    client.disconnect();
  });
});

describe('Disconnect', () => {
  it('sends PLAYER_LEFT when a player disconnects', async () => {
    const client1 = connectClient();
    const client2 = connectClient();
    await Promise.all([
      waitForEvent(client1, 'connect'),
      waitForEvent(client2, 'connect'),
    ]);

    // Both join the same room
    client1.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-dc',
      role: 'gm',
      displayName: 'GM',
    });
    await waitForEvent(client1, EVENTS.ROOM_JOINED);

    client2.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-dc',
      role: 'player',
      displayName: 'Leaver',
    });
    await waitForEvent(client2, EVENTS.ROOM_JOINED);

    // Listen for PLAYER_LEFT on client1
    const leftPromise = waitForEvent<{ displayName: string; playerCount: number }>(
      client1,
      EVENTS.PLAYER_LEFT
    );

    // Client2 disconnects
    client2.disconnect();

    const data = await leftPromise;
    expect(data.displayName).toBe('Leaver');
    expect(data.playerCount).toBe(1);

    client1.disconnect();
  });

  it('sends updated PLAYER_LIST after disconnect', async () => {
    const client1 = connectClient();
    const client2 = connectClient();
    await Promise.all([
      waitForEvent(client1, 'connect'),
      waitForEvent(client2, 'connect'),
    ]);

    client1.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-dclist',
      role: 'gm',
      displayName: 'GM',
    });
    await waitForEvent(client1, EVENTS.ROOM_JOINED);

    client2.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-dclist',
      role: 'player',
      displayName: 'Player2',
    });
    await waitForEvent(client2, EVENTS.ROOM_JOINED);

    // Consume any PLAYER_LIST events from joining before setting up our listener
    await waitForEvent(client1, EVENTS.PLAYER_LIST);

    const listPromise = waitForEvent<{ players: Array<{ displayName: string }> }>(
      client1,
      EVENTS.PLAYER_LIST
    );

    client2.disconnect();

    const data = await listPromise;
    expect(data.players).toHaveLength(1);
    expect(data.players[0].displayName).toBe('GM');

    client1.disconnect();
  });
});

describe('Multi-room isolation', () => {
  it('players in different rooms do not receive each others events', async () => {
    const clientA = connectClient();
    const clientB = connectClient();
    await Promise.all([
      waitForEvent(clientA, 'connect'),
      waitForEvent(clientB, 'connect'),
    ]);

    // Join different rooms
    clientA.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'room-A',
      role: 'gm',
      displayName: 'GM-A',
    });
    await waitForEvent(clientA, EVENTS.ROOM_JOINED);

    clientB.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'room-B',
      role: 'gm',
      displayName: 'GM-B',
    });
    await waitForEvent(clientB, EVENTS.ROOM_JOINED);

    // A third client joins room-A — clientB should NOT get PLAYER_JOINED
    const clientC = connectClient();
    await waitForEvent(clientC, 'connect');

    const bJoinedPromise = Promise.race([
      waitForEvent(clientB, EVENTS.PLAYER_JOINED).then(() => 'received'),
      new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 500)),
    ]);

    clientC.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'room-A',
      role: 'player',
      displayName: 'Player-C',
    });

    const result = await bJoinedPromise;
    expect(result).toBe('timeout');

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
  });
});
