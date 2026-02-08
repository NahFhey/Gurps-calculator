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
  GATHERING_ITEM_ADD,
  FORAGE_ZONE_PROFILES_SET,
  FORAGE_ZONE_PROFILE_ADD,
  FORAGE_ZONE_PROFILE_UPDATE,
  FORAGE_ZONE_PROFILE_REMOVE,
  FORAGE_ITEMS_SET,
  FORAGE_ITEM_ADD,
  FORAGE_ITEM_UPDATE,
  FORAGE_ITEM_REMOVE,
  FORAGING_CONFIG_SET,
  FORAGING_CONFIG_UPDATE,
} from './gatheringActions';
import { DEFAULT_FORAGING_CONFIG } from '../../constants/foraging';

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

    // ========================================================================
    // FORAGE ZONE PROFILE ACTIONS
    // ========================================================================
    case FORAGE_ZONE_PROFILES_SET:
      draft.entities.forageZoneProfiles = action.payload;
      return true;

    case FORAGE_ZONE_PROFILE_ADD:
      draft.entities.forageZoneProfiles[action.payload.id] = action.payload;
      return true;

    case FORAGE_ZONE_PROFILE_UPDATE:
      if (draft.entities.forageZoneProfiles[action.payload.id]) {
        draft.entities.forageZoneProfiles[action.payload.id] = {
          ...draft.entities.forageZoneProfiles[action.payload.id],
          ...action.payload.changes,
        };
      }
      return true;

    case FORAGE_ZONE_PROFILE_REMOVE:
      delete draft.entities.forageZoneProfiles[action.payload];
      return true;

    // ========================================================================
    // FORAGE ITEM ACTIONS
    // ========================================================================
    case FORAGE_ITEMS_SET:
      draft.entities.forageItems = action.payload;
      return true;

    case FORAGE_ITEM_ADD:
      draft.entities.forageItems[action.payload.id] = action.payload;
      return true;

    case FORAGE_ITEM_UPDATE:
      if (draft.entities.forageItems[action.payload.id]) {
        draft.entities.forageItems[action.payload.id] = {
          ...draft.entities.forageItems[action.payload.id],
          ...action.payload.changes,
        };
      }
      return true;

    case FORAGE_ITEM_REMOVE:
      delete draft.entities.forageItems[action.payload];
      return true;

    // ========================================================================
    // FORAGING CONFIG ACTIONS
    // ========================================================================
    case FORAGING_CONFIG_SET:
      draft.entities.foragingConfig = action.payload;
      return true;

    case FORAGING_CONFIG_UPDATE:
      draft.entities.foragingConfig = {
        ...(draft.entities.foragingConfig ?? DEFAULT_FORAGING_CONFIG),
        ...action.payload,
      };
      return true;

    default:
      return false;
  }
}
