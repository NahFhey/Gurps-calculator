/**
 * Foraging System Constants
 *
 * Static configuration data for the revamped foraging system.
 * Includes category metadata, tier multipliers, modifier tables,
 * event thresholds, and default configuration.
 */

import type {
  ForageCategoryMeta,
  ForageCategoryId,
  ForageTier,
  ForagingConfig,
  TierOutcome,
} from '../types/foraging';

// ============================================================================
// CATEGORY METADATA
// ============================================================================

/**
 * Metadata for each forage category including default yield formulas.
 * Yield formulas use GURPS dice notation (XdY+Z, default d6).
 */
export const FORAGE_CATEGORY_META: Record<ForageCategoryId, ForageCategoryMeta> = {
  fruits: {
    id: 'fruits',
    label: 'Fruits',
    inventoryKind: 'food',
    defaultYieldFormula: '3d+1',
  },
  vegetables: {
    id: 'vegetables',
    label: 'Vegetables',
    inventoryKind: 'food',
    defaultYieldFormula: '2d+2',
  },
  grains: {
    id: 'grains',
    label: 'Grains',
    inventoryKind: 'food',
    defaultYieldFormula: '2d',
  },
  mushrooms: {
    id: 'mushrooms',
    label: 'Mushrooms',
    inventoryKind: 'food',
    defaultYieldFormula: '1d+2',
  },
  herbs_spices: {
    id: 'herbs_spices',
    label: 'Herbs & Spices',
    inventoryKind: 'food',
    defaultYieldFormula: '2d+1',
  },
  seeds_nuts: {
    id: 'seeds_nuts',
    label: 'Seeds & Nuts',
    inventoryKind: 'food',
    defaultYieldFormula: '2d',
  },
  fibrous_plants: {
    id: 'fibrous_plants',
    label: 'Fibrous Plants',
    inventoryKind: 'material',
    defaultYieldFormula: '3d+2',
  },
  strong_fibers: {
    id: 'strong_fibers',
    label: 'Strong Fibers',
    inventoryKind: 'material',
    defaultYieldFormula: '2d+2',
  },
  rare_fibers: {
    id: 'rare_fibers',
    label: 'Rare Fibers',
    inventoryKind: 'material',
    defaultYieldFormula: '1d+1',
  },
  alchemical_ingredients: {
    id: 'alchemical_ingredients',
    label: 'Alchemical Ingredients',
    inventoryKind: 'material',
    defaultYieldFormula: '1d+1',
  },
};

/**
 * All category IDs for iteration
 */
export const FORAGE_CATEGORY_IDS: ForageCategoryId[] = Object.keys(
  FORAGE_CATEGORY_META
) as ForageCategoryId[];

// ============================================================================
// TIER MULTIPLIERS
// ============================================================================

/**
 * Yield multipliers applied based on tier outcome.
 * Applied to the rolled yield total before rounding down.
 */
export const FORAGE_TIER_MULTIPLIERS: Record<TierOutcome, number> = {
  common: 1.0,
  uncommon: 1.25,
  rare: 1.5,
  veryRare: 1.75,
  legendary: 2.0,
  scraps: 0.5,
  nothing: 0,
};

// ============================================================================
// MARGIN OF SUCCESS THRESHOLDS
// ============================================================================

/**
 * MoS ranges that determine the tier outcome on a successful roll.
 * Critical success overrides to 'rare' (or allows choosing higher).
 */
export const FORAGE_MOS_TIER_THRESHOLDS = {
  common: { min: 0, max: 2 },
  uncommon: { min: 3, max: 5 },
  rare: { min: 6, max: Infinity },
} as const;

// ============================================================================
// SPECIFIC ITEM TARGETING PENALTIES
// ============================================================================

/**
 * Penalty applied to the skill roll when targeting a specific item,
 * based on the target item's tier.
 */
export const FORAGE_SPECIFIC_PENALTIES: Record<ForageTier, number> = {
  common: 0,
  uncommon: -2,
  rare: -4,
  veryRare: -6,
  legendary: -8,
};

// ============================================================================
// CONTEXT MODIFIERS
// ============================================================================

/**
 * Situational modifiers applied to the foraging skill roll.
 */
export const FORAGE_CONTEXT_MODIFIERS = {
  mapGuide: { label: 'Map/Local Guide', value: 1 },
  unfamiliar: { label: 'Unfamiliar/Hostile Region', value: -2 },
  peakSeason: { label: 'Peak Season', value: 2 },
  offSeason: { label: 'Off Season', value: -2 },
  properTools: { label: 'Proper Tools', value: 2 },
  denseTerrainNoTools: {
    label: 'Dense/Dangerous Terrain (no tools)',
    value: -2,
  },
} as const;

// ============================================================================
// HELPER BONUSES
// ============================================================================

/**
 * Bonus from helpers based on count.
 */
export function getHelperBonus(helperCount: number): number {
  if (helperCount <= 0) return 0;
  if (helperCount === 1) return 1;
  if (helperCount <= 3) return 2;
  return 3; // 4+
}

/**
 * Supervisor bonus when supervisor has skill 15+
 */
