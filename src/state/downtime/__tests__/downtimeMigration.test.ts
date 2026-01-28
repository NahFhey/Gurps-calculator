import { describe, expect, it, beforeEach } from 'vitest';
import { DOWNTIME_SCHEMA_VERSION } from '../downtimeInitialState';
import {
  needsMigration,
  migrateToDowntimeState,
  migrateV0ToV1,
  convertLegacyTaskAssignment,
  initializeDowntimeState,
  resetMigrationIdCounter,
  type LegacyTaskAssignment,
  type LegacyDayPlannerState,
} from '../downtimeMigration';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createLegacyTask(
  overrides: Partial<LegacyTaskAssignment> = {}
): LegacyTaskAssignment {
  return {
    id: 'legacy-task-1',
    dayKey: 1,
    slot: 0,
    orderIndex: 0,
    mode: 'Fishing',
    leaderWorkerId: 'worker-1',
    helperWorkerIds: ['worker-2'],
    assignedWorkerIds: ['worker-1', 'worker-2'],
    environmentId: 'river-spot',
    selectedToolIds: ['rod-1'],
    targetSpeciesId: 'trout',
    resolutionState: 'Draft',
    ...overrides,
  };
}

function createLegacyDayPlannerState(
  overrides: Partial<LegacyDayPlannerState> = {}
): LegacyDayPlannerState {
  return {
    timeSlots: [],
    taskAssignments: [],
    pendingDayLedger: null,
    currentSlot: 0,
    ...overrides,
  };
}

// ============================================================================
// needsMigration TESTS
// ============================================================================

describe('needsMigration', () => {
  it('returns true when no saved version', () => {
    expect(needsMigration(undefined)).toBe(true);
  });

  it('returns true when version < current', () => {
    expect(needsMigration(0, DOWNTIME_SCHEMA_VERSION)).toBe(true);
    expect(needsMigration(DOWNTIME_SCHEMA_VERSION - 1, DOWNTIME_SCHEMA_VERSION)).toBe(
      true
    );
  });

  it('returns false when version >= current', () => {
    expect(needsMigration(DOWNTIME_SCHEMA_VERSION)).toBe(false);
    expect(needsMigration(DOWNTIME_SCHEMA_VERSION + 1)).toBe(false);
  });

  it('uses DOWNTIME_SCHEMA_VERSION as default current version', () => {
    expect(needsMigration(DOWNTIME_SCHEMA_VERSION)).toBe(false);
  });
});

// ============================================================================
// migrateToDowntimeState TESTS
// ============================================================================

describe('migrateToDowntimeState', () => {
  beforeEach(() => {
    resetMigrationIdCounter();
  });

  it('returns initial state for null input', () => {
    const result = migrateToDowntimeState(null);

    expect(result.success).toBe(true);
    expect(result.state.tasksById).toEqual({});
    expect(result.state.taskOrder).toEqual([]);
    expect(result.errors).toHaveLength(0);
  });

  it('returns initial state for undefined input', () => {
    const result = migrateToDowntimeState(undefined);

    expect(result.success).toBe(true);
    expect(result.state.tasksById).toEqual({});
    expect(result.state.taskOrder).toEqual([]);
  });

  it('converts known task types correctly', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({ mode: 'Fishing', id: 'fish-task' }),
        createLegacyTask({ mode: 'Foraging', id: 'forage-task' }),
      ],
    });

    const result = migrateToDowntimeState(legacy, 0);

    expect(result.success).toBe(true);
    expect(result.tasksConverted).toBe(2);

    const fishTask = result.state.tasksById['fish-task'];
    expect(fishTask.activityType).toBe('fishing');

    const forageTask = result.state.tasksById['forage-task'];
    expect(forageTask.activityType).toBe('foraging');
  });

  it('handles unknown modes with warning', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({ mode: 'UnknownMode', id: 'unknown-task' }),
      ],
    });

    const result = migrateToDowntimeState(legacy, 0);

    expect(result.success).toBe(true);
    expect(result.tasksConverted).toBe(1);
    expect(result.warnings.some((w) => w.includes('UnknownMode'))).toBe(true);

    // Unknown modes become 'rest'
    const task = result.state.tasksById['unknown-task'];
    expect(task.activityType).toBe('rest');
  });

  it('preserves task IDs', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({ id: 'my-custom-id' }),
      ],
    });

    const result = migrateToDowntimeState(legacy, 0);

    expect(result.state.tasksById['my-custom-id']).toBeDefined();
    expect(result.state.taskOrder).toContain('my-custom-id');
  });

  it('preserves task order based on orderIndex', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({ id: 'task-c', orderIndex: 2 }),
        createLegacyTask({ id: 'task-a', orderIndex: 0 }),
        createLegacyTask({ id: 'task-b', orderIndex: 1 }),
      ],
    });

    const result = migrateToDowntimeState(legacy, 0);

    expect(result.state.taskOrder).toEqual(['task-a', 'task-b', 'task-c']);
  });

  it('handles non-object legacy state gracefully', () => {
    const result = migrateToDowntimeState('not an object', 0);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.includes('not an object'))).toBe(true);
    expect(result.state.tasksById).toEqual({});
  });
});

