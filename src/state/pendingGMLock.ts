import { useSyncExternalStore } from 'react';
import type { PendingGMLock } from '../utils/campaignImport';

/**
 * The encrypted GM half of the last locked import, kept until a successful unlock
 * or the next import replaces it.
 *
 * It lives outside ManagerTab because the shell remounts when combat starts or ends
 * (UnifiedShell re-wraps itself in CombatContextProvider), and component state would
 * be lost, so a locked file with a running combat could never be unlocked. It is held
 * in memory only: a reload drops it, and the GM re-imports the file. Persisting it
 * means a new persisted field, which belongs with the typed-boundaries phase.
 */
let pendingLock: PendingGMLock | null = null;
const listeners = new Set<() => void>();

export function getPendingGMLock(): PendingGMLock | null {
  return pendingLock;
}

export function setPendingGMLock(lock: PendingGMLock | null): void {
  if (lock === pendingLock) return;
  pendingLock = lock;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingGMLock(): PendingGMLock | null {
  return useSyncExternalStore(subscribe, getPendingGMLock, getPendingGMLock);
}
