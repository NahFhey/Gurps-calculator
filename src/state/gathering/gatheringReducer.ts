/**
 * Gathering Reducer
 *
 * Handles state mutations for gathering-related operations using Immer draft.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type GatheringAction,
  GATHERING_SPECIES_SET,
  GATHERING_SPECIES_ADD,
  GATHERING_TOOLS_SET,
  GATHERING_TOOL_ADD,
  GATHERING_TABLES_SET,
  GATHERING_TABLE_ADD,
  GATHERING_ENVIRONMENTS_SET,
  GATHERING_ENVIRONMENT_ADD,
  GATHERING_SESSION_ADD,
  GATHERING_SESSION_UPDATE,
  GATHERING_SESSIONS_SET,
  GATHERING_DAILY_EVENTS_SET,
  GATHERING_BAIT_SET,
  GATHERING_BAIT_ADD,
  GATHERING_CATEGORIES_SET,
  GATHERING_CATEGORY_ADD,
  GATHERING_ITEMS_SET,
  GATHERING_ITEM_ADD
} from './gatheringActions';

/**
 * Process gathering actions on the campaign state draft.
 */
export function handleGatheringAction(
  draft: Draft<CampaignState>,
  action: GatheringAction
): boolean {
  switch (action.type) {
    // ========================================================================
    // SPECIES ACTIONS
    // ========================================================================
    case GATHERING_SPECIES_SET:
      draft.entities.gatheringSpecies = action.payload;
      return true;

    case GATHERING_SPECIES_ADD:
      draft.entities.gatheringSpecies[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // TOOL ACTIONS
    // ========================================================================
    case GATHERING_TOOLS_SET:
      draft.entities.gatheringTools = action.payload;
      return true;

    case GATHERING_TOOL_ADD:
      draft.entities.gatheringTools[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // TABLE ACTIONS
    // ========================================================================
    case GATHERING_TABLES_SET:
      draft.entities.gatheringTables = action.payload;
      return true;

    case GATHERING_TABLE_ADD:
      draft.entities.gatheringTables[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // ENVIRONMENT ACTIONS
    // ========================================================================
    case GATHERING_ENVIRONMENTS_SET:
      draft.entities.gatheringEnvironments = action.payload;
      return true;

    case GATHERING_ENVIRONMENT_ADD:
      draft.entities.gatheringEnvironments[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // SESSION ACTIONS
    // ========================================================================
    case GATHERING_SESSION_ADD:
      draft.entities.gatheringSessions[action.payload.id] = action.payload;
      return true;

    case GATHERING_SESSION_UPDATE:
      if (draft.entities.gatheringSessions[action.payload.id]) {
        draft.entities.gatheringSessions[action.payload.id] = {
          ...draft.entities.gatheringSessions[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case GATHERING_SESSIONS_SET:
      draft.entities.gatheringSessions = action.payload;
      return true;

    // ========================================================================
    // DAILY EVENTS ACTIONS
    // ========================================================================
    case GATHERING_DAILY_EVENTS_SET:
      draft.entities.gatheringDailyEvents = action.payload;
      return true;

    // ========================================================================
    // BAIT ACTIONS
    // ========================================================================
    case GATHERING_BAIT_SET:
      draft.entities.gatheringBait = action.payload;
      return true;

    case GATHERING_BAIT_ADD:
      draft.entities.gatheringBait[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // CATEGORY ACTIONS
    // ========================================================================
    case GATHERING_CATEGORIES_SET:
      draft.entities.gatheringCategories = action.payload;
      return true;

    case GATHERING_CATEGORY_ADD:
      draft.entities.gatheringCategories[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // ITEM ACTIONS
    // ========================================================================
    case GATHERING_ITEMS_SET:
      draft.entities.gatheringItems = action.payload;
      return true;

    case GATHERING_ITEM_ADD:
      draft.entities.gatheringItems[action.payload.id] = action.payload;
      return true;

    default:
      return false;
  }
}
