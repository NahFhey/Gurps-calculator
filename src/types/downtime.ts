/**
 * Downtime System Types
 *
 * TypeScript interfaces for the unified downtime task system.
 * This system handles all time-based non-combat actions including
 * fishing, foraging, alchemy, crafting, and rest.
 */

// ============================================================================
// TYPE ALIASES
// ============================================================================

/** Unique identifier for a character */
export type CharacterId = string;

/** Unique identifier for a task */
export type TaskId = string;

/** Unique identifier for a tool/equipment */
export type ToolId = string;

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

/**
 * Types of downtime activities that can be performed.
 * Each activity type has its own resolution rules and potential outcomes.
 */
export type DowntimeActivityType =
  | 'fishing'
  | 'foraging'
  | 'alchemy'
  | 'crafting'
  | 'rest';

// ============================================================================
// TASK STATUS
// ============================================================================

/**
 * Lifecycle status of a downtime task.
 * - pending: Task is scheduled but not yet started
 * - in_progress: Task is currently being worked on
 * - resolved: Task has been completed (success or failure)
 * - cancelled: Task was cancelled before completion
 */
export type TaskStatus = 'pending' | 'in_progress' | 'resolved' | 'cancelled';

// ============================================================================
// INVENTORY DELTA
// ============================================================================

/**
 * Represents a change to inventory resulting from task resolution.
 * Positive quantity means items are added; negative means removed.
 */
export interface InventoryDelta {
  /** Unique identifier of the item being modified */
  itemId: string;
  /** Amount to add (positive) or remove (negative) */
  quantity: number;
  /** Human-readable name of the item for display */
  itemName: string;
}

// ============================================================================
// TASK RESULTS
// ============================================================================

/**
 * Outcome data populated when a task is resolved.
 * Contains success/failure info and any rewards or consequences.
 */
export interface TaskResults {
  /** Whether the task succeeded */
  success: boolean;
  /** Human-readable description of what happened */
  message: string;
  /** Items gained or consumed as a result of this task */
  inventoryChanges?: InventoryDelta[];
  /** Character experience points earned from this task */
  experienceGained?: number;
}

// ============================================================================
// DOWNTIME TASK
// ============================================================================

/**
 * Core task entity representing a single downtime activity.
 * Tasks are created when activities are scheduled and updated
 * through their lifecycle until resolution.
 */
export interface DowntimeTask {
  /** Unique identifier for this task */
  id: string;
  /** Type of activity being performed */
  activityType: DowntimeActivityType;
  /** Day number when this task is scheduled */
  dayKey: number;
  /** Time slot within the day (0-based index) */
  slot: number;
  /** Character ID of the primary worker leading this task */
  leaderId: string;
  /** Character IDs of helpers assisting with this task */
  helperIds: string[];
  /** Current lifecycle status */
  status: TaskStatus;
  /**
   * Activity-specific configuration data.
   * Will be a discriminated union based on activityType in future.
   * @todo Define specific interfaces for each activity type
   */
  activityData: unknown;
  /** Results populated when task is resolved */
  results?: TaskResults;
  /** Unix timestamp when task was created */
  createdAt: number;
  /** Unix timestamp of last modification */
  updatedAt: number;
}

// ============================================================================
// PENDING DAY LEDGER
// ============================================================================

/**
 * Placeholder for tracking pending changes for a specific day.
 * Will be expanded to include detailed entry types.
 * @todo Define specific entry interfaces for inventory changes, etc.
 */
export interface PendingDayLedger {
  /** Day number this ledger applies to */
  dayKey: number;
  /** Pending ledger entries awaiting commit */
  entries: unknown[];
}

// ============================================================================
// DOWNTIME STATE
// ============================================================================

/**
 * Root state shape for the downtime system.
 * This is the structure stored in the campaign store.
 */
export interface DowntimeState {
  /** Map of task IDs to task entities for O(1) lookup */
  tasksById: Record<string, DowntimeTask>;
  /** Ordered array of task IDs for stable UI rendering */
  taskOrder: string[];
  /** Pending ledger for the current day, null if no pending changes */
  pendingDayLedger: PendingDayLedger | null;
}
