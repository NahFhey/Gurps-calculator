/**
 * Combat Action Reducer for Phase 2 Undo/Redo System
 * Applies and inverts actions to mutate combat state
 */

import { ACTION_TYPES } from './combatActions';

/**
 * Apply an action to combat state
 * Returns a NEW state object (immutable)
 *
 * @param {object} state - Current combat state
 * @param {object} action - Action to apply
 * @returns {object} New combat state
 */
export function applyAction(state, action) {
  if (!state || !action) {
    throw new Error('applyAction requires state and action');
  }

  switch (action.type) {
    case ACTION_TYPES.TURN_ADVANCE:
      return applyTurnAdvance(state, action.payload);

    case ACTION_TYPES.SET_RESOURCE:
      return applySetResource(state, action.payload);

    case ACTION_TYPES.ADD_LOG_ENTRY:
      return applyAddLogEntry(state, action.payload);

    case ACTION_TYPES.REMOVE_LOG_ENTRY:
      return applyRemoveLogEntry(state, action.payload);

    case ACTION_TYPES.UPDATE_LOG_ENTRY:
      return applyUpdateLogEntry(state, action.payload);

    case ACTION_TYPES.REORDER_TURN_ORDER:
      return applyReorderTurnOrder(state, action.payload);

    case ACTION_TYPES.LOAD_COMBAT_STATE:
      return applyLoadCombatState(state, action.payload);

    default:
      console.warn('Unknown action type:', action.type);
      return state;
  }
}

/**
 * Apply the inverse of an action (for undo)
 * Returns a NEW state object (immutable)
 *
 * @param {object} state - Current combat state
 * @param {object} action - Action to invert
 * @returns {object} New combat state
 */
export function applyInverse(state, action) {
  if (!state || !action) {
    throw new Error('applyInverse requires state and action');
  }

  switch (action.type) {
    case ACTION_TYPES.TURN_ADVANCE:
      return applyTurnAdvance(state, action.inverse);

    case ACTION_TYPES.SET_RESOURCE:
      return applySetResource(state, action.inverse);

    case ACTION_TYPES.ADD_LOG_ENTRY:
      return applyRemoveLogEntry(state, action.inverse);

    case ACTION_TYPES.REMOVE_LOG_ENTRY:
      return applyAddLogEntry(state, action.inverse);

    case ACTION_TYPES.UPDATE_LOG_ENTRY:
      return applyUpdateLogEntry(state, action.inverse);

    case ACTION_TYPES.REORDER_TURN_ORDER:
      return applyReorderTurnOrder(state, action.inverse);

    case ACTION_TYPES.LOAD_COMBAT_STATE:
      return applyLoadCombatState(state, action.inverse);

    default:
      console.warn('Unknown action type for inverse:', action.type);
      return state;
  }
}

// ============================================================================
// Individual Action Appliers
// ============================================================================

/**
 * Apply TURN_ADVANCE
 */
function applyTurnAdvance(state, payload) {
  const { toRound, toTurnIndex } = payload;

  return {
    ...state,
    currentRound: toRound,
    currentTurnIndex: toTurnIndex
  };
}

/**
 * Apply SET_RESOURCE
 */
function applySetResource(state, payload) {
  const { instanceId, resource, to } = payload;

  const updatedParticipants = state.participants.map(p =>
    p.instanceId === instanceId
      ? { ...p, [`current${resource}`]: to }
      : p
  );

  return {
    ...state,
    participants: updatedParticipants
  };
}

/**
 * Apply ADD_LOG_ENTRY
 */
function applyAddLogEntry(state, payload) {
  const { entry } = payload;

  return {
    ...state,
    log: [...state.log, entry]
  };
}

/**
 * Apply REMOVE_LOG_ENTRY
 */
function applyRemoveLogEntry(state, payload) {
  const { entryId } = payload;

  return {
    ...state,
    log: state.log.filter(entry => entry.id !== entryId)
  };
}

/**
 * Apply UPDATE_LOG_ENTRY
 */
function applyUpdateLogEntry(state, payload) {
  const { entryId, toText } = payload;

  const updatedLog = state.log.map(entry =>
    entry.id === entryId
      ? { ...entry, text: toText }
      : entry
  );

  return {
    ...state,
    log: updatedLog
  };
}

/**
 * Apply REORDER_TURN_ORDER
 */
function applyReorderTurnOrder(state, payload) {
  const { toOrder } = payload;

  return {
    ...state,
    turnOrder: [...toOrder]
  };
}

/**
 * Apply LOAD_COMBAT_STATE
 */
function applyLoadCombatState(state, payload) {
  const { toSnapshot } = payload;

  // Replace entire state with snapshot
  // Note: toSnapshot should be a valid CombatState (without history)
  if (!toSnapshot) {
    return state; // Can't load null state
  }

  return {
    ...toSnapshot
  };
}
