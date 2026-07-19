/**
 * Combat Action Creators for Phase 2 Undo/Redo System
 * All state changes must go through actions to enable undo/redo
 */

import { generateId } from './combatHelpers';

interface CombatUndoAction {
  id: string;
  ts: string;
  type: string;
  label: string;
  payload: Record<string, unknown>;
  inverse: Record<string, unknown>;
  revealUpdate?: unknown;
  [key: string]: unknown;
}

interface LogActionEntry {
  entryType?: string;
  id?: string;
}

interface AddReinforcementsActionParams {
  addedCombatants: unknown[];
  addedInstanceIds: string[];
  turnOrderBefore: string[];
  turnOrderAfter: string[];
  logEntry?: { id?: string } | null;
  revealUpdate?: unknown;
}

interface ConditionInstance {
  label: string;
  instanceId: string;
}

interface UpdatedCondition {
  label: string;
}

interface UseItemActionParams {
  actorInstanceId: string;
  targetInstanceId: string;
  item: {
    id: string;
    name: string;
    quantity: number;
    [key: string]: unknown;
  };
  effect: unknown;
  inventoryDelta: {
    quantityChange: number;
    [key: string]: unknown;
  };
  resourceChanges?: Array<{
    from: unknown;
    to: unknown;
    [key: string]: unknown;
  }>;
  conditionsAdded?: unknown[];
  conditionsRemoved?: unknown[];
}

interface HexPosition {
  r: number;
  q: number;
}

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
  LOAD_COMBAT_STATE: 'LOAD_COMBAT_STATE',
  SET_TURN_DECISION: 'SET_TURN_DECISION',
  ADD_REINFORCEMENTS: 'ADD_REINFORCEMENTS',
  // Phase 6 actions
  ADD_CONDITION: 'ADD_CONDITION',
  REMOVE_CONDITION: 'REMOVE_CONDITION',
  UPDATE_CONDITION: 'UPDATE_CONDITION',
  USE_ITEM: 'USE_ITEM',
  // Phase F (map integration) actions
  MOVE_PARTICIPANT: 'MOVE_PARTICIPANT'
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
export function createTurnAdvanceAction(
  fromRound: number,
  fromTurnIndex: number,
  toRound: number,
  toTurnIndex: number
): CombatUndoAction {
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
export function createSetResourceAction(
  instanceId: string,
  resource: string,
  from: number,
  to: number
): CombatUndoAction {
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
export function createAddLogEntryAction<T extends LogActionEntry>(entry: T): CombatUndoAction {
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
export function createRemoveLogEntryAction(
  entryId: string,
  entryBackup: unknown
): CombatUndoAction {
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
export function createUpdateLogEntryAction(
  entryId: string,
  fromText: string,
  toText: string
): CombatUndoAction {
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
export function createReorderTurnOrderAction(
  fromOrder: string[],
  toOrder: string[]
): CombatUndoAction {
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
export function createLoadCombatStateAction(
  fromSnapshot: unknown,
  toSnapshot: unknown
): CombatUndoAction {
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

/**
 * Phase 7: Create a SET_TURN_DECISION action
 * Records maneuver selection/notes for the current turn
 *
 * @param {string} decisionKey - Round/turn/actor key
 * @param {object|null} previousDecision - Previous decision state
 * @param {object|null} nextDecision - Next decision state
 * @returns {object} Action object
 */
export function createSetTurnDecisionAction(
  decisionKey: string,
  previousDecision: unknown,
  nextDecision: unknown
): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.SET_TURN_DECISION,
    label: 'Turn maneuver decision',
    payload: {
      decisionKey,
      decision: nextDecision
    },
    inverse: {
      decisionKey,
      decision: previousDecision
    }
  };
}

/**
 * Phase 8: Create an ADD_REINFORCEMENTS action
 * Records adding new combatants and updating turn order in one atomic action
 *
 * @param {object} params - Reinforcement action parameters
 * @returns {object} Action object
 */
export function createAddReinforcementsAction({
  addedCombatants,
  addedInstanceIds,
  turnOrderBefore,
  turnOrderAfter,
  logEntry,
  revealUpdate
}: AddReinforcementsActionParams): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.ADD_REINFORCEMENTS,
    label: 'Add reinforcements',
    payload: {
      addedCombatants,
      addedInstanceIds,
      turnOrderAfter,
      logEntry
    },
    inverse: {
      removedInstanceIds: addedInstanceIds,
      turnOrderBefore,
      logEntryId: logEntry?.id || null
    },
    revealUpdate
  };
}

/**
 * Phase 6: Create an ADD_CONDITION action
 * Records applying a condition to a combatant
 *
 * @param {string} instanceId - Combatant instance ID
 * @param {object} conditionInstance - Condition instance object
 * @returns {object} Action object
 */
export function createAddConditionAction(
  instanceId: string,
  conditionInstance: ConditionInstance
): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.ADD_CONDITION,
    label: `Add condition: ${conditionInstance.label}`,
    payload: {
      instanceId,
      conditionInstance
    },
    inverse: {
      instanceId,
      conditionInstanceId: conditionInstance.instanceId
    }
  };
}

/**
 * Phase 6: Create a REMOVE_CONDITION action
 * Records removing a condition from a combatant
 *
 * @param {string} instanceId - Combatant instance ID
 * @param {object} conditionInstance - Condition instance being removed (for undo)
 * @returns {object} Action object
 */
export function createRemoveConditionAction(
  instanceId: string,
  conditionInstance: ConditionInstance
): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.REMOVE_CONDITION,
    label: `Remove condition: ${conditionInstance.label}`,
    payload: {
      instanceId,
      conditionInstanceId: conditionInstance.instanceId,
      conditionBackup: conditionInstance
    },
    inverse: {
      instanceId,
      conditionInstance: conditionInstance
    }
  };
}

