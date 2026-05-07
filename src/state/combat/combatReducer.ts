/**
 * Combat Reducer
 *
 * Handles state mutations for combat-related operations using Immer draft.
 * This reducer operates on both the combat slice and entities slice of campaign state.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type CombatAction,
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
} from './combatActions';

/**
 * Process combat actions on the campaign state draft.
 * This function is called from the main campaignReducer within the Immer produce() call.
 *
 * @param draft - The Immer draft of the full CampaignState
 * @param action - The combat action to process
 * @returns true if the action was handled, false otherwise
 */
export function handleCombatAction(
  draft: Draft<CampaignState>,
  action: CombatAction
): boolean {
  switch (action.type) {
    // ========================================================================
    // COMBAT CHARACTER ACTIONS
    // ========================================================================
    case COMBAT_CHARACTER_ADD:
      draft.entities.combatCharacters[action.payload.id] = action.payload;
      return true;

    case COMBAT_CHARACTER_UPDATE:
      if (draft.entities.combatCharacters[action.payload.id]) {
        draft.entities.combatCharacters[action.payload.id] = {
          ...draft.entities.combatCharacters[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case COMBAT_CHARACTER_REMOVE:
      delete draft.entities.combatCharacters[action.payload];
      return true;

    case COMBAT_CHARACTERS_SET:
      draft.entities.combatCharacters = action.payload;
      return true;

    // ========================================================================
    // COMBAT SESSION ACTIONS
    // ========================================================================
    case COMBAT_ACTIVE_SET:
      draft.combat.activeSession = action.payload;
      return true;

    case COMBAT_ACTIVE_UPDATE:
      if (draft.combat.activeSession) {
        draft.combat.activeSession = {
          ...draft.combat.activeSession,
          ...action.payload
        };
      }
      return true;

    // ========================================================================
    // COMBAT HISTORY ACTIONS
    // ========================================================================
    case COMBAT_HISTORY_SET:
      draft.entities.combatHistory = action.payload;
      return true;

    case COMBAT_TOMBSTONES_SET:
      draft.entities.combatTombstones = action.payload;
      return true;

    // ========================================================================
    // COMBAT RULES ACTIONS
    // ========================================================================
    case COMBAT_RULES_PRESET_SET:
      draft.combat.rulesPreset = action.payload;
      return true;

    // ========================================================================
    // COMBAT ITEM ACTIONS
    // ========================================================================
    case COMBAT_ITEMS_SET:
      draft.entities.combatItems = action.payload;
      return true;

    case COMBAT_ITEM_ADD:
      draft.entities.combatItems[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // COMBAT REVEAL STATE ACTIONS (Phase 5)
    // ========================================================================
    case COMBAT_REVEAL_STATE_SET:
      draft.combat.revealState = action.payload;
      return true;

    // ========================================================================
    // ENCOUNTER TEMPLATE ACTIONS (Phase 11c)
    // ========================================================================
    case ENCOUNTER_TEMPLATE_ADD:
      draft.entities.encounterTemplates[action.payload.id] = action.payload;
      return true;

    case ENCOUNTER_TEMPLATE_UPDATE:
      if (draft.entities.encounterTemplates[action.payload.id]) {
        draft.entities.encounterTemplates[action.payload.id] = {
          ...draft.entities.encounterTemplates[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case ENCOUNTER_TEMPLATE_REMOVE:
      delete draft.entities.encounterTemplates[action.payload];
      return true;

    case ENCOUNTER_TEMPLATES_SET:
      draft.entities.encounterTemplates = action.payload;
      return true;

    default:
      return false;
  }
}
