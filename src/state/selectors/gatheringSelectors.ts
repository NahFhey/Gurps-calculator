/**
 * Gathering Selectors
 *
 * Centralized selectors for accessing gathering system data (species, tools,
 * tables, environments, sessions, bait, categories, items) from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type {
  Id,
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringSession,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
  GatheringDailyEvents
} from '../../types/campaign';
import type { ForageZoneProfile, ForageItem, ForagingConfig, ForageTier, ForageCategoryId } from '../../types/foraging';
import { DEFAULT_FORAGING_CONFIG } from '../../constants/foraging';

// ============================================================================
// SPECIES SELECTORS
// ============================================================================

/**
 * Select all gathering species as a record
 */
export const selectGatheringSpeciesRecord = (
  state: CampaignState
): Record<Id, GatheringSpecies> => state.entities.gatheringSpecies;

/**
 * Select all gathering species as an array
 */
export const selectAllGatheringSpecies = (state: CampaignState): GatheringSpecies[] =>
  Object.values(state.entities.gatheringSpecies);

/**
 * Select a gathering species by ID
 */
export const selectGatheringSpeciesById = (
  state: CampaignState,
  id: Id
): GatheringSpecies | undefined => state.entities.gatheringSpecies[id];

// ============================================================================
// TOOL SELECTORS
// ============================================================================

/**
 * Select all gathering tools as a record
 */
export const selectGatheringToolsRecord = (state: CampaignState): Record<Id, GatheringTool> =>
  state.entities.gatheringTools;

/**
 * Select all gathering tools as an array
 */
export const selectAllGatheringTools = (state: CampaignState): GatheringTool[] =>
  Object.values(state.entities.gatheringTools);

/**
 * Select a gathering tool by ID
 */
export const selectGatheringToolById = (
  state: CampaignState,
  id: Id
): GatheringTool | undefined => state.entities.gatheringTools[id];

// ============================================================================
// TABLE SELECTORS
// ============================================================================

/**
 * Select all gathering tables as a record
 */
export const selectGatheringTablesRecord = (state: CampaignState): Record<Id, GatheringTable> =>
  state.entities.gatheringTables;

/**
 * Select all gathering tables as an array
 */
export const selectAllGatheringTables = (state: CampaignState): GatheringTable[] =>
  Object.values(state.entities.gatheringTables);

/**
 * Select a gathering table by ID
 */
export const selectGatheringTableById = (
  state: CampaignState,
  id: Id
): GatheringTable | undefined => state.entities.gatheringTables[id];

// ============================================================================
// ENVIRONMENT SELECTORS
// ============================================================================

/**
 * Select all gathering environments as a record
 */
export const selectGatheringEnvironmentsRecord = (
  state: CampaignState
): Record<Id, GatheringEnvironment> => state.entities.gatheringEnvironments;

/**
 * Select all gathering environments as an array
 */
export const selectAllGatheringEnvironments = (state: CampaignState): GatheringEnvironment[] =>
  Object.values(state.entities.gatheringEnvironments);

/**
 * Select a gathering environment by ID
 */
export const selectGatheringEnvironmentById = (
  state: CampaignState,
  id: Id
): GatheringEnvironment | undefined => state.entities.gatheringEnvironments[id];

// ============================================================================
// SESSION SELECTORS
// ============================================================================

/**
 * Select all gathering sessions as a record
 */
export const selectGatheringSessionsRecord = (
  state: CampaignState
): Record<Id, GatheringSession> => state.entities.gatheringSessions;

/**
 * Select all gathering sessions as an array
 */
export const selectAllGatheringSessions = (state: CampaignState): GatheringSession[] =>
  Object.values(state.entities.gatheringSessions);

/**
 * Select a gathering session by ID
 */
export const selectGatheringSessionById = (
  state: CampaignState,
  id: Id
): GatheringSession | undefined => state.entities.gatheringSessions[id];

/**
 * Select the active gathering session ID from UI state
 */
export const selectActiveGatheringSessionId = (state: CampaignState): string | null | undefined =>
  state.gathering.activeSession;

/**
 * Select the active gathering session
 */
export const selectActiveGatheringSession = (
  state: CampaignState
): GatheringSession | undefined => {
  const id = state.gathering.activeSession;
  return id ? state.entities.gatheringSessions[id] : undefined;
};

// ============================================================================
// BAIT SELECTORS
// ============================================================================

/**
 * Select all gathering bait as a record
 */
export const selectGatheringBaitRecord = (state: CampaignState): Record<Id, GatheringBait> =>
  state.entities.gatheringBait;

