/**
 * Combat History Manager for Phase 2 Hybrid Undo System
 * Manages actions, cursor, checkpoints, and state rebuild
 */

import { applyAction, applyInverse } from './combatReducer';
import { safeDeepClone } from './helpers';
import type {
  CombatState,
  HistoryCheckpoint,
  HistoryState,
  RevealEntry,
  RevealState,
} from '../types/combatTracker';

// ============================================================================
// Configuration
// ============================================================================

interface HistoryConfig {
  checkpointEvery?: number;
  maxActions?: number;
  maxCheckpoints?: number;
}

const DEFAULT_CONFIG: Required<HistoryConfig> = {
  checkpointEvery: 25,
  maxActions: 500,
  maxCheckpoints: 30,
};

type HistoryAction = Record<string, unknown>;

type CombatSnapshot = Omit<CombatState, 'history'> & { history?: unknown };

interface SnapshotWithReveal {
  combatState: CombatSnapshot;
  revealState: RevealState;
}

type Snapshot = SnapshotWithReveal | CombatSnapshot;

export interface RebuildResult {
  combatState: CombatState;
  revealState: RevealState;
}

export interface UndoRedoResult {
  newHistory: HistoryState;
  newCombatState: CombatState;
  newRevealState?: RevealState;
}

interface RevealUpdate {
  add?: Record<string, RevealEntry>;
  set?: Record<string, RevealEntry>;
  remove?: string[];
}

// ============================================================================
// History State Creation
// ============================================================================

/**
 * Create a new empty history state
 */
export function createHistoryState(config: HistoryConfig = {}): HistoryState {
  return {
    version: 1,
    actions: [],
    cursor: 0,
    checkpoints: [],
    checkpointEvery: config.checkpointEvery || DEFAULT_CONFIG.checkpointEvery,
    maxActions: config.maxActions || DEFAULT_CONFIG.maxActions,
    maxCheckpoints: config.maxCheckpoints || DEFAULT_CONFIG.maxCheckpoints,
  };
}

/**
 * Create a snapshot of combat state (without history metadata).
 * Phase 5: Can optionally include reveal state.
 */
export function createSnapshot(
  combatState: CombatState,
  revealState?: null,
): CombatSnapshot;
export function createSnapshot(
  combatState: CombatState,
  revealState: RevealState,
): SnapshotWithReveal;
export function createSnapshot(
  combatState: CombatState,
  revealState: RevealState | null,
): Snapshot;
export function createSnapshot(
  combatState: CombatState,
  revealState: RevealState | null = null,
): Snapshot {
  const { history: _history, ...snapshot } = combatState as CombatState & { history?: unknown };

  if (revealState) {
    return {
      combatState: snapshot,
      revealState: safeDeepClone(revealState),
    };
  }

  return snapshot;
}

// ============================================================================
// Action Management
// ============================================================================

/**
 * Add an action to history. Records the action, advances the cursor, and
 * handles checkpoint creation and pruning.
 */
export function addAction(
  historyState: HistoryState,
  action: HistoryAction,
  currentCombatState: CombatState,
  currentRevealState: RevealState | null = null,
): HistoryState {
  if (!historyState || !action) {
    throw new Error('addAction requires historyState and action');
  }

  const { actions, cursor, checkpoints, checkpointEvery, maxActions, maxCheckpoints } =
    historyState;

  // If cursor is not at the end, discard actions after cursor (branching timeline)
  const newActions: unknown[] =
    cursor < actions.length ? [...actions.slice(0, cursor), action] : [...actions, action];

  const newCursor = cursor + 1;

  let newCheckpoints: HistoryCheckpoint[] = [...checkpoints];
  const shouldCreateCheckpoint = newCursor % checkpointEvery === 0;

  if (shouldCreateCheckpoint && currentCombatState) {
    const snapshot = createSnapshot(currentCombatState, currentRevealState);
    newCheckpoints.push({ at: newCursor, snapshot });

    if (newCheckpoints.length > maxCheckpoints) {
      newCheckpoints = newCheckpoints.slice(-maxCheckpoints);
    }
  }

  let finalActions = newActions;
  let finalCursor = newCursor;
  let finalCheckpoints = newCheckpoints;

  if (finalActions.length > maxActions) {
    const excess = finalActions.length - maxActions;
    finalActions = finalActions.slice(excess);
    finalCursor = finalCursor - excess;

    finalCheckpoints = finalCheckpoints
      .map((cp) => ({ ...cp, at: cp.at - excess }))
      .filter((cp) => cp.at >= 0);

    if (finalCheckpoints.length === 0 || finalCheckpoints[0].at > 0) {
      console.warn('Action history pruned without checkpoint at start. May cause issues.');
    }
  }

  return {
    ...historyState,
    actions: finalActions,
    cursor: finalCursor,
    checkpoints: finalCheckpoints,
  };
}

