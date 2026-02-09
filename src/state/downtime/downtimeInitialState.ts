/**
 * Downtime System Initial State
 *
 * Provides the initial state shape for the downtime task system.
 * This state slice manages all time-based non-combat activities.
 */

import type { DowntimeState } from '../../types/downtime';

/**
 * Initial state for the downtime system.
 * Starts with no tasks and no pending ledger.
 */
export const downtimeInitialState: DowntimeState = {
  tasksById: {},
  taskOrder: [],
  pendingDayLedger: null,
};

/**
 * Schema version for downtime state migrations.
 * Increment when making breaking changes to the state shape.
 */
export const DOWNTIME_SCHEMA_VERSION = 2;