/**
 * Select all gathering bait as an array
 */
export const selectAllGatheringBait = (state: CampaignState): GatheringBait[] =>
  Object.values(state.entities.gatheringBait);

/**
 * Select a gathering bait by ID
 */
export const selectGatheringBaitById = (
  state: CampaignState,
  id: Id
): GatheringBait | undefined => state.entities.gatheringBait[id];

// ============================================================================
// CATEGORY SELECTORS
// ============================================================================

/**
 * Select all gathering categories as a record
 */
export const selectGatheringCategoriesRecord = (
  state: CampaignState
): Record<Id, GatheringCategory> => state.entities.gatheringCategories;

/**
 * Select all gathering categories as an array
 */
export const selectAllGatheringCategories = (state: CampaignState): GatheringCategory[] =>
  Object.values(state.entities.gatheringCategories);

/**
 * Select a gathering category by ID
 */
export const selectGatheringCategoryById = (
  state: CampaignState,
  id: Id
): GatheringCategory | undefined => state.entities.gatheringCategories[id];

// ============================================================================
// ITEM SELECTORS
// ============================================================================

/**
 * Select all gathering items as a record
 */
export const selectGatheringItemsRecord = (state: CampaignState): Record<Id, GatheringItem> =>
  state.entities.gatheringItems;

/**
 * Select all gathering items as an array
 */
export const selectAllGatheringItems = (state: CampaignState): GatheringItem[] =>
  Object.values(state.entities.gatheringItems);

/**
 * Select a gathering item by ID
 */
export const selectGatheringItemById = (
  state: CampaignState,
  id: Id
): GatheringItem | undefined => state.entities.gatheringItems[id];

// ============================================================================
// DAILY EVENTS SELECTORS
// ============================================================================

/**
 * Select gathering daily events
 */
export const selectGatheringDailyEvents = (state: CampaignState): GatheringDailyEvents =>
  state.entities.gatheringDailyEvents;

// ============================================================================
// FORAGE ZONE PROFILE SELECTORS
// ============================================================================

/**
 * Select all forage zone profiles as a record
 */
export const selectForageZoneProfilesRecord = (
  state: CampaignState
): Record<Id, ForageZoneProfile> => state.entities.forageZoneProfiles ?? {};

/**
 * Select all forage zone profiles as an array
 */
export const selectAllForageZoneProfiles = (state: CampaignState): ForageZoneProfile[] =>
  Object.values(state.entities.forageZoneProfiles ?? {});

/**
 * Select forage zone profiles for a specific location
 */
export const selectForageZoneProfilesForLocation = (
  state: CampaignState,
  locationId: string
): ForageZoneProfile[] =>
  Object.values(state.entities.forageZoneProfiles ?? {}).filter(
    (z) => z.locationId === locationId
  );

/**
 * Select a forage zone profile by ID
 */
export const selectForageZoneProfileById = (
  state: CampaignState,
  id: Id
): ForageZoneProfile | undefined => (state.entities.forageZoneProfiles ?? {})[id];

// ============================================================================
// FORAGE ITEM SELECTORS
// ============================================================================

/**
 * Select all forage items as a record
 */
export const selectForageItemsRecord = (
  state: CampaignState
): Record<Id, ForageItem> => state.entities.forageItems ?? {};

/**
 * Select all forage items as an array
 */
export const selectAllForageItems = (state: CampaignState): ForageItem[] =>
  Object.values(state.entities.forageItems ?? {});

/**
 * Select forage items filtered by category
 */
export const selectForageItemsByCategory = (
  state: CampaignState,
  categoryId: ForageCategoryId
): ForageItem[] =>
  Object.values(state.entities.forageItems ?? {}).filter(
    (i) => i.categoryId === categoryId
  );

/**
 * Select forage items filtered by tier and category
 */
export const selectForageItemsByTierAndCategory = (
  state: CampaignState,
  tier: ForageTier,
  categoryId: ForageCategoryId
): ForageItem[] =>
  Object.values(state.entities.forageItems ?? {}).filter(
    (i) => i.tier === tier && i.categoryId === categoryId
  );

/**
 * Select a forage item by ID
 */
export const selectForageItemById = (
  state: CampaignState,
  id: Id
): ForageItem | undefined => (state.entities.forageItems ?? {})[id];

// ============================================================================
// FORAGING CONFIG SELECTOR
// ============================================================================

/**
 * Select the foraging configuration
 */
export const selectForagingConfig = (state: CampaignState): ForagingConfig =>
  state.entities.foragingConfig ?? DEFAULT_FORAGING_CONFIG;
