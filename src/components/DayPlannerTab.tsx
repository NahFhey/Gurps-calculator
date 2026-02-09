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
  PendingDayLedger
} from '../types/dayplanner';

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
    denormalizeObject(state.entities.gatheringSpecies || {}) as any[],
    [state.entities.gatheringSpecies]
  );

  const tools = useMemo(() =>
    denormalizeObject(state.entities.gatheringTools || {}) as any[],
    [state.entities.gatheringTools]
  );

  const tables = useMemo(() =>
    denormalizeObject(state.entities.gatheringTables || {}) as any[],
    [state.entities.gatheringTables]
  );

  const environments = useMemo(() =>
    denormalizeObject(state.entities.gatheringEnvironments || {}) as any[],
    [state.entities.gatheringEnvironments]
  );

  const bait = useMemo(() =>
    denormalizeObject(state.entities.gatheringBait || {}) as any[],
    [state.entities.gatheringBait]
  );

  const categories = useMemo(() =>
    denormalizeObject(state.entities.gatheringCategories || {}) as any[],
    [state.entities.gatheringCategories]
  );

  const items = useMemo(() =>
    denormalizeObject(state.entities.gatheringItems || {}) as any[],
    [state.entities.gatheringItems]
  );

  const workers = useMemo(() => {
    const chars = denormalizeObject(state.entities.characters || {}) as any[];
    return chars.filter(c => c.work?.enabled);
  }, [state.entities.characters]);

  const foods = useMemo(() =>
    denormalizeObject(state.entities.foods || {}) as any[],
    [state.entities.foods]
  );

  const materials = useMemo(() =>
    denormalizeObject(state.entities.materials || {}) as any[],
    [state.entities.materials]
  );

  // Day planner state
  const timeSlots = state.dayPlanner.timeSlots || [];
  const taskAssignments = state.dayPlanner.taskAssignments || [];
  const pendingDayLedger = state.dayPlanner.pendingDayLedger;
  const currentDay = state.time.day;
  const currentSlot = state.dayPlanner.currentSlot || 0;

  // Save callbacks
  const saveTimeSlots = useCallback((slots: any[]) => {
    actions.setTimeSlots(slots);
  }, [actions]);

  const saveTaskAssignments = useCallback((tasks: TaskAssignment[]) => {
    actions.setTaskAssignments(tasks);
  }, [actions]);

  const savePendingDayLedger = useCallback((ledger: PendingDayLedger | null) => {
    actions.setPendingDayLedger(ledger as any);
  }, [actions]);

  const saveCurrentDay = useCallback((day: number) => {
    actions.setTimeDay(day);
  }, [actions]);

  const saveCurrentSlot = useCallback((slot: number) => {
    actions.setDayPlannerSlot(slot);
  }, [actions]);

  const saveFoods = useCallback((foodsList: any[]) => {
    actions.setFoods(normalizeArray(foodsList));
  }, [actions]);

  const saveMaterials = useCallback((materialsList: any[]) => {
    actions.setMaterials(normalizeArray(materialsList));
  }, [actions]);

  // Initialize slots and ledger on mount or day change
  useEffect(() => {
    initializeDayState();
  }, [currentDay]);

  /**
   * Ensures time slots and pending ledger exist for the current day
   */
  function initializeDayState() {
    // Ensure slots exist
    const updatedSlots = ensureDaySlotsExist(timeSlots, currentDay);
    if (updatedSlots.length !== timeSlots.length) {
      saveTimeSlots(updatedSlots);
    }

    // Ensure pending ledger exists
    if (!pendingDayLedger || pendingDayLedger.dayKey !== currentDay) {
      const newLedger = createPendingDayLedger(currentDay);
      savePendingDayLedger(newLedger);
    }
  }

  /**
   * Gets tasks for the current slot
   */
  const currentSlotTasks = useMemo(() => {
    return getTasksForSlot(taskAssignments, currentDay, currentSlot);
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
    return canAdvanceSlot(taskAssignments, currentDay, currentSlot);
  }, [taskAssignments, currentDay, currentSlot]);

  /**
   * Adds a new task to the current slot
   */
  function addTask() {
    const orderIndex = currentSlotTasks.length;
    const newTask = createTaskAssignment(currentDay, currentSlot, orderIndex, newTaskMode);

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
      const updatedLedger = addTaskSummaryToLedger(pendingDayLedger, completedTask);
      savePendingDayLedger(updatedLedger);
    }
  }

  /**
   * Sleep button handler - advances time when no work is done
   */
  async function handleSleep() {
    const slotTasks = currentSlotTasks;

    // If slot has no tasks, advance immediately
    if (slotTasks.length === 0) {
      advanceSlot();
      return;
    }

    // If slot has tasks but none started, warn
    const hasStartedTasks = slotTasks.some(t =>
      t.resolutionState === TASK_STATUS.Resolving || t.resolutionState === TASK_STATUS.Completed
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
    const advancement = advanceToNextSlot(currentDay, currentSlot);

    if (advancement.dayAdvanced) {
      // Day is ending - show summary and commit
      commitDay(advancement.nextDay);
    } else {
      // Just advance to next slot
      saveCurrentSlot(advancement.nextSlot);
    }
  }

  /**
   * Commits the current day and advances to the next
   */
  function commitDay(nextDay: number) {
    if (!pendingDayLedger) return;

    // Commit pending inventory
    const { updatedFoods, updatedMaterials, committedLedger } = commitPendingDayLedger(
      pendingDayLedger,
      foods,
      materials
    );

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
              environments={environments}
              tools={tools}
              species={species}
              categories={categories}
              items={items}
              bait={bait}
              tables={tables}
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
      <DaySummaryPanel pendingDayLedger={pendingDayLedger} />

      {/* Skip Work Confirmation Dialog */}
      <ConfirmDialog {...skipWorkDialog.dialogProps} />
    </div>
  );
}

export const DayPlannerTab = memo(DayPlannerTabBase);
