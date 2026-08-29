/**
 * @fileoverview GURPS Calculator Constants and Configuration Data
 *
 * This module exports all constant values, templates, and configuration data
 * used throughout the GURPS calculator application. Includes definitions for:
 * - Crafting templates (weapons, armor, ranged, explosives)
 * - Material and quality modifiers
 * - Alchemy system constants (aspects, roles, potency, hazards)
 * - Vector and tier configurations
 * - Role coverage penalties and constraints
 */

import type { CurrencyConfig, StudyConfig } from '../types/campaign';

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  currencies: [{ key: 'cp', name: 'Copper' }],
  primaryKey: 'cp',
};

export const DEFAULT_STUDY_CONFIG: StudyConfig = { hoursPerPoint: 200 };
export const STUDY_HOURS_PER_SLOT = 4;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature flags
 */
export const UNIFIED_UI_ENABLED = true;

// ============================================================================
// CRAFTING TEMPLATES
// ============================================================================

export interface WeaponTemplate {
  weight: number;
  hp: number;
  damage: string;
  reach: string;
  parry: string;
  cost: number;
  ST: number;
  notes: string;
}

export interface ArmorTemplate {
  weight: number;
  hp: number;
  location: string;
  DR: number;
  cost: number;
  LC: number;
  notes: string;
}

export interface RangedTemplate {
  weight: number;
  hp: number;
  damage: string;
  Acc: number;
  range: string;
  RoF: number;
  shots: string;
  cost: number;
  ST: number;
  bulk: number;
  RCl: number;
  LC: number;
  notes: string;
}

export interface ExplosiveTemplate {
  weight: number;
  hp: number;
  damage: string;
  fuse: string;
  cost: number;
  LC: number;
  notes: string;
}

export interface Templates {
  weapons: Record<string, WeaponTemplate>;
  armor: Record<string, ArmorTemplate>;
  ranged: Record<string, RangedTemplate>;
  explosives: Record<string, ExplosiveTemplate>;
}

/**
 * Template data for crafting items
 * Defines base stats for weapons, armor, ranged weapons, and explosives
 */
export const TEMPLATES: Templates = {
  weapons: {
    'dagger': { weight: 1, hp: 8, damage: 'thr-1 imp', reach: 'C,1', parry: '-1', cost: 20, ST: 5, notes: '' },
    'main-gauche': { weight: 2, hp: 11, damage: 'thr imp', reach: 'C,1', parry: '0', cost: 50, ST: 6, notes: '' },
    'cutlass': { weight: 3, hp: 11, damage: 'sw cut', reach: '1', parry: '0', cost: 300, ST: 9, notes: '' },
    'shortsword': { weight: 3, hp: 12, damage: 'sw-1 cut', reach: '1', parry: '0', cost: 400, ST: 8, notes: '' },
    'broadsword': { weight: 4, hp: 13, damage: 'sw+1 cut', reach: '1', parry: '0', cost: 500, ST: 10, notes: '' },
    'longsword': { weight: 6, hp: 15, damage: 'sw+2 cut', reach: '1,2', parry: '0', cost: 700, ST: 11, notes: '' }
  },
  armor: {
    'cloth armor': { weight: 6, hp: 15, location: 'torso', DR: 1, cost: 30, LC: 4, notes: '' },
    'leather armor': { weight: 10, hp: 18, location: 'torso', DR: 2, cost: 100, LC: 4, notes: '' },
    'steel corselet': { weight: 35, hp: 27, location: 'torso', DR: 5, cost: 1300, LC: 3, notes: '' }
  },
  ranged: {
    'shortbow': { weight: 2, hp: 11, damage: 'thr+1 imp', Acc: 1, range: '150/200', RoF: 1, shots: '1(2)', cost: 50, ST: 7, bulk: -6, RCl: 1, LC: 4, notes: '' },
    'longbow': { weight: 3, hp: 12, damage: 'thr+2 imp', Acc: 2, range: '180/220', RoF: 1, shots: '1(2)', cost: 200, ST: 11, bulk: -8, RCl: 1, LC: 4, notes: '' }
  },
  explosives: {
    'grenade': { weight: 1, hp: 5, damage: '2d cr', fuse: '4 sec', cost: 30, LC: 1, notes: '' },
    'dynamite': { weight: 2, hp: 8, damage: '6d cr', fuse: '1-10 sec', cost: 50, LC: 1, notes: '' }
  }
} as const;

