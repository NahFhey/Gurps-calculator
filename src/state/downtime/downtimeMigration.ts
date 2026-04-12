/**
 * Downtime State Migration
 *
 * Handles migration from legacy dayPlanner format to the new unified downtime system.
 * Ensures backwards compatibility and data preservation during upgrades.
 */

import type {
  DowntimeState,
  DowntimeTask,
  DowntimeActivityType,
  TaskStatus,
  ActivityData,
  FishingData,
  ForagingData,
  RestData,
} from '../../types/downtime';
import { downtimeInitialState, DOWNTIME_SCHEMA_VERSION } from './downtimeInitialState';

// ============================================================================
// LEGACY FORMAT TYPES
// ============================================================================

/**
 * Legacy task status from dayPlanner system.
 */
type LegacyTaskStatus = 'Draft' | 'Resolving' | 'Completed';

/**
 * Legacy task mode from dayPlanner system.
 */
type LegacyTaskMode = 'Fishing' | 'Foraging' | string;

/**
 * Legacy task assignment format from dayPlanner.
 */
export interface LegacyTaskAssignment {
  id?: string;
  dayKey?: number;
  slot?: number;
  orderIndex?: number;
  mode?: LegacyTaskMode;
  leaderWorkerId?: string | null;
  helperWorkerIds?: string[];
  assignedWorkerIds?: string[];
  environmentId?: string | null;
  selectedToolIds?: string[];
  method?: string;
  baitId?: string | null;
  targetSpeciesId?: string | null;
  resolutionState?: LegacyTaskStatus;
  payload?: unknown;
  inventoryDelta?: unknown[];
  notes?: string;
  warnings?: string[];
}

/**
 * Legacy dayPlanner state format.
 */
export interface LegacyDayPlannerState {
  timeSlots?: unknown[];
  taskAssignments?: LegacyTaskAssignment[];
  pendingDayLedger?: unknown;
  currentSlot?: number;
}

// ============================================================================
// MIGRATION RESULT TYPE
// ============================================================================

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
  /** Whether migration completed successfully */
  success: boolean;
  /** The migrated state */
  state: DowntimeState;
  /** Non-fatal issues encountered during migration */
  warnings: string[];
  /** Fatal errors that prevented full migration */
  errors: string[];
  /** Number of tasks successfully migrated */
  tasksConverted: number;
  /** Number of tasks that failed to convert */
  tasksFailed: number;
}

// ============================================================================
// VERSION CHECKING
// ============================================================================

/**
 * Check if migration is needed based on saved version.
 * Returns true if no version exists or version is older than current.
 */
export function needsMigration(
  savedVersion: number | undefined,
  currentVersion: number = DOWNTIME_SCHEMA_VERSION
): boolean {
  if (savedVersion === undefined) return true;
  return savedVersion < currentVersion;
}

// ============================================================================
// STATUS MAPPING
// ============================================================================

/**
 * Convert legacy task status to new TaskStatus.
 */
function convertLegacyStatus(legacyStatus: LegacyTaskStatus | undefined): TaskStatus {
  switch (legacyStatus) {
    case 'Draft':
      return 'pending';
    case 'Resolving':
      return 'in_progress';
    case 'Completed':
      return 'resolved';
    default:
      return 'pending';
  }
}

/**
 * Convert legacy task mode to DowntimeActivityType.
 * Returns null if mode is unknown.
 */
function convertLegacyMode(
  legacyMode: LegacyTaskMode | undefined
): DowntimeActivityType | null {
  if (!legacyMode) return null;

  const normalized = legacyMode.toLowerCase();
  switch (normalized) {
    case 'fishing':
      return 'fishing';
    case 'foraging':
      return 'foraging';
    case 'gathering':
      return 'foraging'; // Treat gathering as foraging
    case 'alchemy':
      return 'alchemy';
    case 'crafting':
      return 'crafting';
    case 'rest':
    case 'resting':
    case 'sleep':
      return 'rest';
    default:
      return null;
  }
}

// ============================================================================
// ID GENERATION
// ============================================================================

let migrationIdCounter = 0;

/**
 * Generate a unique ID for migrated tasks.
 */
