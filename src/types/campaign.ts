/**
 * Comprehensive type definitions for GURPS Campaign State
 * This file defines all types needed for the unified CampaignStore
 */

import type {
  Equipment,
  GCSCharacterData,
  CharacterImages,
  SkillAttribute,
  SkillDifficulty,
} from './characterSheet';
import type { CombatCategory } from '../constants';
import type {
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringCategoryExtended,
  GatheringItemExtended,
} from './gathering';

export type Id = string;

export type FacilityAttachment =
  | { kind: 'party' }
  | { kind: 'location'; locationId: Id }
  | { kind: 'vehicle'; vehicleId: Id };

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Skill summary stored by legacy pre-GCS character saves.
 * Modern characters use `work.skills` and `gcsData.skills`.
 */
export interface LegacyCharacterSkill {
  name?: string;
  level?: number;
  points?: number;
}

export type LegacyCharacterSkillEntry = string | LegacyCharacterSkill;

/** Optional legacy skill containers still dual-read by downtime foraging. */
export interface LegacyCharacterSkillSource {
  skills?: LegacyCharacterSkillEntry[];
  characterSheet?: {
    skills?: LegacyCharacterSkillEntry[];
  };
}

export interface Character {
  id: Id;
  name: string;
  isPlayer?: boolean;
  /** Can't eat a meal when it contains any of these food types; absent/empty is unrestricted. */
  dietExcludedFoodTypes?: string[];
  /** Can't eat unless a meal contains at least one of these food types; absent/empty is unrestricted. */
  dietRequiredFoodTypes?: string[];
  work: {
    enabled?: boolean;
    skills: Record<string, number>;
  };
  st?: number;  // Strength attribute (legacy, use gcsData.attributes.ST)

  // Hit location profile for combat (defaults to 'humanoid')
  hitLocationProfileId?: string;

  // Character portrait and combat token images
  images?: CharacterImages;

  // Full GCS character sheet data (optional for backward compatibility)
  gcsData?: GCSCharacterData;
}

export interface CharacterTemplateEntity {
  id: Id;
  name: string;
  description: string;
  builtin: boolean;
  gcsData: GCSCharacterData;
  createdAt: number;
  updatedAt: number;
}

// Re-export GCS types for convenience
export type { GCSCharacterData } from './characterSheet';

// ============================================================================
// INVENTORY SYSTEM
// ============================================================================

export interface Material {
  id: Id;
  name: string;
  type: string;  // References MaterialType.name
  quantity: number;
  source?: string;
  notes?: string;
}

export interface Food {
  id: Id;
  name: string;
  type?: string;  // Legacy single type - References FoodType.name
  types?: string[];  // Multi-type support - Array of FoodType.name
  quantity: number;
  calories?: number;
  quality?: string;
  effects?: string;
  source?: string;
  notes?: string;
}

export interface FoodType {
  name: string;
  color: string;  // Hex color for UI
}

export interface MaterialType {
  name: string;
  difficulty: number;
  effects: string;
  ht: number;  // Health threshold
  drShift: number;  // Damage resistance shift
  weightMod: number;  // Weight modifier percentage
  hpMod: number;  // HP modifier percentage
}

export interface RecipeIngredient {
  type: 'food' | 'material';
  id: Id;
  amount: number;
}

export interface CookingRecipeIngredient {
  foodId: Id;
  foodName: string;
  foodTypes: string[];
  amount: number;
}

export interface RecipeCreationLog {
  id: Id;
  date: string;
  worker: string;
  kitchen: string;
  cookingSkill: number;
  kitchenBonus: number;
  effectiveSkill: number;
  roll: number;
  mos: number;
  result: string;
  substitutes: Array<{ original: string; replacement: string; amount: number }>;
}

/**
 * Persisted recipe entity. The collection contains both inventory-style
 * recipes and CookingTab recipes, so format-specific fields are optional while
 * their ingredient arrays remain fully structured.
 */
export interface Recipe {
  id: Id;
  name: string;
  ingredients: RecipeIngredient[] | CookingRecipeIngredient[];
  difficulty: number;
  skill?: string;
  prepTime?: number;  // In minutes
  servings?: number;
  effects?: string;
  notes?: string;
  skills?: string[];
  criticalSuccess?: boolean;
  creationHistory?: RecipeCreationLog[];
}