// ============================================================================
// MATERIALS AND QUALITIES
// ============================================================================

export interface MaterialDefinition {
  difficulty: number;
  weightMod: number;
  hpMod: number;
  ht: number;
}

/**
 * Default material definitions with crafting modifiers
 * Custom materials can override these in the Manager tab
 */
export const MATERIALS: Record<string, MaterialDefinition> = {
  'steel': { difficulty: 0, weightMod: 0, hpMod: 0, ht: 12 },
  'iron': { difficulty: -1, weightMod: 0.1, hpMod: 0, ht: 11 },
  'wood': { difficulty: -2, weightMod: -0.1, hpMod: 0, ht: 10 }
};

export interface QualityDefinition {
  difficulty: number;
  costMult: number;
  htBonus: number;
}

/**
 * Quality levels for crafted items
 * Each quality affects difficulty, cost multiplier, and HT bonus
 */
export const QUALITIES: Record<string, QualityDefinition> = {
  'cheap': { difficulty: 2, costMult: 1/3, htBonus: -2 },
  'good': { difficulty: 0, costMult: 1, htBonus: 0 },
  'fine': { difficulty: -3, costMult: 4, htBonus: 2 },
  'very fine': { difficulty: -6, costMult: 20, htBonus: 4 },
  'legendary': { difficulty: -9, costMult: 100, htBonus: 6 }
};

/**
 * Modification difficulty modifiers for crafting
 */
export const MODS: Record<string, number> = {
  'minor add-on': -1,
  'major add-on': -2,
  'structural overhaul': -3
};

// ============================================================================
// ALCHEMY SYSTEM CONSTANTS
// ============================================================================

/**
 * Elemental and magical aspects for reagents
 * Reagents have primary, secondary, and tertiary aspects that determine effects
 */
export const ASPECTS = ['Water', 'Air', 'Fire', 'Earth', 'Vital', 'Mind', 'Shadow', 'Light'] as const;
export type Aspect = typeof ASPECTS[number];

/**
 * Refinement levels and which aspects are visible at each level
 * crude: all aspects contribute but with noise
 * prepared: primary + secondary
 * refined: primary only (purest form)
 */
export const REFINEMENT_LEVELS: Record<string, string[]> = {
  crude: ['primary', 'secondary', 'tertiary'],
  prepared: ['primary', 'secondary'],
  refined: ['primary']
};

/**
 * Ingredient roles in alchemical formulas
 * Each role contributes differently to the brewing process
 */
export const INGREDIENT_ROLES = ['Active', 'Catalyst', 'Stabilizer', 'Solvent', 'Binder', 'Vector', 'Signature', 'Tool'] as const;
export type IngredientRole = typeof INGREDIENT_ROLES[number];

/**
 * Potency levels from weakest to strongest
 * Higher potency = more powerful effects but harder to work with
 */
export const POTENCY_LEVELS = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type PotencyLevel = typeof POTENCY_LEVELS[number];

/**
 * Hazard tags that can be applied to reagents
 * Hazards add risk and complications during brewing
 */
export const HAZARD_TAGS = ['Flammable', 'Volatile', 'Reactive', 'Unstable', 'Toxic', 'Intoxicant', 'Hallucinogenic'] as const;
export type HazardTag = typeof HAZARD_TAGS[number];

/**
 * Aspect conflict pairs - combining these aspects increases instability
 */
export const CONFLICT_PAIRS: [Aspect, Aspect][] = [
  ['Fire', 'Water'],
  ['Light', 'Shadow'],
  ['Shadow', 'Vital']
];

export interface VectorDefinition {
  name: string;
  wrMod: number;
  dmMod: number;
  tbEfficiency: number;
}

/**
 * Vector types for alchemical preparations
 * Each vector has different WR/DM modifiers and trait budget efficiency
 */
