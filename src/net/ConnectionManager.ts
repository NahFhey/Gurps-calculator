/**
 * ConnectionManager — singleton managing the Socket.IO connection
 * and HTTP API calls to the GURPS VTT server.
 *
 * This is NOT a React hook — it's a plain class so it can be used
 * from both React components and the campaign store's save logic.
 */

import { io, type Socket } from 'socket.io-client';
import { EVENTS } from '../../shared/protocol';
import type {
  StateUpdatedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  RoomJoinedPayload,
  PlayerListPayload,
  PlayerInfo,
} from '../../shared/protocol';
import { Role, type SessionInfo } from '../../shared/session';

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'error';

type StatusListener = (status: ConnectionStatus) => void;
type StateUpdateListener = (payload: StateUpdatedPayload) => void;
type PlayerCountListener = (count: number) => void;
type PlayerListListener = (players: PlayerInfo[]) => void;

class ConnectionManager {
  private socket: Socket | null = null;
  private _status: ConnectionStatus = 'offline';
  private _role: Role | null = null;
  private _campaignId: string | null = null;
  private _sessionInfo: SessionInfo | null = null;
  private _serverVersion: number = 0;
  private _playerCount: number = 0;
  private _displayName: string | null = null;
  private _playerList: PlayerInfo[] = [];