/** Recipe shape created and consumed by CookingTab. */
export interface CookingRecipe extends Recipe {
  ingredients: CookingRecipeIngredient[];
  skills: string[];
  criticalSuccess: boolean;
  creationHistory: RecipeCreationLog[];
}

export interface MealBuff {
  day: number;
  recipeId: string;
  recipeName: string;
  skills: string[];
  /** Party characters who could not eat this meal, snapshotted when it was cooked. */
  excludedCharacterIds?: Id[];
}

// ============================================================================
// CRAFTING SYSTEM
// ============================================================================

export type CraftPhase = 'setup' | 'design' | 'craft' | 'complete';
export type CraftQuality = 'cheap' | 'good' | 'fine' | 'very fine' | 'legendary';

export interface CraftShift {
  id?: string;
  date: string;
  day: number;
  worker: string;
  skill?: number;        // Raw skill level
  skillRoll?: number;    // Alias for roll (legacy)
  roll?: number;         // Dice roll result
  effectiveSkill: number;
  result?: string;       // Human-readable result description
  hoursAdded: number;
  qualityShift?: number;
  qualityChange?: number; // Alias for qualityShift
  phase?: string;        // Which phase this shift was in
  workshop?: string;     // Facility name whose bonus was applied to this shift
}

export interface CraftConsumedMaterial {
  id?: Id;
  materialId?: string;
  amount: number;
  name?: string;
  type?: string;
}

export interface Craft {
  id: Id;
  phase: CraftPhase;
  templateType: 'weapons' | 'armor' | 'ranged' | 'explosives';
  template: string;  // Template name
  quality: CraftQuality | string;
  currentQuality: CraftQuality | string;
  name?: string;     // Custom display name
  mods: Array<{
    name?: string;
    difficulty?: number;
    [key: string]: unknown;
  }>;
  selectedMaterials: Array<{
    requirementIndex: number;
    requiredType: string;
    requiredAmount: number;
    selectedMaterialId: Id | null;
  }>;
  consumedMaterials?: CraftConsumedMaterial[];
  shifts: CraftShift[];
  designShifts?: CraftShift[];
  startDate: string;
  startDay: number;
  completed?: boolean;
  completedDate?: string;
  completedDay?: number;
  completionDate?: string;  // Legacy alias
  finalStats?: {
    weight: number;
    hp: number;
    ht: number;
    damage?: string;
    dr?: number;
  };
}

export interface CraftDesign {
  id: Id;
  name: string;
  templateType: string;
  template: string;
  quality: CraftQuality | string;
  mods: Craft['mods'];
  selectedMaterials: Craft['selectedMaterials'];
  consumedMaterials?: Craft['consumedMaterials'];
  designShifts?: Craft['shifts'];
  savedDate: string;
}

export interface CustomTemplates {
  weapons: Record<string, WeaponTemplate>;
  armor: Record<string, ArmorTemplate>;
  ranged: Record<string, RangedTemplate>;
  explosives: Record<string, ExplosiveTemplate>;
  [key: string]: Record<string, CraftingTemplateDetails>;
}

/** Common readable fields shared by every crafting template category. */
export interface CraftingTemplateDetails {
  [key: string]: unknown;
  name?: string;
  weight: number;
  hp?: number;
  materials?: Array<{
    type: string;
    amount: number;
  }>;
  damage?: string | number | null;
  reach?: string | number | null;
  parry?: string | number | null;
  cost?: string | number | null;
  ST?: string | number | null;
  notes?: string | number | null;
  Acc?: string | number | null;
  range?: string | number | null;
  RoF?: string | number | null;
  shots?: string | number | null;
  bulk?: string | number | null;
  RCl?: string | number | null;
  LC?: string | number | null;
  location?: string | number | null;
  DR?: string | number | null;
  dr?: string | number | null;
  fuse?: string | number | null;
}

export interface WeaponTemplate {
  name: string;
  weight: number;
  hp: number;
  damage: string;
  reach: string;
  parry?: string;
  cost?: number;
  ST?: number;
  notes?: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
  [key: string]: unknown;
}

