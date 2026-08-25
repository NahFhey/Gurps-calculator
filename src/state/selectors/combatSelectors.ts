/**
 * Combat Selectors
 *
 * Centralized selectors for accessing combat system data (characters, items,
 * sessions, history, reveal state) from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type { Id, CombatCharacter, CombatItem, CombatSession } from '../../types/campaign';
import type { CombatState } from '../../types/combatTracker';

// ============================================================================
// COMBAT CHARACTER SELECTORS
// ============================================================================

/**
 * Select all combat characters as a record
 */
export const selectCombatCharactersRecord = (
  state: CampaignState
): Record<Id, CombatCharacter> => state.entities.combatCharacters;

/**
 * Select all combat characters as an array
 */
export const selectAllCombatCharacters = (state: CampaignState): CombatCharacter[] =>
  Object.values(state.entities.combatCharacters);

/**
 * Select a combat character by ID
 */
export const selectCombatCharacterById = (
  state: CampaignState,
  id: Id
): CombatCharacter | undefined => state.entities.combatCharacters[id];

/**
 * Select combat character count
 */
export const selectCombatCharacterCount = (state: CampaignState): number =>
  Object.keys(state.entities.combatCharacters).length;

// ============================================================================
// COMBAT ITEM SELECTORS
// ============================================================================

/**
 * Select all combat items as a record
 */
export const selectCombatItemsRecord = (state: CampaignState): Record<Id, CombatItem> =>
  state.entities.combatItems;

/**
 * Select all combat items as an array
 */
export const selectAllCombatItems = (state: CampaignState): CombatItem[] =>
  Object.values(state.entities.combatItems);

/**
 * Select a combat item by ID
 */
export const selectCombatItemById = (state: CampaignState, id: Id): CombatItem | undefined =>
  state.entities.combatItems[id];

// ============================================================================
// COMBAT SESSION SELECTORS
// ============================================================================

/**
 * Select whether combat is active
 */
export const selectIsCombatActive = (state: CampaignState): boolean => state.combat.active;

/**
 * Select current combat encounter ID
 */
export const selectCombatEncounterId = (state: CampaignState): string | null =>
  state.combat.encounterId;

/**
 * Select active combat session
 */
export const selectActiveCombatSession = (state: CampaignState): CombatState | null =>
  state.combat.activeSession;

/**
 * Select combat rules preset
 */
export const selectCombatRulesPreset = (state: CampaignState): string => state.combat.rulesPreset;

// ============================================================================
// COMBAT HISTORY SELECTORS
// ============================================================================

/**
 * Select combat history
 */
export const selectCombatHistory = (state: CampaignState): CombatSession[] =>
  state.entities.combatHistory;

/**
 * Select combat tombstones (defeated characters)
 */
export const selectCombatTombstones = (state: CampaignState): CombatCharacter[] =>
  state.entities.combatTombstones;

/**
 * Select combat history count
 */
export const selectCombatHistoryCount = (state: CampaignState): number =>
  state.entities.combatHistory.length;

// ============================================================================
// COMBAT REVEAL SELECTORS
// ============================================================================

/**
 * Select revealed target IDs
 */
export const selectRevealedTargets = (state: CampaignState): Set<string> =>
  state.combat.reveal.revealedTargets;

/**
 * Select revealed HP target IDs
 */
export const selectRevealedHP = (state: CampaignState): Set<string> =>
  state.combat.reveal.revealedHP;

/**
 * Select revealed defense values
 */
export const selectRevealedDefenseValues = (
  state: CampaignState
): Record<string, { dodge?: number }> => state.combat.reveal.revealedDefenseValues;

/**
 * Check if a target is revealed
 */
export const selectIsTargetRevealed = (state: CampaignState, targetId: string): boolean =>
  state.combat.reveal.revealedTargets.has(targetId);

/**
 * Check if a target's HP is revealed
 */
export const selectIsHPRevealed = (state: CampaignState, targetId: string): boolean =>
  state.combat.reveal.revealedHP.has(targetId);

/**
 * Select defense values for a specific target
 */
export const selectDefenseValuesForTarget = (
  state: CampaignState,
  targetId: string
): { dodge?: number } | undefined => state.combat.reveal.revealedDefenseValues[targetId];