export const FORAGE_SUPERVISOR_BONUS = 5;

// ============================================================================
// EVENT THRESHOLDS
// ============================================================================

/**
 * 3d6 roll ranges for event severity determination.
 */
export const FORAGE_EVENT_THRESHOLDS = {
  rare: { min: 3, max: 6 },
  mild: { min: 7, max: 10 },
  none: { min: 11, max: 18 },
} as const;

// ============================================================================
// HAZARDS (Critical Failure)
// ============================================================================

/**
 * Hazard descriptions for critical failures.
 */
export const FORAGE_HAZARDS: string[] = [
  'Poisonous plant exposure (HT roll)',
  'Thorns and brambles (minor injury)',
  'Toxic spores inhaled (respiratory irritation)',
  'Aggressive wildlife disturbed',
  'Dangerous terrain (twisted ankle)',
  'Allergic reaction to unknown plant',
  'Disturbed beehive (stung)',
  'Quicksand or unstable ground',
  'Equipment damaged',
  'Severe weather shift',
  'Lost in undergrowth',
];

// ============================================================================
// EVENT TABLES
// ============================================================================

/**
 * Mild event descriptions and their effects.
 */
export const FORAGE_EVENTS_MILD = [
  {
    name: 'Animal Trail Discovered',
    description: 'Found a small animal trail leading to a patch.',
    effects: [
      {
        kind: 'next_roll_modifier' as const,
        value: 1,
        description: '+1 to next forage roll in this zone today',
      },
    ],
  },
  {
    name: 'Weather Shift',
    description: 'A sudden change in weather affects the area.',
    effects: [
      {
        kind: 'next_roll_modifier' as const,
        value: -1,
        description: '-1 to next forage roll in this zone today',
      },
    ],
  },
  {
    name: 'Pleasant Clearing',
    description: 'Discovered a pleasant clearing. Brief rest.',
    effects: [
      {
        kind: 'fp_loss' as const,
        value: -1,
        description: 'Recover 1 FP',
      },
    ],
  },
  {
    name: 'Foraging Competitor',
    description: 'Encountered another forager. Slim pickings nearby.',
    effects: [
      {
        kind: 'yield_multiplier' as const,
        value: -0.25,
        description: '-25% yield',
      },
    ],
  },
  {
    name: 'Bonus Patch',
    description: 'Stumbled upon an unexpectedly rich patch.',
    effects: [
      {
        kind: 'extra_units' as const,
        value: 2,
        description: '+2 bonus units',
      },
    ],
  },
  {
    name: 'Curious Wildlife',
    description: 'A small animal watches curiously. No danger.',
    effects: [],
  },
];

/**
 * Rare event descriptions and their effects.
 */
export const FORAGE_EVENTS_RARE = [
  {
    name: 'Pristine Grove',
    description: 'Discovered a pristine, untouched grove!',
    effects: [
      {
        kind: 'yield_multiplier' as const,
        value: 1.0,
        description: 'Double yield!',
      },
    ],
  },
  {
    name: 'Predator Territory',
    description: "Stumbled into a predator's territory!",
    effects: [
      {
        kind: 'hp_loss' as const,
        diceFormula: '1d-2',
        description: 'Take 1d-2 damage (fight or flee)',
      },
    ],
  },
  {
    name: 'Ancient Ruins',
    description: 'Found ancient ruins overgrown with rare herbs.',
    effects: [
      {
        kind: 'zone_tag_add' as const,
        tag: 'AncientRuins',
        description: 'Zone gains "AncientRuins" tag',
      },
    ],
  },
  {
    name: 'Magical Resonance',
    description: 'Detected a faint magical resonance in the flora.',
    effects: [
      {
        kind: 'next_roll_modifier' as const,
        value: 2,
        description: '+2 to alchemical ingredient foraging here',
      },
    ],
  },
  {
    name: 'Spirit Encounter',
    description: 'A nature spirit appears and offers guidance.',
    effects: [
      {
        kind: 'next_roll_modifier' as const,
        value: 3,
        description: '+3 to next forage roll',
      },
    ],
  },
  {
    name: 'Toxic Bloom',
    description:
      'A toxic bloom has spread through the area. Dangerous to breathe.',
    effects: [
      {
        kind: 'fp_loss' as const,
        value: 2,
        description: 'Lose 2 FP from toxic exposure',
      },
      {
        kind: 'status_effect' as const,
        statusName: 'Nauseated',
        description: 'Nauseated for 1 hour',
      },
    ],
  },
];

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default foraging configuration flags.
 */
export const DEFAULT_FORAGING_CONFIG: ForagingConfig = {
  failureGivesNothing: false,
  critSuccessMixedBasketEnabled: true,
  eventsEnabled: true,
  zoneDynamicsEnabled: false,
  useSeasonSystem: false,
};

// ============================================================================
// SKILL LABELS
// ============================================================================

/**
 * Display labels for foraging skills.
 */
export const FORAGE_SKILL_LABELS = {
  survival: 'Survival (Per)',
  naturalist: 'Naturalist (IQ)',
  herbLore: 'Herb Lore (IQ)',
} as const;
