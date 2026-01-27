/**
 * Day Planner System Types
 *
 * TypeScript interfaces for the day planner system.
 */

import type { Id } from './campaign';
import type {
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringItemExtended,
  GatheringCategoryExtended
} from './gathering';
import type { Worker } from './views';

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskStatus = 'Draft' | 'Resolving' | 'Completed';
export type TaskMode = 'Fishing' | 'Foraging';

export interface TaskIntent {
  skill?: string;
  targetItemId?: string | null;
  isUnfamiliar?: boolean;
  hasMapGuide?: boolean;
  isPeakSeason?: boolean;
}

export interface InventoryDelta {
  type: 'food' | 'material';
  speciesName?: string;
  name?: string;
  foodType?: string;
  materialType?: string;
  units: number;
  dice?: number[];
}

export interface TableEntry {
  resultType: 'species' | 'item' | 'nothing' | 'event' | 'special';
  speciesId?: string;
  itemId?: string;
  text?: string;
}

export interface FindResult {
  type: 'item' | 'nothing';
  item?: GatheringItemExtended;
}

export interface TaskPayload {
  tableEntry?: TableEntry;
  findResult?: FindResult;
  [key: string]: unknown;
}

export interface TaskAssignment {
  id: Id;
  dayKey: number;
  slot: number;
  orderIndex: number;
  mode: TaskMode;
  leaderWorkerId: string | null;
  helperWorkerIds: string[];
  assignedWorkerIds: string[];
  environmentId: string | null;
  selectedToolIds: string[];
  method?: string;
  baitId?: string | null;
  targetSpeciesId?: string | null;
  intent?: TaskIntent;
  resolutionState: TaskStatus;
  payload?: TaskPayload;
  inventoryDelta?: InventoryDelta[];
  notes?: string;
  warnings?: string[];
}

// ============================================================================
// TIME SLOT TYPES
// ============================================================================

export interface TimeSlot {
  id: Id;
  dayKey: number;
  slot: number;
  status: string;
}

// ============================================================================
// LEDGER TYPES
// ============================================================================

export interface TaskSummary {
  taskId: Id;
  mode: TaskMode;
  result: string;
}

export interface PendingDayLedger {
  dayKey: number;
  taskSummaries: TaskSummary[];
  pendingInventoryDelta: InventoryDelta[];
  committed: boolean;
}

// ============================================================================
// FOOD AND MATERIAL TYPES
// ============================================================================

export interface Food {
  id: Id;
  name: string;
  type: string;
  units: number;
}

export interface Material {
  id: Id;
  name: string;
  type: string;
  units: number;
}

// ============================================================================
// ADVANCE SLOT RESULT
// ============================================================================

export interface CanAdvanceResult {
  canAdvance: boolean;
  reason?: string;
}

// ============================================================================
// DICE ROLL STATE
// ============================================================================

export interface DiceRollState {
  dice: number[];
  total: number;
}

// ============================================================================
// VIEW PROPS INTERFACES
// ============================================================================

export interface DayHeaderBarProps {
  currentDay: number;
  currentSlot: number;
  canAdvance: CanAdvanceResult;
  onSleep: () => void;
  onAdvanceSlot: () => void;
}

export interface WorkersPanelProps {
  workers: Worker[];
  availableWorkers: Worker[];
  assignedWorkerIds: string[];
}

export interface TaskListPanelProps {
  tasks: TaskAssignment[];
  selectedTaskId: string | null;
  showAddTask: boolean;
  newTaskMode: TaskMode;
  onSelectTask: (taskId: string | null) => void;
  onToggleAddTask: () => void;
  onSetNewTaskMode: (mode: TaskMode) => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
}

export interface DaySummaryPanelProps {
  pendingDayLedger: PendingDayLedger | null;
}

export interface TaskDetailPanelProps {
  task: TaskAssignment | undefined;
  workers: Worker[];
  environments: GatheringEnvironmentExtended[];
  tools: GatheringToolExtended[];
  species: GatheringSpeciesExtended[];
  categories: GatheringCategoryExtended[];
  items: GatheringItemExtended[];
  bait: GatheringBaitExtended[];
  tables: GatheringTableExtended[];
  taskAssignments: TaskAssignment[];
  currentDay: number;
  currentSlot: number;
  updateTask: (task: TaskAssignment) => void;
  completeTask: (task: TaskAssignment) => void;
}

// ============================================================================
// DAY PLANNER TAB PROPS
// ============================================================================

export interface DayPlannerTabProps {
  // Gathering data
  species: GatheringSpeciesExtended[];
  tools: GatheringToolExtended[];
  tables: GatheringTableExtended[];
  environments: GatheringEnvironmentExtended[];
  bait: GatheringBaitExtended[];
  categories: GatheringCategoryExtended[];
  items: GatheringItemExtended[];
  workers: Worker[];
  foods: Food[];
  materials: Material[];
  _foodTypes?: unknown[];
  _materialTypes?: unknown[];

  // Day Planner data
  timeSlots: TimeSlot[];
  taskAssignments: TaskAssignment[];
  pendingDayLedger: PendingDayLedger | null;
  currentDay: number;
  currentSlot: number;

  // Save functions
  saveTimeSlots: (slots: TimeSlot[]) => void;
  saveTaskAssignments: (assignments: TaskAssignment[]) => void;
  savePendingDayLedger: (ledger: PendingDayLedger) => void;
  saveCurrentDay: (day: number) => void;
  saveCurrentSlot: (slot: number) => void;
  saveFoods: (foods: Food[]) => void;
  saveMaterials: (materials: Material[]) => void;
}