  // Listeners
  private statusListeners = new Set<StatusListener>();
  private stateUpdateListeners = new Set<StateUpdateListener>();
  private playerCountListeners = new Set<PlayerCountListener>();
  private playerListListeners = new Set<PlayerListListener>();

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get status(): ConnectionStatus { return this._status; }
  get role(): Role | null { return this._role; }
  get campaignId(): string | null { return this._campaignId; }
  get sessionInfo(): SessionInfo | null { return this._sessionInfo; }
  get serverVersion(): number { return this._serverVersion; }
  get playerCount(): number { return this._playerCount; }
  get displayName(): string | null { return this._displayName; }
  get playerList(): PlayerInfo[] { return this._playerList; }
  get isConnected(): boolean { return this._status === 'connected'; }
  get isGM(): boolean { return this._role === Role.GM; }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Host a new game: create campaign on server, create session, connect.
   */
  async hostGame(campaignName: string, stateJson: string, displayName: string = 'GM'): Promise<SessionInfo> {
    this.setStatus('connecting');

    try {
      // Create campaign
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName, state: stateJson }),
      });
      if (!campaignRes.ok) throw new Error(`Failed to create campaign: ${campaignRes.statusText}`);
      const campaign = await campaignRes.json();

      // Create session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (!sessionRes.ok) throw new Error(`Failed to create session: ${sessionRes.statusText}`);
      const session = await sessionRes.json();

      const info: SessionInfo = {
        sessionId: session.sessionId,
        campaignId: campaign.id,
        joinCode: session.joinCode,
        role: Role.GM,
      };

      this._role = Role.GM;
      this._campaignId = campaign.id;
      this._sessionInfo = info;
      this._serverVersion = campaign.version;
      this._displayName = displayName;

      // Connect Socket.IO
      this.connectSocket(displayName);

      return info;
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  /**
   * Join an existing game by join code.
   */
  async joinGame(joinCode: string, displayName: string = 'Player'): Promise<{ sessionInfo: SessionInfo; stateJson: string }> {
    this.setStatus('connecting');

    try {
      // Look up session
      const joinRes = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      });
      if (!joinRes.ok) {
        if (joinRes.status === 404) throw new Error('Invalid or expired join code');
        throw new Error(`Failed to join: ${joinRes.statusText}`);
      }
      const joinData = await joinRes.json();

      const info: SessionInfo = {
        sessionId: joinData.sessionId,
        campaignId: joinData.campaignId,
        joinCode: joinData.joinCode,
        role: Role.Player,
      };

      this._role = Role.Player;
      this._campaignId = joinData.campaignId;
      this._sessionInfo = info;
      this._serverVersion = joinData.version;
      this._displayName = displayName;

      // Fetch current campaign state
      const stateData = await this.fetchState(joinData.campaignId);

      // Connect Socket.IO
      this.connectSocket(displayName);

      return { sessionInfo: info, stateJson: stateData.state };
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._status = 'offline';
    this._role = null;
    this._campaignId = null;
    this._sessionInfo = null;
    this._serverVersion = 0;
    this._playerCount = 0;
    this._displayName = null;
    this._playerList = [];
    this.notifyStatusListeners();
    this.notifyPlayerCountListeners();
    this.notifyPlayerListListeners();
  }

  // ---------------------------------------------------------------------------
  // State sync
  // ---------------------------------------------------------------------------

  /**
   * Push updated state to the server (GM only).
   */
  async pushState(stateJson: string): Promise<number> {
    if (!this._campaignId) throw new Error('Not connected to a campaign');

    const res = await fetch(`/api/campaigns/${this._campaignId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateJson }),
    });
    if (!res.ok) throw new Error(`Failed to push state: ${res.statusText}`);

    const data = await res.json();
    this._serverVersion = data.version;
    return data.version;
  }

  /**
   * Fetch the current state from the server.
   */
  async fetchState(campaignId?: string): Promise<{ state: string; version: number }> {
    const id = campaignId || this._campaignId;
    if (!id) throw new Error('No campaign ID');

    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);

    const data = await res.json();
    this._serverVersion = data.version;
    return { state: data.state, version: data.version };
  }

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onStateUpdated(listener: StateUpdateListener): () => void {
    this.stateUpdateListeners.add(listener);
    return () => this.stateUpdateListeners.delete(listener);
  }

  onPlayerCountChange(listener: PlayerCountListener): () => void {
    this.playerCountListeners.add(listener);
    return () => this.playerCountListeners.delete(listener);
  }

  onPlayerListChange(listener: PlayerListListener): () => void {
    this.playerListListeners.add(listener);
    return () => this.playerListListeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private connectSocket(displayName: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io({ transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.setStatus('connected');

      // Join the campaign room
      this.socket!.emit(EVENTS.JOIN_ROOM, {
        campaignId: this._campaignId,
        role: this._role,
        displayName,
      });
    });

    this.socket.on('disconnect', () => {
      this.setStatus('offline');
    });

    this.socket.on('connect_error', () => {
      this.setStatus('error');
    });

    // State updated by another client
    this.socket.on(EVENTS.STATE_UPDATED, (payload: StateUpdatedPayload) => {
      // Only process if it's a newer version (skip our own updates)
      if (payload.version > this._serverVersion) {
        this._serverVersion = payload.version;
        for (const listener of this.stateUpdateListeners) {
          listener(payload);
        }
      }
    });

    // Room joined confirmation
    this.socket.on(EVENTS.ROOM_JOINED, (payload: RoomJoinedPayload) => {
      this._playerCount = payload.playerCount;
      this.notifyPlayerCountListeners();
    });

    // Player join/leave
    this.socket.on(EVENTS.PLAYER_JOINED, (payload: PlayerJoinedPayload) => {
      this._playerCount = payload.playerCount;
      this.notifyPlayerCountListeners();
    });

    this.socket.on(EVENTS.PLAYER_LEFT, (payload: PlayerLeftPayload) => {
      this._playerCount = payload.playerCount;
      this.notifyPlayerCountListeners();
    });

    // Player list (sent to GM for character assignment)
    this.socket.on(EVENTS.PLAYER_LIST, (payload: PlayerListPayload) => {
      this._playerList = payload.players;
      this.notifyPlayerListListeners();
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.notifyStatusListeners();
  }

  private notifyStatusListeners(): void {
    for (const listener of this.statusListeners) {
      listener(this._status);
    }
  }

  private notifyPlayerCountListeners(): void {
    for (const listener of this.playerCountListeners) {
      listener(this._playerCount);
    }
  }

  private notifyPlayerListListeners(): void {
    for (const listener of this.playerListListeners) {
      listener(this._playerList);
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
