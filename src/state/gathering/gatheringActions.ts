/**
 * Gathering Actions
 *
 * Action type constants and type definitions for gathering-related state changes.
 */

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
import type { ForageZoneProfile, ForageItem, ForagingConfig } from '../../types/foraging';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Species actions
export const GATHERING_SPECIES_SET = 'setGatheringSpecies' as const;
export const GATHERING_SPECIES_ADD = 'addGatheringSpecies' as const;

// Tool actions
export const GATHERING_TOOLS_SET = 'setGatheringTools' as const;
export const GATHERING_TOOL_ADD = 'addGatheringTool' as const;

// Table actions
export const GATHERING_TABLES_SET = 'setGatheringTables' as const;
export const GATHERING_TABLE_ADD = 'addGatheringTable' as const;

// Environment actions
export const GATHERING_ENVIRONMENTS_SET = 'setGatheringEnvironments' as const;
export const GATHERING_ENVIRONMENT_ADD = 'addGatheringEnvironment' as const;

// Session actions
export const GATHERING_SESSION_ADD = 'addGatheringSession' as const;
export const GATHERING_SESSION_UPDATE = 'updateGatheringSession' as const;
export const GATHERING_SESSIONS_SET = 'setGatheringSessions' as const;

// Daily events actions
export const GATHERING_DAILY_EVENTS_SET = 'setGatheringDailyEvents' as const;

// Bait actions
export const GATHERING_BAIT_SET = 'setGatheringBait' as const;
export const GATHERING_BAIT_ADD = 'addGatheringBait' as const;

// Category actions
export const GATHERING_CATEGORIES_SET = 'setGatheringCategories' as const;
export const GATHERING_CATEGORY_ADD = 'addGatheringCategory' as const;

// Item actions
export const GATHERING_ITEMS_SET = 'setGatheringItems' as const;
export const GATHERING_ITEM_ADD = 'addGatheringItem' as const;

// Forage Zone Profile actions
export const FORAGE_ZONE_PROFILES_SET = 'setForageZoneProfiles' as const;
export const FORAGE_ZONE_PROFILE_ADD = 'addForageZoneProfile' as const;
export const FORAGE_ZONE_PROFILE_UPDATE = 'updateForageZoneProfile' as const;
export const FORAGE_ZONE_PROFILE_REMOVE = 'removeForageZoneProfile' as const;

// Forage Item actions
export const FORAGE_ITEMS_SET = 'setForageItems' as const;
export const FORAGE_ITEM_ADD = 'addForageItem' as const;
export const FORAGE_ITEM_UPDATE = 'updateForageItem' as const;
export const FORAGE_ITEM_REMOVE = 'removeForageItem' as const;

// Foraging Config actions
export const FORAGING_CONFIG_SET = 'setForagingConfig' as const;
export const FORAGING_CONFIG_UPDATE = 'updateForagingConfig' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

export type SetGatheringSpeciesAction = {
  type: typeof GATHERING_SPECIES_SET;
  payload: Record<Id, GatheringSpecies>;
};
export type AddGatheringSpeciesAction = {
  type: typeof GATHERING_SPECIES_ADD;
  payload: GatheringSpecies;
};

export type SetGatheringToolsAction = {
  type: typeof GATHERING_TOOLS_SET;
  payload: Record<Id, GatheringTool>;
};
export type AddGatheringToolAction = {
  type: typeof GATHERING_TOOL_ADD;
  payload: GatheringTool;
};

export type SetGatheringTablesAction = {
  type: typeof GATHERING_TABLES_SET;
  payload: Record<Id, GatheringTable>;
};
export type AddGatheringTableAction = {
  type: typeof GATHERING_TABLE_ADD;
  payload: GatheringTable;
};

export type SetGatheringEnvironmentsAction = {
  type: typeof GATHERING_ENVIRONMENTS_SET;
  payload: Record<Id, GatheringEnvironment>;
};
export type AddGatheringEnvironmentAction = {
  type: typeof GATHERING_ENVIRONMENT_ADD;
  payload: GatheringEnvironment;
};

