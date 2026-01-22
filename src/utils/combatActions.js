/**
 * Combat Action Creators for Phase 2 Undo/Redo System
 * All state changes must go through actions to enable undo/redo
 */

import { generateId } from './combatHelpers';

/**
 * Action types
 */
export const ACTION_TYPES = {
  TURN_ADVANCE: 'TURN_ADVANCE',
  SET_RESOURCE: 'SET_RESOURCE',
  ADD_LOG_ENTRY: 'ADD_LOG_ENTRY',
  REMOVE_LOG_ENTRY: 'REMOVE_LOG_ENTRY',
  UPDATE_LOG_ENTRY: 'UPDATE_LOG_ENTRY',
  REORDER_TURN_ORDER: 'REORDER_TURN_ORDER',
  LOAD_COMBAT_STATE: 'LOAD_COMBAT_STATE'
};

/**
 * Create a TURN_ADVANCE action
 * Records a turn/round change
 *
 * @param {number} fromRound - Starting round
 * @param {number} fromTurnIndex - Starting turn index
 * @param {number} toRound - Ending round
 * @param {number} toTurnIndex - Ending turn index
 * @returns {object} Action object
 */
export function createTurnAdvanceAction(fromRound, fromTurnIndex, toRound, toTurnIndex) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.TURN_ADVANCE,
    label: `Turn: R${toRound} T${toTurnIndex + 1}`,
    payload: {
      fromRound,
      fromTurnIndex,
      toRound,
      toTurnIndex
    },
    inverse: {
      fromRound: toRound,
      fromTurnIndex: toTurnIndex,
      toRound: fromRound,
      toTurnIndex: fromTurnIndex
    }
  };
}

/**
 * Create a SET_RESOURCE action
 * Records a resource (HP/FP/MP) change
 *
 * @param {string} instanceId - Combatant instance ID
 * @param {string} resource - 'HP' | 'FP' | 'MP'
 * @param {number} from - Previous value
 * @param {number} to - New value
 * @returns {object} Action object
 */
export function createSetResourceAction(instanceId, resource, from, to) {
  const delta = to - from;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.SET_RESOURCE,
    label: `${resource} ${deltaStr}`,
    payload: {
      instanceId,
      resource,
      from,
      to
    },
    inverse: {
      instanceId,
      resource,
      from: to,
      to: from
    }
  };
}

/**
 * Create an ADD_LOG_ENTRY action
 * Records adding a log entry
 *
 * @param {object} entry - LogEntry object
 * @returns {object} Action object
 */
export function createAddLogEntryAction(entry) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.ADD_LOG_ENTRY,
    label: `Log: ${entry.entryType}`,
    payload: {
      entry
    },
    inverse: {
      entryId: entry.id
    }
  };
}

/**
 * Create a REMOVE_LOG_ENTRY action
 * Records removing a log entry
 *
 * @param {string} entryId - Log entry ID to remove
 * @param {object} entryBackup - Backup of the entry for undo
 * @returns {object} Action object
 */
export function createRemoveLogEntryAction(entryId, entryBackup) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.REMOVE_LOG_ENTRY,
    label: 'Remove log entry',
    payload: {
      entryId,
      entryBackup
    },
    inverse: {
      entry: entryBackup
    }
  };
}

/**
 * Create an UPDATE_LOG_ENTRY action
 * Records editing a log entry's text
 *
 * @param {string} entryId - Log entry ID
 * @param {string} fromText - Previous text
 * @param {string} toText - New text
 * @returns {object} Action object
 */
export function createUpdateLogEntryAction(entryId, fromText, toText) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.UPDATE_LOG_ENTRY,
    label: 'Edit log entry',
    payload: {
      entryId,
      fromText,
      toText
    },
    inverse: {
      entryId,
      fromText: toText,
      toText: fromText
    }
  };
}

/**
 * Create a REORDER_TURN_ORDER action
 * Records manual turn order reordering
 *
 * @param {string[]} fromOrder - Previous order (array of instanceIds)
 * @param {string[]} toOrder - New order (array of instanceIds)
 * @returns {object} Action object
 */
export function createReorderTurnOrderAction(fromOrder, toOrder) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.REORDER_TURN_ORDER,
    label: 'Reorder turn order',
    payload: {
      fromOrder: [...fromOrder],
      toOrder: [...toOrder]
    },
    inverse: {
      fromOrder: [...toOrder],
      toOrder: [...fromOrder]
    }
  };
}

/**
 * Create a LOAD_COMBAT_STATE action
 * Records loading a saved combat (allows undo across imports)
 *
 * @param {object} fromSnapshot - Previous state snapshot (or null if starting fresh)
 * @param {object} toSnapshot - New loaded state snapshot
 * @returns {object} Action object
 */
export function createLoadCombatStateAction(fromSnapshot, toSnapshot) {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.LOAD_COMBAT_STATE,
    label: 'Load combat state',
    payload: {
      fromSnapshot,
      toSnapshot
    },
    inverse: {
      fromSnapshot: toSnapshot,
      toSnapshot: fromSnapshot
    }
  };
}
