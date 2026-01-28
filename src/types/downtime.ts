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

/**
 * Composite key for targeting specific resources.
 * Format: 'resourceType:resourceId' (e.g., 'recipe:123', 'species:456')
 */
export type ActivityTargetKey = string;

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
// ACTIVITY-SPECIFIC DATA INTERFACES
// ============================================================================

/**
 * Configuration data for fishing activities.
 * Includes location, equipment, and targeting information.
 */
export interface FishingData {
  /** Discriminator field for the discriminated union */
  type: 'fishing';
  /** Target species to catch */
  speciesId: string;
  /** Fishing location/spot identifier */
  spotId: string;
  /** Equipment being used (rods, nets, traps, etc.) */
  toolIds: string[];
  /** Cumulative skill modifier from conditions, equipment, etc. */
  skillModifier: number;
  /** Expected yield amount on success */
  targetYield: number;
}

/**
 * Configuration data for foraging activities.
 * Includes biome, node, and gathering table information.
 */
export interface ForagingData {
  /** Discriminator field for the discriminated union */
  type: 'foraging';
  /** Environment/biome where foraging occurs */
  biomeId: string;
  /** Specific gathering node within the biome */
  nodeId: string;
  /** Random encounter/loot table for results */
  tableId: string;
  /** Equipment being used (baskets, knives, etc.) */
  toolIds: string[];
  /** Cumulative skill modifier from conditions, equipment, etc. */
  skillModifier: number;
}

/**
 * Configuration data for alchemy activities.
 * Includes recipe, reagents, and batch configuration.
 */
export interface AlchemyData {
  /** Discriminator field for the discriminated union */
  type: 'alchemy';
  /** High-level recipe category */
  recipeId: string;
  /** Specific formula being followed */
  formulaId: string;
  /** Reagent items being consumed */
  reagentIds: string[];
  /** Lab equipment and tools being used */
  toolIds: string[];
  /** Number of units being produced in this batch */
  batchSize: number;
  /** Modifiers for different alchemical aspects (potency, duration, etc.) */
  aspectModifiers: Record<string, number>;
}

/**
 * Configuration data for crafting activities.
 * Slot-bounded: each task completes within a single slot.
 * NO multi-slot project persistence - each attempt is independent.
 */
export interface CraftingData {
  /** Discriminator field for the discriminated union */
  type: 'crafting';
  /** Recipe/blueprint being followed */
  recipeId: string;
  /** Inventory item IDs for materials being consumed */
  materialInstanceIds: string[];
  /** Inventory item IDs for tools being used */
  toolInstanceIds: string[];
  /** Target quality level for the crafted item */
  qualityTarget: 'basic' | 'standard' | 'fine' | 'masterwork';
  /** Cumulative skill modifier from conditions, equipment, etc. */
  skillModifier: number;
}

/**
 * Configuration data for rest activities.
 * Includes rest type and recovery modifiers.
 */
export interface RestData {
  /** Discriminator field for the discriminated union */
  type: 'rest';
  /** Type of rest being performed */
  restType: 'sleep' | 'light_rest' | 'meditation';
  /** Bonus to recovery rolls from conditions (comfortable bed, etc.) */
  recoveryBonus: number;
}

// ============================================================================
// ACTIVITY DATA DISCRIMINATED UNION
// ============================================================================

/**
 * Discriminated union of all activity-specific data types.
 * Use the `type` field to narrow to specific activity data.
 *
 * @example
 * ```ts
 * if (task.activityData.type === 'fishing') {
 *   // TypeScript knows activityData is FishingData here
 *   console.log(task.activityData.speciesId);
 * }
 * ```
 */
export type ActivityData =
  | FishingData
  | ForagingData
  | AlchemyData
  | CraftingData
  | RestData;

// ============================================================================
// TASK LOCK KEY
// ============================================================================

/**
 * Composite key for task locking/deduplication.
 * Format: 'activityType|characterId|dayKey|slot|targetKey'
 * Used to prevent duplicate task assignments.
 */
export type TaskLockKey =
  `${DowntimeActivityType}|${CharacterId}|${number}|${number}|${ActivityTargetKey}`;

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
   * Discriminated union - use the `type` field to narrow.
   */
  activityData: ActivityData;
  /** Results populated when task is resolved */
  results?: TaskResults;
  /** Unix timestamp when task was created */
  createdAt: number;
  /** Unix timestamp of last modification */
  updatedAt: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a task is a fishing task.
 * Narrows the activityData type to FishingData.
 */
export function isFishingTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: FishingData } {
  return task.activityData.type === 'fishing';
}

/**
 * Type guard to check if a task is a foraging task.
 * Narrows the activityData type to ForagingData.
 */
export function isForagingTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: ForagingData } {
  return task.activityData.type === 'foraging';
}

/**
 * Type guard to check if a task is an alchemy task.
 * Narrows the activityData type to AlchemyData.
 */
export function isAlchemyTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: AlchemyData } {
  return task.activityData.type === 'alchemy';
}

/**
 * Type guard to check if a task is a crafting task.
 * Narrows the activityData type to CraftingData.
 */
export function isCraftingTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: CraftingData } {
  return task.activityData.type === 'crafting';
}

/**
 * Type guard to check if a task is a rest task.
 * Narrows the activityData type to RestData.
 */
export function isRestTask(
  task: DowntimeTask
): task is DowntimeTask & { activityData: RestData } {
  return task.activityData.type === 'rest';
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
