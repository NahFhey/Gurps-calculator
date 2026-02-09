/**
 * Downtime System Integration Tests
 *
 * End-to-end tests for the complete downtime workflow.
 * Tests multi-activity scenarios, day transitions, and state persistence.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type {
  DowntimeState,
  DowntimeTask,
  FishingData,
  ForagingData,
  AlchemyData,
  CraftingData,
  RestData,
  TaskResults,
  TaskStatus,
} from '../types/downtime';
import { downtimeInitialState } from '../state/downtime/downtimeInitialState';
import { downtimeReducer } from '../state/downtime/downtimeReducer';
import {
  createTask,
  beginResolveTask,
  resolveTask,
  cancelTask,
  type CreateTaskPayload,
} from '../state/downtime/downtimeActions';
import {
  selectTasksForSlot,
  selectCanAdvanceSlot,
  selectCharacterFatigueStatus,
  selectAssignedCharacterIdsForSlot,
  selectReservedToolIdsForSlot,
  selectPendingTasksForSlot,
  selectResolvedTasksForSlot,
  selectTasksByCharacter,
} from '../state/downtime/downtimeSelectors';
import { DowntimeValidationError, DOWNTIME_ERROR_CODES } from '../state/downtime/downtimeErrors';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createFishingData(overrides?: Partial<FishingData>): FishingData {
  return {
    type: 'fishing',
    method: 'Line',
    speciesId: 'species-trout',
    isRandomCatch: false,
    spotId: 'spot-river',
    toolIds: [],
    baitId: null,
    retryAttempt: 0,
    skillModifier: 0,
    targetYield: 5,
    ...overrides,
  };
}

function createForagingData(overrides?: Partial<ForagingData>): ForagingData {
  return {
    type: 'foraging',
    zoneId: 'zone-forest',
    mode: 'general',
    skillUsed: 'survival',
    toolIds: [],
    leaderSkill: 12,
    skillModifier: 0,
    ...overrides,
  };
}

function createAlchemyData(overrides?: Partial<AlchemyData>): AlchemyData {
  return {
    type: 'alchemy',
    recipeId: 'recipe-healing-potion',
    formulaId: 'formula-basic',
    reagentIds: ['reagent-1'],
    toolIds: [],
    batchSize: 1,
    aspectModifiers: {},
    ...overrides,
  };
}

function createCraftingData(overrides?: Partial<CraftingData>): CraftingData {
  return {
    type: 'crafting',
    recipeId: 'recipe-longsword',
    materialInstanceIds: ['material-1'],
    toolInstanceIds: [],
    qualityTarget: 'standard',
    skillModifier: 0,
    ...overrides,
  };
}

function createRestData(overrides?: Partial<RestData>): RestData {
  return {
    type: 'rest',
    restType: 'sleep',
    recoveryBonus: 0,
    ...overrides,
  };
}

function createTaskPayload(overrides?: Partial<CreateTaskPayload>): CreateTaskPayload {
  return {
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    activityData: createFishingData(),
    ...overrides,
  };
}

function createSuccessResults(message = 'Success!'): TaskResults {
  return {
    success: true,
    message,
    inventoryChanges: [],
    experienceGained: 10,
  };
}

function createFailureResults(message = 'Failed!'): TaskResults {
  return {
    success: false,
    message,
    inventoryChanges: [],
    experienceGained: 0,
  };
}

// ============================================================================
// END-TO-END WORKFLOW TESTS
// ============================================================================

describe('Downtime System Integration', () => {
  describe('End-to-end workflow', () => {
    it('complete day workflow: create tasks → resolve → advance', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Create fishing task for char-1
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );

      // Create foraging task for char-2 (different character)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'foraging',
            dayKey,
            slot,
            leaderId: 'char-2',
            activityData: createForagingData({ mode: 'specific', targetItemId: 'mushrooms' }),
          })
        )
      );

      // Verify both tasks created
      const tasksInSlot = selectTasksForSlot(state, dayKey, slot);
      expect(tasksInSlot).toHaveLength(2);

      // Verify time cannot advance with pending tasks
      const preResolveCheck = selectCanAdvanceSlot(state, dayKey, slot);
      expect(preResolveCheck.canAdvance).toBe(false);
      expect(preResolveCheck.blockingTaskIds).toHaveLength(2);

      // Resolve first task
      const task1Id = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(task1Id));
      state = downtimeReducer(
        state,
        resolveTask(task1Id, createSuccessResults('Caught 5 trout!'))
      );

      // Still cannot advance (one task pending)
      const midResolveCheck = selectCanAdvanceSlot(state, dayKey, slot);
      expect(midResolveCheck.canAdvance).toBe(false);
      expect(midResolveCheck.blockingTaskIds).toHaveLength(1);

      // Resolve second task
      const task2Id = state.taskOrder[1];
      state = downtimeReducer(state, beginResolveTask(task2Id));
      state = downtimeReducer(
        state,
        resolveTask(task2Id, createSuccessResults('Found 3 mushrooms!'))
      );

      // Now time can advance
      const postResolveCheck = selectCanAdvanceSlot(state, dayKey, slot);
      expect(postResolveCheck.canAdvance).toBe(true);
      expect(postResolveCheck.blockingTaskIds).toHaveLength(0);

      // Verify resolved tasks remain in state
      const resolvedTasks = selectResolvedTasksForSlot(state, dayKey, slot);
      expect(resolvedTasks).toHaveLength(2);
      expect(resolvedTasks[0].results?.success).toBe(true);
      expect(resolvedTasks[1].results?.success).toBe(true);
    });

    it('multi-slot workflow with same character', () => {
      let state = downtimeInitialState;
      const dayKey = 1;

      // Slot 0: Fishing
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData(),
          })
        )
      );

      // Slot 1: Same character foraging (allowed in different slot)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'foraging',
            dayKey,
            slot: 1,
            leaderId: 'char-1',
            activityData: createForagingData(),
          })
        )
      );

      // Slot 2: Same character crafting
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'crafting',
            dayKey,
            slot: 2,
            leaderId: 'char-1',
            activityData: createCraftingData(),
          })
        )
      );

      // Verify all tasks created
      expect(state.taskOrder).toHaveLength(3);

      // Resolve all tasks
      for (const taskId of state.taskOrder) {
        state = downtimeReducer(state, beginResolveTask(taskId));
        state = downtimeReducer(state, resolveTask(taskId, createSuccessResults()));
      }

      // Verify all slots can advance
      expect(selectCanAdvanceSlot(state, dayKey, 0).canAdvance).toBe(true);
      expect(selectCanAdvanceSlot(state, dayKey, 1).canAdvance).toBe(true);
      expect(selectCanAdvanceSlot(state, dayKey, 2).canAdvance).toBe(true);
    });

    it('multi-day workflow with same characters and targets', () => {
      let state = downtimeInitialState;

      // Day 1: Fish for trout
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey: 1,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );

      const day1TaskId = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(day1TaskId));
      state = downtimeReducer(state, resolveTask(day1TaskId, createSuccessResults()));

      // Day 2: Same character, same target (allowed on different day)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey: 2,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );

      expect(state.taskOrder).toHaveLength(2);

      // Verify tasks are on different days
      const tasks = state.taskOrder.map((id) => state.tasksById[id]);
      expect(tasks[0].dayKey).toBe(1);
      expect(tasks[1].dayKey).toBe(2);
    });

    it('cancelled task workflow with partial slot completion', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Create three tasks
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'foraging',
            dayKey,
            slot,
            leaderId: 'char-2',
            activityData: createForagingData({ mode: 'specific', targetItemId: 'herbs' }),
          })
        )
      );
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'alchemy',
            dayKey,
            slot,
            leaderId: 'char-3',
            activityData: createAlchemyData({ recipeId: 'potion-1' }),
          })
        )
      );

      // Resolve first task
      const task1Id = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(task1Id));
      state = downtimeReducer(state, resolveTask(task1Id, createSuccessResults()));

      // Cancel second task
      const task2Id = state.taskOrder[1];
      state = downtimeReducer(state, cancelTask(task2Id));

      // Resolve third task
      const task3Id = state.taskOrder[2];
      state = downtimeReducer(state, beginResolveTask(task3Id));
      state = downtimeReducer(state, resolveTask(task3Id, createSuccessResults()));

      // Time should be able to advance (one resolved, one cancelled, one resolved)
      const advanceCheck = selectCanAdvanceSlot(state, dayKey, slot);
      expect(advanceCheck.canAdvance).toBe(true);

      // Verify task statuses
      expect(state.tasksById[task1Id].status).toBe('resolved');
      expect(state.tasksById[task2Id].status).toBe('cancelled');
      expect(state.tasksById[task3Id].status).toBe('resolved');
    });

    it('helper assignment workflow', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Create task with leader and helpers
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            helperIds: ['char-2', 'char-3'],
            activityData: createCraftingData(),
          })
        )
      );

      // Verify all characters are assigned
      const assignedChars = selectAssignedCharacterIdsForSlot(state, dayKey, slot);
      expect(assignedChars.has('char-1')).toBe(true);
      expect(assignedChars.has('char-2')).toBe(true);
      expect(assignedChars.has('char-3')).toBe(true);

      // Verify char-4 is not assigned
      expect(assignedChars.has('char-4')).toBe(false);
    });

    it('alchemy batch workflow', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Create alchemy task with batch size 3
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'alchemy',
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createAlchemyData({
              recipeId: 'healing-potion',
              batchSize: 3,
              reagentIds: ['herb-1', 'herb-2', 'herb-3'],
            }),
          })
        )
      );

      const taskId = state.taskOrder[0];

      // Verify task is pending
      expect(state.tasksById[taskId].status).toBe('pending');

      // Begin resolution
      state = downtimeReducer(state, beginResolveTask(taskId));
      expect(state.tasksById[taskId].status).toBe('in_progress');

      // Complete resolution with batch results
      const batchResults: TaskResults = {
        success: true,
        message: 'Brewed 3 healing potions!',
        inventoryChanges: [
          { itemId: 'healing-potion', quantity: 3, itemName: 'Healing Potion' },
          { itemId: 'herb-1', quantity: -1, itemName: 'Healing Herb' },
          { itemId: 'herb-2', quantity: -1, itemName: 'Purified Water' },
          { itemId: 'herb-3', quantity: -1, itemName: 'Magic Essence' },
        ],
        experienceGained: 30,
      };

      state = downtimeReducer(state, resolveTask(taskId, batchResults));

      expect(state.tasksById[taskId].status).toBe('resolved');
      expect(state.tasksById[taskId].results).toEqual(batchResults);
    });
  });

  // ============================================================================
  // FATIGUE TRACKING TESTS
  // ============================================================================

  describe('Fatigue tracking', () => {
    it('tracks tired status after work in previous slot', () => {
      let state = downtimeInitialState;
      const dayKey = 1;

      // Work in slot 0
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData(),
          })
        )
      );

      const taskId = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(taskId));
      state = downtimeReducer(state, resolveTask(taskId, createSuccessResults()));

      // Check fatigue at slot 1 (should be tired after working in slot 0)
      const fatigueAtSlot1 = selectCharacterFatigueStatus(state, 'char-1', dayKey, 1);
      expect(fatigueAtSlot1).toBe('tired');

      // Check fatigue at slot 0 (should be rested - we look at completed slots before)
      const fatigueAtSlot0 = selectCharacterFatigueStatus(state, 'char-1', dayKey, 0);
      expect(fatigueAtSlot0).toBe('rested');
    });

    it('tracks exhausted status after working while tired', () => {
      let state = downtimeInitialState;
      const dayKey = 1;

      // Work in slot 0
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );
      const task1Id = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(task1Id));
      state = downtimeReducer(state, resolveTask(task1Id, createSuccessResults()));

      // Work in slot 1 (while tired)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 1,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'salmon' }),
          })
        )
      );
      const task2Id = state.taskOrder[1];
      state = downtimeReducer(state, beginResolveTask(task2Id));
      state = downtimeReducer(state, resolveTask(task2Id, createSuccessResults()));

      // Check fatigue at slot 2 (should be exhausted after working while tired)
      const fatigueAtSlot2 = selectCharacterFatigueStatus(state, 'char-1', dayKey, 2);
      expect(fatigueAtSlot2).toBe('exhausted');
    });

    it('clears fatigue with rest', () => {
      let state = downtimeInitialState;
      const dayKey = 1;

      // Work in slot 0 (becomes tired)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData(),
          })
        )
      );
      const task1Id = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(task1Id));
      state = downtimeReducer(state, resolveTask(task1Id, createSuccessResults()));

      // Rest in slot 1
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'rest',
            dayKey,
            slot: 1,
            leaderId: 'char-1',
            activityData: createRestData(),
          })
        )
      );
      const task2Id = state.taskOrder[1];
      state = downtimeReducer(state, beginResolveTask(task2Id));
      state = downtimeReducer(state, resolveTask(task2Id, createSuccessResults()));

      // Check fatigue at slot 2 (should be rested after rest)
      const fatigueAtSlot2 = selectCharacterFatigueStatus(state, 'char-1', dayKey, 2);
      expect(fatigueAtSlot2).toBe('rested');
    });

    it('only counts non-rest resolved tasks as work', () => {
      let state = downtimeInitialState;
      const dayKey = 1;

      // Pending task in slot 0 (shouldn't count as work)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot: 0,
            leaderId: 'char-1',
            activityData: createFishingData(),
          })
        )
      );

      // Check fatigue at slot 1 (should still be rested - task not resolved)
      const fatigueAtSlot1 = selectCharacterFatigueStatus(state, 'char-1', dayKey, 1);
      expect(fatigueAtSlot1).toBe('rested');
    });
  });

  // ============================================================================
  // TOOL RESERVATION WORKFLOW TESTS
  // ============================================================================

  describe('Tool reservation workflow', () => {
    it('reserves tools when task is created', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({ toolIds: ['rod-1', 'net-1'] }),
          })
        )
      );

      const reservedTools = selectReservedToolIdsForSlot(state, dayKey, slot);
      expect(reservedTools.has('rod-1')).toBe(true);
      expect(reservedTools.has('net-1')).toBe(true);
    });

    it('frees tools when task is cancelled', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({
              toolIds: ['rod-1'],
              speciesId: 'trout',
            }),
          })
        )
      );

      const taskId = state.taskOrder[0];
      state = downtimeReducer(state, cancelTask(taskId));

      // Tools should be freed after cancellation
      const reservedTools = selectReservedToolIdsForSlot(state, dayKey, slot);
      expect(reservedTools.has('rod-1')).toBe(false);
    });

    it('allows tool reuse after cancellation by different character', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // char-1 uses rod-1
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({
              toolIds: ['rod-1'],
              speciesId: 'trout',
            }),
          })
        )
      );

      // Cancel char-1's task
      const taskId = state.taskOrder[0];
      state = downtimeReducer(state, cancelTask(taskId));

      // char-2 can now use rod-1 (different target to avoid lock conflict)
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-2',
            activityData: createFishingData({
              toolIds: ['rod-1'],
              speciesId: 'salmon',
            }),
          })
        )
      );

      expect(state.taskOrder).toHaveLength(2);
      expect(state.tasksById[state.taskOrder[1]].leaderId).toBe('char-2');
    });

    it('maintains tool reservation through resolution', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({ toolIds: ['rod-1'] }),
          })
        )
      );

      const taskId = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(taskId));

      // Tools still reserved during in_progress
      let reservedTools = selectReservedToolIdsForSlot(state, dayKey, slot);
      expect(reservedTools.has('rod-1')).toBe(true);

      state = downtimeReducer(state, resolveTask(taskId, createSuccessResults()));

      // Tools freed after resolution
      reservedTools = selectReservedToolIdsForSlot(state, dayKey, slot);
      expect(reservedTools.has('rod-1')).toBe(false);
    });
  });

  // ============================================================================
  // COMPLEX SCENARIO TESTS
  // ============================================================================

  describe('Complex scenarios', () => {
    it('party-wide activity coordination', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Assign all party members to different activities
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'warrior',
            activityData: createCraftingData({ recipeId: 'sword-maintenance' }),
          })
        )
      );

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'alchemy',
            dayKey,
            slot,
            leaderId: 'mage',
            activityData: createAlchemyData({ recipeId: 'mana-potion' }),
          })
        )
      );

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'foraging',
            dayKey,
            slot,
            leaderId: 'ranger',
            activityData: createForagingData({ mode: 'specific', targetItemId: 'herbs' }),
          })
        )
      );

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'fishing',
            dayKey,
            slot,
            leaderId: 'rogue',
            activityData: createFishingData({ speciesId: 'fish' }),
          })
        )
      );

      // All party members should be assigned
      const assigned = selectAssignedCharacterIdsForSlot(state, dayKey, slot);
      expect(assigned.size).toBe(4);
      expect(assigned.has('warrior')).toBe(true);
      expect(assigned.has('mage')).toBe(true);
      expect(assigned.has('ranger')).toBe(true);
      expect(assigned.has('rogue')).toBe(true);

      // Resolve all tasks
      for (const taskId of state.taskOrder) {
        state = downtimeReducer(state, beginResolveTask(taskId));
        state = downtimeReducer(state, resolveTask(taskId, createSuccessResults()));
      }

      // Slot should be advanceable
      expect(selectCanAdvanceSlot(state, dayKey, slot).canAdvance).toBe(true);
    });

    it('leader-helper team workflow', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Master craftsman with apprentices
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'crafting',
            dayKey,
            slot,
            leaderId: 'master-smith',
            helperIds: ['apprentice-1', 'apprentice-2'],
            activityData: createCraftingData({
              recipeId: 'masterwork-sword',
              qualityTarget: 'masterwork',
            }),
          })
        )
      );

      // All participants should be assigned
      const assigned = selectAssignedCharacterIdsForSlot(state, dayKey, slot);
      expect(assigned.size).toBe(3);

      // Get tasks by each character
      const masterTasks = selectTasksByCharacter(state, 'master-smith');
      const apprentice1Tasks = selectTasksByCharacter(state, 'apprentice-1');
      const apprentice2Tasks = selectTasksByCharacter(state, 'apprentice-2');

      expect(masterTasks).toHaveLength(1);
      expect(apprentice1Tasks).toHaveLength(1);
      expect(apprentice2Tasks).toHaveLength(1);

      // All should reference the same task
      expect(masterTasks[0].id).toBe(apprentice1Tasks[0].id);
      expect(masterTasks[0].id).toBe(apprentice2Tasks[0].id);
    });

    it('mixed success and failure results', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      // Create multiple tasks
      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: createFishingData({ speciesId: 'trout' }),
          })
        )
      );

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'alchemy',
            dayKey,
            slot,
            leaderId: 'char-2',
            activityData: createAlchemyData({ recipeId: 'volatile-potion' }),
          })
        )
      );

      // Resolve first task with success
      const task1Id = state.taskOrder[0];
      state = downtimeReducer(state, beginResolveTask(task1Id));
      state = downtimeReducer(
        state,
        resolveTask(task1Id, createSuccessResults('Caught fish!'))
      );

      // Resolve second task with failure
      const task2Id = state.taskOrder[1];
      state = downtimeReducer(state, beginResolveTask(task2Id));
      state = downtimeReducer(
        state,
        resolveTask(task2Id, createFailureResults('Potion exploded!'))
      );

      // Both tasks should be resolved regardless of success/failure
      expect(state.tasksById[task1Id].status).toBe('resolved');
      expect(state.tasksById[task2Id].status).toBe('resolved');

      expect(state.tasksById[task1Id].results?.success).toBe(true);
      expect(state.tasksById[task2Id].results?.success).toBe(false);

      // Slot should still be advanceable
      expect(selectCanAdvanceSlot(state, dayKey, slot).canAdvance).toBe(true);
    });

    it('activity-specific data preservation through lifecycle', () => {
      let state = downtimeInitialState;
      const dayKey = 1;
      const slot = 0;

      const alchemyData = createAlchemyData({
        recipeId: 'special-brew',
        formulaId: 'formula-advanced',
        reagentIds: ['rare-herb', 'dragon-scale', 'moonwater'],
        batchSize: 2,
        aspectModifiers: { potency: 5, duration: 3 },
      });

      state = downtimeReducer(
        state,
        createTask(
          createTaskPayload({
            activityType: 'alchemy',
            dayKey,
            slot,
            leaderId: 'char-1',
            activityData: alchemyData,
          })
        )
      );

      const taskId = state.taskOrder[0];

      // Verify data preserved at creation
      expect(state.tasksById[taskId].activityData).toEqual(alchemyData);

      // Progress through lifecycle
      state = downtimeReducer(state, beginResolveTask(taskId));
      expect(state.tasksById[taskId].activityData).toEqual(alchemyData);

      state = downtimeReducer(state, resolveTask(taskId, createSuccessResults()));
      expect(state.tasksById[taskId].activityData).toEqual(alchemyData);
    });
  });

  // ============================================================================
  // STATE CONSISTENCY TESTS
  // ============================================================================

  describe('State consistency', () => {
    it('maintains taskOrder and tasksById synchronization', () => {
      let state = downtimeInitialState;

      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        state = downtimeReducer(
          state,
          createTask(
            createTaskPayload({
              dayKey: 1,
              slot: i,
              leaderId: `char-${i}`,
              activityData: createFishingData({ speciesId: `species-${i}` }),
            })
          )
        );
      }

      // Verify synchronization
      expect(state.taskOrder).toHaveLength(5);
      for (const taskId of state.taskOrder) {
        expect(state.tasksById[taskId]).toBeDefined();
        expect(state.tasksById[taskId].id).toBe(taskId);
      }

      // Cancel some tasks
      state = downtimeReducer(state, cancelTask(state.taskOrder[1]));
      state = downtimeReducer(state, cancelTask(state.taskOrder[3]));

      // Tasks should still be in sync (cancelled tasks remain)
      expect(state.taskOrder).toHaveLength(5);
      for (const taskId of state.taskOrder) {
        expect(state.tasksById[taskId]).toBeDefined();
      }
    });

    it('timestamps are correctly maintained', () => {
      let state = downtimeInitialState;

      const beforeCreate = Date.now();
      state = downtimeReducer(
        state,
        createTask(createTaskPayload())
      );
      const afterCreate = Date.now();

      const taskId = state.taskOrder[0];
      const task = state.tasksById[taskId];

      // Creation timestamp
      expect(task.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(task.createdAt).toBeLessThanOrEqual(afterCreate);
      expect(task.updatedAt).toBe(task.createdAt);

      // Update timestamp on status change
      const beforeResolve = Date.now();
      state = downtimeReducer(state, beginResolveTask(taskId));
      const afterResolve = Date.now();

      const updatedTask = state.tasksById[taskId];
      expect(updatedTask.updatedAt).toBeGreaterThanOrEqual(beforeResolve);
      expect(updatedTask.updatedAt).toBeLessThanOrEqual(afterResolve);
      expect(updatedTask.createdAt).toBe(task.createdAt); // Creation unchanged
    });

    it('handles empty state operations gracefully', () => {
      const state = downtimeInitialState;

      // Selectors on empty state
      expect(selectTasksForSlot(state, 1, 0)).toEqual([]);
      expect(selectPendingTasksForSlot(state, 1, 0)).toEqual([]);
      expect(selectResolvedTasksForSlot(state, 1, 0)).toEqual([]);
      expect(selectAssignedCharacterIdsForSlot(state, 1, 0).size).toBe(0);
      expect(selectReservedToolIdsForSlot(state, 1, 0).size).toBe(0);
      expect(selectCanAdvanceSlot(state, 1, 0).canAdvance).toBe(true);
      expect(selectCharacterFatigueStatus(state, 'char-1', 1, 0)).toBe('rested');
    });
  });
});
