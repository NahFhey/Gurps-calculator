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
import { resolveTask } from '../utils/taskResolution';

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
    return getAssignedWorkersForSlot(taskAssignments, currentDay, currentSlot);
  }, [taskAssignments, currentDay, currentSlot]);

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
  currentDay,
  currentSlot,
  updateTask,
  completeTask
}) {
  const [validationError, setValidationError] = useState('');

  if (!task) return null;

  /**
   * Updates a field on the task
   */
  function updateField(field, value) {
    const updatedTask = { ...task, [field]: value };

    // Recalculate assignedWorkerIds if workers changed
    if (field === 'leaderWorkerId' || field === 'helperWorkerIds') {
      updatedTask.assignedWorkerIds = [
        updatedTask.leaderWorkerId,
        ...(updatedTask.helperWorkerIds || [])
      ].filter(Boolean);
    }

    updateTask(updatedTask);
  }

  /**
   * Validates and sets the leader
   */
  function setLeader(workerId) {
    if (!workerId) {
      updateField('leaderWorkerId', null);
      setValidationError('');
      return;
    }

    const validation = validateWorkerAssignment(
      taskAssignments,
      currentDay,
      currentSlot,
      workerId,
      task.id
    );

    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setValidationError('');
    updateField('leaderWorkerId', workerId);
  }

  /**
   * Validates and toggles a helper
   */
  function toggleHelper(workerId) {
    const currentHelpers = task.helperWorkerIds || [];
    const isCurrentlyHelper = currentHelpers.includes(workerId);

    if (isCurrentlyHelper) {
      // Remove helper
      updateField('helperWorkerIds', currentHelpers.filter(id => id !== workerId));
      setValidationError('');
      return;
    }

    // Add helper - validate first
    const validation = validateWorkerAssignment(
      taskAssignments,
      currentDay,
      currentSlot,
      workerId,
      task.id
    );

    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setValidationError('');
    updateField('helperWorkerIds', [...currentHelpers, workerId]);
  }

  /**
   * Toggles tool selection
   */
  function toggleTool(toolId) {
    const currentTools = task.selectedToolIds || [];
    const isSelected = currentTools.includes(toolId);

    if (isSelected) {
      updateField('selectedToolIds', currentTools.filter(id => id !== toolId));
    } else {
      updateField('selectedToolIds', [...currentTools, toolId]);
    }
  }

  /**
   * Filters tools available for this mode
   */
  const availableTools = tools.filter(tool =>
    tool.allowedModes?.includes(task.mode)
  );

  /**
   * Gets available environments for this mode
   */
  const availableEnvironments = environments.filter(env =>
    env.supportedModes?.includes(task.mode)
  );

  /**
   * Checks if task is ready to be completed
   */
  const canComplete = task.leaderWorkerId && task.environmentId;

  return (
    <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
      <div>
        <h3 className="text-lg font-bold">{task.mode} Task</h3>
        <div className="text-sm text-gray-400">Order: {task.orderIndex + 1}</div>
        <div className="text-xs text-gray-500 mt-1">
          Status: <span className={task.resolutionState === TASK_STATUS.Completed ? 'text-green-400' : 'text-yellow-400'}>
            {task.resolutionState}
          </span>
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="p-2 bg-red-900 border border-red-600 rounded text-sm">
          {validationError}
        </div>
      )}

      {/* Task is completed - show summary */}
      {task.resolutionState === TASK_STATUS.Completed ? (
        <div className="space-y-3">
          <div className="p-3 bg-green-900 border border-green-600 rounded">
            <div className="font-medium text-green-200">Task Completed</div>
            <div className="text-sm text-green-300 mt-1">
              Results added to pending day ledger
            </div>
          </div>

          {task.notes && (
            <div className="p-3 bg-gray-700 rounded">
              <div className="text-xs text-gray-400 mb-1">Notes:</div>
              <div className="text-sm">{task.notes}</div>
            </div>
          )}

          {task.warnings && task.warnings.length > 0 && (
            <div className="p-3 bg-yellow-900 border border-yellow-600 rounded">
              <div className="text-xs text-yellow-300 mb-1">Warnings:</div>
              {task.warnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-yellow-200">• {warning}</div>
              ))}
            </div>
          )}

          {task.inventoryDelta && task.inventoryDelta.length > 0 && (
            <div className="p-3 bg-gray-700 rounded">
              <div className="text-xs text-gray-400 mb-1">Inventory Pending:</div>
              {task.inventoryDelta.map((delta, idx) => (
                <div key={idx} className="text-sm">
                  {delta.speciesName || delta.name}: {delta.units} units
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Task configuration */
        <div className="space-y-4">
          {/* Worker Assignment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Leader *</label>
            <select
              value={task.leaderWorkerId || ''}
              onChange={(e) => setLeader(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              <option value="">-- Select Leader --</option>
              {workers.map(worker => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </div>

          {/* Helpers */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Helpers (optional)</label>
            <div className="space-y-1">
              {workers
                .filter(w => w.id !== task.leaderWorkerId)
                .map(worker => (
                  <label key={worker.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                    <input
                      type="checkbox"
                      checked={(task.helperWorkerIds || []).includes(worker.id)}
                      onChange={() => toggleHelper(worker.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{worker.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Environment *</label>
            <select
              value={task.environmentId || ''}
              onChange={(e) => updateField('environmentId', e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              <option value="">-- Select Environment --</option>
              {availableEnvironments.map(env => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tools */}
          {availableTools.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Tools (optional)</label>
              <div className="space-y-1">
                {availableTools.map(tool => (
                  <label key={tool.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                    <input
                      type="checkbox"
                      checked={(task.selectedToolIds || []).includes(tool.id)}
                      onChange={() => toggleTool(tool.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{tool.name}</span>
                    {tool.bonuses && tool.bonuses.length > 0 && (
                      <span className="text-xs text-green-400 ml-auto">
                        +{tool.bonuses.find(b => b.type === 'skill_bonus')?.value || 0}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Mode-specific configuration placeholder */}
          <div className="p-3 bg-gray-700 rounded border border-gray-600">
            <div className="text-sm text-gray-400">
              Mode-specific configuration ({task.mode})
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Method selection, intent, and resolution UI will be added next
            </div>
          </div>

          {/* Complete button */}
          {task.resolutionState !== TASK_STATUS.Completed && (
            <div className="space-y-2">
              {!canComplete && (
                <div className="text-xs text-yellow-400">
                  Assign a leader and select an environment to complete this task
                </div>
              )}
              <button
                onClick={() => {
                  if (!canComplete) {
                    alert('Please assign a leader and select an environment');
                    return;
                  }

                  // Get leader
                  const leader = workers.find(w => w.id === task.leaderWorkerId);
                  if (!leader) {
                    alert('Leader not found');
                    return;
                  }

                  // Get environment
                  const env = environments.find(e => e.id === task.environmentId);
                  if (!env) {
                    alert('Environment not found');
                    return;
                  }

                  // Get selected tools
                  const selectedTools = tools.filter(t => (task.selectedToolIds || []).includes(t.id));

                  // Resolve the task
                  const resolution = resolveTask({
                    task,
                    leader,
                    environment: env,
                    tools: selectedTools,
                    species,
                    categories,
                    items,
                    tables
                  });

                  // Mark task as completed with resolution data
                  const completedTask = {
                    ...task,
                    resolutionState: TASK_STATUS.Completed,
                    payload: resolution.payload,
                    inventoryDelta: resolution.inventoryDelta,
                    notes: resolution.notes,
                    warnings: resolution.warnings
                  };
                  completeTask(completedTask);
                }}
                disabled={!canComplete}
                className={`w-full px-4 py-2 rounded ${
                  canComplete
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-gray-600 opacity-50 cursor-not-allowed'
                }`}
              >
                Complete Task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
