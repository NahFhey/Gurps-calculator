import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Moon, ChevronRight, Trash2, Edit2, Users, CheckCircle, Circle } from 'lucide-react';
import {
  SLOTS_PER_DAY,
  SLOT_NAMES,
  SLOT_STATUS,
  TASK_STATUS,
  TASK_MODES
} from '../constants';
import {
  createTimeSlot,
  createTaskAssignment,
  createPendingDayLedger,
  getAssignedWorkersForSlot,
  isWorkerAssignedInSlot,
  validateWorkerAssignment,
  updateTaskAssignedWorkers,
  getTasksForSlot,
  canAdvanceSlot,
  advanceToNextSlot,
  addTaskSummaryToLedger,
  commitPendingDayLedger,
  getCurrentSlot,
  ensureDaySlotsExist
} from '../utils/dayPlanner';

/**
 * DayPlannerTab - Main component for the Day Planner gathering system
 * Replaces the old one-off GatheringTab with a time-slot based planning system
 */
export function DayPlannerTab({
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
  foodTypes,
  materialTypes,

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
}) {
  // Local state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskMode, setNewTaskMode] = useState('Fishing');

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
   * Gets the current slot object
   */
  const currentSlotObj = useMemo(() => {
    return getCurrentSlot(timeSlots, currentDay, currentSlot);
  }, [timeSlots, currentDay, currentSlot]);

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
    return getAssignedWorkersForSlot(taskAssignments, currentSlot);
  }, [taskAssignments, currentSlot]);

  /**
   * Gets available (unassigned) workers for the current slot
   */
  const availableWorkers = useMemo(() => {
    return workers.filter(w => !assignedWorkerIds.includes(w.id));
  }, [workers, assignedWorkerIds]);

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
  function deleteTask(taskId) {
    const updatedTasks = taskAssignments.filter(t => t.id !== taskId);
    saveTaskAssignments(updatedTasks);

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  }

  /**
   * Updates a task
   */
  function updateTask(updatedTask) {
    const updatedTasks = taskAssignments.map(t =>
      t.id === updatedTask.id ? updatedTask : t
    );
    saveTaskAssignments(updatedTasks);
  }

  /**
   * Completes a task and adds its results to the pending ledger
   */
  function completeTask(task) {
    // Mark task as completed
    const completedTask = {
      ...task,
      resolutionState: TASK_STATUS.Completed
    };
    updateTask(completedTask);

    // Add to pending ledger
    const updatedLedger = addTaskSummaryToLedger(pendingDayLedger, completedTask);
    savePendingDayLedger(updatedLedger);
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
  function commitDay(nextDay) {
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

  /**
   * Checks if the current slot can advance
   */
  const canAdvance = useMemo(() => {
    return canAdvanceSlot(taskAssignments, currentDay, currentSlot);
  }, [taskAssignments, currentDay, currentSlot]);

  return (
    <div className="p-4 space-y-4">
      {/* Top Bar */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          {/* Day Display */}
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">Day {currentDay}</div>
            <div className="text-lg text-gray-400">
              {SLOT_NAMES[currentSlot]} (Slot {currentSlot + 1}/{SLOTS_PER_DAY})
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSleep}
              className="px-4 py-2 bg-indigo-600 rounded flex items-center gap-2"
            >
              <Moon size={16} /> Sleep
            </button>
            <button
              onClick={advanceSlot}
              disabled={!canAdvance.canAdvance}
              className={`px-4 py-2 rounded flex items-center gap-2 ${
                canAdvance.canAdvance
                  ? 'bg-blue-600'
                  : 'bg-gray-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={16} />
              {currentSlot === SLOTS_PER_DAY - 1 ? 'End Day' : 'Advance Slot'}
            </button>
          </div>
        </div>

        {/* Slot Status */}
        {!canAdvance.canAdvance && (
          <div className="mt-2 text-sm text-yellow-400">
            {canAdvance.reason}
          </div>
        )}
      </div>

      {/* Three-Panel Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel: Workers */}
        <div className="col-span-3 bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={18} /> Workers
          </h3>

          <div className="space-y-2">
            <div className="text-sm text-gray-400 mb-2">
              Available ({availableWorkers.length}/{workers.length})
            </div>
            {availableWorkers.map(worker => (
              <div
                key={worker.id}
                className="p-2 bg-gray-700 rounded text-sm"
              >
                {worker.name}
              </div>
            ))}

            {assignedWorkerIds.length > 0 && (
              <>
                <div className="text-sm text-gray-400 mt-4 mb-2">
                  Assigned ({assignedWorkerIds.length})
                </div>
                {assignedWorkerIds.map(workerId => {
                  const worker = workers.find(w => w.id === workerId);
                  return (
                    <div
                      key={workerId}
                      className="p-2 bg-green-900 rounded text-sm"
                    >
                      {worker?.name || 'Unknown'}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Middle Panel: Task List */}
        <div className="col-span-5 bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">
              Tasks ({currentSlotTasks.length})
            </h3>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="px-3 py-1 bg-green-600 rounded text-sm flex items-center gap-1"
            >
              <Plus size={14} /> Add Task
            </button>
          </div>

          {showAddTask && (
            <div className="mb-4 p-3 bg-gray-700 rounded space-y-2">
              <label className="block text-sm text-gray-400">Mode</label>
              <select
                value={newTaskMode}
                onChange={(e) => setNewTaskMode(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {TASK_MODES.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={addTask}
                  className="flex-1 bg-green-600 px-3 py-2 rounded text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowAddTask(false)}
                  className="bg-gray-600 px-3 py-2 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {currentSlotTasks.length === 0 ? (
              <div className="text-gray-500 italic text-sm">
                No tasks planned for this slot
              </div>
            ) : (
              currentSlotTasks.map((task, index) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`p-3 rounded cursor-pointer border-2 ${
                    selectedTaskId === task.id
                      ? 'bg-blue-900 border-blue-600'
                      : 'bg-gray-700 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {task.resolutionState === TASK_STATUS.Completed ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : (
                        <Circle size={16} className="text-gray-400" />
                      )}
                      <span className="font-medium">{task.mode}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {task.assignedWorkerIds.length > 0
                      ? `${task.assignedWorkerIds.length} worker(s)`
                      : 'No workers assigned'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {task.resolutionState}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

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

      {/* Day Summary (show if ledger has content) */}
      {pendingDayLedger && pendingDayLedger.taskSummaries.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-2">Pending Day Summary</h3>
          <div className="text-sm text-gray-400">
            {pendingDayLedger.taskSummaries.length} task(s) completed
          </div>
          <div className="text-sm text-gray-400">
            {pendingDayLedger.pendingInventoryDelta.length} item(s) pending commit
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TaskDetailPanel - Shows details and resolution UI for a selected task
 */
function TaskDetailPanel({
  task,
  workers,
  environments,
  tools,
  species,
  categories,
  items,
  bait,
  tables,
  taskAssignments,
  currentSlot,
  updateTask,
  completeTask
}) {
  if (!task) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">{task.mode} Task</h3>
        <div className="text-sm text-gray-400">Order: {task.orderIndex + 1}</div>
      </div>

      {/* Basic task configuration will go here */}
      <div className="p-3 bg-gray-700 rounded">
        <div className="text-sm text-gray-400">
          Task configuration and resolution UI will be implemented next.
        </div>
        <div className="text-xs text-gray-500 mt-2">
          This will include worker assignment, environment selection, and mode-specific UI.
        </div>
      </div>

      {task.resolutionState !== TASK_STATUS.Completed && (
        <button
          onClick={() => completeTask(task)}
          className="w-full bg-green-600 px-4 py-2 rounded"
        >
          Complete Task
        </button>
      )}
    </div>
  );
}