export type AddGatheringSessionAction = {
  type: typeof GATHERING_SESSION_ADD;
  payload: GatheringSession;
};
export type UpdateGatheringSessionAction = {
  type: typeof GATHERING_SESSION_UPDATE;
  payload: { id: Id; changes: Partial<GatheringSession> };
};
export type SetGatheringSessionsAction = {
  type: typeof GATHERING_SESSIONS_SET;
  payload: Record<Id, GatheringSession>;
};

export type SetGatheringDailyEventsAction = {
  type: typeof GATHERING_DAILY_EVENTS_SET;
  payload: GatheringDailyEvents;
};

export type SetGatheringBaitAction = {
  type: typeof GATHERING_BAIT_SET;
  payload: Record<Id, GatheringBait>;
};
export type AddGatheringBaitAction = {
  type: typeof GATHERING_BAIT_ADD;
  payload: GatheringBait;
};

export type SetGatheringCategoriesAction = {
  type: typeof GATHERING_CATEGORIES_SET;
  payload: Record<Id, GatheringCategory>;
};
export type AddGatheringCategoryAction = {
  type: typeof GATHERING_CATEGORY_ADD;
  payload: GatheringCategory;
};

export type SetGatheringItemsAction = {
  type: typeof GATHERING_ITEMS_SET;
  payload: Record<Id, GatheringItem>;
};
export type AddGatheringItemAction = {
  type: typeof GATHERING_ITEM_ADD;
  payload: GatheringItem;
};

// Forage Zone Profile action types
export type SetForageZoneProfilesAction = {
  type: typeof FORAGE_ZONE_PROFILES_SET;
  payload: Record<Id, ForageZoneProfile>;
};
export type AddForageZoneProfileAction = {
  type: typeof FORAGE_ZONE_PROFILE_ADD;
  payload: ForageZoneProfile;
};
export type UpdateForageZoneProfileAction = {
  type: typeof FORAGE_ZONE_PROFILE_UPDATE;
  payload: { id: Id; changes: Partial<ForageZoneProfile> };
};
export type RemoveForageZoneProfileAction = {
  type: typeof FORAGE_ZONE_PROFILE_REMOVE;
  payload: Id;
};

// Forage Item action types
export type SetForageItemsAction = {
  type: typeof FORAGE_ITEMS_SET;
  payload: Record<Id, ForageItem>;
};
export type AddForageItemAction = {
  type: typeof FORAGE_ITEM_ADD;
  payload: ForageItem;
};
export type UpdateForageItemAction = {
  type: typeof FORAGE_ITEM_UPDATE;
  payload: { id: Id; changes: Partial<ForageItem> };
};
export type RemoveForageItemAction = {
  type: typeof FORAGE_ITEM_REMOVE;
  payload: Id;
};

// Foraging Config action types
export type SetForagingConfigAction = {
  type: typeof FORAGING_CONFIG_SET;
  payload: ForagingConfig;
};
export type UpdateForagingConfigAction = {
  type: typeof FORAGING_CONFIG_UPDATE;
  payload: Partial<ForagingConfig>;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type GatheringAction =
  | SetGatheringSpeciesAction
  | AddGatheringSpeciesAction
  | SetGatheringToolsAction
  | AddGatheringToolAction
  | SetGatheringTablesAction
  | AddGatheringTableAction
  | SetGatheringEnvironmentsAction
  | AddGatheringEnvironmentAction
  | AddGatheringSessionAction
  | UpdateGatheringSessionAction
  | SetGatheringSessionsAction
  | SetGatheringDailyEventsAction
  | SetGatheringBaitAction
  | AddGatheringBaitAction
  | SetGatheringCategoriesAction
  | AddGatheringCategoryAction
  | SetGatheringItemsAction
  | AddGatheringItemAction
  | SetForageZoneProfilesAction
  | AddForageZoneProfileAction
  | UpdateForageZoneProfileAction
  | RemoveForageZoneProfileAction
  | SetForageItemsAction
  | AddForageItemAction
  | UpdateForageItemAction
  | RemoveForageItemAction
  | SetForagingConfigAction
  | UpdateForagingConfigAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const GATHERING_ACTION_TYPES = new Set([
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
]);

export function isGatheringAction(action: { type: string }): action is GatheringAction {
  return GATHERING_ACTION_TYPES.has(action.type as any);
}
