import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { setupSocket } from '../socket.js';
import { signToken } from '../auth.js';
import { Role } from '../../../shared/session.js';
import { EVENTS } from '../../../shared/protocol.js';

let httpServer: ReturnType<typeof createServer>;
let io: SocketServer;
let port: number;

/** Create an authenticated client for a campaign. */
async function connectClient(campaignId: string, role: Role = Role.GM, displayName = 'GM'): Promise<ClientSocket> {
  const token = await signToken({ campaignId, role, displayName });
  return ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    auth: { token },
  });
}

/** Create an unauthenticated client (no token). */
function connectUnauthClient(): ClientSocket {
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

/** The event's payload, or 'timeout' when it does not arrive within `ms`. */
function eventOrTimeout<T = unknown>(socket: ClientSocket, event: string, ms = 500): Promise<T | 'timeout'> {
  return Promise.race([
    waitForEvent<T>(socket, event),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
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

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
describe('Socket authentication', () => {
  it('rejects connection without a token', async () => {
    const client = connectUnauthClient();

    const error = await waitForEvent<Error>(client, 'connect_error');
    expect(error.message).toMatch(/authentication/i);

    client.disconnect();
  });

  it('rejects connection with an invalid token', async () => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: 'garbage-token' },
    });

    const error = await waitForEvent<Error>(client, 'connect_error');
    expect(error.message).toMatch(/invalid|expired/i);

    client.disconnect();
  });

  it('accepts connection with a valid token', async () => {
    const client = await connectClient('camp-auth');
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// JOIN_ROOM
// ---------------------------------------------------------------------------
describe('JOIN_ROOM', () => {
  it('confirms room join with ROOM_JOINED event', async () => {
    const client = await connectClient('camp-1', Role.GM, 'GM Alice');
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

  it('uses role from token, not from client payload', async () => {
    // Client has a Player token but tries to claim GM role in the payload
    const client = await connectClient('camp-role', Role.Player, 'Sneaky');
    await waitForEvent(client, 'connect');

    const listPromise = waitForEvent<{ players: Array<{ displayName: string; role: string }> }>(
      client,
      EVENTS.PLAYER_LIST
    );

    client.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-role',
      role: 'gm', // lies about role
      displayName: 'Admin', // lies about name
    });

    const data = await listPromise;
    expect(data.players).toHaveLength(1);
    // Server should use the token values, not the client payload
    expect(data.players[0].role).toBe('player');
    expect(data.players[0].displayName).toBe('Sneaky');

    client.disconnect();
  });

  it('rejects joining a campaign the token is not for', async () => {
    const client = await connectClient('camp-a', Role.GM, 'GM');
    await waitForEvent(client, 'connect');

    const errorPromise = waitForEvent<{ message: string }>(client, EVENTS.ERROR);

    client.emit(EVENTS.JOIN_ROOM, {
      campaignId: 'camp-b', // different campaign
      role: 'gm',
      displayName: 'GM',
    });

    const data = await errorPromise;
    expect(data.message).toMatch(/not authenticated/i);

    client.disconnect();
  });

  it('sends PLAYER_LIST after join', async () => {
    const client = await connectClient('camp-list', Role.GM, 'GM Bob');
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
    const client1 = await connectClient('camp-notify', Role.GM, 'GM');
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
    const client2 = await connectClient('camp-notify', Role.Player, 'Player1');
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

  it('rejects JOIN_ROOM with no campaignId with an error event and does not join', async () => {
    const client = await connectClient('camp-empty', Role.GM, 'Bad');
    await waitForEvent(client, 'connect');

    const joined = eventOrTimeout(client, EVENTS.ROOM_JOINED);
    const error = eventOrTimeout<{ message: string }>(client, EVENTS.ERROR);
    client.emit(EVENTS.JOIN_ROOM, { role: 'gm', displayName: 'Bad' });

    expect(await error).toEqual({ message: expect.stringMatching(/invalid/i) });
    expect(await joined).toBe('timeout');
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it.each<[string, unknown[]]>([
    ['no argument', []],
    ['null', [null]],
    ['a bare string', ['camp-bad']],
    ['a number', [42]],
    ['an empty object', [{}]],
    ['a numeric campaignId', [{ campaignId: 42 }]],
    ['an unknown role', [{ campaignId: 'camp-bad', role: 'admin' }]],
    ['a non-string displayName', [{ campaignId: 'camp-bad', displayName: 7 }]],
  ])('JOIN_ROOM with %s emits an error, keeps the socket, and a valid join still works', async (_label, args) => {
    const client = await connectClient('camp-bad', Role.GM, 'GM');
    await waitForEvent(client, 'connect');

    const error = eventOrTimeout<{ message: string }>(client, EVENTS.ERROR);
    const early = eventOrTimeout(client, EVENTS.ROOM_JOINED);
    client.emit(EVENTS.JOIN_ROOM, ...args);

    const payload = await error;
    expect(payload).toEqual({ message: expect.stringMatching(/invalid/i) });
    expect(payload === 'timeout' ? '' : payload.message).not.toMatch(/not authenticated/i);
    expect(await early).toBe('timeout');
    expect(client.connected).toBe(true);

    const joined = eventOrTimeout<{ campaignId: string; playerCount: number }>(client, EVENTS.ROOM_JOINED);
    client.emit(EVENTS.JOIN_ROOM, { campaignId: 'camp-bad' });
    expect(await joined).toEqual({ campaignId: 'camp-bad', playerCount: 1 });

    client.disconnect();
  });

  it('JOIN_ROOM with only a campaignId joins (role and name come from the token)', async () => {
    const client = await connectClient('camp-min', Role.Player, 'Minimal');
    await waitForEvent(client, 'connect');

    const joined = eventOrTimeout<{ campaignId: string; playerCount: number }>(client, EVENTS.ROOM_JOINED);
    client.emit(EVENTS.JOIN_ROOM, { campaignId: 'camp-min' });

    expect(await joined).toEqual({ campaignId: 'camp-min', playerCount: 1 });
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// A refused JOIN_ROOM leaves the socket out of the room
// ---------------------------------------------------------------------------
describe('Refused JOIN_ROOM', () => {
  /** Number of server sockets in a room. */
  async function roomSize(room: string): Promise<number> {
    return (await io.in(room).fetchSockets()).length;
  }

  it('a payload with a bad field does not put the socket in the named room', async () => {
    const client = await connectClient('camp-bad', Role.GM, 'GM');
    await waitForEvent(client, 'connect');

    const error = waitForEvent<{ message: string }>(client, EVENTS.ERROR);
    client.emit(EVENTS.JOIN_ROOM, { campaignId: 'camp-bad', role: 'admin' });

    expect(await error).toEqual({ message: expect.stringMatching(/invalid/i) });
    expect(await roomSize('camp-bad')).toBe(0);
    client.disconnect();
  });

  it('a join for a campaign the token is not for does not put the socket in that room', async () => {
    const client = await connectClient('camp-1', Role.Player, 'Player');
    await waitForEvent(client, 'connect');

    const error = waitForEvent<{ message: string }>(client, EVENTS.ERROR);
    client.emit(EVENTS.JOIN_ROOM, { campaignId: 'camp-2' });

    expect(await error).toEqual({ message: expect.stringMatching(/not authenticated/i) });
    expect(await roomSize('camp-2')).toBe(0);
    client.disconnect();
  });

  it.each<[string, string, Record<string, unknown>]>([
    ['a bad field', 'camp-shared', { campaignId: 'camp-shared', role: 'admin' }],
    ['a token for another campaign', 'camp-other', { campaignId: 'camp-shared' }],
  ])('a refused join (%s) tells the members of the room nothing', async (_label, tokenCampaign, payload) => {
    const member = await connectClient('camp-shared', Role.GM, 'GM');
    await waitForEvent(member, 'connect');
    const memberList = waitForEvent(member, EVENTS.PLAYER_LIST);
    member.emit(EVENTS.JOIN_ROOM, { campaignId: 'camp-shared' });
    await memberList; // the member's own join is fully announced before the refused one starts

    const heard: string[] = [];
    member.on(EVENTS.PLAYER_JOINED, () => heard.push(EVENTS.PLAYER_JOINED));
    member.on(EVENTS.PLAYER_LIST, () => heard.push(EVENTS.PLAYER_LIST));

    const intruder = await connectClient(tokenCampaign, Role.Player, 'Intruder');
    await waitForEvent(intruder, 'connect');
    const error = waitForEvent(intruder, EVENTS.ERROR);
    intruder.emit(EVENTS.JOIN_ROOM, payload);
    await error;
    // The server emits any announcement before it sends the error, so a wrong
    // one is already in flight; give it a short window to arrive.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(heard).toEqual([]);
    expect(await roomSize('camp-shared')).toBe(1);
    member.disconnect();
    intruder.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------
describe('Disconnect', () => {
  it('sends PLAYER_LEFT when a player disconnects', async () => {
    const client1 = await connectClient('camp-dc', Role.GM, 'GM');
    const client2 = await connectClient('camp-dc', Role.Player, 'Leaver');
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
    const client1 = await connectClient('camp-dclist', Role.GM, 'GM');
    const client2 = await connectClient('camp-dclist', Role.Player, 'Player2');
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

// ---------------------------------------------------------------------------
// Multi-room isolation
// ---------------------------------------------------------------------------
describe('Multi-room isolation', () => {
  it('players in different rooms do not receive each others events', async () => {
    const clientA = await connectClient('room-A', Role.GM, 'GM-A');
    const clientB = await connectClient('room-B', Role.GM, 'GM-B');
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
    const clientC = await connectClient('room-A', Role.Player, 'Player-C');
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
