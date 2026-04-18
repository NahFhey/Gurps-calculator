import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { TASK_STATUS } from '../constants';
import { useCampaignStore } from '../state/campaignStore';
import { denormalizeObject, normalizeArray } from '../state/campaignUtils';
import {
  createTaskAssignment,
  createPendingDayLedger,
  getAssignedWorkersForSlot,
  getTasksForSlot,
  canAdvanceSlot,
  advanceToNextSlot,
  addTaskSummaryToLedger,
  commitPendingDayLedger,
  ensureDaySlotsExist
} from '../utils/dayPlanner';
import {
  DayHeaderBar,
  WorkersPanel,
  TaskListPanel,
  DaySummaryPanel,
  TaskDetailPanel
} from './dayplanner/views';
import { ConfirmDialog, useConfirmDialog, useToast } from './ui';
import type {
  TaskAssignment,
  TaskMode,
  PendingDayLedger,
  CanAdvanceResult
} from '../types/dayplanner';
import type {
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringCategoryExtended,
  GatheringItemExtended
} from '../types/gathering';
import type {
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
  Character,
  Food,
  Material,
  TimeSlot as CampaignTimeSlot,
  TaskAssignment as CampaignTaskAssignment,
  DayLedger
} from '../types/campaign';

/**
 * DayPlannerTab - Main component for the Day Planner gathering system
 * Memoized to prevent re-renders from unrelated tab changes
 *
 * This component is a thin router that delegates to view components for:
 * - DayHeaderBar (day/slot display and controls)
 * - WorkersPanel (available/assigned workers)
 * - TaskListPanel (task list for current slot)
 * - TaskDetailPanel (task configuration and resolution)
 * - DaySummaryPanel (pending inventory summary)
 *
 * MIGRATED: Now uses useCampaignStore directly instead of props.
 * Decomposed from 1,365 lines to ~220 lines (84% reduction)
 */
