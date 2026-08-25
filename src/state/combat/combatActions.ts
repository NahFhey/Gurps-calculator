/**
 * Combat Actions
 *
 * Action type constants and type definitions for combat-related state changes.
 * Covers combat characters, sessions, history, tombstones, rules, and items.
 */

import type { Id, CombatCharacter, CombatItem, CombatSession } from '../../types/campaign';
import type { CombatState, EncounterTemplate, RevealState } from '../../types/combatTracker';

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

// Combat reveal state action (Phase 5)
export const COMBAT_REVEAL_STATE_SET = 'setCombatRevealState' as const;

// Encounter template actions (Phase 11c)
export const ENCOUNTER_TEMPLATE_ADD = 'addEncounterTemplate' as const;
export const ENCOUNTER_TEMPLATE_UPDATE = 'updateEncounterTemplate' as const;
export const ENCOUNTER_TEMPLATE_REMOVE = 'removeEncounterTemplate' as const;
export const ENCOUNTER_TEMPLATES_SET = 'setEncounterTemplates' as const;

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
  payload: CombatState | null;
};
export type UpdateCombatActiveAction = {
  type: typeof COMBAT_ACTIVE_UPDATE;
  payload: Partial<CombatState>;
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

// Combat reveal state action type (Phase 5)
export type RevealStatePayload = RevealState | null;
export type SetCombatRevealStateAction = {
  type: typeof COMBAT_REVEAL_STATE_SET;
  payload: RevealStatePayload;
};

// Encounter template action types (Phase 11c)
export type AddEncounterTemplateAction = {
  type: typeof ENCOUNTER_TEMPLATE_ADD;
  payload: EncounterTemplate;
};
export type UpdateEncounterTemplateAction = {
  type: typeof ENCOUNTER_TEMPLATE_UPDATE;
  payload: { id: Id; changes: Partial<EncounterTemplate> };
};
export type RemoveEncounterTemplateAction = {
  type: typeof ENCOUNTER_TEMPLATE_REMOVE;
  payload: Id;
};
export type SetEncounterTemplatesAction = {
  type: typeof ENCOUNTER_TEMPLATES_SET;
  payload: Record<Id, EncounterTemplate>;
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
  | AddCombatItemAction
  // Reveal state action
  | SetCombatRevealStateAction
  // Encounter template actions
  | AddEncounterTemplateAction
  | UpdateEncounterTemplateAction
  | RemoveEncounterTemplateAction
  | SetEncounterTemplatesAction;

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
  COMBAT_ITEM_ADD,
  COMBAT_REVEAL_STATE_SET,
  ENCOUNTER_TEMPLATE_ADD,
  ENCOUNTER_TEMPLATE_UPDATE,
  ENCOUNTER_TEMPLATE_REMOVE,
  ENCOUNTER_TEMPLATES_SET
]);

/**
 * Type guard to check if an action is a combat action
 */
export function isCombatAction(action: { type: string }): action is CombatAction {
  return COMBAT_ACTION_TYPES.has(action.type as typeof COMBAT_CHARACTER_ADD);
}