// ============================================================================
// migrateV0ToV1 TESTS
// ============================================================================

describe('migrateV0ToV1', () => {
  beforeEach(() => {
    resetMigrationIdCounter();
  });

  it('returns success with initial state for null', () => {
    const result = migrateV0ToV1(null);

    expect(result.success).toBe(true);
    expect(result.state.tasksById).toEqual({});
    expect(result.state.taskOrder).toEqual([]);
  });

  it('converts legacy task statuses correctly', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({ id: 'draft', resolutionState: 'Draft' }),
        createLegacyTask({ id: 'resolving', resolutionState: 'Resolving' }),
        createLegacyTask({ id: 'completed', resolutionState: 'Completed' }),
      ],
    });

    const result = migrateV0ToV1(legacy);

    expect(result.state.tasksById['draft'].status).toBe('pending');
    expect(result.state.tasksById['resolving'].status).toBe('in_progress');
    expect(result.state.tasksById['completed'].status).toBe('resolved');
  });

  it('extracts leader and helpers correctly', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [
        createLegacyTask({
          id: 'task-1',
          leaderWorkerId: 'leader',
          helperWorkerIds: ['helper-1', 'helper-2'],
        }),
      ],
    });

    const result = migrateV0ToV1(legacy);

    const task = result.state.tasksById['task-1'];
    expect(task.leaderId).toBe('leader');
    expect(task.helperIds).toEqual(['helper-1', 'helper-2']);
  });

  it('handles missing taskAssignments array', () => {
    const legacy = { timeSlots: [] };

    const result = migrateV0ToV1(legacy);

    expect(result.success).toBe(true);
    expect(result.state.tasksById).toEqual({});
  });

  it('marks result as failed when all tasks fail', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [null, undefined, 123] as unknown as LegacyTaskAssignment[],
    });

    const result = migrateV0ToV1(legacy);

    expect(result.success).toBe(false);
    expect(result.tasksConverted).toBe(0);
    expect(result.tasksFailed).toBe(3);
  });
});

// ============================================================================
// convertLegacyTaskAssignment TESTS
// ============================================================================