function generateMigrationId(): string {
  return `migrated-${Date.now()}-${++migrationIdCounter}`;
}

/**
 * Reset migration ID counter (for testing).
 */
export function resetMigrationIdCounter(): void {
  migrationIdCounter = 0;
}

// ============================================================================
// ACTIVITY DATA CONVERSION
// ============================================================================

/**
 * Create activity data from legacy task assignment.
 */
function createActivityData(
  activityType: DowntimeActivityType,
  legacy: LegacyTaskAssignment
): ActivityData {
  const toolIds = legacy.selectedToolIds ?? [];

  switch (activityType) {
    case 'fishing':
      return {
        type: 'fishing',
        speciesId: legacy.targetSpeciesId ?? 'unknown',
        spotId: legacy.environmentId ?? 'unknown',
        toolIds,
        skillModifier: 0,
        targetYield: 1,
      } as FishingData;

    case 'foraging':
      return {
        type: 'foraging',
        zoneId: legacy.environmentId ?? 'unknown',
        mode: legacy.targetSpeciesId ? 'specific' : 'general',
        targetItemId: legacy.targetSpeciesId ?? undefined,
        skillUsed: 'survival',
        toolIds,
        leaderSkill: 10,
        skillModifier: 0,
        // Keep legacy fields for traceability
        biomeId: legacy.environmentId ?? 'unknown',
        nodeId: legacy.targetSpeciesId ?? undefined,
        tableId: 'default',
      } as ForagingData;

    case 'alchemy':
      return {
        type: 'alchemy',
        recipeId: 'migrated',
        formulaId: 'migrated',
        reagentIds: [],
        toolIds,
        batchSize: 1,
        aspectModifiers: {},
      };

    case 'crafting':
      return {
        type: 'crafting',
        recipeId: 'migrated',
        materialInstanceIds: [],
        toolInstanceIds: toolIds,
        qualityTarget: 'standard',
        skillModifier: 0,
      };

    case 'rest':
      return {
        type: 'rest',
        restType: 'light_rest',
        recoveryBonus: 0,
      } as RestData;

    default:
      return {
        type: 'rest',
        restType: 'light_rest',
        recoveryBonus: 0,
      } as RestData;
  }
}

// ============================================================================
// SINGLE TASK CONVERSION
// ============================================================================

/**
 * Convert a single legacy task assignment to new DowntimeTask format.
 * Returns null if the assignment is completely invalid.
 */
export function convertLegacyTaskAssignment(
  assignment: unknown,
  dayKey: number,
  slot: number,
  warnings: string[]
): DowntimeTask | null {
  // Validate input is an object
  if (!assignment || typeof assignment !== 'object') {
    return null;
  }

  const legacy = assignment as LegacyTaskAssignment;

  // Must have either an ID or enough info to create a task
  const taskId = legacy.id ?? generateMigrationId();

  // Determine activity type
  let activityType = convertLegacyMode(legacy.mode);

  if (!activityType) {
    // Unknown mode - convert to rest with warning
    warnings.push(
      `Task ${taskId}: Unknown mode "${legacy.mode}" converted to "rest"`
    );
    activityType = 'rest';
  }

  // Get leader ID
  const leaderId = legacy.leaderWorkerId ?? legacy.assignedWorkerIds?.[0] ?? '';
  if (!leaderId) {
    warnings.push(`Task ${taskId}: No leader assigned, task may be invalid`);
  }

  // Get helper IDs (exclude leader if present)
  const helperIds = (legacy.helperWorkerIds ?? []).filter((id) => id !== leaderId);

  // Convert status
  const status = convertLegacyStatus(legacy.resolutionState);

  // Use provided dayKey/slot or fall back to legacy values
  const finalDayKey = legacy.dayKey ?? dayKey;
  const finalSlot = legacy.slot ?? slot;

  // Create activity data
  const activityData = createActivityData(activityType, legacy);

  // Create the new task
  const now = Date.now();
  const task: DowntimeTask = {
    id: taskId,
    activityType,
    dayKey: finalDayKey,
    slot: finalSlot,
    leaderId,
    helperIds,
    status,
    activityData,
    createdAt: now,
    updatedAt: now,
  };

  // Preserve notes as part of results if completed
  if (status === 'resolved' && legacy.notes) {
    task.results = {
      success: true,
      message: legacy.notes,
    };
  }

  return task;
}

