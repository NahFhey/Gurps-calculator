/**
 * Combat Action Reducer for Phase 2 Undo/Redo System
 * Applies and inverts actions to mutate combat state
 * 
 * Uses immer for cleaner immutable updates, reducing O(n) array copies
 * to efficient structural sharing (typically O(log n))
 */

import { produce } from 'immer';
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

    case ACTION_TYPES.SET_TURN_DECISION:
      return applySetTurnDecision(state, action.payload);

    case ACTION_TYPES.ADD_REINFORCEMENTS:
      return applyAddReinforcements(state, action.payload);

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
      throw new Error(`Unknown action type: ${action.type}`);
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
      return applyTurnAdvance(state, action.inverse, action);

    case ACTION_TYPES.SET_RESOURCE:
      if (action.inverse) {
        return applySetResource(state, action.inverse, action);
      }
      return applySetResource(state, {
        ...action.payload,
        value: action.payload?.previousValue
      }, action);

    case ACTION_TYPES.ADD_LOG_ENTRY:
      return applyRemoveLogEntry(state, action.inverse, action);

    case ACTION_TYPES.REMOVE_LOG_ENTRY:
      return applyAddLogEntry(state, action.inverse, action);

    case ACTION_TYPES.UPDATE_LOG_ENTRY:
      return applyUpdateLogEntry(state, action.inverse, action);

    case ACTION_TYPES.REORDER_TURN_ORDER:
      return applyReorderTurnOrder(state, action.inverse, action);

    case ACTION_TYPES.LOAD_COMBAT_STATE:
      return applyLoadCombatState(state, action.inverse, action);

    case ACTION_TYPES.SET_TURN_DECISION:
      return applySetTurnDecision(state, action.inverse, action);

    case ACTION_TYPES.ADD_REINFORCEMENTS:
      return applyRemoveReinforcements(state, action.inverse, action);

    // Phase 6 inverses
    case ACTION_TYPES.ADD_CONDITION:
      return applyRemoveCondition(state, action.inverse, action);

    case ACTION_TYPES.REMOVE_CONDITION:
      return applyAddCondition(state, action.inverse, action);

    case ACTION_TYPES.UPDATE_CONDITION:
      return applyUpdateCondition(state, action.inverse, action);

    case ACTION_TYPES.USE_ITEM:
      return applyUseItemInverse(state, action.inverse, action);

    default:
      throw new Error(`Unknown action type for inverse: ${action.type}`);
  }
}

// ============================================================================
// Individual Action Appliers
// ============================================================================

/**
 * Apply TURN_ADVANCE
 */
function applyTurnAdvance(state, payload = {}) {
  const { toRound, toTurnIndex } = payload;
  if (typeof toRound === 'number' && typeof toTurnIndex === 'number') {
    return {
      ...state,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex
    };
  }

  const totalTurns = state.turnOrder?.length ?? 0;
  if (totalTurns === 0) {
    return state;
  }

  const nextTurnIndex = (state.currentTurnIndex + 1) % totalTurns;
  const roundIncrement = nextTurnIndex === 0 ? 1 : 0;

  return {
    ...state,
    currentRound: state.currentRound + roundIncrement,
    currentTurnIndex: nextTurnIndex
  };
}

/**
 * Apply SET_RESOURCE
 * Optimized with immer: O(1) lookup instead of O(n) array map
 */
function applySetResource(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const { instanceId, resource, mode, to, value, previousValue } = resolvedPayload || {};

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (!participant) {
      throw new Error(`Participant ${instanceId} not found`);
    }

    if (participant[resource] && mode) {
      participant[resource][mode] = to ?? value;
      return;
    }

    if (mode && participant[resource] && typeof participant[resource] === 'object') {
      participant[resource][mode] = to ?? value;
      return;
    }

    if (resource && mode) {
      if (!participant[resource]) {
        participant[resource] = {};
      }
      participant[resource][mode] = to ?? value;
      return;
    }

    const resolvedValue = to ?? value ?? previousValue;
    if (resource) {
      participant[`current${resource}`] = resolvedValue;
    }
  });
}

/**
 * Apply ADD_LOG_ENTRY
 * Optimized with immer: no array spread needed
 */
function applyAddLogEntry(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const entry = resolvedPayload?.entry ?? resolvedPayload;

  return produce(state, draft => {
    draft.log.push(entry);
  });
}

/**
 * Apply SET_TURN_DECISION
 */
function applySetTurnDecision(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const { decisionKey, decision } = resolvedPayload || {};

  return produce(state, draft => {
    if (!draft.turnDecisions) {
      draft.turnDecisions = {};
    }

    if (!decisionKey) {
      return;
    }

    if (decision === null || decision === undefined) {
      delete draft.turnDecisions[decisionKey];
      return;
    }

    draft.turnDecisions[decisionKey] = decision;
  });
}

/**
 * Apply ADD_REINFORCEMENTS
 */
