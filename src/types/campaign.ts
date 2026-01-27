/**
 * Comprehensive type definitions for GURPS Campaign State
 * This file defines all types needed for the unified CampaignStore
 */

import type { GCSCharacterData } from './characterSheet';

export type Id = string;

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface Character {
  id: Id;
  name: string;
  isPlayer?: boolean;
  work: {
    enabled?: boolean;
    skills: Record<string, number>;
  };
  st?: number;  // Strength attribute (legacy, use gcsData.attributes.ST)

  // Full GCS character sheet data (optional for backward compatibility)
  gcsData?: GCSCharacterData;
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
  type: string;  // References FoodType.name
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

export interface Recipe {
  id: Id;
  name: string;
  ingredients: Array<{
    type: 'food' | 'material';
    id: Id;
    amount: number;
  }>;
  skill: string;
  difficulty: number;
  prepTime: number;  // In minutes
  servings: number;
  effects?: string;
  notes?: string;
}

// ============================================================================
// CRAFTING SYSTEM
// ============================================================================

export type CraftPhase = 'setup' | 'design' | 'craft' | 'complete';
export type CraftQuality = 'cheap' | 'good' | 'fine' | 'very fine' | 'legendary';

export interface Craft {
  id: Id;
  phase: CraftPhase;
  templateType: 'weapons' | 'armor' | 'ranged' | 'explosives';
  template: string;  // Template name
  quality: CraftQuality;
  currentQuality: CraftQuality;
  mods: Array<{
    name: string;
    difficulty: number;
  }>;
  selectedMaterials: Array<{
    requirementIndex: number;
    requiredType: string;
    requiredAmount: number;
    selectedMaterialId: Id | null;
  }>;
  consumedMaterials?: Array<{
    id: Id;
    amount: number;
  }>;
  shifts: Array<{
    date: string;
    day: number;
    worker: string;
    skillRoll: number;
    effectiveSkill: number;
    hoursAdded: number;
    qualityShift?: number;
  }>;
  designShifts?: Array<typeof Craft.prototype.shifts[0]>;
  startDate: string;
  startDay: number;
  completionDate?: string;
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
  quality: CraftQuality;
  mods: Craft['mods'];
  selectedMaterials: Craft['selectedMaterials'];
  consumedMaterials?: Craft['consumedMaterials'];
  designShifts: Craft['shifts'];
  savedDate: string;
}

export interface CustomTemplates {
  weapons: Record<string, WeaponTemplate>;
  armor: Record<string, ArmorTemplate>;
  ranged: Record<string, RangedTemplate>;
  explosives: Record<string, ExplosiveTemplate>;
}

export interface WeaponTemplate {
  name: string;
  weight: number;
  hp: number;
  damage: string;
  reach: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
}

export interface ArmorTemplate {
  name: string;
  weight: number;
  hp: number;
  dr: number;
  location: string;
  materials: Array<{
    type: string;
    amount: number;
  }>;
}

export interface RangedTemplate {
  name: string;
  weight: number;
  hp: number;
  damage: string;
  accuracy: number;
  range: string;
  rateOfFire: number;
  shots: number;
  materials: Array<{
    type: string;
    amount: number;
  }>;
}

export interface ExplosiveTemplate {
  name: string;
  weight: number;
  damage: string;
  fragmentationDamage?: string;
  blastRadius: number;
  materials: Array<{
    type: string;
    amount: number;
  }>;
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
}

export interface AlchemyFormula {
  id: Id;
  name: string;
  reagents: Array<{
    reagentId: Id;
    amount: number;
  }>;
  skill: string;
  difficulty: number;
  brewTime: number;  // In minutes
  effects: string;
  potency?: number;
  notes?: string;
}

export interface AlchemyBatch {
  id: Id;
  formulaId: Id;
  status: 'brewing' | 'complete' | 'failed';
  worker: string;
  labId: Id;
  startDate: string;
  startDay: number;
  completionDate?: string;
  skillRoll?: number;
  effectiveSkill?: number;
  resultingPotions?: number;
  notes?: string;
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
}

export interface AlchemySettings {
  defaultLabRating: number;
  workBlockMinutes: number;
}

// ============================================================================
// GATHERING SYSTEM
// ============================================================================

export interface GatheringSpecies {
  id: Id;
  name: string;
  category: 'fish' | 'game' | 'plant';
  baseYield: number;
  skill: string;
  difficulty: number;
  environments: string[];  // Environment IDs
  seasonality?: string;
  notes?: string;
}

export interface GatheringTool {
  id: Id;
  name: string;
  category: string;
  skillBonus: number;
  yieldBonus: number;
  durability?: number;
  currentDurability?: number;
}

export interface GatheringTable {
  id: Id;
  name: string;
  skill: string;
  rolls: Array<{
    min: number;
    max: number;
    result: string;
    speciesId?: Id;
    quantity?: number;
  }>;
}

export interface GatheringEnvironment {
  id: Id;
  name: string;
  description: string;
  species: Id[];  // Species IDs
  hazards?: string[];
}

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

export interface GatheringBait {
  id: Id;
  name: string;
  attractionBonus: number;
  quantity: number;
}

export interface GatheringCategory {
  id: Id;
  name: string;
  color: string;
}

export interface GatheringItem {
  id: Id;
  name: string;
  categoryId: Id;
  baseYield: number;
  skill: string;
}

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
  taskType: 'fishing' | 'foraging' | 'hunting' | 'cooking' | 'crafting' | 'alchemy' | 'rest';
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
  isNPC: boolean;
  hp: number;
  maxHP: number;
  fp?: number;
  maxFP?: number;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  dodge: number;
  parry?: number;
  block?: number;
  dr: number;
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

// ============================================================================
// CONFIG SYSTEM
// ============================================================================

export interface Kitchen {
  id: Id;
  name: string;
  rating: number;  // Bonus to cooking skill
  description: string;
}

export interface CookingSkill {
  name: string;
  level: number;
}

export type EffectFamilyMap = Record<string, string[]>;

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

export interface Facility {
  id: Id;
  name: string;
  conditionId: Id;
  activityCategories: Record<string, ToolModifierSet>;
}

export interface ItemInstance {
  id: Id;
  name?: string;
  quantity?: number;
}

export interface MaterialEntry {
  id: Id;
  quantity: number;
}

export interface FoodEntry {
  id: Id;
  quantity: number;
}

export interface Inventory {
  id: Id;
  ownerType: 'party' | 'character';
  ownerId: Id | null;
  currency: Record<string, number>;
  items: ItemInstance[];
  tools: ToolInstance[];
  materials: MaterialEntry[];
  food: FoodEntry[];
}

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