export interface ArmorTemplate {
  name: string;
  weight: number;
  hp: number;
  dr?: number;
  DR?: number;
  location?: string;
  cost?: number;
  LC?: number;
  notes?: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
  [key: string]: unknown;
}

export interface RangedTemplate {
  name: string;
  weight: number;
  hp: number;
  damage: string;
  accuracy?: number;
  Acc?: number;
  range: string;
  rateOfFire?: number;
  RoF?: string;
  shots?: number | string;
  cost?: number;
  ST?: number;
  bulk?: number;
  RCl?: number;
  LC?: number;
  notes?: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
  [key: string]: unknown;
}

export interface ExplosiveTemplate {
  name: string;
  weight: number;
  hp?: number;
  damage: string;
  fragmentationDamage?: string;
  blastRadius?: number;
  fuse?: string;
  cost?: number;
  LC?: number;
  notes?: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
  [key: string]: unknown;
}

// ============================================================================
// ALCHEMY SYSTEM
// ============================================================================

export interface AlchemyReagent {
  id: Id;
  name: string;
  quantity: number;
  effectFamily?: string;
  potency?: number;
  source?: string;
  notes?: string;

  // Extended properties for alchemy engine
  aspects?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  refinement?: 'crude' | 'prepared' | 'refined';
  basePotency?: string;
  concentrationSteps?: number;
  roles?: string[];
  primaryRole?: string;
  hazards?: string[];
  processingNotes?: string;
  identificationLevel?: number;
  analysisHistory?: unknown[];
  falseProfile?: {
    aspects?: {
      primary?: string;
      secondary?: string;
      tertiary?: string;
    };
    basePotency?: string;
    concentrationSteps?: number;
    refinement?: string;
    roles?: string[];
    primaryRole?: string;
    hazards?: string[];
    processingNotes?: string;
  } | null;
  baseReagentName?: string;
  identityId?: string;
  processingLog?: Array<{
    timestamp: string;
    operation: string;
    inputUnits: number;
    outputUnits: number;
    worker: string;
    lab: string;
    aborted?: boolean;
    results?: Array<{
      attempt: number;
      roll: number;
      success: boolean;
      message?: string;
    }>;
  }>;
}

export interface FormulaIngredient {
  reagentId: Id;
  reagentName: string;
  role: string;
  unitsUsed: number;
  refinement: 'crude' | 'prepared' | 'refined';
  aspects?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
}

export interface AlchemyFormula {
  id: Id;
  name: string;
  // Legacy simple reagent list
  reagents?: Array<{
    reagentId: Id;
    amount: number;
  }>;
  // Rich ingredient list from alchemy engine
  ingredients?: FormulaIngredient[];
  skill?: string;
  difficulty?: number;
  brewTime?: number;  // In minutes
  effects?: string;
  potency?: number | string;
  notes?: string;

  // Formula stats (from calculateFormulaStats)
  tier?: number;
  calculatedTier?: number;
  potencyLoad?: number;
  vector?: string;
  baseWR?: number;
  baseDM?: number;
  dominantAspect?: string;
  secondaryAspect?: string;
  basePotency?: string;
  finalPotency?: string;
  concentrationSteps?: number;
  totalConcentrationSteps?: number;
  traitBudget?: number;
  hasMatchingStabilizer?: boolean;
  traits?: Array<{ name: string; cost: number }>;
  roleCoverage?: unknown;
  hazards?: string[];
}

export interface AlchemyBatch {
  id: Id;
  formulaId: Id;
  formulaName?: string;
  status: 'brewing' | 'complete' | 'failed';
  phase?: 'brewing' | 'completed' | 'failed';
  worker: string;
  labId?: Id;
  labName?: string;
  labRating?: number;
  startDate: string;
  startDay: number;
  completionDate?: string;
  completedDate?: string | null;
  skillRoll?: number;
  effectiveSkill?: number;
  resultingPotions?: number;
  notes?: string;

  // Brewing mechanics
  PP?: number;
  WR?: number;
  CP?: number;
  DM?: number;
  tier?: number;
  calculatedTier?: number;
  potencyLoad?: number;
  vector?: string;
  dominantAspect?: string | null;
  secondaryAspect?: string | null;
  basePotency?: string;
  finalPotency?: string;
  concentrationSteps?: number;
  totalConcentrationSteps?: number;
  traitBudget?: number;
  traits?: Array<{ name: string; cost: number }>;
  hasMatchingStabilizer?: boolean;
  quality?: string | null;
  amount?: number;
  potency?: string;