describe('convertLegacyTaskAssignment', () => {
  beforeEach(() => {
    resetMigrationIdCounter();
  });

  it('maps Fishing mode to fishing activity type', () => {
    const legacy = createLegacyTask({ mode: 'Fishing' });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(task!.activityType).toBe('fishing');
    expect(task!.activityData.type).toBe('fishing');
  });

  it('maps Foraging mode to foraging activity type', () => {
    const legacy = createLegacyTask({ mode: 'Foraging' });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(task!.activityType).toBe('foraging');
    expect(task!.activityData.type).toBe('foraging');
  });

  it('maps gathering to foraging', () => {
    const legacy = createLegacyTask({ mode: 'gathering' });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(task!.activityType).toBe('foraging');
  });

  it('returns null for completely invalid data', () => {
    const warnings: string[] = [];

    expect(convertLegacyTaskAssignment(null, 1, 0, warnings)).toBeNull();
    expect(convertLegacyTaskAssignment(undefined, 1, 0, warnings)).toBeNull();
    expect(convertLegacyTaskAssignment('string', 1, 0, warnings)).toBeNull();
    expect(convertLegacyTaskAssignment(123, 1, 0, warnings)).toBeNull();
  });

  it('generates ID when not provided', () => {
    const legacy = createLegacyTask({ id: undefined });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(task!.id).toMatch(/^migrated-/);
  });

  it('uses provided dayKey and slot', () => {
    const legacy = createLegacyTask({ dayKey: undefined, slot: undefined });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 5, 2, warnings);

    expect(task).not.toBeNull();
    expect(task!.dayKey).toBe(5);
    expect(task!.slot).toBe(2);
  });

  it('preserves legacy dayKey and slot when present', () => {
    const legacy = createLegacyTask({ dayKey: 3, slot: 1 });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 99, 99, warnings);

    expect(task).not.toBeNull();
    expect(task!.dayKey).toBe(3);
    expect(task!.slot).toBe(1);
  });

  it('copies tool IDs to activity data', () => {
    const legacy = createLegacyTask({
      selectedToolIds: ['tool-1', 'tool-2'],
    });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    const activityData = task!.activityData as { toolIds: string[] };
    expect(activityData.toolIds).toEqual(['tool-1', 'tool-2']);
  });

  it('copies species/environment IDs appropriately', () => {
    const legacy = createLegacyTask({
      mode: 'Fishing',
      targetSpeciesId: 'salmon',
      environmentId: 'lake',
    });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    const activityData = task!.activityData as { speciesId: string; spotId: string };
    expect(activityData.speciesId).toBe('salmon');
    expect(activityData.spotId).toBe('lake');
  });

  it('preserves notes in results for completed tasks', () => {
    const legacy = createLegacyTask({
      resolutionState: 'Completed',
      notes: 'Caught 5 fish!',
    });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(task!.results).toBeDefined();
    expect(task!.results!.message).toBe('Caught 5 fish!');
    expect(task!.results!.success).toBe(true);
  });

  it('adds warning for missing leader', () => {
    const legacy = createLegacyTask({
      leaderWorkerId: null,
      assignedWorkerIds: [],
    });
    const warnings: string[] = [];

    const task = convertLegacyTaskAssignment(legacy, 1, 0, warnings);

    expect(task).not.toBeNull();
    expect(warnings.some((w) => w.includes('No leader'))).toBe(true);
  });
});

// ============================================================================
// initializeDowntimeState TESTS
// ============================================================================

describe('initializeDowntimeState', () => {
  beforeEach(() => {
    resetMigrationIdCounter();
  });

  it('returns initial state for null saved state', () => {
    const { state, migrationResult } = initializeDowntimeState(null);

    expect(state.tasksById).toEqual({});
    expect(state.taskOrder).toEqual([]);
    expect(migrationResult).toBeUndefined();
  });

  it('returns initial state for undefined saved state', () => {
    const { state, migrationResult } = initializeDowntimeState(undefined);

    expect(state.tasksById).toEqual({});
    expect(migrationResult).toBeUndefined();
  });

  it('migrates legacy state when version is missing', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [createLegacyTask({ id: 'migrated-task' })],
    });

    const { state, migrationResult } = initializeDowntimeState(legacy);

    expect(state.tasksById['migrated-task']).toBeDefined();
    expect(migrationResult).toBeDefined();
    expect(migrationResult!.success).toBe(true);
  });

  it('migrates legacy state when version is older', () => {
    const legacy = createLegacyDayPlannerState({
      taskAssignments: [createLegacyTask({ id: 'old-task' })],
    });

    const { state, migrationResult } = initializeDowntimeState(legacy, 0);

    expect(state.tasksById['old-task']).toBeDefined();
    expect(migrationResult).toBeDefined();
  });

  it('uses saved state directly when version is current', () => {
    const validState = {
      tasksById: { 'task-1': { id: 'task-1' } },
      taskOrder: ['task-1'],
      pendingDayLedger: null,
    };

    const { state, migrationResult } = initializeDowntimeState(
      validState,
      DOWNTIME_SCHEMA_VERSION
    );

    expect(state).toBe(validState);
    expect(migrationResult).toBeUndefined();
  });

  it('returns error for invalid state format with current version', () => {
    const invalidState = { notValid: true };

    const { state, migrationResult } = initializeDowntimeState(
      invalidState,
      DOWNTIME_SCHEMA_VERSION
    );

    expect(state.tasksById).toEqual({});
    expect(migrationResult).toBeDefined();
    expect(migrationResult!.success).toBe(false);
    expect(migrationResult!.errors.length).toBeGreaterThan(0);
  });
});
