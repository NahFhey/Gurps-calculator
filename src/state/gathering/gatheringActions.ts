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
  | AddGatheringItemAction;

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
  GATHERING_ITEM_ADD
]);

export function isGatheringAction(action: { type: string }): action is GatheringAction {
  return GATHERING_ACTION_TYPES.has(action.type);
}