export function canUndo(historyState: HistoryState | null | undefined): boolean {
  return !!historyState && historyState.cursor > 0;
}

export function canRedo(historyState: HistoryState | null | undefined): boolean {
  return !!historyState && historyState.cursor < historyState.actions.length;
}

export function getUndoCount(historyState: HistoryState | null | undefined): number {
  return historyState ? historyState.cursor : 0;
}

export function getRedoCount(historyState: HistoryState | null | undefined): number {
  if (!historyState) return 0;
  return historyState.actions.length - historyState.cursor;
}

// ============================================================================
// State Rebuild
// ============================================================================

function findNearestCheckpoint(
  historyState: HistoryState,
  targetCursor: number,
): HistoryCheckpoint | null {
  const { checkpoints } = historyState;

  if (!checkpoints || checkpoints.length === 0) {
    return null;
  }

  let nearest: HistoryCheckpoint | null = null;
  for (const checkpoint of checkpoints) {
    if (checkpoint.at <= targetCursor) {
      if (!nearest || checkpoint.at > nearest.at) {
        nearest = checkpoint;
      }
    }
  }

  return nearest;
}

function isSnapshotWithReveal(snapshot: unknown): snapshot is SnapshotWithReveal {
  return (
    !!snapshot &&
    typeof snapshot === 'object' &&
    'combatState' in (snapshot as Record<string, unknown>) &&
    'revealState' in (snapshot as Record<string, unknown>)
  );
}

/**
 * Rebuild combat state from history at a specific cursor position.
 * Uses nearest checkpoint and replays actions forward.
 * Phase 5: Also returns reveal state if stored in checkpoints.
 */
export function rebuildState(
  baseState: CombatState,
  historyState: HistoryState,
  targetCursor: number,
  baseRevealState?: RevealState | null,
): CombatState | RebuildResult {
  if (!baseState || !historyState) {
    throw new Error('rebuildState requires baseState and historyState');
  }

  const { actions } = historyState;

  if (targetCursor === 0) {
    if (baseRevealState) {
      return { combatState: baseState, revealState: baseRevealState };
    }
    return baseState;
  }

  const checkpoint = findNearestCheckpoint(historyState, targetCursor);

  let state: CombatState;
  let revealState: RevealState | null | undefined = baseRevealState;
  let startIndex: number;

  if (checkpoint) {
    if (isSnapshotWithReveal(checkpoint.snapshot)) {
      state = { ...(checkpoint.snapshot.combatState as unknown as CombatState) };
      revealState = safeDeepClone(checkpoint.snapshot.revealState);
      startIndex = checkpoint.at;
    } else {
      state = { ...(checkpoint.snapshot as unknown as CombatState) };
      startIndex = checkpoint.at;
    }
  } else {
    state = baseState;
    startIndex = 0;
  }

  for (let i = startIndex; i < targetCursor; i++) {
    if (i >= actions.length) {
      console.warn('Rebuild requested cursor beyond actions length');
      break;
    }
    const action = actions[i] as HistoryAction;
    state = applyAction(state, action) as CombatState;
    const revealUpdate = action?.revealUpdate as RevealUpdate | undefined;
    if (revealState && revealUpdate) {
      revealState = applyRevealUpdate(revealState, revealUpdate);
    }
  }

  if (revealState) {
    return { combatState: state, revealState };
  }

  return state;
}

function applyRevealUpdate(
  revealState: RevealState | null | undefined,
  revealUpdate: RevealUpdate | null | undefined,
): RevealState | null | undefined {
  if (!revealState || !revealUpdate) return revealState;

  const updated = safeDeepClone(revealState);
  if (!updated.byInstanceId) {
    updated.byInstanceId = {};
  }

  if (revealUpdate.add) {
    for (const [instanceId, reveal] of Object.entries(revealUpdate.add)) {
      updated.byInstanceId[instanceId] = reveal;
    }
  }

  if (revealUpdate.set) {
    for (const [instanceId, reveal] of Object.entries(revealUpdate.set)) {
      updated.byInstanceId[instanceId] = reveal;
    }
  }

  if (Array.isArray(revealUpdate.remove)) {
    for (const instanceId of revealUpdate.remove) {
      delete updated.byInstanceId[instanceId];
    }
  }

  return updated;
}

