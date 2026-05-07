/**
 * SyncProvider — React context wrapping the ConnectionManager.
 *
 * Provides connection status, role, and actions (hostGame, joinGame, disconnect)
 * to the React component tree. Also listens for server state updates and
 * triggers campaign state replacement via the dispatch ref.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { connectionManager, type ConnectionStatus } from './ConnectionManager';
import { standaloneToast } from '../components/ui/Toast';
import type { SessionInfo } from '../../shared/session';
import type { Role } from '../../shared/session';
import type { PlayerInfo } from '../../shared/protocol';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface SyncContextValue {
  /** Current connection status */
  status: ConnectionStatus;
  /** Role in the current session */
  role: Role | null;
  /** Session info (join code, campaign ID, etc.) */
  sessionInfo: SessionInfo | null;
  /** Number of connected players */
  playerCount: number;
  /** This client's display name */
  displayName: string | null;
  /** List of connected players (GM only) */
  playerList: PlayerInfo[];
  /** Host a new game as GM */
  hostGame: (campaignName: string, stateJson: string) => Promise<SessionInfo>;
  /** Join an existing game as Player */
  joinGame: (joinCode: string, displayName?: string) => Promise<string>;
  /** Disconnect from the server */
  disconnect: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside <SyncProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SyncProviderProps {
  children: ReactNode;
  /** Callback to replace campaign state when server sends an update */
  onServerStateUpdate?: (stateJson: string) => void;
}

export function SyncProvider({ children, onServerStateUpdate }: SyncProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>(connectionManager.status);
  const [role, setRole] = useState<Role | null>(connectionManager.role);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(connectionManager.sessionInfo);
  const [playerCount, setPlayerCount] = useState(connectionManager.playerCount);
  const [displayName, setDisplayName] = useState<string | null>(connectionManager.displayName);
  const [playerList, setPlayerList] = useState<PlayerInfo[]>(connectionManager.playerList);
  const onServerStateUpdateRef = useRef(onServerStateUpdate);
  onServerStateUpdateRef.current = onServerStateUpdate;

  // Subscribe to connection manager events
  useEffect(() => {
    const unsubStatus = connectionManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setRole(connectionManager.role);
      setSessionInfo(connectionManager.sessionInfo);
    });

    const unsubPlayerCount = connectionManager.onPlayerCountChange((count) => {
      setPlayerCount(count);
    });

    const unsubPlayerList = connectionManager.onPlayerListChange((players) => {
      setPlayerList(players);
    });

    const unsubStateUpdate = connectionManager.onStateUpdated(async () => {
      // Server has a new version — fetch the full state
      if (!connectionManager.campaignId) return;
      try {
        const { state } = await connectionManager.fetchState();
        onServerStateUpdateRef.current?.(state);
      } catch (err) {
        console.error('[SyncProvider] Failed to fetch updated state:', err);
        standaloneToast.error('Failed to sync with server. Your local changes are preserved.');
      }
    });

    return () => {
      unsubStatus();
      unsubPlayerCount();
      unsubPlayerList();
      unsubStateUpdate();
    };
  }, []);

  const hostGame = useCallback(async (campaignName: string, stateJson: string): Promise<SessionInfo> => {
    const info = await connectionManager.hostGame(campaignName, stateJson);
    setRole(connectionManager.role);
    setSessionInfo(info);
    setDisplayName(connectionManager.displayName);
    return info;
  }, []);

  const joinGame = useCallback(async (joinCode: string, playerDisplayName?: string): Promise<string> => {
    const { stateJson } = await connectionManager.joinGame(joinCode, playerDisplayName);
    setRole(connectionManager.role);
    setSessionInfo(connectionManager.sessionInfo);
    setDisplayName(connectionManager.displayName);
    return stateJson;
  }, []);

  const disconnect = useCallback(() => {
    connectionManager.disconnect();
    setStatus('offline');
    setRole(null);
    setSessionInfo(null);
    setPlayerCount(0);
    setDisplayName(null);
    setPlayerList([]);
  }, []);

  const value: SyncContextValue = {
    status,
    role,
    sessionInfo,
    playerCount,
    displayName,
    playerList,
    hostGame,
    joinGame,
    disconnect,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