  // Hazards
  hazards?: string[];
  hazardDetails?: unknown[];
  hazardsPublic?: unknown[];
  gmHazards?: unknown[];

  // Analysis
  forecast?: {
    performedAt: string;
    currentCP: number;
    predictedQuality: string;
    dmBonus: number;
  } | null;
  microAssay?: {
    performedAt: string;
    dominantAspect: string | null;
    secondaryAspect: string | null;
    revealed: boolean;
  } | null;

  // Consumed ingredients
  consumedIngredients?: Array<{
    reagentId: string;
    reagentName: string;
    role: string;
    unitsUsed: number;
    refinement: string;
    aspects: Record<string, string | undefined>;
    potency?: string;
    concentrationSteps?: number;
  }>;

  // Work shift history
  shifts?: Array<{
    id: string;
    date: string;
    worker: string;
    skill: number;
    roll: number;
    effectiveSkill: number;
    result: string;
    ppAdded: number;
    cpChange: number;
    labName?: string;
    labRating?: number;
    hazardEvents?: Array<{
      hazard: string;
      effect: string;
      severity: string;
      trigger?: string;
    }>;
  }>;

  // Completion hazard events
  completionHazards?: Array<{
    hazard: string;
    effect: string;
    severity: string;
    trigger: string;
  }>;

  // Legacy workSessions
  workSessions?: Array<{
    date: string;
    day: number;
    minutesWorked: number;
  }>;
}

export interface AlchemyLab {
  id: Id;
  name: string;
  rating: number;  // Bonus to alchemy skill
  description: string;
  attachment?: FacilityAttachment;
}

export interface AlchemySettings {
  defaultLabRating: number;
  workBlockMinutes: number;
  showObviousRoles?: boolean;
  autoSaveRecipes?: boolean;
}

// ============================================================================
// GATHERING SYSTEM
// ============================================================================

// The gathering entity types are canonically defined in `./gathering` (the
// "Extended" interfaces) — that is the shape the reducers, sample data, and
// every view actually produce and consume. The old campaign-local interfaces
// declared a divergent shape (category/baseYield/skill) that no code ever
// read; they were retired 2026-07-23 in favor of these aliases.
export type GatheringSpecies = GatheringSpeciesExtended;
export type GatheringTool = GatheringToolExtended;
export type GatheringTable = GatheringTableExtended;
export type GatheringEnvironment = GatheringEnvironmentExtended;

export interface GatheringSession {
  id: Id;
  type: 'fishing' | 'foraging' | 'hunting';
  worker: string;
  day: number;
  slot: number;
  environmentId: Id;
  toolId?: Id;
  baitId?: Id;
  skillRoll?: number;
  effectiveSkill?: number;
  results: Array<{
    speciesId: Id;
    quantity: number;
  }>;
  status: 'pending' | 'complete';
}

export type GatheringBait = GatheringBaitExtended;
export type GatheringCategory = GatheringCategoryExtended;
export type GatheringItem = GatheringItemExtended;

export type GatheringDailyEvents = Record<string, Record<string, {
  rolled: boolean;
  resultType?: string;
  speciesId?: Id;
  quantity?: number;
}>>;

// ============================================================================
// DAY PLANNER SYSTEM
// ============================================================================

export interface TimeSlot {
  id: Id;
  day: number;
  slot: number;  // 0, 1, 2 (morning, afternoon, evening)
  label: string;
  locked: boolean;
}

export interface TaskAssignment {
  id: Id;
  day: number;
  slot: number;
  workerId: Id;
  taskType: 'fishing' | 'foraging' | 'hunting' | 'cooking' | 'crafting' | 'alchemy' | 'rest' | 'trading' | 'study' | 'social';
  taskId?: Id;  // References session/batch/craft ID
  status: 'pending' | 'complete' | 'failed';
  notes?: string;
}

export interface DayLedger {
  day: number;
  results: Array<{
    taskId: Id;
    workerId: Id;
    outcome: 'success' | 'failure';
    rewards?: Array<{
      type: 'material' | 'food' | 'item';
      id: Id;
      quantity: number;
    }>;
  }>;
}