export const VECTORS: VectorDefinition[] = [
  { name: 'Potion', wrMod: 0, dmMod: 0, tbEfficiency: 1.0 },
  { name: 'Salve/Poultice', wrMod: 1, dmMod: -1, tbEfficiency: 1.0 },
  { name: 'Ink/Coating', wrMod: 1, dmMod: -1, tbEfficiency: 1.0 },
  { name: 'Aerosol/Smoke', wrMod: 2, dmMod: -2, tbEfficiency: 1.0 },
  { name: 'Bomb/Grenade', wrMod: 3, dmMod: -3, tbEfficiency: 1.0 }
];

export interface TierDefinition {
  baseWR: number;
  baseDM: number;
  traitBudget: number;
}

/**
 * Tier data defining base Work Required (WR), Difficulty Modifier (DM), and trait budget
 * Higher tiers = more powerful but harder to brew
 */
export const TIER_DATA: Record<number, TierDefinition> = {
  1: { baseWR: 4, baseDM: 0, traitBudget: 10 },
  2: { baseWR: 8, baseDM: -1, traitBudget: 25 },
  3: { baseWR: 12, baseDM: -2, traitBudget: 50 },
  4: { baseWR: 16, baseDM: -4, traitBudget: 100 }
};

/**
 * Quality outcome labels based on Contamination Points (CP)
 */
export const QUALITY_OUTCOMES: Record<number, string> = {
  0: 'Clean',
  1: 'Minor Flaw',
  2: 'Unstable',
  3: 'Flawed',
  4: 'Mishap'
};

export interface TierThreshold {
  tier: number;
  minPotencyLoad: number;
  maxPotencyLoad: number;
}

/**
 * Tier calculation thresholds based on potency load of active ingredients
 * Potency load = sum of (potency index + concentration steps) for all actives
 */
export const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 1, minPotencyLoad: 0, maxPotencyLoad: 3 },   // P0-P1 actives
  { tier: 2, minPotencyLoad: 4, maxPotencyLoad: 6 },   // P2 actives
  { tier: 3, minPotencyLoad: 7, maxPotencyLoad: 9 },   // P3 actives
  { tier: 4, minPotencyLoad: 10, maxPotencyLoad: 999 } // P4+ actives
];

/**
 * Required ingredient roles for each vector type
 * Missing required roles incur penalties
 */
export const REQUIRED_ROLES_BY_VECTOR: Record<string, string[]> = {
  'Potion': ['Active', 'Stabilizer', 'Solvent', 'Tool'],
  'Salve/Poultice': ['Active', 'Binder', 'Tool'],
  'Ink/Coating': ['Active', 'Binder', 'Tool'],
  'Aerosol/Smoke': ['Active', 'Catalyst', 'Tool'],
  'Bomb/Grenade': ['Active', 'Catalyst', 'Stabilizer', 'Tool']
};

export interface RoleCoveragePenalty {
  wr: number;
  dm: number;
  message: string;
}

/**
 * Penalty Scheme A: WR/DM adjustments for missing required roles
 * Active and Tool are mandatory (wr: 999 = cannot brew)
 */
export const ROLE_COVERAGE_PENALTIES: Record<string, RoleCoveragePenalty> = {
  'Active': { wr: 999, dm: -999, message: 'Cannot brew without Active ingredient' },
  'Tool': { wr: 999, dm: -999, message: 'Cannot brew without Tool ingredient' },
  'Stabilizer': { wr: 2, dm: -1, message: 'Missing Stabilizer: +2 WR, -1 DM' },
  'Solvent': { wr: 2, dm: -1, message: 'Missing Solvent: +2 WR, -1 DM' },
  'Binder': { wr: 2, dm: -1, message: 'Missing Binder: +2 WR, -1 DM' },
  'Catalyst': { wr: 1, dm: 0, message: 'Missing Catalyst: +1 WR' }
};

/**
 * Maximum number of reagents allowed in a single batch
 */
export const MAX_REAGENTS_PER_BATCH = 8;

/**
 * Maximum units of each reagent by role
 * Different roles have different maximum contribution limits
 */
export const MAX_UNITS_PER_REAGENT_BY_ROLE: Record<string, number> = {
  'Active': 3,
  'Catalyst': 2,
  'Stabilizer': 2,
  'Solvent': 5,     // Can use more for dilution
  'Binder': 3,
  'Vector': 1,
  'Signature': 1,
  'Tool': 1
};

