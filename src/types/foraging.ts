/**
 * Foraging System Types
 *
 * Type definitions for the revamped foraging system with three modes:
 * - General: No target, system selects from zone weights
 * - Category: Target a category (e.g., Mushrooms, Herbs)
 * - Specific: Target a specific item with rarity penalties
 */

// ============================================================================
// ENUMS / LITERALS
// ============================================================================

/** Foraging mode determines what the worker is looking for */
export type ForageMode = 'general' | 'category' | 'specific';

/** Item rarity tiers with increasing difficulty to find */
export type ForageTier = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';

/** Forageable item categories */
export type ForageCategoryId =
  | 'fruits'
  | 'vegetables'
  | 'grains'
  | 'mushrooms'
  | 'herbs_spices'
  | 'seeds_nuts'
  | 'fibrous_plants'
  | 'strong_fibers'
  | 'rare_fibers'
  | 'alchemical_ingredients';

/** Tier outcome including failure states */
export type TierOutcome = ForageTier | 'scraps' | 'nothing';

/** Critical state of a roll */
export type CritState = 'none' | 'critical_success' | 'critical_failure';

/** Event severity levels */
export type EventSeverity = 'none' | 'mild' | 'rare';

/** Skill types usable for foraging */
export type ForageSkill = 'survival' | 'naturalist' | 'herbLore';

// ============================================================================
// ZONE PROFILE
// ============================================================================

/** A category with a weight for random selection (legacy format) */
export interface WeightedCategory {
  categoryId: ForageCategoryId;
  weight: number;
}

/** A reference to a specific item from the Items tab with a weight for selection */
export interface WeightedItem {
  /** References GatheringItemExtended.id from the Items tab */
  itemId: string;
  /** Weight for random selection within the category */
  weight: number;
}

/** A category within a zone tier, containing weighted item references */
export interface ZoneTierCategory {
  categoryId: ForageCategoryId;
  /** Weight for selecting this category within the tier */
  weight: number;
  /** Specific items from the Items tab with per-item weights */
  items: WeightedItem[];
}

/**
 * Defines what can be found in a zone and with what likelihood.
 * Linked to a GatheringEnvironment via environmentId.
 * Categories contain weighted references to items from the Items tab.
 */
export interface ForageZoneProfile {
  id: string;
  name: string;
  /** Links to Location id from location system */
  locationId?: string;
  /** Links to GatheringEnvironmentExtended.id */
  environmentId?: string;
  /** Categories available at common tier with weights and per-item lists */
  commonCategories: ZoneTierCategory[];
  /** Categories available at uncommon tier with weights and per-item lists */
  uncommonCategories: ZoneTierCategory[];
  /** Categories available at rare tier with weights and per-item lists */
  rareCategories: ZoneTierCategory[];
  /** Tags for modifier/event lookups (e.g., "MistyBasin", "OldGrowth", "Coastal") */
  tags: string[];
  /** Current season for seasonal item filtering */
  currentSeason?: string;
}

// ============================================================================
// FORAGE ITEM
// ============================================================================

/**
 * A specific forageable item grouped by tier and category.
 * Items can be restricted to certain zones, tags, or seasons.
 */
export interface ForageItem {
  id: string;
  name: string;
  categoryId: ForageCategoryId;
  tier: ForageTier;
  /** Dice formula for base yield (e.g., "2d+1") */
  yieldFormula: string;
  /** Destination in inventory system */
  inventoryKind: 'food' | 'material';
  /** Food type or material type name for inventory integration */
  typeId: string;
  /** Only available in these zone IDs (empty = all zones) */
  zoneRestrictions?: string[];
  /** Only available in zones with these tags */
  tagRestrictions?: string[];
  /** Only available in these seasons */
  seasonRestrictions?: string[];
  /** Flavor text */
  description?: string;
}

// ============================================================================
// CATEGORY METADATA
// ============================================================================

/** Static metadata for a forage category */
export interface ForageCategoryMeta {
  id: ForageCategoryId;
  label: string;
  inventoryKind: 'food' | 'material';
  /** Default yield formula when no item-specific formula exists */
  defaultYieldFormula: string;
}

// ============================================================================
// ACTION INPUT
// ============================================================================

/** Context flags affecting skill modifiers */
export interface ForageContextFlags {
  hasMapOrGuide: boolean;
  isUnfamiliarOrHostile: boolean;
  isPeakSeason: boolean;
  isOffSeason: boolean;
  hasProperTools: boolean;
  isDenseOrDangerousTerrain: boolean;
}

/**
 * Input to the foraging resolution engine.
 * Captures all information needed to resolve a single forage action.
 */
export interface ForageActionInput {
  actorId: string;
  zoneId: string;
  mode: ForageMode;
  targetCategory?: ForageCategoryId;
  targetItemId?: string;
  skillUsed: ForageSkill;
  baseSkillLevel: number;
  contextFlags: ForageContextFlags;
  toolIds: string[];
  helperCount: number;
  /** Whether supervisor (skill 15+) is present */
  supervisorSkill15Plus: boolean;
  /** Pre-computed tool skill bonus */
  toolSkillBonus: number;
  /** Pre-computed tool yield bonus (extra dice) */
  toolYieldBonus: number;
  /** Weather gathering modifier */
  weatherModifier: number;
}

// ============================================================================
// ACTION RESULT
// ============================================================================

/** A stack of found items */
export interface FoundStack {
  itemId: string;
  itemName: string;
  categoryId: ForageCategoryId;
  quantity: number;
  quality: 'normal' | 'high';
  inventoryKind: 'food' | 'material';
  typeId: string;
}

/** A single effect from a foraging event */
export interface ForageEventEffect {
  kind:
    | 'yield_multiplier'
    | 'extra_units'
    | 'status_effect'
    | 'fp_loss'
    | 'hp_loss'
    | 'zone_tag_add'
    | 'zone_tag_remove'
    | 'next_roll_modifier';
  value?: number;
  diceFormula?: string;
  tag?: string;
  statusName?: string;
  description: string;
}

/** Result of an event check */
export interface ForageEvent {
  severity: EventSeverity;
  name: string;
  effects: ForageEventEffect[];
  notes?: string;
}

/** Applied modifier for display in the log */
export interface AppliedModifier {
  label: string;
  value: number;
}

/** Complete result of a forage action */
export interface ForageActionResult {
  actorId: string;
  zoneId: string;
  mode: ForageMode;
  roll: {
    total: number;
    margin: number;
    crit: CritState;
    modifiersApplied: AppliedModifier[];
  };
  tierOutcome: TierOutcome;
  found: FoundStack[];
  event?: ForageEvent;
  logText: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Configuration flags for the foraging system */
export interface ForagingConfig {
  /** If true, failure gives nothing instead of scraps */
  failureGivesNothing: boolean;
  /** If true, critical success can yield a mixed basket (two items) */
  critSuccessMixedBasketEnabled: boolean;
  /** If true, events are checked during resolution */
  eventsEnabled: boolean;
  /** If true, zone tags can change dynamically from events */
  zoneDynamicsEnabled: boolean;
  /** If true, season filtering is applied to items */
  useSeasonSystem: boolean;
}
