// @vitest-environment node
/**
 * Integration tests for the GURPS VTT server.
 * Tests route handlers, database operations, and socket events
 * by starting a real server on an ephemeral port.
 *
 * Auth-aware (Phase 10.5): campaign routes require a Bearer token, session
 * creation requires the GM role, and Socket.IO connections must present a
 * token in the handshake. Tokens come from the API itself (create/join);
 * only the missing-campaign cases mint one directly via signToken, which
 * shares the per-start secret because the server runs in-process.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, type ServerHandle } from '../../server/src/index.js';
import { signToken } from '../../server/src/auth.js';
import { Role } from '../../shared/session.js';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import os from 'os';

let server: ServerHandle;
let baseUrl: string;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurps-test-'));
  server = await startServer({ port: 0, dbDir: tmpDir });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.close();
  // Clean up temp DB
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Create a campaign via the API; returns { id, name, version, token } (GM token). */
async function createCampaign(name: string, state = '{}') {
  const res = await fetch(`${baseUrl}/api/campaigns`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, state }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

// ---------------------------------------------------------------------------
// Campaign Routes
// ---------------------------------------------------------------------------
describe('Campaign routes', () => {
  it('POST /api/campaigns creates a campaign and returns a GM token', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Test Campaign', state: '{"foo":"bar"}' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test Campaign');
    expect(data.version).toBe(1);
    expect(typeof data.token).toBe('string');
  });

  it('POST /api/campaigns rejects missing name', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ state: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/campaigns rejects missing state', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'No state' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/campaigns/:id returns a campaign with a valid token', async () => {
    const { id, token } = await createCampaign('Get Test', '{"key":"val"}');

    const res = await fetch(`${baseUrl}/api/campaigns/${id}`, {
      headers: jsonHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(id);
    expect(data.name).toBe('Get Test');
    expect(data.state).toBe('{"key":"val"}');
    expect(data.version).toBe(1);
  });

  it('GET /api/campaigns/:id returns 401 without a token', async () => {
    const { id } = await createCampaign('No Auth Test');
    const res = await fetch(`${baseUrl}/api/campaigns/${id}`);
    expect(res.status).toBe(401);
  });

  it("GET /api/campaigns/:id returns 403 for another campaign's token", async () => {
    const { id } = await createCampaign('Victim Campaign');
    const { token: otherToken } = await createCampaign('Other Campaign');
    const res = await fetch(`${baseUrl}/api/campaigns/${id}`, {
      headers: jsonHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/campaigns/:id returns 404 for missing', async () => {
    // A token scoped to the nonexistent id gets past campaign-access checks
    // so the handler's own 404 is reachable.
    const token = await signToken({
      campaignId: 'nonexistent',
      role: Role.GM,
      displayName: 'Ghost',
    });
    const res = await fetch(`${baseUrl}/api/campaigns/nonexistent`, {
      headers: jsonHeaders(token),
    });
    expect(res.status).toBe(404);
  });

  it('PUT /api/campaigns/:id/state updates state and bumps version', async () => {
    const { id, token } = await createCampaign('Update Test', '{"v":1}');

    const putRes = await fetch(`${baseUrl}/api/campaigns/${id}/state`, {
      method: 'PUT',
      headers: jsonHeaders(token),
      body: JSON.stringify({ state: '{"v":2}' }),
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.version).toBe(2);

    // Verify the state was actually updated
    const getRes = await fetch(`${baseUrl}/api/campaigns/${id}`, {
      headers: jsonHeaders(token),
    });
    const getData = await getRes.json();
    expect(getData.state).toBe('{"v":2}');
    expect(getData.version).toBe(2);
  });

  it('PUT /api/campaigns/:id/state returns 400 without state', async () => {
    const { id, token } = await createCampaign('No Body Test');

    const res = await fetch(`${baseUrl}/api/campaigns/${id}/state`, {
      method: 'PUT',
      headers: jsonHeaders(token),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/campaigns/:id/state returns 404 for missing campaign', async () => {
    const token = await signToken({
      campaignId: 'nonexistent',
      role: Role.GM,
      displayName: 'Ghost',
    });
    const res = await fetch(`${baseUrl}/api/campaigns/nonexistent/state`, {
      method: 'PUT',
      headers: jsonHeaders(token),
      body: JSON.stringify({ state: '{}' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Session Routes
// ---------------------------------------------------------------------------
describe('Session routes', () => {
  let campaignId: string;
  let gmToken: string;

  beforeEach(async () => {
    const data = await createCampaign('Session Test');
    campaignId = data.id;
    gmToken = data.token;
  });

  it('POST /api/sessions creates a session with join code', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({ campaignId }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sessionId).toBeDefined();
    expect(data.campaignId).toBe(campaignId);
    // 10-character join codes since Phase 10.5 (up from 6)
    expect(data.joinCode).toMatch(/^[A-Z0-9_-]{10}$/i);
  });

  it('POST /api/sessions returns 401 without a token', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ campaignId }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/sessions rejects missing campaignId', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/sessions rejects a different campaign's id", async () => {
    // GM token is scoped to `campaignId`; asking for another campaign is 403.
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({ campaignId: 'nonexistent' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /api/sessions rejects nonexistent campaign', async () => {
    const token = await signToken({
      campaignId: 'nonexistent',
      role: Role.GM,
      displayName: 'Ghost',
    });
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ campaignId: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/join resolves a valid join code and returns a player token', async () => {
    // Create session
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({ campaignId }),
    });
    const { joinCode } = await sessionRes.json();

    // Join (no auth — the join code is the credential)
    const joinRes = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ joinCode }),
    });
    expect(joinRes.status).toBe(200);
    const data = await joinRes.json();
    expect(data.campaignId).toBe(campaignId);
    expect(data.campaignName).toBe('Session Test');
    expect(typeof data.token).toBe('string');
  });

  it('POST /api/sessions/join is case-insensitive', async () => {
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({ campaignId }),
    });
    const { joinCode } = await sessionRes.json();

    const joinRes = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ joinCode: joinCode.toLowerCase() }),
    });
    expect(joinRes.status).toBe(200);
  });

  it('POST /api/sessions/join rejects missing joinCode', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/sessions/join rejects invalid join code', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ joinCode: 'ZZZZZZZZZZ' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Socket.IO Events
// ---------------------------------------------------------------------------
describe('Socket.IO events', () => {
  let campaignId: string;
  let gmToken: string;

  beforeEach(async () => {
    const data = await createCampaign('Socket Test');
    campaignId = data.id;
    gmToken = data.token;
  });

  /** Get a player token for the current campaign via session create + join. */
  async function playerToken(displayName: string): Promise<string> {
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(gmToken),
      body: JSON.stringify({ campaignId }),
    });
    const { joinCode } = await sessionRes.json();
    const joinRes = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ joinCode, displayName }),
    });
    const { token } = await joinRes.json();
    return token;
  }

  function connectClient(token: string): ClientSocket {
    return ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token },
    });
  }

  it('JOIN_ROOM emits ROOM_JOINED back to client', async () => {
    const client = connectClient(gmToken);
    try {
      const result = await new Promise<{ campaignId: string; playerCount: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client.on('room:joined', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
        // Role and displayName come from the verified token, not the payload
        client.emit('room:join', { campaignId });
      });
      expect(result.campaignId).toBe(campaignId);
      expect(result.playerCount).toBe(1);
    } finally {
      client.disconnect();
    }
  });

  it('PLAYER_JOINED is broadcast to other clients in room', async () => {
    const client1 = connectClient(gmToken);
    const client2 = connectClient(await playerToken('Player1'));

    try {
      // Client1 joins first
      await new Promise<void>((resolve) => {
        client1.on('room:joined', () => resolve());
        client1.emit('room:join', { campaignId });
      });

      // Listen for player:joined on client1
      const joinedPromise = new Promise<{ displayName: string; playerCount: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client1.on('player:joined', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      // Client2 joins
      client2.emit('room:join', { campaignId });

      const result = await joinedPromise;
      expect(result.displayName).toBe('Player1');
      expect(result.playerCount).toBe(2);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('PLAYER_LIST is broadcast when players join', async () => {
    const client1 = connectClient(gmToken);

    try {
      const listPromise = new Promise<{ players: Array<{ displayName: string; role: string }> }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client1.on('player:list', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      client1.emit('room:join', { campaignId });

      const result = await listPromise;
      expect(result.players).toHaveLength(1);
      // Campaign creator's GM token carries the display name from creation
      expect(result.players[0].role).toBe('gm');
    } finally {
      client1.disconnect();
    }
  });

  it('PLAYER_LEFT is emitted when a client disconnects', async () => {
    const client1 = connectClient(gmToken);
    const client2 = connectClient(await playerToken('Player1'));

    try {
      // Both join
      await new Promise<void>((resolve) => {
        client1.on('room:joined', () => resolve());
        client1.emit('room:join', { campaignId });
      });
      await new Promise<void>((resolve) => {
        client2.on('room:joined', () => resolve());
        client2.emit('room:join', { campaignId });
      });

      // Listen for player:left on client1
      const leftPromise = new Promise<{ displayName: string; playerCount: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client1.on('player:left', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      // Disconnect client2
      client2.disconnect();

      const result = await leftPromise;
      expect(result.displayName).toBe('Player1');
      expect(result.playerCount).toBe(1);
    } finally {
      client1.disconnect();
    }
  });

  it('STATE_UPDATED is emitted to room when state is pushed via REST', async () => {
    const client = connectClient(gmToken);

    try {
      // Join the room
      await new Promise<void>((resolve) => {
        client.on('room:joined', () => resolve());
        client.emit('room:join', { campaignId });
      });

      // Listen for state:updated
      const updatePromise = new Promise<{ version: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client.on('state:updated', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      // Push state via REST (GM auth required)
      await fetch(`${baseUrl}/api/campaigns/${campaignId}/state`, {
        method: 'PUT',
        headers: jsonHeaders(gmToken),
        body: JSON.stringify({ state: '{"updated":true}' }),
      });

      const result = await updatePromise;
      expect(result.version).toBe(2);
    } finally {
      client.disconnect();
    }
  });
});