// ============================================================================
// V0 TO V1 MIGRATION
// ============================================================================

/**
 * Migrate from version 0 (no schema version) to version 1.
 * This handles the initial migration from legacy dayPlanner format.
 */
export function migrateV0ToV1(legacy: unknown): MigrationResult {
  const result: MigrationResult = {
    success: true,
    state: { ...downtimeInitialState },
    warnings: [],
    errors: [],
    tasksConverted: 0,
    tasksFailed: 0,
  };

  // Handle null/undefined - just return initial state
  if (legacy === null || legacy === undefined) {
    return result;
  }

  // Validate input is an object
  if (typeof legacy !== 'object') {
    result.warnings.push('Legacy state is not an object, using initial state');
    return result;
  }

  const legacyState = legacy as LegacyDayPlannerState;

  // Extract task assignments
  const taskAssignments = legacyState.taskAssignments ?? [];

  if (!Array.isArray(taskAssignments)) {
    result.warnings.push('taskAssignments is not an array, skipping migration');
    return result;
  }

  // Convert each task assignment
  const tasksById: Record<string, DowntimeTask> = {};
  const taskOrder: string[] = [];

  // Sort by orderIndex if available, handling null/undefined entries
  const sortedAssignments = [...taskAssignments]
    .filter((a) => a !== null && a !== undefined)
    .sort((a, b) => {
      const orderA = a.orderIndex ?? 0;
      const orderB = b.orderIndex ?? 0;
      return orderA - orderB;
    });

  // Track null/undefined entries as failures
  const invalidEntries = taskAssignments.filter((a) => a === null || a === undefined);
  result.tasksFailed += invalidEntries.length;
  for (let i = 0; i < invalidEntries.length; i++) {
    result.warnings.push(`Task at index contained null/undefined value`);
  }

  for (const assignment of sortedAssignments) {
    try {
      const task = convertLegacyTaskAssignment(
        assignment,
        assignment.dayKey ?? 1,
        assignment.slot ?? 0,
        result.warnings
      );

      if (task) {
        tasksById[task.id] = task;
        taskOrder.push(task.id);
        result.tasksConverted++;
      } else {
        result.tasksFailed++;
        result.warnings.push(
          `Failed to convert task at index ${sortedAssignments.indexOf(assignment)}`
        );
      }
    } catch (error) {
      result.tasksFailed++;
      result.errors.push(
        `Error converting task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  result.state = {
    tasksById,
    taskOrder,
    pendingDayLedger: null,
  };

  // Mark as failed only if we had tasks but converted none
  if (taskAssignments.length > 0 && result.tasksConverted === 0) {
    result.success = false;
    result.errors.push('Failed to convert any tasks');
  }

  return result;
}

// ============================================================================
// V1 TO V2 MIGRATION (Foraging Revamp)
// ============================================================================

/**
 * Migrate ForagingData tasks from V1 (biomeId/nodeId) to V2 (zoneId/mode/targetItemId).
 * Non-foraging tasks pass through unchanged.
 */
export function migrateV1ToV2(state: DowntimeState): MigrationResult {
  const result: MigrationResult = {
    success: true,
    state: { ...state, tasksById: { ...state.tasksById } },
    warnings: [],
    errors: [],
    tasksConverted: 0,
    tasksFailed: 0,
  };

  for (const taskId of state.taskOrder) {
    const task = state.tasksById[taskId];
    if (!task || task.activityType !== 'foraging') continue;

    const data = task.activityData as ForagingData;

    // Already migrated (has mode field)
    if (data.mode) {
      continue;
    }

    try {
      const legacyBiomeId = (data as any).biomeId ?? '';
      const legacyNodeId = (data as any).nodeId ?? '';

      const migratedData: ForagingData = {
        type: 'foraging',
        zoneId: legacyBiomeId,
        mode: legacyNodeId ? 'specific' : 'general',
        targetItemId: legacyNodeId || undefined,
        skillUsed: (data as any).skillUsed ?? 'survival',
        toolIds: data.toolIds ?? [],
        leaderSkill: data.leaderSkill ?? 10,
        skillModifier: data.skillModifier ?? 0,
        // Preserve legacy fields
        biomeId: legacyBiomeId,
        nodeId: legacyNodeId || undefined,
        tableId: (data as any).tableId,
      };

      result.state.tasksById[taskId] = {
        ...task,
        activityData: migratedData,
      };
      result.tasksConverted++;
    } catch (error) {
      result.tasksFailed++;
      result.warnings.push(
        `Failed to migrate foraging task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

/**
 * Main migration function that routes to appropriate version migration.
 * Returns migrated state or falls back to initial state on catastrophic failure.
 */
export function migrateToDowntimeState(
  legacyDayPlanner: unknown,
  savedVersion?: number
): MigrationResult {
  // If no migration needed, check if we have valid downtime state already
  if (!needsMigration(savedVersion)) {
    // Try to use as-is if it looks like valid DowntimeState
    if (isValidDowntimeState(legacyDayPlanner)) {
      return {
        success: true,
        state: legacyDayPlanner as DowntimeState,
        warnings: [],
        errors: [],
        tasksConverted: 0,
        tasksFailed: 0,
      };
    }
  }

  try {
    const targetVersion = savedVersion ?? 0;
    let currentResult: MigrationResult;

    if (targetVersion < 1) {
      currentResult = migrateV0ToV1(legacyDayPlanner);
    } else if (isValidDowntimeState(legacyDayPlanner)) {
      currentResult = {
        success: true,
        state: legacyDayPlanner as DowntimeState,
        warnings: [],
        errors: [],
        tasksConverted: 0,
        tasksFailed: 0,
      };
    } else {
      currentResult = {
        success: true,
        state: downtimeInitialState,
        warnings: ['Unknown version, using initial state'],
        errors: [],
        tasksConverted: 0,
        tasksFailed: 0,
      };
    }

    // Chain V1 → V2 migration if needed
    if (targetVersion < 2 && currentResult.success) {
      const v2Result = migrateV1ToV2(currentResult.state);
      currentResult = {
        success: v2Result.success,
        state: v2Result.state,
        warnings: [...currentResult.warnings, ...v2Result.warnings],
        errors: [...currentResult.errors, ...v2Result.errors],
        tasksConverted: currentResult.tasksConverted + v2Result.tasksConverted,
        tasksFailed: currentResult.tasksFailed + v2Result.tasksFailed,
      };
    }

    return currentResult;
  } catch (error) {
    // Catastrophic failure - return safe initial state
    return {
      success: false,
      state: downtimeInitialState,
      warnings: [],
      errors: [
        `Catastrophic migration failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Falling back to initial state',
      ],
      tasksConverted: 0,
      tasksFailed: 0,
    };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if an object looks like valid DowntimeState.
 */
function isValidDowntimeState(obj: unknown): obj is DowntimeState {
  if (!obj || typeof obj !== 'object') return false;

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.tasksById === 'object' &&
    candidate.tasksById !== null &&
    Array.isArray(candidate.taskOrder)
  );
}

// ============================================================================
// INITIALIZATION HELPER
// ============================================================================

/**
 * Initialize downtime state from saved data.
 * Handles both fresh starts and migrations from legacy formats.
 */
export function initializeDowntimeState(
  savedState: unknown,
  savedVersion?: number
): { state: DowntimeState; migrationResult?: MigrationResult } {
  // Fresh start - no saved state
  if (savedState === null || savedState === undefined) {
    return { state: downtimeInitialState };
  }

  // Check if migration is needed
  if (needsMigration(savedVersion)) {
    const migrationResult = migrateToDowntimeState(savedState, savedVersion);
    return {
      state: migrationResult.state,
      migrationResult,
    };
  }

  // No migration needed - validate and use saved state
  if (isValidDowntimeState(savedState)) {
    return { state: savedState };
  }

  // Invalid state format - fall back to initial
  return {
    state: downtimeInitialState,
    migrationResult: {
      success: false,
      state: downtimeInitialState,
      warnings: [],
      errors: ['Saved state is not valid DowntimeState format'],
      tasksConverted: 0,
      tasksFailed: 0,
    },
  };
}
