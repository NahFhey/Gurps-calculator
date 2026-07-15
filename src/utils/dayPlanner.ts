import { SLOTS_PER_DAY, SLOT_NAMES, SLOT_STATUS, TASK_STATUS, LEDGER_STATUS } from '../constants';
import type { TimeSlot, TaskAssignment, PendingDayLedger } from '../types/dayplanner';

export type { TimeSlot, TaskAssignment, PendingDayLedger };

export interface ValidationResult {
  valid: boolean;
  error?: string | null;
}

export interface WorkerAssignmentValidation {
  valid: boolean;
  error?: string | null;
}

export interface SlotAdvancementResult {
  canAdvance: boolean;
  reason: string;
}

export interface NextSlotResult {
  nextDay: number;
  nextSlot: number;
  dayAdvanced: boolean;
}

export interface CommitResult {
  updatedFoods: any[];
  updatedMaterials: any[];
  committedLedger: PendingDayLedger;
}

type RuntimeTimeSlotFields = {
  slotIndex?: number;
};

type RuntimeTaskAssignmentFields = {
  slotIndex?: number;
};

type RuntimeTimeSlot = TimeSlot & RuntimeTimeSlotFields;
type RuntimeTaskAssignment = TaskAssignment & RuntimeTaskAssignmentFields;

/**
 * Creates a new TimeSlot object
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index (0-2)
 * @returns {Object} TimeSlot object
 */
export function createTimeSlot(dayKey: number, slotIndex: number): TimeSlot {
  const timeSlot = {
    id: crypto.randomUUID(),
    dayKey,
    slotIndex,
    name: SLOT_NAMES[slotIndex] || `Slot ${slotIndex}`,
    status: SLOT_STATUS.Planned,
    assignedWorkerIds: [],
    taskIds: [],
    createdAt: new Date().toISOString()
  };

  // runtime shape (slotIndex-based) intentionally diverges from canonical TimeSlot; see dayPlanner.d.ts history
  return timeSlot as unknown as TimeSlot;
}

/**
 * Creates a new TaskAssignment object
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @param {number} orderIndex - The order index for sequential resolution
 * @param {string} mode - The gathering mode (Fishing, Foraging, etc.)
 * @returns {Object} TaskAssignment object
 */
