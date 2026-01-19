import { SLOTS_PER_DAY, SLOT_NAMES, SLOT_STATUS, TASK_STATUS, LEDGER_STATUS } from '../constants';

/**
 * Creates a new TimeSlot object
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index (0-2)
 * @returns {Object} TimeSlot object
 */
export function createTimeSlot(dayKey, slotIndex) {
  return {
    id: crypto.randomUUID(),
    dayKey,
    slotIndex,
    name: SLOT_NAMES[slotIndex] || `Slot ${slotIndex}`,
    status: SLOT_STATUS.Planned,
    assignedWorkerIds: [],
    taskIds: [],
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates a new TaskAssignment object
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @param {number} orderIndex - The order index for sequential resolution
 * @param {string} mode - The gathering mode (Fishing, Foraging, etc.)
 * @returns {Object} TaskAssignment object
 */
export function createTaskAssignment(dayKey, slotIndex, orderIndex, mode) {
  return {
    id: crypto.randomUUID(),
    dayKey,
    slotIndex,
    orderIndex,
    mode,
    environmentId: null,
    method: null,
    leaderWorkerId: null,
    helperWorkerIds: [],
    assignedWorkerIds: [],
    intent: {},
    selectedToolIds: [],
    selectedConsumableIds: [],
    resolutionState: TASK_STATUS.Draft,
    payload: null,
    inventoryDelta: [],
    notes: '',
    warnings: [],
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates a new PendingDayLedger object
 * @param {number} dayKey - The day number
 * @returns {Object} PendingDayLedger object
 */
export function createPendingDayLedger(dayKey) {
  return {
    id: crypto.randomUUID(),
    dayKey,
    pendingInventoryDelta: [],
    taskSummaries: [],
    status: LEDGER_STATUS.Open,
    createdAt: new Date().toISOString()
  };
}

/**
 * Gets all assigned worker IDs for a given slot
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @returns {string[]} Array of worker IDs assigned to tasks in this slot
 */
export function getAssignedWorkersForSlot(tasks, dayKey, slotIndex) {
  const assignedWorkers = new Set();

  tasks
    .filter(task => task.dayKey === dayKey && task.slotIndex === slotIndex)
    .forEach(task => {
      task.assignedWorkerIds.forEach(workerId => assignedWorkers.add(workerId));
    });

  return Array.from(assignedWorkers);
}

/**
 * Checks if a worker is already assigned to a task in the given slot
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @param {string} workerId - The worker ID to check
 * @returns {boolean} True if worker is already assigned
 */
export function isWorkerAssignedInSlot(tasks, dayKey, slotIndex, workerId) {
  return tasks
    .filter(task => task.dayKey === dayKey && task.slotIndex === slotIndex)
    .some(task => task.assignedWorkerIds.includes(workerId));
}

/**
 * Validates that a worker can be assigned to a task
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @param {string} workerId - The worker ID to validate
 * @param {string} [excludeTaskId] - Task ID to exclude from validation (for editing)
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateWorkerAssignment(tasks, dayKey, slotIndex, workerId, excludeTaskId = null) {
  const relevantTasks = tasks
    .filter(task => task.dayKey === dayKey && task.slotIndex === slotIndex && task.id !== excludeTaskId);

  const isAssigned = relevantTasks.some(task =>
    task.assignedWorkerIds.includes(workerId)
  );

  if (isAssigned) {
    return {
      valid: false,
      error: 'Worker is already assigned to another task this slot.'
    };
  }

  return { valid: true, error: null };
}

/**
 * Updates the assignedWorkerIds array for a task based on leader and helpers
 * @param {Object} task - TaskAssignment object
 * @returns {Object} Updated task with assignedWorkerIds
 */
export function updateTaskAssignedWorkers(task) {
  const assignedWorkers = [];

  if (task.leaderWorkerId) {
    assignedWorkers.push(task.leaderWorkerId);
  }

  if (task.helperWorkerIds && task.helperWorkerIds.length > 0) {
    assignedWorkers.push(...task.helperWorkerIds);
  }

  return {
    ...task,
    assignedWorkerIds: assignedWorkers
  };
}

/**
 * Gets all tasks for a specific slot
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @returns {Object[]} Array of tasks sorted by orderIndex
 */
export function getTasksForSlot(tasks, dayKey, slotIndex) {
  return tasks
    .filter(task => task.dayKey === dayKey && task.slotIndex === slotIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Checks if a slot can advance (all tasks completed or no tasks)
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @returns {Object} { canAdvance: boolean, reason: string }
 */
export function canAdvanceSlot(tasks, dayKey, slotIndex) {
  const slotTasks = getTasksForSlot(tasks, dayKey, slotIndex);

  if (slotTasks.length === 0) {
    return { canAdvance: true, reason: 'No tasks in slot' };
  }

  const allCompleted = slotTasks.every(task => task.resolutionState === TASK_STATUS.Completed);

  if (allCompleted) {
    return { canAdvance: true, reason: 'All tasks completed' };
  }

  const incompleteTasks = slotTasks.filter(task => task.resolutionState !== TASK_STATUS.Completed);

  return {
    canAdvance: false,
    reason: `${incompleteTasks.length} task(s) not completed`
  };
}

/**
 * Advances to the next slot, handling day rollover
 * @param {number} currentDay - Current day number
 * @param {number} currentSlot - Current slot index
 * @returns {Object} { nextDay: number, nextSlot: number, dayAdvanced: boolean }
 */
export function advanceToNextSlot(currentDay, currentSlot) {
  const nextSlot = currentSlot + 1;

  if (nextSlot >= SLOTS_PER_DAY) {
    // Day rollover
    return {
      nextDay: currentDay + 1,
      nextSlot: 0,
      dayAdvanced: true
    };
  }

  return {
    nextDay: currentDay,
    nextSlot,
    dayAdvanced: false
  };
}

/**
 * Adds a task summary to the pending day ledger
 * @param {Object} ledger - PendingDayLedger object
 * @param {Object} task - Completed TaskAssignment object
 * @returns {Object} Updated ledger
 */
export function addTaskSummaryToLedger(ledger, task) {
  const summary = {
    taskId: task.id,
    slotIndex: task.slotIndex,
    mode: task.mode,
    environment: task.environmentId,
    workers: task.assignedWorkerIds,
    inventoryDelta: task.inventoryDelta,
    notes: task.notes,
    warnings: task.warnings,
    completedAt: new Date().toISOString()
  };

  return {
    ...ledger,
    taskSummaries: [...ledger.taskSummaries, summary],
    pendingInventoryDelta: [
      ...ledger.pendingInventoryDelta,
      ...task.inventoryDelta
    ]
  };
}

/**
 * Commits the pending day ledger to inventory
 * @param {Object} ledger - PendingDayLedger object
 * @param {Object[]} currentFoods - Current food inventory
 * @param {Object[]} currentMaterials - Current material inventory
 * @returns {Object} { updatedFoods, updatedMaterials, committedLedger }
 */
export function commitPendingDayLedger(ledger, currentFoods, currentMaterials) {
  const updatedFoods = [...currentFoods];
  const updatedMaterials = [...currentMaterials];

  // Process each inventory delta
  ledger.pendingInventoryDelta.forEach(delta => {
    if (delta.type === 'food') {
      const existingIndex = updatedFoods.findIndex(
        f => f.speciesName === delta.speciesName && f.foodType === delta.foodType
      );

      if (existingIndex >= 0) {
        updatedFoods[existingIndex] = {
          ...updatedFoods[existingIndex],
          units: updatedFoods[existingIndex].units + delta.units
        };
      } else {
        updatedFoods.push({
          speciesName: delta.speciesName,
          foodType: delta.foodType,
          units: delta.units
        });
      }
    } else if (delta.type === 'material') {
      const existingIndex = updatedMaterials.findIndex(
        m => m.name === delta.name && m.type === delta.materialType
      );

      if (existingIndex >= 0) {
        updatedMaterials[existingIndex] = {
          ...updatedMaterials[existingIndex],
          units: updatedMaterials[existingIndex].units + delta.units
        };
      } else {
        updatedMaterials.push({
          name: delta.name,
          type: delta.materialType,
          units: delta.units
        });
      }
    }
  });

  const committedLedger = {
    ...ledger,
    status: LEDGER_STATUS.Committed,
    committedAt: new Date().toISOString()
  };

  return {
    updatedFoods,
    updatedMaterials,
    committedLedger
  };
}

/**
 * Gets the current slot for a given day and slot index
 * @param {Object[]} timeSlots - Array of TimeSlot objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @returns {Object|null} TimeSlot object or null if not found
 */
export function getCurrentSlot(timeSlots, dayKey, slotIndex) {
  return timeSlots.find(
    slot => slot.dayKey === dayKey && slot.slotIndex === slotIndex
  ) || null;
}

/**
 * Initializes time slots for a new day if they don't exist
 * @param {Object[]} timeSlots - Array of existing TimeSlot objects
 * @param {number} dayKey - The day number to initialize
 * @returns {Object[]} Updated array of TimeSlot objects
 */
export function ensureDaySlotsExist(timeSlots, dayKey) {
  const existingSlots = timeSlots.filter(slot => slot.dayKey === dayKey);

  if (existingSlots.length >= SLOTS_PER_DAY) {
    return timeSlots;
  }

  const newSlots = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const exists = existingSlots.some(slot => slot.slotIndex === i);
    if (!exists) {
      newSlots.push(createTimeSlot(dayKey, i));
    }
  }

  return [...timeSlots, ...newSlots];
}
