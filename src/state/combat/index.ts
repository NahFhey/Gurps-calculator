/**
 * Combat State Module
 *
 * Exports for the combat system state slice.
 * Handles combat characters, sessions, history, tombstones, rules, and items.
 */

// Reducer
export { handleCombatAction } from './combatReducer';

// Actions
export {
  // Action type constants
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
  // Type guard
  isCombatAction,
  // Types
  type CombatAction,
  type AddCombatCharacterAction,
  type UpdateCombatCharacterAction,
  type RemoveCombatCharacterAction,
  type SetCombatCharactersAction,
  type SetCombatActiveAction,
  type UpdateCombatActiveAction,
  type SetCombatHistoryAction,
  type SetCombatTombstonesAction,
  type SetCombatRulesPresetAction,
  type SetCombatItemsAction,
  type AddCombatItemAction
} from './combatActions';

// Re-export selectors from central location
export {
  // Characters
  selectCombatCharactersRecord,
  selectAllCombatCharacters,
  selectCombatCharacterById,
  selectCombatCharacterCount,
  // Items
  selectCombatItemsRecord,
  selectAllCombatItems,
  selectCombatItemById,
  // Session
  selectIsCombatActive,
  selectCombatEncounterId,
  selectActiveCombatSession,
  selectCombatRulesPreset,
  // History
  selectCombatHistory,
  selectCombatTombstones,
  selectCombatHistoryCount,
  // Reveal
  selectRevealedTargets,
  selectRevealedHP,
  selectRevealedDefenseValues,
  selectIsTargetRevealed,
  selectIsHPRevealed,
  selectDefenseValuesForTarget
} from '../selectors/combatSelectors';