/**
 * Phase 6: Create an UPDATE_CONDITION action
 * Records updating a condition's duration
 *
 * @param {string} instanceId - Combatant instance ID
 * @param {string} conditionInstanceId - Condition instance ID
 * @param {object} fromCondition - Condition before update
 * @param {object} toCondition - Condition after update
 * @returns {object} Action object
 */
export function createUpdateConditionAction(
  instanceId: string,
  conditionInstanceId: string,
  fromCondition: unknown,
  toCondition: UpdatedCondition
): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.UPDATE_CONDITION,
    label: `Update condition: ${toCondition.label}`,
    payload: {
      instanceId,
      conditionInstanceId,
      fromCondition,
      toCondition
    },
    inverse: {
      instanceId,
      conditionInstanceId,
      fromCondition: toCondition,
      toCondition: fromCondition
    }
  };
}

/**
 * Phase 6: Create a USE_ITEM action
 * Records using an item in combat (includes inventory delta and effect application)
 *
 * @param {string} actorInstanceId - Actor using the item
 * @param {string} targetInstanceId - Target of the item effect
 * @param {object} item - Item being used
 * @param {object} effect - Effect being applied
 * @param {object} inventoryDelta - Inventory change for undo
 * @param {array} resourceChanges - Array of {instanceId, resource, from, to}
 * @param {array} conditionsAdded - Array of {instanceId, conditionInstance}
 * @param {array} conditionsRemoved - Array of {instanceId, conditionInstance}
 * @returns {object} Action object
 */
export function createUseItemAction({
  actorInstanceId,
  targetInstanceId,
  item,
  effect,
  inventoryDelta,
  resourceChanges = [],
  conditionsAdded = [],
  conditionsRemoved = []
}: UseItemActionParams): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.USE_ITEM,
    label: `Use ${item.name}`,
    payload: {
      actorInstanceId,
      targetInstanceId,
      item: {
        id: item.id,
        name: item.name,
        quantityBefore: item.quantity + Math.abs(inventoryDelta.quantityChange),
        quantityAfter: item.quantity
      },
      effect,
      inventoryDelta,
      resourceChanges,
      conditionsAdded,
      conditionsRemoved
    },
    inverse: {
      actorInstanceId,
      targetInstanceId,
      inventoryDelta,
      resourceChanges: resourceChanges.map(rc => ({
        ...rc,
        from: rc.to,
        to: rc.from
      })),
      conditionsAdded: conditionsRemoved,
      conditionsRemoved: conditionsAdded
    }
  };
}

/**
 * Phase F (Map Integration): Create a MOVE_PARTICIPANT action
 * Records moving a combatant on the tactical map.
 *
 * @param {string} instanceId - Combatant instance ID
 * @param {object} fromPosition - Starting position { r, q }
 * @param {object} toPosition - Destination position { r, q }
 * @param {string[]} path - Tile IDs along the movement path
 * @param {number} cost - Movement cost in yards
 * @returns {object} Action object
 */
export function createMoveParticipantAction(
  instanceId: string,
  fromPosition: HexPosition | null | undefined,
  toPosition: HexPosition | null | undefined,
  path: string[] = [],
  cost: number = 0
): CombatUndoAction {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type: ACTION_TYPES.MOVE_PARTICIPANT,
    label: `Move to (${toPosition?.r ?? '?'},${toPosition?.q ?? '?'})`,
    payload: {
      instanceId,
      fromPosition,
      toPosition,
      path,
      cost
    },
    inverse: {
      instanceId,
      fromPosition: toPosition,
      toPosition: fromPosition,
      path: [...path].reverse(),
      cost
    }
  };
}