// ============================================================================
// COMBAT SYSTEM
// ============================================================================

export interface CombatCharacter {
  id: Id;
  name: string;
  /** Encounter-setup grouping. Records saved before schema 1.5.1 are backfilled at load. */
  category: CombatCategory;
  /** Derived: category !== 'player'. Kept for reveal/GM-mode consumers. */
  isNPC: boolean;
  hp: number;
  maxHP: number;
  fp?: number;
  maxFP?: number;
  mp?: number;
  maxMP?: number;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  dodge: number;
  parry?: number;
  block?: number;
  dr: number;
  basicSpeed?: number;
  basicMove?: number;
  hitLocationProfileId?: string;
  drByLocation?: Record<string, number>;
  attacks?: Array<{
    name: string;
    skill: number;
    damage?: string;
    notes?: string;
  }>;
  skills: Record<string, number>;
  weapons: Array<{
    name: string;
    damage: string;
    reach: string;
    skill: string;
  }>;
  armor?: Array<{
    location: string;
    dr: number;
  }>;
  notes?: string;
}

export interface CombatSession {
  id: Id;
  name: string;
  participants: Array<{
    characterId: Id;
    team: 'ally' | 'enemy';
    initiative: number;
    currentHP: number;
    currentFP?: number;
    status: 'active' | 'unconscious' | 'dead';
    conditions?: string[];
  }>;
  currentRound: number;
  currentTurn: number;
  log: Array<{
    round: number;
    turn: number;
    action: string;
    actorId: Id;
    targetId?: Id;
    roll?: number;
    damage?: number;
    timestamp: number;
  }>;
  startDate: string;
  endDate?: string;
  outcome?: 'victory' | 'defeat' | 'fled' | 'negotiated';
}

export interface CombatItem {
  id: Id;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'tool';
  stats: Record<string, unknown>;
  quantity: number;
}

export { type EncounterTemplate } from './combatTracker';

// ============================================================================
// CONFIG SYSTEM
// ============================================================================

export interface Kitchen {
  id: Id;
  name: string;
  rating: number;  // Bonus to cooking skill
  description: string;
  attachment?: FacilityAttachment;
}

export interface CookingSkill {
  id: Id;
  name: string;
  level?: number;
}

export interface EffectDefinition {
  id: Id;
  name: string;
  keywords: string;
  notes: string;
  gmNotes: string;
  gmNotesVisible: boolean;
}

export interface EffectPairData {
  summary?: string;
  effects?: EffectDefinition[];
}

export type EffectFamilyMap = Record<string, EffectPairData>;

export interface CurrencyDef {
  key: string;
  name: string;
}

export interface CurrencyConfig {
  currencies: CurrencyDef[];
  primaryKey: string;
}

export interface PriceBookEntry {
  key: string;
  name: string;
  kind: 'material' | 'food' | 'item';
  price: number;
  updatedAt: number;
}

export type ContactKind = 'person' | 'faction' | 'settlement';

export interface ContactShift {
  id: Id;
  dayKey: number;
  delta: number;
  newModifier: number;
  cause: string;
  timestamp: number;
}

export interface ContactEntry {
  id: Id;
  name: string;
  kind: ContactKind;
  modifier: number;
  notes?: string;
  locationId?: Id | null;
  history: ContactShift[];
  createdAt: number;
  updatedAt: number;
}