export function createTaskAssignment(
  dayKey: number,
  slotIndex: number,
  orderIndex: number,
  mode: string
): TaskAssignment {
  const taskAssignment = {
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

  // runtime shape (slotIndex-based) intentionally diverges from canonical TaskAssignment; see dayPlanner.d.ts history
  return taskAssignment as unknown as TaskAssignment;
}

/**
 * Creates a new PendingDayLedger object
 * @param {number} dayKey - The day number
 * @returns {Object} PendingDayLedger object
 */
export function createPendingDayLedger(dayKey: number): PendingDayLedger {
  const pendingDayLedger = {
    id: crypto.randomUUID(),
    dayKey,
    pendingInventoryDelta: [],
    taskSummaries: [],
    status: LEDGER_STATUS.Open,
    createdAt: new Date().toISOString()
  };

  // runtime shape intentionally diverges from canonical PendingDayLedger; see dayPlanner.d.ts history
  return pendingDayLedger as unknown as PendingDayLedger;
}

/**
 * Gets all assigned worker IDs for a given slot
 * @param {Object[]} tasks - Array of TaskAssignment objects
 * @param {number} dayKey - The day number
 * @param {number} slotIndex - The slot index
 * @returns {string[]} Array of worker IDs assigned to tasks in this slot
 */
export function getAssignedWorkersForSlot(
  tasks: TaskAssignment[],
  dayKey: number,
  slotIndex: number
): string[];
export function getAssignedWorkersForSlot(
  tasks: RuntimeTaskAssignment[],
  dayKey: number,
  slotIndex: number
): string[] {
  const assignedWorkers = new Set<string>();

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
export function isWorkerAssignedInSlot(
  tasks: TaskAssignment[],
  dayKey: number,
  slotIndex: number,
  workerId: string
): boolean;
export function isWorkerAssignedInSlot(
  tasks: RuntimeTaskAssignment[],
  dayKey: number,
  slotIndex: number,
  workerId: string
): boolean {
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
export function validateWorkerAssignment(
  tasks: TaskAssignment[],
  dayKey: number,
  slotIndex: number,
  workerId: string,
  excludeTaskId?: string | null
): WorkerAssignmentValidation;
export function validateWorkerAssignment(
  tasks: RuntimeTaskAssignment[],
  dayKey: number,
  slotIndex: number,
  workerId: string,
  excludeTaskId: string | null = null
): WorkerAssignmentValidation {
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
export function updateTaskAssignedWorkers(task: TaskAssignment): TaskAssignment {
  const assignedWorkers: string[] = [];

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
export function getTasksForSlot(
  tasks: TaskAssignment[],
  dayKey: number,
  slotIndex: number
): TaskAssignment[];
export function getTasksForSlot(
  tasks: RuntimeTaskAssignment[],
  dayKey: number,
  slotIndex: number
): TaskAssignment[] {
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
export function canAdvanceSlot(
  tasks: TaskAssignment[],
  dayKey: number,
  slotIndex: number
): SlotAdvancementResult;
export function canAdvanceSlot(
  tasks: RuntimeTaskAssignment[],
  dayKey: number,
  slotIndex: number
): SlotAdvancementResult {
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
export function advanceToNextSlot(currentDay: number, currentSlot: number): NextSlotResult {
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
export function addTaskSummaryToLedger(
  ledger: PendingDayLedger,
  task: TaskAssignment
): PendingDayLedger;
export function addTaskSummaryToLedger(
  ledger: PendingDayLedger,
  task: RuntimeTaskAssignment
): PendingDayLedger {
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

  const updatedLedger = {
    ...ledger,
    taskSummaries: [...ledger.taskSummaries, summary],
    pendingInventoryDelta: [
      ...ledger.pendingInventoryDelta,
      ...task.inventoryDelta!
    ]
  };

  // runtime task-summary shape intentionally diverges from canonical PendingDayLedger; see dayPlanner.d.ts history
  return updatedLedger as unknown as PendingDayLedger;
}

/**
 * Commits the pending day ledger to inventory
 * @param {Object} ledger - PendingDayLedger object
 * @param {Object[]} currentFoods - Current food inventory
 * @param {Object[]} currentMaterials - Current material inventory
 * @returns {Object} { updatedFoods, updatedMaterials, committedLedger }
 */
export function commitPendingDayLedger(
  ledger: PendingDayLedger,
  currentFoods: any[],
  currentMaterials: any[]
): CommitResult {
  const updatedFoods = [...currentFoods];
  const updatedMaterials = [...currentMaterials];

  // Process each inventory delta
  ledger.pendingInventoryDelta.forEach(delta => {
    if (delta.type === 'food') {
      // Food items use name and types array in inventory
      const existingIndex = updatedFoods.findIndex(
        f => f.name === delta.speciesName && f.types?.includes(delta.foodType)
      );

      if (existingIndex >= 0) {
        updatedFoods[existingIndex] = {
          ...updatedFoods[existingIndex],
          quantity: updatedFoods[existingIndex].quantity + delta.units
        };
      } else {
        updatedFoods.push({
          id: crypto.randomUUID(),
          name: delta.speciesName,
          quantity: delta.units,
          types: [delta.foodType]
        });
      }
    } else if (delta.type === 'material') {
      const existingIndex = updatedMaterials.findIndex(
        m => m.name === delta.name && m.type === delta.materialType
      );

      if (existingIndex >= 0) {
        updatedMaterials[existingIndex] = {
          ...updatedMaterials[existingIndex],
          quantity: updatedMaterials[existingIndex].quantity + delta.units
        };
      } else {
        updatedMaterials.push({
          id: crypto.randomUUID(),
          name: delta.name,
          type: delta.materialType,
          quantity: delta.units
        });
      }
    }
  });

  // runtime committed-ledger shape intentionally diverges from canonical PendingDayLedger; see dayPlanner.d.ts history
  const committedLedger = {
    ...ledger,
    status: LEDGER_STATUS.Committed,
    committedAt: new Date().toISOString()
  } as unknown as PendingDayLedger;

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
export function getCurrentSlot(
  timeSlots: TimeSlot[],
  dayKey: number,
  slotIndex: number
): TimeSlot | null;
export function getCurrentSlot(
  timeSlots: RuntimeTimeSlot[],
  dayKey: number,
  slotIndex: number
): TimeSlot | null {
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
export function ensureDaySlotsExist(timeSlots: TimeSlot[], dayKey: number): TimeSlot[];
export function ensureDaySlotsExist(
  timeSlots: RuntimeTimeSlot[],
  dayKey: number
): TimeSlot[] {
  const existingSlots = timeSlots.filter(slot => slot.dayKey === dayKey);

  if (existingSlots.length >= SLOTS_PER_DAY) {
    return timeSlots;
  }

  const newSlots: TimeSlot[] = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const exists = existingSlots.some(slot => slot.slotIndex === i);
    if (!exists) {
      newSlots.push(createTimeSlot(dayKey, i));
    }
  }

  return [...timeSlots, ...newSlots];
}
