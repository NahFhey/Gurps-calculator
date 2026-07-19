/**
 * Combat Action Reducer for Phase 2 Undo/Redo System
 * Applies and inverts actions to mutate combat state
 * 
 * Uses immer for cleaner immutable updates, reducing O(n) array copies
 * to efficient structural sharing (typically O(log n))
 */

import { produce } from 'immer';
import type { CombatState } from '../types/combatTracker';
import { ACTION_TYPES } from './combatActions';

interface CombatReducerAction {
  type?: unknown;
  payload?: unknown;
  inverse?: unknown;
  [key: string]: unknown;
}

interface WorkCondition {
  instanceId?: string;
}

interface WorkParticipant {
  instanceId?: string;
  conditions?: WorkCondition[];
}

interface WorkLogEntry {
  id?: string;
  timestamp?: unknown;
  text?: string;
}

interface WorkState {
  participants: WorkParticipant[];
  turnOrder?: string[];
  currentTurnIndex: number;
  currentRound: number;
  log: WorkLogEntry[];
  turnDecisions?: Record<string, unknown>;
}

interface TurnAdvancePayload {
  toRound?: unknown;
  toTurnIndex?: unknown;
  [key: string]: unknown;
}

interface SetResourcePayload {
  instanceId?: unknown;
  resource?: unknown;
  mode?: unknown;
  to?: unknown;
  value?: unknown;
  previousValue?: unknown;
  [key: string]: unknown;
}

interface LogPayload extends WorkLogEntry {
  entry?: WorkLogEntry;
  entryId?: string;
  index?: number;
  updates?: Record<string, unknown>;
  toText?: string;
}

interface TurnDecisionPayload {
  decisionKey?: string;
  decision?: unknown;
  [key: string]: unknown;
}

interface ReinforcementsPayload {
  addedCombatants?: WorkParticipant[];
  addedInstanceIds?: string[];
  turnOrderAfter?: string[];
  logEntry?: WorkLogEntry;
  removedInstanceIds?: string[];
  turnOrderBefore?: string[];
  logEntryId?: string;
  [key: string]: unknown;
}

interface ReorderTurnOrderPayload {
  toOrder?: string[];
  [key: string]: unknown;
}

interface LoadCombatStatePayload {
  toSnapshot?: WorkState;
  [key: string]: unknown;
}