/**
 * Move cursor and return new history state.
 * Does NOT rebuild combat state — caller must do that.
 */
export function moveCursor(historyState: HistoryState, newCursor: number): HistoryState {
  if (!historyState) {
    throw new Error('moveCursor requires historyState');
  }

  const { actions } = historyState;
  const clampedCursor = Math.max(0, Math.min(newCursor, actions.length));

  return {
    ...historyState,
    cursor: clampedCursor,
  };
}

/**
 * Perform undo: move cursor back and rebuild state.
 * Phase 5: Also returns reveal state if checkpoints contain it.
 */
export function undo(
  baseState: CombatState,
  historyState: HistoryState,
  currentCombatState: CombatState | null = null,
  baseRevealState: RevealState | null = null,
): UndoRedoResult {
  if (!canUndo(historyState)) {
    const result: UndoRedoResult = {
      newHistory: historyState,
      newCombatState: currentCombatState || baseState,
    };
    if (baseRevealState) result.newRevealState = baseRevealState;
    return result;
  }

  const newCursor = historyState.cursor - 1;
  const newHistory = moveCursor(historyState, newCursor);

  let newCombatState: CombatState;
  let newRevealState: RevealState | undefined;

  if (baseRevealState) {
    const rebuilt = rebuildState(baseState, newHistory, newCursor, baseRevealState) as RebuildResult;
    newCombatState = rebuilt.combatState;
    newRevealState = rebuilt.revealState;
  } else if (currentCombatState && historyState.cursor > 0) {
    const actionToUndo = historyState.actions[historyState.cursor - 1] as HistoryAction;
    newCombatState = applyInverse(currentCombatState, actionToUndo) as CombatState;
  } else {
    newCombatState = rebuildState(baseState, newHistory, newCursor) as CombatState;
  }

  const result: UndoRedoResult = { newHistory, newCombatState };
  if (newRevealState) result.newRevealState = newRevealState;
  return result;
}

/**
 * Perform redo: move cursor forward and rebuild state.
 * Phase 5: Also returns reveal state if checkpoints contain it.
 */
export function redo(
  baseState: CombatState,
  historyState: HistoryState,
  currentCombatState: CombatState | null = null,
  baseRevealState: RevealState | null = null,
): UndoRedoResult {
  if (!canRedo(historyState)) {
    const result: UndoRedoResult = {
      newHistory: historyState,
      newCombatState: currentCombatState || baseState,
    };
    if (baseRevealState) result.newRevealState = baseRevealState;
    return result;
  }

  const newCursor = historyState.cursor + 1;
  const newHistory = moveCursor(historyState, newCursor);

  let newCombatState: CombatState;
  let newRevealState: RevealState | undefined;

  if (baseRevealState) {
    const rebuilt = rebuildState(baseState, newHistory, newCursor, baseRevealState) as RebuildResult;
    newCombatState = rebuilt.combatState;
    newRevealState = rebuilt.revealState;
  } else if (currentCombatState && historyState.cursor < historyState.actions.length) {
    const actionToRedo = historyState.actions[historyState.cursor] as HistoryAction;
    newCombatState = applyAction(currentCombatState, actionToRedo) as CombatState;
  } else {
    newCombatState = rebuildState(baseState, newHistory, newCursor) as CombatState;
  }

  const result: UndoRedoResult = { newHistory, newCombatState };
  if (newRevealState) result.newRevealState = newRevealState;
  return result;
}

// ============================================================================
// Export / Import Helpers
// ============================================================================

export function exportHistory(historyState: HistoryState): HistoryState {
  return {
    version: historyState.version,
    actions: historyState.actions,
    cursor: historyState.cursor,
    checkpoints: historyState.checkpoints,
    checkpointEvery: historyState.checkpointEvery,
    maxActions: historyState.maxActions,
    maxCheckpoints: historyState.maxCheckpoints,
  };
}

export function importHistory(data: unknown): HistoryState {
  if (!data || typeof data !== 'object') {
    return createHistoryState();
  }

  const d = data as Partial<HistoryState>;
  return {
    version: d.version || 1,
    actions: Array.isArray(d.actions) ? d.actions : [],
    cursor: typeof d.cursor === 'number' ? d.cursor : 0,
    checkpoints: Array.isArray(d.checkpoints) ? d.checkpoints : [],
    checkpointEvery: d.checkpointEvery || DEFAULT_CONFIG.checkpointEvery,
    maxActions: d.maxActions || DEFAULT_CONFIG.maxActions,
    maxCheckpoints: d.maxCheckpoints || DEFAULT_CONFIG.maxCheckpoints,
  };
}
