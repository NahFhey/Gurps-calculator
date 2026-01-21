import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Moon, ChevronRight, Trash2, Edit2, Users, CheckCircle, Circle } from 'lucide-react';
import { DiceRoller } from './DiceRoller';
import {
  SLOTS_PER_DAY,
  SLOT_NAMES,
  SLOT_STATUS,
  TASK_STATUS,
  TASK_MODES,
  FISHING_METHODS,
  FORAGING_RARITIES
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
import { determineDynamicEventType, parseDiceFormula } from '../utils/gathering';

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
          <div className="text-sm text-gray-400 mb-3">
            {pendingDayLedger.taskSummaries.length} task(s) completed
          </div>

          {pendingDayLedger.pendingInventoryDelta.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-300">Pending Inventory:</div>

              {/* Food items */}
              {(() => {
                const foodItems = Object.values(
                  pendingDayLedger.pendingInventoryDelta
                    .filter(delta => delta.type === 'food')
                    .reduce((acc, delta) => {
                      const key = `${delta.speciesName}-${delta.foodType}`;
                      if (!acc[key]) {
                        acc[key] = { ...delta, units: 0 };
                      }
                      acc[key].units += delta.units;
                      return acc;
                    }, {})
                );

                return foodItems.length > 0 && (
                  <div className="bg-gray-700 p-2 rounded text-sm">
                    <div className="text-gray-400 text-xs mb-1">Food:</div>
                    {foodItems.map((item, idx) => (
                      <div key={idx} className="text-gray-200">
                        • {item.speciesName}: {item.units} units ({item.foodType})
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Material items */}
              {(() => {
                const materialItems = Object.values(
                  pendingDayLedger.pendingInventoryDelta
                    .filter(delta => delta.type === 'material')
                    .reduce((acc, delta) => {
                      const key = `${delta.name}-${delta.materialType}`;
                      if (!acc[key]) {
                        acc[key] = { ...delta, units: 0 };
                      }
                      acc[key].units += delta.units;
                      return acc;
                    }, {})
                );

                return materialItems.length > 0 && (
                  <div className="bg-gray-700 p-2 rounded text-sm">
                    <div className="text-gray-400 text-xs mb-1">Materials:</div>
                    {materialItems.map((item, idx) => (
                      <div key={idx} className="text-gray-200">
                        • {item.name}: {item.units} units ({item.materialType})
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No items collected yet</div>
          )}
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

  // Manual resolution roll state
  const [isResolving, setIsResolving] = useState(false);
  const [skillRoll, setSkillRoll] = useState({ dice: [], total: 0 });
  const [eventCheckRoll, setEventCheckRoll] = useState({ dice: [], total: 0 });
  const [eventTableRoll, setEventTableRoll] = useState({ dice: [], total: 0 });
  const [tableRoll, setTableRoll] = useState({ dice: [], total: 0 });

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

          {/* Show found item for foraging tasks */}
          {task.mode === 'Foraging' && task.payload?.findResult?.type === 'item' && (() => {
            const foundItem = task.payload.findResult.item;
            if (!foundItem) return null;

            // Parse yield formula to get dice info
            const formula = foundItem.yieldFormula || '1d';
            const parsed = parseDiceFormula(formula);
            const diceCount = parsed.count || 1;
            const diceSides = parsed.sides || 6;
            const modValue = parsed.modifier || 0;

            // Get current yield from inventory delta
            const currentDelta = task.inventoryDelta?.find(d =>
              (d.speciesName || d.name) === foundItem.name
            );
            const currentYield = currentDelta?.units || 0;

            return (
              <div className="p-3 bg-purple-900 border border-purple-600 rounded">
                <div className="font-medium text-purple-200 mb-2">Found Item</div>
                <div className="text-sm text-purple-100 mb-1">{foundItem.name}</div>
                <div className="text-xs text-purple-300 mb-3">
                  Yield Formula: {formula}
                </div>

                <DiceRoller
                  label="Roll for Yield"
                  diceCount={diceCount}
                  diceSides={diceSides}
                  modifier={modValue}
                  dice={[]}
                  total={currentYield}
                  onRoll={(dice, total) => {
                    // Update inventory delta with new yield
                    const updatedDelta = (task.inventoryDelta || []).map(d => {
                      if ((d.speciesName || d.name) === foundItem.name) {
                        return { ...d, units: total };
                      }
                      return d;
                    });
                    updateTask({
                      ...task,
                      inventoryDelta: updatedDelta
                    });
                  }}
                  onTotalChange={(total) => {
                    // Update inventory delta with manual yield
                    const updatedDelta = (task.inventoryDelta || []).map(d => {
                      if ((d.speciesName || d.name) === foundItem.name) {
                        return { ...d, units: total };
                      }
                      return d;
                    });
                    updateTask({
                      ...task,
                      inventoryDelta: updatedDelta
                    });
                  }}
                />
              </div>
            );
          })()}

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

          {/* Mode-specific configuration */}
          {task.mode === 'Fishing' && (
            <div className="p-3 bg-gray-700 rounded border border-gray-600 space-y-3">
              <div className="text-sm font-medium text-gray-300">Fishing Configuration</div>

              {/* Method Selection */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Method</label>
                <select
                  value={task.method || 'Line'}
                  onChange={(e) => updateField('method', e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  {Object.keys(FISHING_METHODS).map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              {/* Bait Selection (only for Line fishing) */}
              {task.method === 'Line' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bait (optional)</label>
                  <select
                    value={task.baitId || ''}
                    onChange={(e) => updateField('baitId', e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">No bait</option>
                    {bait.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.quantity} remaining)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Species */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Species (optional)</label>
                <select
                  value={task.targetSpeciesId || ''}
                  onChange={(e) => updateField('targetSpeciesId', e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Any species</option>
                  {species.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {task.mode === 'Foraging' && (
            <div className="p-3 bg-gray-700 rounded border border-gray-600 space-y-3">
              <div className="text-sm font-medium text-gray-300">Foraging Configuration</div>

              {/* Skill Selection */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Skill</label>
                <select
                  value={task.intent?.skill || 'Survival'}
                  onChange={(e) => updateField('intent', { ...task.intent, skill: e.target.value })}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="Survival">Survival</option>
                  <option value="Naturalist">Naturalist</option>
                  <option value="Herb Lore">Herb Lore</option>
                </select>
              </div>

              {/* Target Selection */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target (optional)</label>
                <select
                  value={task.intent?.targetItemId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      updateField('intent', { ...task.intent, targetItemId: null });
                    } else {
                      updateField('intent', { ...task.intent, targetItemId: value });
                    }
                  }}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Random foraging</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              {/* Context Modifiers */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Context Modifiers</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={task.intent?.isUnfamiliar || false}
                    onChange={(e) => updateField('intent', { ...task.intent, isUnfamiliar: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Unfamiliar terrain (-4)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={task.intent?.hasMapGuide || false}
                    onChange={(e) => updateField('intent', { ...task.intent, hasMapGuide: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Has map/guide (+2)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={task.intent?.isPeakSeason || false}
                    onChange={(e) => updateField('intent', { ...task.intent, isPeakSeason: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Peak season (+1)
                </label>
              </div>

              {/* Target Rarity Display (only if targeting) */}
              {task.intent?.targetItemId && items && FORAGING_RARITIES && (() => {
                const targetItem = items.find(i => i.id === task.intent.targetItemId);
                if (!targetItem) return null;
                const rarity = targetItem.rarity || 'Common';
                const rarityData = FORAGING_RARITIES[rarity] || FORAGING_RARITIES.Common || { label: rarity, penalty: 0 };
                return (
                  <div className="p-2 bg-gray-600 rounded">
                    <div className="text-xs text-gray-400 mb-1">Target Rarity</div>
                    <div className="text-sm text-gray-200">{rarityData.label} ({rarityData.penalty})</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Resolution UI */}
          {task.resolutionState !== TASK_STATUS.Completed && !isResolving && (
            <div className="space-y-2">
              {!canComplete && (
                <div className="text-xs text-yellow-400">
                  Assign a leader and select an environment to complete this task
                </div>
              )}
              <button
                onClick={() => setIsResolving(true)}
                disabled={!canComplete}
                className={`w-full px-4 py-2 rounded ${
                  canComplete
                    ? 'bg-purple-600 hover:bg-purple-500'
                    : 'bg-gray-600 opacity-50 cursor-not-allowed'
                }`}
              >
                Begin Resolution
              </button>
            </div>
          )}

          {/* Manual Roll UI */}
          {isResolving && task.resolutionState !== TASK_STATUS.Completed && (() => {
            // Get leader and environment for skill calculation
            const leader = workers.find(w => w.id === task.leaderWorkerId);
            const env = environments.find(e => e.id === task.environmentId);
            const selectedTools = tools.filter(t => (task.selectedToolIds || []).includes(t.id));

            if (!leader || !env) {
              return (
                <div className="text-red-400">Error: Missing leader or environment</div>
              );
            }

            // Calculate effective skill based on mode
            let effectiveSkill = 10;
            let skillLabel = 'Skill';
            if (task.mode === 'Fishing') {
              const baseFishingSkill = leader.skills?.fishing || 10;
              const toolBonus = selectedTools.reduce((sum, tool) => {
                const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
                return sum + (skillBonus?.value || 0);
              }, 0);
              effectiveSkill = baseFishingSkill + toolBonus + (env.skillMod || 0);
              skillLabel = 'Fishing Skill';
            } else if (task.mode === 'Foraging') {
              const baseForagingSkill = leader.skills?.survival || 10;
              const toolBonus = selectedTools.reduce((sum, tool) => {
                const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
                return sum + (skillBonus?.value || 0);
              }, 0);
              effectiveSkill = baseForagingSkill + toolBonus + (env.skillMod || 0);
              skillLabel = 'Foraging Skill';
            }

            // Check if event was triggered based on separate event check roll
            const eventType = eventCheckRoll.total > 0 ? determineDynamicEventType(eventCheckRoll.total) : 'none';
            const showEventTableRoll = eventType !== 'none';

            // Get table info
            const modeDefaults = env.defaultsByMode?.[task.mode] || {};
            const findTable = tables.find(t => t.id === modeDefaults.randomCatchTableId);
            const tableName = findTable?.name || 'Table';
            const tableRollMethod = findTable?.rollMethod || '2d6';
            const tableDiceCount = tableRollMethod === '1d6' ? 1 : tableRollMethod === '3d6' ? 3 : 2;

            // Check if event table exists
            const eventTableId = eventType === 'rare' ? modeDefaults.rareEventTableId : modeDefaults.mildEventTableId;
            const eventTable = tables.find(t => t.id === eventTableId);
            const eventTableName = eventTable?.name || `${eventType === 'rare' ? 'Rare' : 'Mild'} Event`;

            // Can finalize when all required rolls are done
            const canFinalize = skillRoll.total > 0 && eventCheckRoll.total > 0 && tableRoll.total > 0 && (!showEventTableRoll || eventTableRoll.total > 0);

            return (
              <div className="space-y-3 bg-gray-800 p-4 rounded border-2 border-purple-500">
                <div className="text-lg font-bold text-purple-300">Manual Resolution</div>

                {/* 1. Skill Roll */}
                <DiceRoller
                  label={skillLabel}
                  diceCount={3}
                  diceSides={6}
                  dice={skillRoll.dice}
                  total={skillRoll.total}
                  targetNumber={effectiveSkill}
                  onRoll={(dice, total) => setSkillRoll({ dice, total })}
                  onTotalChange={(total) => setSkillRoll({ ...skillRoll, total })}
                />

                {/* 2. Event Check Roll */}
                <DiceRoller
                  label="Event Check"
                  diceCount={3}
                  diceSides={6}
                  dice={eventCheckRoll.dice}
                  total={eventCheckRoll.total}
                  onRoll={(dice, total) => setEventCheckRoll({ dice, total })}
                  onTotalChange={(total) => setEventCheckRoll({ ...eventCheckRoll, total })}
                />

                {/* 3. Event Table Roll (if event triggered) */}
                {showEventTableRoll && (
                  <div className="border-l-4 border-yellow-500 pl-3">
                    <div className="text-xs text-yellow-300 mb-1">
                      {eventType === 'rare' ? 'Rare' : 'Mild'} Event Triggered!
                    </div>
                    <DiceRoller
                      label={eventTableName}
                      diceCount={2}
                      diceSides={6}
                      dice={eventTableRoll.dice}
                      total={eventTableRoll.total}
                      onRoll={(dice, total) => setEventTableRoll({ dice, total })}
                      onTotalChange={(total) => setEventTableRoll({ ...eventTableRoll, total })}
                    />
                  </div>
                )}

                {/* 4. Catch/Find Table Roll */}
                {skillRoll.total > 0 && (
                  <DiceRoller
                    label={tableName}
                    diceCount={tableDiceCount}
                    diceSides={6}
                    dice={tableRoll.dice}
                    total={tableRoll.total}
                    onRoll={(dice, total) => setTableRoll({ dice, total })}
                    onTotalChange={(total) => setTableRoll({ ...tableRoll, total })}
                  />
                )}

                {/* Finalize Button */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setIsResolving(false);
                      setSkillRoll({ dice: [], total: 0 });
                      setEventCheckRoll({ dice: [], total: 0 });
                      setEventTableRoll({ dice: [], total: 0 });
                      setTableRoll({ dice: [], total: 0 });
                    }}
                    className="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Resolve task with manual roll values
                      const resolution = resolveTask({
                        task,
                        leader,
                        environment: env,
                        tools: selectedTools,
                        species,
                        categories,
                        items,
                        tables,
                        manualRolls: {
                          skillRoll: skillRoll.total,
                          eventCheckRoll: eventCheckRoll.total,
                          eventTableRoll: showEventTableRoll ? eventTableRoll.total : null,
                          tableRoll: tableRoll.total
                        }
                      });

                      // Mark task as completed
                      const completedTask = {
                        ...task,
                        resolutionState: TASK_STATUS.Completed,
                        payload: resolution.payload,
                        inventoryDelta: resolution.inventoryDelta,
                        notes: resolution.notes,
                        warnings: resolution.warnings
                      };
                      completeTask(completedTask);

                      // Reset state
                      setIsResolving(false);
                      setSkillRoll({ dice: [], total: 0 });
                      setEventCheckRoll({ dice: [], total: 0 });
                      setEventTableRoll({ dice: [], total: 0 });
                      setTableRoll({ dice: [], total: 0 });
                    }}
                    disabled={!canFinalize}
                    className={`flex-1 px-4 py-2 rounded ${
                      canFinalize
                        ? 'bg-green-600 hover:bg-green-500'
                        : 'bg-gray-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Finalize Task
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
