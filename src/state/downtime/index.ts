/**
 * Downtime State Module
 *
 * Exports for the downtime system state slice.
 */

// Initial state
export { downtimeInitialState, DOWNTIME_SCHEMA_VERSION } from './downtimeInitialState';

// Reducer
export { downtimeReducer, generateTaskId } from './downtimeReducer';

// Actions
export {
  // Action type constants
  DOWNTIME_TASK_CREATE,
  DOWNTIME_TASK_UPDATE,
  DOWNTIME_TASK_BEGIN_RESOLVE,
  DOWNTIME_TASK_RESOLVE,
  DOWNTIME_TASK_CANCEL,
  DOWNTIME_TASK_REORDER,
  // Action creators
  createTask,
  updateTask,
  beginResolveTask,
  resolveTask,
  cancelTask,
  reorderTasks,
  // Types
  type CreateTaskPayload,
  type UpdateTaskPayload,
  type DowntimeAction,
} from './downtimeActions';

// Selectors
export {
  // Basic selectors
  selectAllTasks,
  selectTaskById,
  // Slot-based selectors
  selectTasksForSlot,
  selectPendingTasksForSlot,
  selectResolvedTasksForSlot,
  selectCancelledTasksForSlot,
  selectInProgressTasksForSlot,
  // Filter selectors
  selectTasksByActivityType,
  selectTasksByLeader,
  selectTasksByHelper,
  selectTasksByCharacter,
  // Status selectors
  selectTasksByStatus,
  selectPendingTasks,
  selectResolvedTasks,
  selectCancelledTasks,
  selectInProgressTasks,
  // Day-based selectors
  selectTasksForDay,
  selectTaskCountsByStatusForDay,
  // Utility selectors
  selectSlotHasUnresolvedTasks,
  selectTaskCount,
  // Assignment selectors
  selectCharacterAssignmentForSlot,
  selectAssignedCharacterIdsForSlot,
  selectAvailableCharacterIdsForSlot,
  // Lock selectors
  generateTaskLockKey,
  selectExistingLockKeysForSlot,
  canCreateTaskForTarget,
  getTargetKeyFromActivityData,
  // Tool reservation selectors
  selectReservedToolIdsForSlot,
  canUseTools,
  // Time advancement selectors
  selectCanAdvanceSlot,
  type AdvancementCheck,
} from './downtimeSelectors';

// Migration
export {
  // Main migration functions
  needsMigration,
  migrateToDowntimeState,
  migrateV0ToV1,
  initializeDowntimeState,
  // Helpers
  convertLegacyTaskAssignment,
  resetMigrationIdCounter,
  // Types
  type MigrationResult,
  type LegacyTaskAssignment,
  type LegacyDayPlannerState,
} from './downtimeMigration';

// Validation
export {
  validateTaskCreation,
  validateAssignment,
  validateLockOnCreate,
  validateToolExclusivity,
  getToolIdsFromActivityData,
  type ValidationResult,
} from './downtimeValidation';

// Errors
export {
  DowntimeValidationError,
  DOWNTIME_ERROR_CODES,
  type DowntimeErrorCode,
} from './downtimeErrors';