interface ConditionPayload {
  instanceId?: unknown;
  conditionInstance?: WorkCondition;
  conditionInstanceId?: unknown;
  toCondition?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ResourceChange {
  instanceId?: unknown;
  resource?: unknown;
  to?: unknown;
  [key: string]: unknown;
}

interface ConditionChange {
  instanceId?: unknown;
  conditionInstance: WorkCondition;
  [key: string]: unknown;
}

interface UseItemPayload {
  resourceChanges?: ResourceChange[];
  conditionsAdded?: ConditionChange[];
  conditionsRemoved?: ConditionChange[];
  [key: string]: unknown;
}

/**
 * Apply an action to combat state
 * Returns a NEW state object (immutable)
 *
 * @param {object} state - Current combat state
 * @param {object} action - Action to apply
 * @returns {object} New combat state
 */
export function applyAction(state: CombatState, action: CombatReducerAction): CombatState {
  if (!state || !action) {
    throw new Error('applyAction requires state and action');
  }

  const workState = state as WorkState;

  switch (action.type) {
    case ACTION_TYPES.TURN_ADVANCE:
      return applyTurnAdvance(workState, action.payload as TurnAdvancePayload) as CombatState;

    case ACTION_TYPES.SET_RESOURCE:
      return applySetResource(workState, action.payload as SetResourcePayload) as CombatState;

    case ACTION_TYPES.ADD_LOG_ENTRY:
      return applyAddLogEntry(workState, action.payload as LogPayload) as CombatState;

    case ACTION_TYPES.REMOVE_LOG_ENTRY:
      return applyRemoveLogEntry(workState, action.payload as LogPayload) as CombatState;

    case ACTION_TYPES.UPDATE_LOG_ENTRY:
      return applyUpdateLogEntry(workState, action.payload as LogPayload) as CombatState;

    case ACTION_TYPES.REORDER_TURN_ORDER:
      return applyReorderTurnOrder(workState, action.payload as ReorderTurnOrderPayload) as CombatState;

    case ACTION_TYPES.LOAD_COMBAT_STATE:
      return applyLoadCombatState(workState, action.payload as LoadCombatStatePayload) as CombatState;

    case ACTION_TYPES.SET_TURN_DECISION:
      return applySetTurnDecision(workState, action.payload as TurnDecisionPayload) as CombatState;

    case ACTION_TYPES.ADD_REINFORCEMENTS:
      return applyAddReinforcements(workState, action.payload as ReinforcementsPayload) as CombatState;

    // Phase 6 actions
    case ACTION_TYPES.ADD_CONDITION:
      return applyAddCondition(workState, action.payload as ConditionPayload) as CombatState;

    case ACTION_TYPES.REMOVE_CONDITION:
      return applyRemoveCondition(workState, action.payload as ConditionPayload) as CombatState;

    case ACTION_TYPES.UPDATE_CONDITION:
      return applyUpdateCondition(workState, action.payload as ConditionPayload) as CombatState;

    case ACTION_TYPES.USE_ITEM:
      return applyUseItem(workState, action.payload as UseItemPayload) as CombatState;

    default:
      throw new Error(`Unknown action type: ${action.type as string}`);
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
export function applyInverse(state: CombatState, action: CombatReducerAction): CombatState {
  if (!state || !action) {
    throw new Error('applyInverse requires state and action');
  }

  const workState = state as WorkState;

  switch (action.type) {
    case ACTION_TYPES.TURN_ADVANCE:
      return applyTurnAdvance(workState, action.inverse as TurnAdvancePayload, action) as CombatState;

    case ACTION_TYPES.SET_RESOURCE:
      if (action.inverse) {
        return applySetResource(workState, action.inverse as SetResourcePayload, action) as CombatState;
      }
      return applySetResource(workState, {
        ...(action.payload as SetResourcePayload),
        value: (action.payload as SetResourcePayload | undefined)?.previousValue
      }, action) as CombatState;

    case ACTION_TYPES.ADD_LOG_ENTRY:
      return applyRemoveLogEntry(workState, action.inverse as LogPayload, action) as CombatState;

    case ACTION_TYPES.REMOVE_LOG_ENTRY:
      return applyAddLogEntry(workState, action.inverse as LogPayload, action) as CombatState;

    case ACTION_TYPES.UPDATE_LOG_ENTRY:
      return applyUpdateLogEntry(workState, action.inverse as LogPayload, action) as CombatState;

    case ACTION_TYPES.REORDER_TURN_ORDER:
      return applyReorderTurnOrder(workState, action.inverse as ReorderTurnOrderPayload, action) as CombatState;

    case ACTION_TYPES.LOAD_COMBAT_STATE:
      return applyLoadCombatState(workState, action.inverse as LoadCombatStatePayload, action) as CombatState;

    case ACTION_TYPES.SET_TURN_DECISION:
      return applySetTurnDecision(workState, action.inverse as TurnDecisionPayload, action) as CombatState;

    case ACTION_TYPES.ADD_REINFORCEMENTS:
      return applyRemoveReinforcements(workState, action.inverse as ReinforcementsPayload, action) as CombatState;

    // Phase 6 inverses
    case ACTION_TYPES.ADD_CONDITION:
      return applyRemoveCondition(workState, action.inverse as ConditionPayload, action) as CombatState;

    case ACTION_TYPES.REMOVE_CONDITION:
      return applyAddCondition(workState, action.inverse as ConditionPayload, action) as CombatState;

    case ACTION_TYPES.UPDATE_CONDITION:
      return applyUpdateCondition(workState, action.inverse as ConditionPayload, action) as CombatState;

    case ACTION_TYPES.USE_ITEM:
      return applyUseItemInverse(workState, action.inverse as UseItemPayload, action) as CombatState;

    default:
      throw new Error(`Unknown action type for inverse: ${action.type as string}`);
  }
}

// ============================================================================
// Individual Action Appliers
// ============================================================================

/**
 * Apply TURN_ADVANCE
 */
function applyTurnAdvance(
  state: WorkState,
  payload?: TurnAdvancePayload,
  action?: CombatReducerAction
): WorkState;
function applyTurnAdvance(state: WorkState, payload: TurnAdvancePayload = {}): WorkState {
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
function applySetResource(
  state: WorkState,
  payload?: SetResourcePayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as SetResourcePayload | undefined;
  const { instanceId, resource, mode, to, value, previousValue } = resolvedPayload || {};

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (!participant) {
      throw new Error(`Participant ${instanceId} not found`);
    }

    const dynamicParticipant = participant as WorkParticipant & Record<string, unknown>;
    const resourceKey = resource as string;
    const modeKey = mode as string;

    if (dynamicParticipant[resourceKey] && mode) {
      const bucket = dynamicParticipant[resourceKey] as Record<string, unknown>;
      bucket[modeKey] = to ?? value;
      return;
    }

    if (
      mode &&
      dynamicParticipant[resourceKey] &&
      typeof dynamicParticipant[resourceKey] === 'object'
    ) {
      const bucket = dynamicParticipant[resourceKey] as Record<string, unknown>;
      bucket[modeKey] = to ?? value;
      return;
    }

    if (resource && mode) {
      if (!dynamicParticipant[resourceKey]) {
        dynamicParticipant[resourceKey] = {};
      }
      const bucket = dynamicParticipant[resourceKey] as Record<string, unknown>;
      bucket[modeKey] = to ?? value;
      return;
    }

    const resolvedValue = to ?? value ?? previousValue;
    if (resource) {
      dynamicParticipant[`current${resource as string}`] = resolvedValue;
    }
  });
}

/**
 * Apply ADD_LOG_ENTRY
 * Optimized with immer: no array spread needed
 */
function applyAddLogEntry(
  state: WorkState,
  payload?: LogPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as LogPayload | undefined;
  const entry = resolvedPayload?.entry ?? resolvedPayload;

  return produce(state, draft => {
    draft.log.push(entry as WorkLogEntry);
  });
}

/**
 * Apply SET_TURN_DECISION
 */
function applySetTurnDecision(
  state: WorkState,
  payload?: TurnDecisionPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as TurnDecisionPayload | undefined;
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
function applyAddReinforcements(
  state: WorkState,
  payload?: ReinforcementsPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as ReinforcementsPayload | undefined;
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
function applyRemoveReinforcements(
  state: WorkState,
  payload?: ReinforcementsPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as ReinforcementsPayload | undefined;
  const { removedInstanceIds, turnOrderBefore, logEntryId } = resolvedPayload || {};

  return produce(state, draft => {
    if (Array.isArray(removedInstanceIds)) {
      draft.participants = draft.participants.filter(
        participant => !removedInstanceIds.includes(participant.instanceId as string)
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
function applyRemoveLogEntry(
  state: WorkState,
  payload?: LogPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as LogPayload | undefined;
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
function applyUpdateLogEntry(
  state: WorkState,
  payload?: LogPayload,
  action?: CombatReducerAction
): WorkState {
  const resolvedPayload = (payload || action?.payload) as LogPayload | undefined;
  const entryId = resolvedPayload?.entryId;
  const indexOverride = resolvedPayload?.index;
  const updates = resolvedPayload?.updates;
  const toText = resolvedPayload?.toText;

  return produce(state, draft => {
    let entry: (typeof draft.log)[number] | null | undefined = null;
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
function applyReorderTurnOrder(
  state: WorkState,
  payload: ReorderTurnOrderPayload,
  action?: CombatReducerAction
): WorkState;
function applyReorderTurnOrder(
  state: WorkState,
  payload: ReorderTurnOrderPayload
): WorkState {
  const { toOrder } = payload;

  return produce(state, draft => {
    draft.turnOrder = toOrder;
  });
}

/**
 * Apply LOAD_COMBAT_STATE
 */
function applyLoadCombatState(
  state: WorkState,
  payload: LoadCombatStatePayload,
  action?: CombatReducerAction
): WorkState;
function applyLoadCombatState(state: WorkState, payload: LoadCombatStatePayload): WorkState {
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
function applyAddCondition(
  state: WorkState,
  payload: ConditionPayload,
  action?: CombatReducerAction
): WorkState;
function applyAddCondition(state: WorkState, payload: ConditionPayload): WorkState {
  const { instanceId, conditionInstance } = payload;

  return produce(state, draft => {
    const participant = draft.participants.find(p => p.instanceId === instanceId);
    if (participant) {
      if (!participant.conditions) {
        participant.conditions = [];
      }
      participant.conditions.push(conditionInstance as WorkCondition);
    }
  });
}

/**
 * Apply REMOVE_CONDITION
 * Optimized with immer: efficient removal without full array copy
 */
function applyRemoveCondition(
  state: WorkState,
  payload: ConditionPayload,
  action?: CombatReducerAction
): WorkState;
function applyRemoveCondition(state: WorkState, payload: ConditionPayload): WorkState {
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
function applyUpdateCondition(
  state: WorkState,
  payload: ConditionPayload,
  action?: CombatReducerAction
): WorkState;
function applyUpdateCondition(state: WorkState, payload: ConditionPayload): WorkState {
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
function applyUseItem(
  state: WorkState,
  payload: UseItemPayload,
  action?: CombatReducerAction
): WorkState;
function applyUseItem(state: WorkState, payload: UseItemPayload): WorkState {
  const { resourceChanges, conditionsAdded, conditionsRemoved } = payload;

  let updatedState: WorkState = { ...state };

  // Apply resource changes
  for (const rc of resourceChanges as ResourceChange[]) {
    updatedState = applySetResource(updatedState, {
      instanceId: rc.instanceId,
      resource: rc.resource,
      to: rc.to
    });
  }

  // Apply conditions added
  for (const ca of conditionsAdded as ConditionChange[]) {
    updatedState = applyAddCondition(updatedState, {
      instanceId: ca.instanceId,
      conditionInstance: ca.conditionInstance
    });
  }

  // Apply conditions removed
  for (const cr of conditionsRemoved as ConditionChange[]) {
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
function applyUseItemInverse(
  state: WorkState,
  payload: UseItemPayload,
  action?: CombatReducerAction
): WorkState;
function applyUseItemInverse(state: WorkState, payload: UseItemPayload): WorkState {
  const { resourceChanges, conditionsAdded, conditionsRemoved } = payload;

  let updatedState: WorkState = { ...state };

  // Reverse resource changes
  for (const rc of resourceChanges as ResourceChange[]) {
    updatedState = applySetResource(updatedState, {
      instanceId: rc.instanceId,
      resource: rc.resource,
      to: rc.to
    });
  }

  // Reverse conditions added (remove them)
  for (const ca of conditionsAdded as ConditionChange[]) {
    updatedState = applyRemoveCondition(updatedState, {
      instanceId: ca.instanceId,
      conditionInstanceId: ca.conditionInstance.instanceId
    });
  }

  // Reverse conditions removed (add them back)
  for (const cr of conditionsRemoved as ConditionChange[]) {
    updatedState = applyAddCondition(updatedState, {
      instanceId: cr.instanceId,
      conditionInstance: cr.conditionInstance
    });
  }

  return updatedState;
}
