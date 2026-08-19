/**
 * useEffectiveRole — derives the effective user role for UI gating.
 *
 * When connected to a server, uses the network role from SyncProvider.
 * When offline, returns 'gm' so the app behaves as before (full access).
 */

import { useMemo } from 'react';
import { useSyncContextOptional } from '../net/SyncProvider';
import { Role } from '../../shared/session';

export interface EffectiveRoleInfo {
  /** The role to use for all UI gating decisions */
  effectiveRole: Role;
  /** Whether connected to a multiplayer server */
  isOnline: boolean;
  /** Shorthand checks */
  isGM: boolean;
  isPlayer: boolean;
  isSpectator: boolean;
  /** True for GM and offline — can modify state */
  canEdit: boolean;
  /** The player's display name (set when joining as player) */
  displayName: string | null;
}

export function useEffectiveRole(): EffectiveRoleInfo {
  // No <SyncProvider> mounted (offline / single-machine play) behaves the same
  // as a disconnected provider: effective role falls back to GM.
  const sync = useSyncContextOptional();
  const status = sync?.status ?? 'disconnected';
  const role = sync?.role ?? null;
  const displayName = sync?.displayName ?? null;

  return useMemo(() => {
    const isOnline = status === 'connected' && role !== null;
    const effectiveRole = isOnline ? role! : Role.GM;

    return {
      effectiveRole,
      isOnline,
      isGM: effectiveRole === Role.GM,
      isPlayer: effectiveRole === Role.Player,
      isSpectator: effectiveRole === Role.Spectator,
      canEdit: effectiveRole === Role.GM,
      displayName: displayName ?? null,
    };
  }, [status, role, displayName]);
}