export interface StudyProject {
  id: Id;
  characterId: Id;
  skillName: string;
  specialization?: string;
  attribute: SkillAttribute;
  difficulty: SkillDifficulty;
  accumulatedHours: number;
  pointsAwarded: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudyConfig {
  hoursPerPoint: number;
}

// ============================================================================
// PARTY TOOL INTEGRATION (existing types from partyTool.ts)
// ============================================================================

export interface ToolModifierSet {
  skillBonus?: number;
  yieldFlat?: number;
  yieldPercent?: number;
  timeBonus?: number;
  riskModifier?: number;
  qualityModifier?: number;
}

export interface ToolTemplate {
  templateId: Id;
  name: string;
  activityCategories: Record<string, ToolModifierSet>;
}

export interface ToolInstance {
  toolId: Id;
  templateId: Id;
  conditionId: Id;
  notes?: string;
  ownerId?: Id;  // Character or 'party'
}

/**
 * Unified Facility type - supports both simple (rating-based) and complex
 * (activity category-based) facilities like kitchens, labs, workshops.
 *
 * Activity types: 'cooking', 'alchemy', 'crafting', 'gathering', 'hunting'
 */
export type FacilityType = 'kitchen' | 'lab' | 'workshop' | 'general';

export interface Facility {
  id: Id;
  name: string;
  facilityType: FacilityType;
  /** Simple rating (0-4) for backwards compatibility with kitchens/labs */
  rating: number;
  /** Optional description */
  description?: string;
  attachment?: FacilityAttachment;
  /** Condition tracking (good, worn, damaged, etc.) */
  conditionId?: Id;
  /**
   * Activity-specific modifiers. Keys are activity types like 'cooking', 'alchemy'.
   * If not provided, `rating` is used as `skillBonus` for the facility's primary activity.
   */
  activityCategories?: Record<string, ToolModifierSet>;
}

/** Sheet-domain stats an item carries while it is NOT on a character sheet.
 * Opaque cargo: the inventory system ferries it, never edits it. */
export type EquipmentCargo = Omit<
  Equipment,
  'id' | 'name' | 'quantity' | 'equipped' | 'sourceItem'
>;

export interface ItemInstance {
  id: Id;
  name?: string;
  quantity?: number;
  /** Character who completed the crafting project; absent for non-crafted items or unresolved workers. */
  crafterId?: Id;
  /** Whether this item is magical. Absent is treated as false. */
  magical?: boolean;
  /** Whether this item is attuned. Absent is treated as false. */
  attuned?: boolean;
  /** Value in the campaign base currency (e.g. from loot distribution). */
  value?: number;
  notes?: string;
  /** Provenance label, e.g. 'crafting' | 'gathering' | 'loot' */
  source?: string;
  equipmentData?: EquipmentCargo;
}

/** Authoritative material holding for one owner. There is no global material pool. */
export interface MaterialEntry extends Material {}

/** Authoritative food holding for one owner. There is no global food pool. */
export interface FoodEntry extends Food {}

export interface Inventory {
  id: Id;
  ownerType: 'party' | 'character';
  ownerId: Id | null;
  currency: Record<string, number>;
  /** Authoritative equipment/other holdings for this owner. */
  items: ItemInstance[];
  tools: ToolInstance[];
  /** Authoritative material holdings for this owner. */
  materials: MaterialEntry[];
  /** Authoritative food holdings for this owner. */
  food: FoodEntry[];
}

// ============================================================================
// INVENTORY INTEGRATION BUS (Phase 12a.5)
// ============================================================================

/** Owner tag for inventory bus writes: the shared party pool or a character id. */
export type InventoryOwner = 'party' | Id;

/** Provenance of an inventory bus write. Read-only metadata; reducers never branch on it. */
export type AcquisitionSource = 'crafting' | 'gathering' | 'loot' | 'trade';

/**
 * Item payload for the `inventory/itemAcquired` bus action.
 *
 * Discriminated on `kind`, mapping each acquirable thing onto existing storage:
 * - material/food → stack into the owner's authoritative Inventory holdings using
 *   the existing name+type rules
 * - equipment/other → ItemInstance in the owner's Inventory record
 * - currency → owner's Inventory currency map
 *
 * `source` on material/food is the descriptive label stored on the holding
 * (e.g. "Foraging at Greenwood"); when omitted, the action-level source is used.
 */
export type AcquiredItem =
  | { kind: 'material'; id: Id; name: string; type: string; quantity: number; source?: string; notes?: string }
  | { kind: 'food'; id: Id; name: string; types?: string[]; quantity: number; source?: string; notes?: string }
  | { kind: 'equipment' | 'other'; id: Id; name: string; quantity: number; crafterId?: Id; value?: number; notes?: string; magical?: boolean; source?: string; equipmentData?: EquipmentCargo }
  | { kind: 'currency'; currencyKey: string; amount: number };

export interface CurrencyLog {
  id: Id;
  sourceInventoryId: Id;
  targetInventoryId: Id;
  currencyKey?: string;
  amount?: number;
  itemInstanceId?: Id;
  toolId?: Id;
  timestamp: number;
}
