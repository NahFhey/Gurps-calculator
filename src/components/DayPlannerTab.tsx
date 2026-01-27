import { useState, useEffect, useMemo, memo } from 'react';
import { TASK_STATUS } from '../constants';
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
import type {
  DayPlannerTabProps,
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
 * Decomposed from 1,365 lines to ~220 lines (84% reduction)
 */
function DayPlannerTabBase({
  // Gathering data
  species,
  tools,
  tables,
  environments,
  bait,
  categories,
  items,
  workers,
  foods,
  materials,

  // Day Planner data
  timeSlots,
  taskAssignments,
  pendingDayLedger,
  currentDay,
  currentSlot,

  // Save functions
  saveTimeSlots,
  saveTaskAssignments,
  savePendingDayLedger,
  saveCurrentDay,
  saveCurrentSlot,
  saveFoods,
  saveMaterials
}: DayPlannerTabProps) {
  // Local state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskMode, setNewTaskMode] = useState<TaskMode>('Fishing');

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
  function handleSleep() {
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
      const confirmed = window.confirm(
        'This slot has planned work. Sleeping will skip it. Continue?'
      );
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

    alert(`Day ${currentDay} complete! Inventory committed. Starting Day ${nextDay}.`);
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
    </div>
  );
}

export const DayPlannerTab = memo(DayPlannerTabBase);
