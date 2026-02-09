/**
 * Gathering State Module
 *
 * Exports for the gathering system state slice.
 */

// Reducer
export { handleGatheringAction } from './gatheringReducer';

// Actions
export {
  // Action type constants
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
  // Type guard
  isGatheringAction,
  // Types
  type GatheringAction
} from './gatheringActions';

// Re-export selectors from central location
export * from '../selectors/gatheringSelectors';
