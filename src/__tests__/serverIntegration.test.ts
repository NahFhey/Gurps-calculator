// @vitest-environment node
/**
 * Integration tests for the GURPS VTT server.
 * Tests route handlers, database operations, and socket events
 * by starting a real server on an ephemeral port.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, type ServerHandle } from '../../server/src/index.js';
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

// ---------------------------------------------------------------------------
// Campaign Routes
// ---------------------------------------------------------------------------
describe('Campaign routes', () => {
  it('POST /api/campaigns creates a campaign', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Campaign', state: '{"foo":"bar"}' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test Campaign');
    expect(data.version).toBe(1);
  });

  it('POST /api/campaigns rejects missing name', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '{}' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/campaigns rejects missing state', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No state' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/campaigns/:id returns a campaign', async () => {
    // Create first
    const createRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Get Test', state: '{"key":"val"}' }),
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/campaigns/${id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(id);
    expect(data.name).toBe('Get Test');
    expect(data.state).toBe('{"key":"val"}');
    expect(data.version).toBe(1);
  });

  it('GET /api/campaigns/:id returns 404 for missing', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/campaigns/:id/state updates state and bumps version', async () => {
    const createRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Update Test', state: '{"v":1}' }),
    });
    const { id } = await createRes.json();

    const putRes = await fetch(`${baseUrl}/api/campaigns/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '{"v":2}' }),
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.version).toBe(2);

    // Verify the state was actually updated
    const getRes = await fetch(`${baseUrl}/api/campaigns/${id}`);
    const getData = await getRes.json();
    expect(getData.state).toBe('{"v":2}');
    expect(getData.version).toBe(2);
  });

  it('PUT /api/campaigns/:id/state returns 400 without state', async () => {
    const createRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Body Test', state: '{}' }),
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/campaigns/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/campaigns/:id/state returns 404 for missing campaign', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns/nonexistent/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

  beforeEach(async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Session Test', state: '{}' }),
    });
    const data = await res.json();
    campaignId = data.id;
  });

  it('POST /api/sessions creates a session with join code', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sessionId).toBeDefined();
    expect(data.campaignId).toBe(campaignId);
    expect(data.joinCode).toMatch(/^[A-Z0-9_-]{6}$/i);
  });

  it('POST /api/sessions rejects missing campaignId', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/sessions rejects nonexistent campaign', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/join resolves a valid join code', async () => {
    // Create session
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    });
    const { joinCode } = await sessionRes.json();

    // Join
    const joinRes = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    });
    expect(joinRes.status).toBe(200);
    const data = await joinRes.json();
    expect(data.campaignId).toBe(campaignId);
    expect(data.campaignName).toBe('Session Test');
  });

  it('POST /api/sessions/join is case-insensitive', async () => {
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    });
    const { joinCode } = await sessionRes.json();

    const joinRes = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode: joinCode.toLowerCase() }),
    });
    expect(joinRes.status).toBe(200);
  });

  it('POST /api/sessions/join rejects missing joinCode', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/sessions/join rejects invalid join code', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode: 'ZZZZZZ' }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Socket.IO Events
// ---------------------------------------------------------------------------
describe('Socket.IO events', () => {
  let campaignId: string;

  beforeEach(async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Socket Test', state: '{}' }),
    });
    const data = await res.json();
    campaignId = data.id;
  });

  function connectClient(): ClientSocket {
    return ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
  }

  it('JOIN_ROOM emits ROOM_JOINED back to client', async () => {
    const client = connectClient();
    try {
      const result = await new Promise<{ campaignId: string; playerCount: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client.on('room:joined', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
        client.emit('room:join', {
          campaignId,
          role: 'gm',
          displayName: 'TestGM',
        });
      });
      expect(result.campaignId).toBe(campaignId);
      expect(result.playerCount).toBe(1);
    } finally {
      client.disconnect();
    }
  });

  it('PLAYER_JOINED is broadcast to other clients in room', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    try {
      // Client1 joins first
      await new Promise<void>((resolve) => {
        client1.on('room:joined', () => resolve());
        client1.emit('room:join', {
          campaignId,
          role: 'gm',
          displayName: 'GM',
        });
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
      client2.emit('room:join', {
        campaignId,
        role: 'player',
        displayName: 'Player1',
      });

      const result = await joinedPromise;
      expect(result.displayName).toBe('Player1');
      expect(result.playerCount).toBe(2);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('PLAYER_LIST is broadcast when players join', async () => {
    const client1 = connectClient();

    try {
      const listPromise = new Promise<{ players: Array<{ displayName: string; role: string }> }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client1.on('player:list', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      client1.emit('room:join', {
        campaignId,
        role: 'gm',
        displayName: 'TheGM',
      });

      const result = await listPromise;
      expect(result.players).toHaveLength(1);
      expect(result.players[0].displayName).toBe('TheGM');
      expect(result.players[0].role).toBe('gm');
    } finally {
      client1.disconnect();
    }
  });

  it('PLAYER_LEFT is emitted when a client disconnects', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    try {
      // Both join
      await new Promise<void>((resolve) => {
        client1.on('room:joined', () => resolve());
        client1.emit('room:join', { campaignId, role: 'gm', displayName: 'GM' });
      });
      await new Promise<void>((resolve) => {
        client2.on('room:joined', () => resolve());
        client2.emit('room:join', { campaignId, role: 'player', displayName: 'Player1' });
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
    const client = connectClient();

    try {
      // Join the room
      await new Promise<void>((resolve) => {
        client.on('room:joined', () => resolve());
        client.emit('room:join', { campaignId, role: 'gm', displayName: 'GM' });
      });

      // Listen for state:updated
      const updatePromise = new Promise<{ version: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);
        client.on('state:updated', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      // Push state via REST
      await fetch(`${baseUrl}/api/campaigns/${campaignId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: '{"updated":true}' }),
      });

      const result = await updatePromise;
      expect(result.version).toBe(2);
    } finally {
      client.disconnect();
    }
  });
});
