/**
 * Alchemy Actions
 *
 * Action type constants and type definitions for alchemy-related state changes.
 */

import type {
  Id,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  AlchemySettings
} from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Reagent actions
export const ALCHEMY_REAGENT_ADD = 'addAlchemyReagent' as const;
export const ALCHEMY_REAGENT_UPDATE = 'updateAlchemyReagent' as const;
export const ALCHEMY_REAGENT_REMOVE = 'removeAlchemyReagent' as const;
export const ALCHEMY_REAGENTS_SET = 'setAlchemyReagents' as const;

// Formula actions
export const ALCHEMY_FORMULA_ADD = 'addAlchemyFormula' as const;
export const ALCHEMY_FORMULA_UPDATE = 'updateAlchemyFormula' as const;
export const ALCHEMY_FORMULA_REMOVE = 'removeAlchemyFormula' as const;
export const ALCHEMY_FORMULAS_SET = 'setAlchemyFormulas' as const;

// Batch actions
export const ALCHEMY_BATCH_ADD = 'addAlchemyBatch' as const;
export const ALCHEMY_BATCH_UPDATE = 'updateAlchemyBatch' as const;
export const ALCHEMY_BATCH_REMOVE = 'removeAlchemyBatch' as const;
export const ALCHEMY_BATCHES_SET = 'setAlchemyBatches' as const;

// Lab actions
export const ALCHEMY_LABS_SET = 'setAlchemyLabs' as const;
export const ALCHEMY_LAB_ADD = 'addAlchemyLab' as const;

// Settings actions
export const ALCHEMY_SETTINGS_UPDATE = 'updateAlchemySettings' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

export type AddAlchemyReagentAction = {
  type: typeof ALCHEMY_REAGENT_ADD;
  payload: AlchemyReagent;
};
export type UpdateAlchemyReagentAction = {
  type: typeof ALCHEMY_REAGENT_UPDATE;
  payload: { id: Id; changes: Partial<AlchemyReagent> };
};
export type RemoveAlchemyReagentAction = {
  type: typeof ALCHEMY_REAGENT_REMOVE;
  payload: Id;
};
export type SetAlchemyReagentsAction = {
  type: typeof ALCHEMY_REAGENTS_SET;
  payload: Record<Id, AlchemyReagent>;
};

export type AddAlchemyFormulaAction = {
  type: typeof ALCHEMY_FORMULA_ADD;
  payload: AlchemyFormula;
};
export type UpdateAlchemyFormulaAction = {
  type: typeof ALCHEMY_FORMULA_UPDATE;
  payload: { id: Id; changes: Partial<AlchemyFormula> };
};
export type RemoveAlchemyFormulaAction = {
  type: typeof ALCHEMY_FORMULA_REMOVE;
  payload: Id;
};
export type SetAlchemyFormulasAction = {
  type: typeof ALCHEMY_FORMULAS_SET;
  payload: Record<Id, AlchemyFormula>;
};

export type AddAlchemyBatchAction = {
  type: typeof ALCHEMY_BATCH_ADD;
  payload: AlchemyBatch;
};
export type UpdateAlchemyBatchAction = {
  type: typeof ALCHEMY_BATCH_UPDATE;
  payload: { id: Id; changes: Partial<AlchemyBatch> };
};
export type RemoveAlchemyBatchAction = {
  type: typeof ALCHEMY_BATCH_REMOVE;
  payload: Id;
};
export type SetAlchemyBatchesAction = {
  type: typeof ALCHEMY_BATCHES_SET;
  payload: Record<Id, AlchemyBatch>;
};

export type SetAlchemyLabsAction = {
  type: typeof ALCHEMY_LABS_SET;
  payload: Record<Id, AlchemyLab>;
};
export type AddAlchemyLabAction = {
  type: typeof ALCHEMY_LAB_ADD;
  payload: AlchemyLab;
};

export type UpdateAlchemySettingsAction = {
  type: typeof ALCHEMY_SETTINGS_UPDATE;
  payload: Partial<AlchemySettings>;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type AlchemyAction =
  | AddAlchemyReagentAction
  | UpdateAlchemyReagentAction
  | RemoveAlchemyReagentAction
  | SetAlchemyReagentsAction
  | AddAlchemyFormulaAction
  | UpdateAlchemyFormulaAction
  | RemoveAlchemyFormulaAction
  | SetAlchemyFormulasAction
  | AddAlchemyBatchAction
  | UpdateAlchemyBatchAction
  | RemoveAlchemyBatchAction
  | SetAlchemyBatchesAction
  | SetAlchemyLabsAction
  | AddAlchemyLabAction
  | UpdateAlchemySettingsAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const ALCHEMY_ACTION_TYPES: Set<string> = new Set([
  ALCHEMY_REAGENT_ADD,
  ALCHEMY_REAGENT_UPDATE,
  ALCHEMY_REAGENT_REMOVE,
  ALCHEMY_REAGENTS_SET,
  ALCHEMY_FORMULA_ADD,
  ALCHEMY_FORMULA_UPDATE,
  ALCHEMY_FORMULA_REMOVE,
  ALCHEMY_FORMULAS_SET,
  ALCHEMY_BATCH_ADD,
  ALCHEMY_BATCH_UPDATE,
  ALCHEMY_BATCH_REMOVE,
  ALCHEMY_BATCHES_SET,
  ALCHEMY_LABS_SET,
  ALCHEMY_LAB_ADD,
  ALCHEMY_SETTINGS_UPDATE
]);

export function isAlchemyAction(action: { type: string }): action is AlchemyAction {
  return ALCHEMY_ACTION_TYPES.has(action.type);
}
