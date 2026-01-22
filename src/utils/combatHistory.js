/**
 * Combat History Manager for Phase 2 Hybrid Undo System
 * Manages actions, cursor, checkpoints, and state rebuild
 */

import { applyAction, applyInverse } from './combatReducer';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  checkpointEvery: 25,
  maxActions: 500,
  maxCheckpoints: 30
};

// ============================================================================
// History State Creation
// ============================================================================

/**
 * Create a new empty history state
 * @param {object} config - Optional configuration overrides
 * @returns {object} CombatHistoryState
 */
export function createHistoryState(config = {}) {
  return {
    version: 1,
    actions: [],
    cursor: 0, // Points between actions (0 = before all actions)
    checkpoints: [],
    checkpointEvery: config.checkpointEvery || DEFAULT_CONFIG.checkpointEvery,
    maxActions: config.maxActions || DEFAULT_CONFIG.maxActions,
    maxCheckpoints: config.maxCheckpoints || DEFAULT_CONFIG.maxCheckpoints
  };
}

/**
 * Create a snapshot of combat state (without history metadata)
 * @param {object} combatState - Full combat state
 * @returns {object} Snapshot
 */
export function createSnapshot(combatState) {
  // Create a shallow copy without history reference
  const { history, ...snapshot } = combatState;
  return snapshot;
}

// ============================================================================
// Action Management
// ============================================================================

/**
 * Add an action to history
 * This records the action and advances the cursor
 * Also handles checkpoint creation and pruning
 *
 * @param {object} historyState - Current history state
 * @param {object} action - Action to add
 * @param {object} currentCombatState - Current combat state (for checkpoint)
 * @returns {object} New history state
 */
export function addAction(historyState, action, currentCombatState) {
  if (!historyState || !action) {
    throw new Error('addAction requires historyState and action');
  }

  const { actions, cursor, checkpoints, checkpointEvery, maxActions, maxCheckpoints } = historyState;

  // If cursor is not at the end, discard actions after cursor (branching timeline)
  const newActions = cursor < actions.length
    ? [...actions.slice(0, cursor), action]
    : [...actions, action];

  // New cursor is after the added action
  const newCursor = cursor + 1;

  // Check if we need to create a checkpoint
  let newCheckpoints = [...checkpoints];
  const shouldCreateCheckpoint = newCursor % checkpointEvery === 0;

  if (shouldCreateCheckpoint && currentCombatState) {
    const snapshot = createSnapshot(currentCombatState);
    newCheckpoints.push({
      at: newCursor,
      snapshot
    });

    // Prune checkpoints if over limit
    if (newCheckpoints.length > maxCheckpoints) {
      newCheckpoints = newCheckpoints.slice(-maxCheckpoints);
    }
  }

  // Prune actions if over limit
  let finalActions = newActions;
  let finalCursor = newCursor;
  let finalCheckpoints = newCheckpoints;

  if (finalActions.length > maxActions) {
    const excess = finalActions.length - maxActions;
    finalActions = finalActions.slice(excess);
    finalCursor = finalCursor - excess;

    // Adjust checkpoint positions and prune invalid ones
    finalCheckpoints = finalCheckpoints
      .map(cp => ({ ...cp, at: cp.at - excess }))
      .filter(cp => cp.at >= 0);

    // Ensure we have at least one checkpoint at the start
    if (finalCheckpoints.length === 0 || finalCheckpoints[0].at > 0) {
      // Need to create a new base checkpoint
      // This is a problem - we don't have the state at position 0
      // Best we can do is rebuild from what we have
      console.warn('Action history pruned without checkpoint at start. May cause issues.');
    }
  }

  return {
    ...historyState,
    actions: finalActions,
    cursor: finalCursor,
    checkpoints: finalCheckpoints
  };
}

/**
 * Can undo? (cursor > 0)
 * @param {object} historyState
 * @returns {boolean}
 */
export function canUndo(historyState) {
  return historyState && historyState.cursor > 0;
}

/**
 * Can redo? (cursor < actions.length)
 * @param {object} historyState
 * @returns {boolean}
 */
export function canRedo(historyState) {
  return historyState && historyState.cursor < historyState.actions.length;
}

/**
 * Get undo count (how many actions can be undone)
 * @param {object} historyState
 * @returns {number}
 */
export function getUndoCount(historyState) {
  return historyState ? historyState.cursor : 0;
}

/**
 * Get redo count (how many actions can be redone)
 * @param {object} historyState
 * @returns {number}
 */
export function getRedoCount(historyState) {
  if (!historyState) return 0;
  return historyState.actions.length - historyState.cursor;
}

// ============================================================================
// State Rebuild
// ============================================================================

/**
 * Find the nearest checkpoint at or before a given position
 * @param {object} historyState
 * @param {number} targetCursor - Target cursor position
 * @returns {{at: number, snapshot: object} | null}
 */
function findNearestCheckpoint(historyState, targetCursor) {
  const { checkpoints } = historyState;

  if (!checkpoints || checkpoints.length === 0) {
    return null;
  }

  // Find the latest checkpoint with at <= targetCursor
  let nearest = null;
  for (const checkpoint of checkpoints) {
    if (checkpoint.at <= targetCursor) {
      if (!nearest || checkpoint.at > nearest.at) {
        nearest = checkpoint;
      }
    }
  }

  return nearest;
}