export interface HazardRule {
  triggerOn: string[];
  effect: string;
  wrMod: number;
  dmMod: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Hazard rules defining triggers, effects, and severity
 * Each hazard can trigger under different conditions and has various effects
 */
export const HAZARD_RULES: Record<string, HazardRule> = {
  'Flammable': {
    triggerOn: ['mishap', 'quality_unstable_or_worse'],
    effect: 'Fire damage to lab and workers',
    wrMod: 1,
    dmMod: 0,
    severity: 'high'
  },
  'Volatile': {
    triggerOn: ['failure', 'mishap'],
    effect: 'Explosion - batch destroyed, possible injury',
    wrMod: 2,
    dmMod: 0,
    severity: 'critical'
  },
  'Reactive': {
    triggerOn: ['conflict_pairs_present'],
    effect: 'Increased instability from aspect conflicts',
    wrMod: 1,
    dmMod: -1,
    severity: 'medium'
  },
  'Unstable': {
    triggerOn: ['any_failure'],
    effect: 'Additional contamination on failure (CP +1 extra)',
    wrMod: 1,
    dmMod: 0,
    severity: 'medium'
  },
  'Toxic': {
    triggerOn: ['exposure', 'mishap'],
    effect: 'HT roll or take toxic damage',
    wrMod: 0,
    dmMod: 0,
    severity: 'high'
  },
  'Intoxicant': {
    triggerOn: ['exposure'],
    effect: 'IQ/DX penalties, possible unconsciousness',
    wrMod: 0,
    dmMod: 0,
    severity: 'medium'
  },
  'Hallucinogenic': {
    triggerOn: ['exposure'],
    effect: 'Mental effects, hallucinations',
    wrMod: 0,
    dmMod: 0,
    severity: 'medium'
  }
};

// ============================================================================
// GATHERING SYSTEM CONSTANTS
// ============================================================================

/**
 * Gathering modes supported by the system
 * Each mode has different methods, tools, and resolution mechanics
 */
export const GATHERING_MODES = ['Fishing', 'Foraging', 'Mining', 'Logging'] as const;
export type GatheringMode = typeof GATHERING_MODES[number];

export interface FishingMethodDefinition {
  label: string;
  canTarget: boolean;
  toolTypes: string[];
  description: string;
}

/**
 * Fishing methods with their specific rules and restrictions
 */
export const FISHING_METHODS: Record<string, FishingMethodDefinition> = {
  Line: {
    label: 'Line Fishing',
    canTarget: true,
    toolTypes: ['fishing_rod', 'handline', 'general'],
    description: 'Can target specific species. Success = 1 fish, crit = 2 fish. Up to 3 retry attempts at -1 cumulative.'
  },
  Net: {
    label: 'Net Fishing',
    canTarget: false,
    toolTypes: ['net', 'general'],
    description: 'Cannot target. Catches 1 + 1 per 3 MoS fish. Large fish are rerolled.'
  },
  Spear: {
    label: 'Spear Fishing',
    canTarget: true,
    toolTypes: ['spear', 'general'],
    description: 'Requires Stealth approach + Spear hit. Catches 1 fish (2 on crit). Often restricted to shallow water.'
  }
};

/**
 * Tool types for gathering system with display labels
 */
export const GATHERING_TOOL_TYPES: Record<string, string> = {
  fishing_rod: 'Fishing Rod',
  handline: 'Handline',
  net: 'Net',
  spear: 'Spear',
  general: 'General Tool'
};

/**
 * Bait tags for consumables
 */
export const BAIT_TAGS = ['Glow', 'Blood', 'Larva', 'Worm', 'Kelp', 'CrabChunk', 'Insect', 'Fish'] as const;
export type BaitTag = typeof BAIT_TAGS[number];

/**
 * Species tags for fish and other gatherable creatures
 */
export const SPECIES_TAGS = ['LargeFish', 'Common', 'Rare', 'Prize', 'Crustacean', 'Shellfish', 'Predator', 'Schooling'] as const;
export type SpeciesTag = typeof SPECIES_TAGS[number];

/**
 * Secondary material types from fish processing
 */
export const FISH_SECONDARY_MATERIALS = ['scales', 'shell', 'oil', 'bone', 'glowflesh', 'fins', 'teeth', 'ink'] as const;

/**
 * Special rules that can apply to fish species
 */
export const SPECIES_SPECIAL_RULES = ['glows', 'hard_to_prepare', 'high_fat', 'toxin_possible', 'prized_meat', 'tough_scales'] as const;

/**
 * Table types for the gathering system
 */
export const GATHERING_TABLE_TYPES = [
  'FishingRandomCatch',
  'FishingEventMild',
  'FishingEventRare',
  'ForagingRandomFind',
  'ForagingEventMild',
  'ForagingEventRare'
] as const;

export interface ThresholdRange {
  min: number;
  max: number;
}

/**
 * Dynamic event roll thresholds (3d6)
 * Once per day per gathering group
 */
export const DYNAMIC_EVENT_THRESHOLDS: Record<string, ThresholdRange> = {
  rare: { min: 3, max: 6 },    // 3-6: Rare event
  mild: { min: 7, max: 10 },   // 7-10: Mild event
  none: { min: 11, max: 18 }   // 11-18: No event
};

export interface FishingOutcome {
  fish: number;
  description: string;
}

/**
 * Fishing roll outcomes based on margin of success
 */
export const FISHING_OUTCOMES: Record<string, FishingOutcome> = {
  critSuccess: { fish: 2, description: 'Critical Success - Catch 2 fish!' },
  success: { fish: 1, description: 'Success - Catch 1 fish' },
  failure: { fish: 0, description: 'Failure - No catch' },
  critFailure: { fish: 0, description: 'Critical Failure - Line snapped / Net torn' }
};

/**
 * Bait modifiers for fishing
 */
export const BAIT_MODIFIERS = {
  correctBait: +1,       // Bait matches target species preference
  inappropriateBait: -2, // Bait is wrong for target
  noBait: 0              // No bait used
} as const;

/**
 * Large fish targeting penalty
 */
export const LARGE_FISH_TARGETING_PENALTY = -2;

/**
 * Maximum net reroll attempts before error
 * Prevents infinite loops on misconfigured tables
 */
export const MAX_NET_REROLL_ATTEMPTS = 20;

/**
 * Default fish ST for large fish struggle if not specified
 */
export const DEFAULT_FISH_ST = 14;

/**
 * Fish ST range for random generation
 */
export const FISH_ST_RANGE = { min: 12, max: 18 } as const;

// ============================================================================
// FORAGING SYSTEM CONSTANTS
// ============================================================================

export interface ForagingSkillDefinition {
  label: string;
  attribute: string;
  description: string;
}

/**
 * Foraging skills with their base attributes
 */
export const FORAGING_SKILLS: Record<string, ForagingSkillDefinition> = {
  Survival: {
    label: 'Survival',
    attribute: 'Per',
    description: 'Perception-based wilderness survival skill for finding food and resources'
  },
  Naturalist: {
    label: 'Naturalist',
    attribute: 'IQ',
    description: 'IQ-based knowledge of plants, animals, and ecosystems'
  },
  HerbLore: {
    label: 'Herb Lore',
    attribute: 'IQ',
    description: 'IQ-based specialized knowledge of medicinal and culinary plants'
  }
};

/**
 * Foraging tool types
 */
export const FORAGING_TOOL_TYPES: Record<string, string> = {
  basket: 'Basket',
  gloves: 'Gloves',
  knife: 'Knife',
  machete: 'Machete',
  sickle: 'Sickle',
  digging_tool: 'Digging Tool',
  general: 'General Tool'
};

export interface ForagingRarityDefinition {
  label: string;
  penalty: number;
  description: string;
}

/**
 * Foraging rarity levels with targeting penalties
 */
export const FORAGING_RARITIES: Record<string, ForagingRarityDefinition> = {
  Common: {
    label: 'Common',
    penalty: 0,
    description: 'Easy to find, no penalty'
  },
  Uncommon: {
    label: 'Uncommon',
    penalty: -2,
    description: 'Harder to find, -2 penalty'
  },
  Rare: {
    label: 'Rare',
    penalty: -4,
    description: 'Difficult to find, -4 penalty'
  },
  VeryRare: {
    label: 'Very Rare',
    penalty: -6,
    description: 'Very difficult to find, -6 penalty'
  },
  Legendary: {
    label: 'Legendary',
    penalty: -8,
    description: 'Extremely rare, -8 penalty'
  }
};

export interface ContextModifierDefinition {
  label: string;
  modifier: number;
  description: string;
}

/**
 * Context modifiers for foraging
 */
export const FORAGING_CONTEXT_MODIFIERS: Record<string, ContextModifierDefinition> = {
  mapGuide: {
    label: 'Map/Local Guide',
    modifier: 1,
    description: 'Character has a map or local guide'
  },
  unfamiliar: {
    label: 'Unfamiliar/Hostile Region',
    modifier: -2,
    description: 'Character is unfamiliar with the area or it is hostile'
  },
  peakSeason: {
    label: 'Peak Season',
    modifier: 2,
    description: 'Optimal season for foraging'
  }
};

export interface ForagingCategoryTemplate {
  name: string;
  yieldFormula: string;
  inventoryKind: 'food' | 'material';
  description: string;
}

/**
 * Predefined foraging category templates
 * These can be customized in the Manager
 */
export const FORAGING_CATEGORY_TEMPLATES: ForagingCategoryTemplate[] = [
  { name: 'Fruits', yieldFormula: '3d+1', inventoryKind: 'food', description: 'Edible fruits and berries' },
  { name: 'Vegetables', yieldFormula: '3d', inventoryKind: 'food', description: 'Edible roots, tubers, and vegetables' },
  { name: 'Grains', yieldFormula: '2d+2', inventoryKind: 'food', description: 'Wild grains and seeds' },
  { name: 'Mushrooms', yieldFormula: '2d', inventoryKind: 'food', description: 'Edible fungi' },
  { name: 'Herbs & Spices', yieldFormula: '1d+1', inventoryKind: 'food', description: 'Culinary herbs and spices' },
  { name: 'Seeds & Nuts', yieldFormula: '2d+1', inventoryKind: 'food', description: 'Nuts and edible seeds' },
  { name: 'Fibrous Plants', yieldFormula: '3d', inventoryKind: 'material', description: 'Common plant fibers for crafting' },
  { name: 'Strong Fibers', yieldFormula: '2d', inventoryKind: 'material', description: 'Durable fibers for rope and textiles' },
  { name: 'Rare Fibers', yieldFormula: '1d', inventoryKind: 'material', description: 'Exotic or specialty fibers' },
  { name: 'Alchemical Ingredients', yieldFormula: '1d+1', inventoryKind: 'material', description: 'Reagents for alchemy' },
  { name: 'Resin/Sap', yieldFormula: '1d+2', inventoryKind: 'material', description: 'Tree resins and saps' },
  { name: 'Medicinal Herbs', yieldFormula: '1d', inventoryKind: 'material', description: 'Herbs with healing properties' }
];

export interface ForagingOutcome {
  yieldMultiplier: number;
  bonusFind?: boolean;
  randomFallback?: boolean;
  hazard?: boolean;
  description: string;
}

/**
 * Foraging roll outcomes with yield multipliers
 */
export const FORAGING_OUTCOMES: Record<string, ForagingOutcome> = {
  critSuccess: {
    yieldMultiplier: 1.5,
    bonusFind: true,
    description: 'Critical Success - Full yield +50% bonus, plus rare find!'
  },
  success: {
    yieldMultiplier: 1.0,
    bonusFind: false,
    description: 'Success - Full yield'
  },
  failure: {
    yieldMultiplier: 0.5,
    bonusFind: false,
    randomFallback: true,
    description: 'Failure - Half yield, random find if targeted'
  },
  critFailure: {
    yieldMultiplier: 0.5,
    hazard: true,
    randomFallback: true,
    description: 'Critical Failure - Half yield, hazard encountered!'
  }
};

/**
 * Foraging hazards for critical failures
 */
export const FORAGING_HAZARDS: string[] = [
  'Poisonous plant exposure (HT roll)',
  'Thorns and brambles (minor injury)',
  'Toxic spores inhaled (respiratory irritation)',
  'Aggressive wildlife disturbed',
  'Dangerous terrain (twisted ankle)',
  'Allergic reaction to unknown plant'
];

/**
 * Default food types for foraging categories
 */
export const FORAGING_FOOD_TYPES: string[] = [
  'fruits',
  'vegetables',
  'grains',
  'mushrooms',
  'herbs_spices',
  'nuts_seeds',
  'seaweed'
];

/**
 * Default material types for foraging categories
 */
export const FORAGING_MATERIAL_TYPES: string[] = [
  'fiber',
  'strong_fiber',
  'rare_fiber',
  'resin_sap',
  'medicinal_herb',
  'alchemical_ingredient',
  'wood',
  'bark',
  'lichen'
];

/**
 * Table entry result types for foraging find tables
 */
export const FORAGING_FIND_RESULT_TYPES = ['category', 'item', 'nothing', 'special'] as const;

// ============================================================================
// DAY PLANNER SYSTEM CONSTANTS
// ============================================================================

/**
 * Number of time slots per day (Morning, Afternoon, Night)
 * Each slot represents 8 hours
 */
export const SLOTS_PER_DAY = 3;

/**
 * Names for each time slot
 */
export const SLOT_NAMES = ['Morning', 'Afternoon', 'Night'] as const;

/**
 * Time slot statuses
 */
export const SLOT_STATUS = {
  Planned: 'Planned',
  InProgress: 'InProgress',
  Resolved: 'Resolved'
} as const;

/**
 * Task assignment resolution states
 */
export const TASK_STATUS = {
  Draft: 'Draft',
  Resolving: 'Resolving',
  Completed: 'Completed'
} as const;

/**
 * Pending day ledger statuses
 */
export const LEDGER_STATUS = {
  Open: 'Open',
  Committed: 'Committed'
} as const;

/**
 * Available gathering modes for task assignments
 */
export const TASK_MODES = [
  'Fishing',
  'Foraging'
  // 'Hunting', 'Logging', 'Mining' - future
] as const;

// ============================================================================
// COMBAT RUNNER CONSTANTS
// ============================================================================

/**
 * Character categories for combat
 */
export const COMBAT_CATEGORIES = ['player', 'ally', 'enemy', 'object'] as const;
export type CombatCategory = typeof COMBAT_CATEGORIES[number];

/**
 * HP status thresholds for combatants
 * These are based on GURPS HP status rules
 */
export const HP_STATUS = {
  HEALTHY: 'healthy',     // HP > 1/3 max
  INJURED: 'injured',     // HP > 0
  CRITICAL: 'critical',   // HP <= 0 but > -HP
  DEAD: 'dead'            // HP <= -HP
} as const;
export type HPStatus = typeof HP_STATUS[keyof typeof HP_STATUS];

/**
 * Combat log entry types
 */
export const LOG_ENTRY_TYPES = [
  'turn_change',
  'round_change',
  'hp_change',
  'fp_change',
  'mp_change',
  'note',
  'combat_start',
  'combat_end'
] as const;
export type LogEntryType = typeof LOG_ENTRY_TYPES[number];

/**
 * Maximum number of combat history entries to keep
 */
export const MAX_COMBAT_HISTORY = 50;

// ============================================================================
// REVAMPED FORAGING SYSTEM (re-exported from dedicated module)
// ============================================================================

export {
  FORAGE_CATEGORY_META,
  FORAGE_CATEGORY_IDS,
  FORAGE_TIER_MULTIPLIERS,
  FORAGE_MOS_TIER_THRESHOLDS,
  FORAGE_SPECIFIC_PENALTIES,
  FORAGE_CONTEXT_MODIFIERS,
  getHelperBonus,
  FORAGE_SUPERVISOR_BONUS,
  FORAGE_EVENT_THRESHOLDS,
  FORAGE_HAZARDS,
  FORAGE_EVENTS_MILD,
  FORAGE_EVENTS_RARE,
  DEFAULT_FORAGING_CONFIG,
  FORAGE_SKILL_LABELS,
} from './foraging';