function applyAddReinforcements(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const { addedCombatants, addedInstanceIds, turnOrderAfter, logEntry } = resolvedPayload || {};

  return produce(state, draft => {
    if (Array.isArray(addedCombatants)) {
      draft.participants.push(...addedCombatants);
    }

    if (Array.isArray(turnOrderAfter)) {
      draft.turnOrder = turnOrderAfter;
    }

    if (logEntry) {
      draft.log.push(logEntry);
    }

    if (Array.isArray(addedInstanceIds) && draft.turnDecisions) {
      for (const decisionKey of Object.keys(draft.turnDecisions)) {
        const matches = addedInstanceIds.some(id => decisionKey.includes(`_${id}`));
        if (matches) {
          delete draft.turnDecisions[decisionKey];
        }
      }
    }
  });
}

/**
 * Apply ADD_REINFORCEMENTS inverse
 */
function applyRemoveReinforcements(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const { removedInstanceIds, turnOrderBefore, logEntryId } = resolvedPayload || {};

  return produce(state, draft => {
    if (Array.isArray(removedInstanceIds)) {
      draft.participants = draft.participants.filter(
        participant => !removedInstanceIds.includes(participant.instanceId)
      );
    }

    if (Array.isArray(turnOrderBefore)) {
      draft.turnOrder = turnOrderBefore;
    }

    if (logEntryId) {
      const index = draft.log.findIndex(entry => entry.id === logEntryId);
      if (index !== -1) {
        draft.log.splice(index, 1);
      }
    }

    if (Array.isArray(removedInstanceIds) && draft.turnDecisions) {
      for (const decisionKey of Object.keys(draft.turnDecisions)) {
        const matches = removedInstanceIds.some(id => decisionKey.includes(`_${id}`));
        if (matches) {
          delete draft.turnDecisions[decisionKey];
        }
      }
    }
  });
}

/**
 * Apply REMOVE_LOG_ENTRY
 * Optimized with immer: efficient filtering
 */
function applyRemoveLogEntry(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const entryId = resolvedPayload?.entryId;
  const indexOverride = resolvedPayload?.index;
  const entry = resolvedPayload?.entry ?? resolvedPayload;

  return produce(state, draft => {
    let index = -1;
    if (typeof indexOverride === 'number') {
      index = indexOverride;
    } else if (entryId) {
      index = draft.log.findIndex(entryItem => entryItem.id === entryId);
    } else if (entry) {
      index = draft.log.findIndex(entryItem =>
        entryItem === entry ||
        (entryItem.timestamp === entry.timestamp && entryItem.text === entry.text)
      );
    }

    if (index !== -1) {
      draft.log.splice(index, 1);
    }
  });
}

/**
 * Apply UPDATE_LOG_ENTRY
 * Optimized with immer: direct property mutation
 */
function applyUpdateLogEntry(state, payload, action) {
  const resolvedPayload = payload || action?.payload;
  const entryId = resolvedPayload?.entryId;
  const indexOverride = resolvedPayload?.index;
  const updates = resolvedPayload?.updates;
  const toText = resolvedPayload?.toText;

  return produce(state, draft => {
    let entry = null;
    if (typeof indexOverride === 'number') {
      entry = draft.log[indexOverride];
    } else if (entryId) {
      entry = draft.log.find(e => e.id === entryId);
    }

    if (entry) {
      if (updates) {
        Object.assign(entry, updates);
      } else if (toText !== undefined) {
        entry.text = toText;
      }
    }
  });
}

/**
 * Apply REORDER_TURN_ORDER
 * Optimized with immer: direct array mutation
 */
function applyReorderTurnOrder(state, payload) {
  const { toOrder } = payload;

  return produce(state, draft => {
    draft.turnOrder = toOrder;
  });
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
 * Optimized with immer: O(1) participant lookup and direct array mutation
 */
function applyAddCondition(state, payload) {
  const { instanceId, conditionInstance } = payload;

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (participant) {
      if (!participant.conditions) {
        participant.conditions = [];
      }
      participant.conditions.push(conditionInstance);
    }
  });
}

/**
 * Apply REMOVE_CONDITION
 * Optimized with immer: efficient removal without full array copy
 */
function applyRemoveCondition(state, payload) {
  const { instanceId, conditionInstanceId } = payload;

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (participant && participant.conditions) {
      const index = participant.conditions.findIndex(c => c.instanceId === conditionInstanceId);
      if (index !== -1) {
        participant.conditions.splice(index, 1);
      }
    }
  });
}

/**
 * Apply UPDATE_CONDITION
 * Optimized with immer: direct condition property mutation
 */
function applyUpdateCondition(state, payload) {
  const { instanceId, conditionInstanceId, toCondition } = payload;

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (participant && participant.conditions) {
      const condition = participant.conditions.find(c => c.instanceId === conditionInstanceId);
      if (condition) {
        Object.assign(condition, toCondition);
      }
    }
  });
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
