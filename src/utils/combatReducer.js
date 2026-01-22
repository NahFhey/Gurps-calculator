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

    // Phase 6 actions
    case ACTION_TYPES.ADD_CONDITION:
      return applyAddCondition(state, action.payload);

    case ACTION_TYPES.REMOVE_CONDITION:
      return applyRemoveCondition(state, action.payload);

    case ACTION_TYPES.UPDATE_CONDITION:
      return applyUpdateCondition(state, action.payload);

    case ACTION_TYPES.USE_ITEM:
      return applyUseItem(state, action.payload);

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

    // Phase 6 inverses
    case ACTION_TYPES.ADD_CONDITION:
      return applyRemoveCondition(state, action.inverse);

    case ACTION_TYPES.REMOVE_CONDITION:
      return applyAddCondition(state, action.inverse);

    case ACTION_TYPES.UPDATE_CONDITION:
      return applyUpdateCondition(state, action.inverse);

    case ACTION_TYPES.USE_ITEM:
      return applyUseItemInverse(state, action.inverse);

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

// ============================================================================
// Phase 6 Action Appliers
// ============================================================================

/**
 * Apply ADD_CONDITION
 */
function applyAddCondition(state, payload) {
  const { instanceId, conditionInstance } = payload;

  const updatedParticipants = state.participants.map(p => {
    if (p.instanceId === instanceId) {
      const conditions = p.conditions || [];
      return {
        ...p,
        conditions: [...conditions, conditionInstance]
      };
    }
    return p;
  });

  return {
    ...state,
    participants: updatedParticipants
  };
}

/**
 * Apply REMOVE_CONDITION
 */
function applyRemoveCondition(state, payload) {
  const { instanceId, conditionInstanceId } = payload;

  const updatedParticipants = state.participants.map(p => {
    if (p.instanceId === instanceId) {
      const conditions = p.conditions || [];
      return {
        ...p,
        conditions: conditions.filter(c => c.instanceId !== conditionInstanceId)
      };
    }
    return p;
  });

  return {
    ...state,
    participants: updatedParticipants
  };
}

/**
 * Apply UPDATE_CONDITION
 */
function applyUpdateCondition(state, payload) {
  const { instanceId, conditionInstanceId, toCondition } = payload;

  const updatedParticipants = state.participants.map(p => {
    if (p.instanceId === instanceId) {
      const conditions = p.conditions || [];
      return {
        ...p,
        conditions: conditions.map(c =>
          c.instanceId === conditionInstanceId ? toCondition : c
        )
      };
    }
    return p;
  });

  return {
    ...state,
    participants: updatedParticipants
  };
}

/**
 * Apply USE_ITEM
 *
 * This is a compound action that applies multiple changes:
 * - Resource changes (HP/FP/MP deltas)
 * - Conditions added
 * - Conditions removed
 *
 * Note: Inventory delta is handled separately by the component layer
 */
function applyUseItem(state, payload) {
  const { resourceChanges, conditionsAdded, conditionsRemoved } = payload;

  let updatedState = { ...state };

  // Apply resource changes
  for (const rc of resourceChanges) {
    updatedState = applySetResource(updatedState, {
      instanceId: rc.instanceId,
      resource: rc.resource,
      to: rc.to
    });
  }

  // Apply conditions added
  for (const ca of conditionsAdded) {
    updatedState = applyAddCondition(updatedState, {
      instanceId: ca.instanceId,
      conditionInstance: ca.conditionInstance
    });
  }

  // Apply conditions removed
  for (const cr of conditionsRemoved) {
    updatedState = applyRemoveCondition(updatedState, {
      instanceId: cr.instanceId,
      conditionInstanceId: cr.conditionInstance.instanceId
    });
  }

  return updatedState;
}

/**
 * Apply USE_ITEM inverse (for undo)
 */
function applyUseItemInverse(state, payload) {
  const { resourceChanges, conditionsAdded, conditionsRemoved } = payload;

  let updatedState = { ...state };

  // Reverse resource changes
  for (const rc of resourceChanges) {
    updatedState = applySetResource(updatedState, {
      instanceId: rc.instanceId,
      resource: rc.resource,
      to: rc.to
    });
  }

  // Reverse conditions added (remove them)
  for (const ca of conditionsAdded) {
    updatedState = applyRemoveCondition(updatedState, {
      instanceId: ca.instanceId,
      conditionInstanceId: ca.conditionInstance.instanceId
    });
  }

  // Reverse conditions removed (add them back)
  for (const cr of conditionsRemoved) {
    updatedState = applyAddCondition(updatedState, {
      instanceId: cr.instanceId,
      conditionInstance: cr.conditionInstance
    });
  }

  return updatedState;
}
