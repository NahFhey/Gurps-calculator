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