function DayPlannerTabBase() {
  const { state, actions } = useCampaignStore();

  // Local state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskMode, setNewTaskMode] = useState<TaskMode>('Fishing');

  // Toast notifications
  const { success: showSuccess } = useToast();

  // Confirm dialog for skipping planned work
  const skipWorkDialog = useConfirmDialog({
    title: 'Skip Planned Work',
    message: 'This slot has planned work. Sleeping will skip it. Continue?',
    confirmLabel: 'Skip & Sleep',
    variant: 'warning',
  });

  // Derive data from normalized state
  const species = useMemo(() =>
    denormalizeObject<GatheringSpecies>(state.entities.gatheringSpecies || {}),
    [state.entities.gatheringSpecies]
  );

  const tools = useMemo(() =>
    denormalizeObject<GatheringTool>(state.entities.gatheringTools || {}),
    [state.entities.gatheringTools]
  );

  const tables = useMemo(() =>
    denormalizeObject<GatheringTable>(state.entities.gatheringTables || {}),
    [state.entities.gatheringTables]
  );

  const environments = useMemo(() =>
    denormalizeObject<GatheringEnvironment>(state.entities.gatheringEnvironments || {}),
    [state.entities.gatheringEnvironments]
  );

  const bait = useMemo(() =>
    denormalizeObject<GatheringBait>(state.entities.gatheringBait || {}),
    [state.entities.gatheringBait]
  );

  const categories = useMemo(() =>
    denormalizeObject<GatheringCategory>(state.entities.gatheringCategories || {}),
    [state.entities.gatheringCategories]
  );

  const items = useMemo(() =>
    denormalizeObject<GatheringItem>(state.entities.gatheringItems || {}),
    [state.entities.gatheringItems]
  );

  const workers = useMemo(() => {
    const chars = denormalizeObject<Character>(state.entities.characters || {});
    return chars.filter(c => c.work?.enabled);
  }, [state.entities.characters]);

  const foods = useMemo(() =>
    denormalizeObject<Food>(state.entities.foods || {}),
    [state.entities.foods]
  );

  const materials = useMemo(() =>
    denormalizeObject<Material>(state.entities.materials || {}),
    [state.entities.materials]
  );

  // Day planner state (cast from campaign types to dayplanner types)
  const timeSlots = useMemo(
    () => state.dayPlanner.timeSlots || [],
    [state.dayPlanner.timeSlots]
  );
  const taskAssignments = useMemo(
    () => (state.dayPlanner.taskAssignments || []) as unknown as TaskAssignment[],
    [state.dayPlanner.taskAssignments]
  );
  const pendingDayLedger = state.dayPlanner.pendingDayLedger as unknown as PendingDayLedger | null;
  const currentDay = state.time.day;
  const currentSlot = state.dayPlanner.currentSlot || 0;

  // Save callbacks
  const saveTimeSlots = useCallback((slots: CampaignTimeSlot[]) => {
    actions.setTimeSlots(slots);
  }, [actions]);

  const saveTaskAssignments = useCallback((tasks: TaskAssignment[]) => {
    actions.setTaskAssignments(tasks as unknown as CampaignTaskAssignment[]);
  }, [actions]);

  const savePendingDayLedger = useCallback((ledger: PendingDayLedger | null) => {
    actions.setPendingDayLedger(ledger as unknown as DayLedger | null);
  }, [actions]);

  const saveCurrentDay = useCallback((day: number) => {
    actions.setTimeDay(day);
  }, [actions]);

  const saveCurrentSlot = useCallback((slot: number) => {
    actions.setDayPlannerSlot(slot);
  }, [actions]);

  const saveFoods = useCallback((foodsList: Food[]) => {
    actions.setFoods(normalizeArray(foodsList));
  }, [actions]);

  const saveMaterials = useCallback((materialsList: Material[]) => {
    actions.setMaterials(normalizeArray(materialsList));
  }, [actions]);

  /**
   * Ensures time slots and pending ledger exist for the current day
   */
  const initializeDayState = useCallback(() => {
    // Ensure slots exist
    const updatedSlots = ensureDaySlotsExist(timeSlots, currentDay) as unknown as CampaignTimeSlot[];
    if (updatedSlots.length !== timeSlots.length) {
      saveTimeSlots(updatedSlots);
    }

    // Ensure pending ledger exists
    if (!pendingDayLedger || (pendingDayLedger as unknown as { dayKey: number }).dayKey !== currentDay) {
      const newLedger = createPendingDayLedger(currentDay) as unknown as PendingDayLedger;
      savePendingDayLedger(newLedger);
    }
  }, [timeSlots, currentDay, pendingDayLedger, saveTimeSlots, savePendingDayLedger]);

  // Initialize slots and ledger on mount or day change
  useEffect(() => {
    initializeDayState();
  }, [initializeDayState]);

  /**
   * Gets tasks for the current slot
   */
  const currentSlotTasks = useMemo(() => {
    return getTasksForSlot(taskAssignments, currentDay, currentSlot) as unknown as TaskAssignment[];
  }, [taskAssignments, currentDay, currentSlot]);

  /**
   * Gets assigned workers for the current slot
   */
  const assignedWorkerIds = useMemo(() => {
    return getAssignedWorkersForSlot(taskAssignments, currentDay, currentSlot);
  }, [taskAssignments, currentDay, currentSlot]);

  /**
   * Gets available (unassigned) workers for the current slot
   */
  const availableWorkers = useMemo(() => {
    return workers.filter(w => !assignedWorkerIds.includes(w.id));
  }, [workers, assignedWorkerIds]);

  /**
   * Checks if the current slot can advance
   */
  const canAdvance = useMemo(() => {
    return canAdvanceSlot(taskAssignments, currentDay, currentSlot) as unknown as CanAdvanceResult;
  }, [taskAssignments, currentDay, currentSlot]);
  /**
   * Adds a new task to the current slot
   */
  function addTask() {
    const orderIndex = currentSlotTasks.length;
    const newTask = createTaskAssignment(currentDay, currentSlot, orderIndex, newTaskMode) as unknown as TaskAssignment;

    saveTaskAssignments([...taskAssignments, newTask]);
    setSelectedTaskId(newTask.id);
    setShowAddTask(false);
  }

  /**
   * Deletes a task
   */
  function deleteTask(taskId: string) {
    const updatedTasks = taskAssignments.filter(t => t.id !== taskId);
    saveTaskAssignments(updatedTasks);

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  }

  /**
   * Updates a task
   */
  function updateTask(updatedTask: TaskAssignment) {
    const updatedTasks = taskAssignments.map(t =>
      t.id === updatedTask.id ? updatedTask : t
    );
    saveTaskAssignments(updatedTasks);
  }

  /**
   * Completes a task and adds its results to the pending ledger
   */
  function completeTask(task: TaskAssignment) {
    // Mark task as completed
    const completedTask: TaskAssignment = {
      ...task,
      resolutionState: 'Completed'
    };
    updateTask(completedTask);

    // Add to pending ledger
    if (pendingDayLedger) {
      const updatedLedger = addTaskSummaryToLedger(pendingDayLedger as unknown as PendingDayLedger, completedTask) as unknown as PendingDayLedger;
      savePendingDayLedger(updatedLedger);
    }
  }

  /**
   * Sleep button handler - advances time when no work is done
   */
  async function handleSleep() {
    // If slot has no tasks, advance immediately
    if (currentSlotTasks.length === 0) {
      advanceSlot();
      return;
    }

    // If slot has tasks but none started, warn
    const hasStartedTasks = currentSlotTasks.some(
      t => t.resolutionState === TASK_STATUS.Resolving || t.resolutionState === TASK_STATUS.Completed
    );

    if (!hasStartedTasks) {
      const confirmed = await skipWorkDialog.confirm();
      if (!confirmed) return;
    }

    // Advance slot (or day if Night)
    advanceSlot();
  }

  /**
   * Advances to the next slot
   */
  function advanceSlot() {
    const advancement = advanceToNextSlot(currentDay, currentSlot) as unknown as { nextDay: number; nextSlot: number; dayAdvanced: boolean };

    if (advancement?.dayAdvanced) {
      // Day is ending - show summary and commit
      commitDay(advancement.nextDay);
    } else {
      // Just advance to next slot
      saveCurrentSlot(advancement?.nextSlot);
    }
  }

  /**
   * Commits the current day and advances to the next
   */
  function commitDay(nextDay: number) {
    if (!pendingDayLedger) return;

    // Commit pending inventory
    const result = commitPendingDayLedger(
      pendingDayLedger as unknown as PendingDayLedger,
      foods,
      materials
    ) as unknown as { updatedFoods: Food[]; updatedMaterials: Material[]; committedLedger: PendingDayLedger };
    const { updatedFoods, updatedMaterials, committedLedger } = result;

    // Save committed inventory
    saveFoods(updatedFoods);
    saveMaterials(updatedMaterials);
    savePendingDayLedger(committedLedger);

    // Advance to next day
    saveCurrentDay(nextDay);
    saveCurrentSlot(0); // Reset to Morning

    showSuccess(`Day ${currentDay} complete! Inventory committed. Starting Day ${nextDay}.`);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Top Bar */}
      <DayHeaderBar
        currentDay={currentDay}
        currentSlot={currentSlot}
        canAdvance={canAdvance}
        onSleep={handleSleep}
        onAdvanceSlot={advanceSlot}
      />

      {/* Three-Panel Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel: Workers */}
        <WorkersPanel
          workers={workers}
          availableWorkers={availableWorkers}
          assignedWorkerIds={assignedWorkerIds}
        />

        {/* Middle Panel: Task List */}
        <TaskListPanel
          tasks={currentSlotTasks}
          selectedTaskId={selectedTaskId}
          showAddTask={showAddTask}
          newTaskMode={newTaskMode}
          onSelectTask={setSelectedTaskId}
          onToggleAddTask={() => setShowAddTask(!showAddTask)}
          onSetNewTaskMode={setNewTaskMode}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
        />

        {/* Right Panel: Task Detail */}
        <div className="col-span-4 bg-gray-800 p-4 rounded-lg">
          {selectedTaskId ? (
            <TaskDetailPanel
              task={taskAssignments.find(t => t.id === selectedTaskId)}
              workers={workers}
              environments={environments as unknown as GatheringEnvironmentExtended[]}
              tools={tools as unknown as GatheringToolExtended[]}
              species={species as unknown as GatheringSpeciesExtended[]}
              categories={categories as unknown as GatheringCategoryExtended[]}
              items={items as unknown as GatheringItemExtended[]}
              bait={bait as unknown as GatheringBaitExtended[]}
              tables={tables as unknown as GatheringTableExtended[]}
              taskAssignments={taskAssignments}
              currentDay={currentDay}
              currentSlot={currentSlot}
              updateTask={updateTask}
              completeTask={completeTask}
            />
          ) : (
            <div className="text-gray-500 italic">
              Select a task to view details
            </div>
          )}
        </div>
      </div>

      {/* Day Summary */}
      <DaySummaryPanel pendingDayLedger={pendingDayLedger as unknown as PendingDayLedger | null} />

      {/* Skip Work Confirmation Dialog */}
      <ConfirmDialog {...skipWorkDialog.dialogProps} />
    </div>
  );
}

export const DayPlannerTab = memo(DayPlannerTabBase);
