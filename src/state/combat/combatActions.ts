/**
 * Combat Actions
 *
 * Action type constants and type definitions for combat-related state changes.
 * Covers combat characters, sessions, history, tombstones, rules, and items.
 */

import type { Id, CombatCharacter, CombatItem, CombatSession } from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Combat character actions
export const COMBAT_CHARACTER_ADD = 'addCombatCharacter' as const;
export const COMBAT_CHARACTER_UPDATE = 'updateCombatCharacter' as const;
export const COMBAT_CHARACTER_REMOVE = 'removeCombatCharacter' as const;
export const COMBAT_CHARACTERS_SET = 'setCombatCharacters' as const;

// Combat session actions
export const COMBAT_ACTIVE_SET = 'setCombatActive' as const;
export const COMBAT_ACTIVE_UPDATE = 'updateCombatActive' as const;

// Combat history actions
export const COMBAT_HISTORY_SET = 'setCombatHistory' as const;
export const COMBAT_TOMBSTONES_SET = 'setCombatTombstones' as const;

// Combat rules actions
export const COMBAT_RULES_PRESET_SET = 'setCombatRulesPreset' as const;

// Combat item actions
export const COMBAT_ITEMS_SET = 'setCombatItems' as const;
export const COMBAT_ITEM_ADD = 'addCombatItem' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

// Combat character action types
export type AddCombatCharacterAction = {
  type: typeof COMBAT_CHARACTER_ADD;
  payload: CombatCharacter;
};
export type UpdateCombatCharacterAction = {
  type: typeof COMBAT_CHARACTER_UPDATE;
  payload: { id: Id; changes: Partial<CombatCharacter> };
};
export type RemoveCombatCharacterAction = {
  type: typeof COMBAT_CHARACTER_REMOVE;
  payload: Id;
};
export type SetCombatCharactersAction = {
  type: typeof COMBAT_CHARACTERS_SET;
  payload: Record<Id, CombatCharacter>;
};

// Combat session action types
export type SetCombatActiveAction = {
  type: typeof COMBAT_ACTIVE_SET;
  payload: CombatSession | null;
};
export type UpdateCombatActiveAction = {
  type: typeof COMBAT_ACTIVE_UPDATE;
  payload: Partial<CombatSession>;
};

// Combat history action types
export type SetCombatHistoryAction = {
  type: typeof COMBAT_HISTORY_SET;
  payload: CombatSession[];
};
export type SetCombatTombstonesAction = {
  type: typeof COMBAT_TOMBSTONES_SET;
  payload: CombatCharacter[];
};

// Combat rules action types
export type SetCombatRulesPresetAction = {
  type: typeof COMBAT_RULES_PRESET_SET;
  payload: string;
};

// Combat item action types
export type SetCombatItemsAction = {
  type: typeof COMBAT_ITEMS_SET;
  payload: Record<Id, CombatItem>;
};
export type AddCombatItemAction = {
  type: typeof COMBAT_ITEM_ADD;
  payload: CombatItem;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type CombatAction =
  // Character actions
  | AddCombatCharacterAction
  | UpdateCombatCharacterAction
  | RemoveCombatCharacterAction
  | SetCombatCharactersAction
  // Session actions
  | SetCombatActiveAction
  | UpdateCombatActiveAction
  // History actions
  | SetCombatHistoryAction
  | SetCombatTombstonesAction
  // Rules actions
  | SetCombatRulesPresetAction
  // Item actions
  | SetCombatItemsAction
  | AddCombatItemAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const COMBAT_ACTION_TYPES = new Set([
  COMBAT_CHARACTER_ADD,
  COMBAT_CHARACTER_UPDATE,
  COMBAT_CHARACTER_REMOVE,
  COMBAT_CHARACTERS_SET,
  COMBAT_ACTIVE_SET,
  COMBAT_ACTIVE_UPDATE,
  COMBAT_HISTORY_SET,
  COMBAT_TOMBSTONES_SET,
  COMBAT_RULES_PRESET_SET,
  COMBAT_ITEMS_SET,
  COMBAT_ITEM_ADD
]);

/**
 * Type guard to check if an action is a combat action
 */
export function isCombatAction(action: { type: string }): action is CombatAction {
  return COMBAT_ACTION_TYPES.has(action.type);
}