/**
 * Rebuild combat state from history at a specific cursor position
 * Uses nearest checkpoint and replays actions forward
 *
 * @param {object} baseState - Base combat state (at cursor 0)
 * @param {object} historyState - History state with actions and checkpoints
 * @param {number} targetCursor - Target cursor position to rebuild to
 * @returns {object} Rebuilt combat state
 */
export function rebuildState(baseState, historyState, targetCursor) {
  if (!baseState || !historyState) {
    throw new Error('rebuildState requires baseState and historyState');
  }

  const { actions, checkpoints } = historyState;

  // If target is 0, return base state
  if (targetCursor === 0) {
    return baseState;
  }

  // Find nearest checkpoint
  const checkpoint = findNearestCheckpoint(historyState, targetCursor);

  let state;
  let startIndex;

  if (checkpoint) {
    // Start from checkpoint
    state = { ...checkpoint.snapshot };
    startIndex = checkpoint.at;
  } else {
    // No checkpoint, start from base
    state = baseState;
    startIndex = 0;
  }

  // Replay actions from startIndex to targetCursor - 1
  for (let i = startIndex; i < targetCursor; i++) {
    if (i >= actions.length) {
      console.warn('Rebuild requested cursor beyond actions length');
      break;
    }
    state = applyAction(state, actions[i]);
  }

  return state;
}

/**
 * Move cursor and return new history state
 * Does NOT rebuild combat state - caller must do that
 *
 * @param {object} historyState - Current history state
 * @param {number} newCursor - New cursor position
 * @returns {object} New history state with updated cursor
 */
export function moveCursor(historyState, newCursor) {
  if (!historyState) {
    throw new Error('moveCursor requires historyState');
  }

  const { actions } = historyState;

  // Clamp cursor to valid range
  const clampedCursor = Math.max(0, Math.min(newCursor, actions.length));

  return {
    ...historyState,
    cursor: clampedCursor
  };
}

/**
 * Perform undo: move cursor back and rebuild state
 * Returns { newHistory, newCombatState }
 *
 * @param {object} baseState - Base combat state at cursor 0
 * @param {object} historyState - Current history state
 * @param {object} currentCombatState - Current combat state (optional, for optimization)
 * @returns {{newHistory: object, newCombatState: object}}
 */
export function undo(baseState, historyState, currentCombatState = null) {
  if (!canUndo(historyState)) {
    return { newHistory: historyState, newCombatState: currentCombatState || baseState };
  }

  const newCursor = historyState.cursor - 1;
  const newHistory = moveCursor(historyState, newCursor);

  // Optimization: if we have current state, we can apply inverse instead of full rebuild
  let newCombatState;
  if (currentCombatState && historyState.cursor > 0) {
    const actionToUndo = historyState.actions[historyState.cursor - 1];
    newCombatState = applyInverse(currentCombatState, actionToUndo);
  } else {
    newCombatState = rebuildState(baseState, newHistory, newCursor);
  }

  return { newHistory, newCombatState };
}

/**
 * Perform redo: move cursor forward and rebuild state
 * Returns { newHistory, newCombatState }
 *
 * @param {object} baseState - Base combat state at cursor 0
 * @param {object} historyState - Current history state
 * @param {object} currentCombatState - Current combat state (optional, for optimization)
 * @returns {{newHistory: object, newCombatState: object}}
 */
export function redo(baseState, historyState, currentCombatState = null) {
  if (!canRedo(historyState)) {
    return { newHistory: historyState, newCombatState: currentCombatState || baseState };
  }

  const newCursor = historyState.cursor + 1;
  const newHistory = moveCursor(historyState, newCursor);

  // Optimization: if we have current state, we can apply action instead of full rebuild
  let newCombatState;
  if (currentCombatState && historyState.cursor < historyState.actions.length) {
    const actionToRedo = historyState.actions[historyState.cursor];
    newCombatState = applyAction(currentCombatState, actionToRedo);
  } else {
    newCombatState = rebuildState(baseState, newHistory, newCursor);
  }

  return { newHistory, newCombatState };
}

// ============================================================================
// Export / Import Helpers
// ============================================================================

/**
 * Prepare history state for export
 * @param {object} historyState
 * @returns {object} Serializable history state
 */
export function exportHistory(historyState) {
  return {
    version: historyState.version,
    actions: historyState.actions,
    cursor: historyState.cursor,
    checkpoints: historyState.checkpoints,
    checkpointEvery: historyState.checkpointEvery,
    maxActions: historyState.maxActions,
    maxCheckpoints: historyState.maxCheckpoints
  };
}

/**
 * Import and validate history state
 * @param {object} data - Imported data
 * @returns {object} Valid history state
 */
export function importHistory(data) {
  if (!data || typeof data !== 'object') {
    return createHistoryState();
  }

  return {
    version: data.version || 1,
    actions: Array.isArray(data.actions) ? data.actions : [],
    cursor: typeof data.cursor === 'number' ? data.cursor : 0,
    checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
    checkpointEvery: data.checkpointEvery || DEFAULT_CONFIG.checkpointEvery,
    maxActions: data.maxActions || DEFAULT_CONFIG.maxActions,
    maxCheckpoints: data.maxCheckpoints || DEFAULT_CONFIG.maxCheckpoints
  };
}
