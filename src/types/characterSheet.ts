/**
 * GCS Character Sheet Type Definitions
 * Extended character types for full GURPS Character Sheet support
 *
 * These types extend the base Character interface to support:
 * - Full primary and secondary attributes
 * - Advantages, Disadvantages, Perks, Quirks
 * - Skills with GURPS difficulty and relative skill levels
 * - Spells with full casting information
 * - Equipment with weight and cost
 * - Reactions and conditional modifiers
 * - Hit Location Profiles
 */

import type { Id } from './campaign';

// ============================================================================
// HIT LOCATION TYPES
// ============================================================================

export interface HitLocation {
  key: string;
  label: string;
  rollRange: number[];
  drKey: string;
  isVital: boolean;
  isLimb: boolean;
  isExtremity: boolean;
  toHitPenalty: number;
}

export interface HitLocationProfile {
  id: string;
  name: string;
  locations: HitLocation[];
}

// Available profile IDs
export const HIT_LOCATION_PROFILE_IDS = ['humanoid'] as const;
export type HitLocationProfileId = typeof HIT_LOCATION_PROFILE_IDS[number];

// Default profile for new characters
export const DEFAULT_HIT_LOCATION_PROFILE: HitLocationProfileId = 'humanoid';

// ============================================================================
// ATTRIBUTE TYPES
// ============================================================================

export interface PrimaryAttributes {
  ST: number;  // Strength
  DX: number;  // Dexterity
  IQ: number;  // Intelligence
  HT: number;  // Health
}

export interface PrimaryAttributePoints {
  ST: number;
  DX: number;
  IQ: number;
  HT: number;
}

export interface SecondaryAttribute {
  value: number;
  points: number;
}

export interface SecondaryAttributes {
  will: SecondaryAttribute;
  frightCheck: SecondaryAttribute;
  per: SecondaryAttribute;           // Perception
  vision: SecondaryAttribute;
  hearing: SecondaryAttribute;
  tasteSmell: SecondaryAttribute;
  touch: SecondaryAttribute;
  basicSpeed: SecondaryAttribute;
  basicMove: SecondaryAttribute;
}

export interface PointPool {
  current: number;
  max: number;
  points: number;
}

export interface PointPools {
  HP: PointPool;
  FP: PointPool;
}

// ============================================================================
// TRAIT TYPES (Advantages, Disadvantages, Perks, Quirks)
// ============================================================================

export interface Trait {
  id: Id;
  name: string;
  points: number;
  level?: number;           // For leveled advantages like "Increased DX 2"
  specialization?: string;  // For traits like "Bad Sight (Nearsighted)"
  notes?: string;
  reference?: string;       // e.g., "B43" for Basic Set page 43
}

export interface Advantage extends Trait {
  type: 'advantage';
}

export interface Disadvantage extends Trait {
  type: 'disadvantage';
}

export interface Perk extends Trait {
  type: 'perk';
}

export interface Quirk extends Trait {
  type: 'quirk';
}

export type AnyTrait = Advantage | Disadvantage | Perk | Quirk;

// ============================================================================
// SKILL TYPES
// ============================================================================

export type SkillDifficulty = 'E' | 'A' | 'H' | 'VH';
export type SkillAttribute = 'ST' | 'DX' | 'IQ' | 'HT' | 'Will' | 'Per';

export interface Skill {
  id: Id;
  name: string;
  specialization?: string;    // e.g., "Area Knowledge (Tuto; Lived there)"
  techLevel?: number;         // e.g., 3 for TL3
  attribute: SkillAttribute;
  relativeLevel: number;      // e.g., +1 for IQ+1, -2 for DX-2
  points: number;
  level: number;              // Final calculated level
  difficulty?: SkillDifficulty;
  notes?: string;
  reference?: string;
}

// ============================================================================
// SPELL TYPES
// ============================================================================

export type SpellClass =
  | 'Regular'
  | 'Missile'
  | 'Blocking'
  | 'Area'
  | 'Special'
  | 'Melee'
  | 'Info'
  | 'Info/Area'
  | 'Enchantment';

export interface Spell {
  id: Id;
  name: string;
  level: number;              // Skill level (e.g., 14)
  attribute: 'IQ';            // Spells are always IQ-based
  relativeLevel: number;      // e.g., +0 for IQ+0, -1 for IQ-1
  points: number;
  spellClass: SpellClass;
  castingCost: string;        // e.g., "2", "Varies", "1-4", "2/pt"
  maintenanceCost: string;    // e.g., "1", "Half", "-", "Same"
  castingTime: string;        // e.g., "1 sec", "10 sec"
  duration: string;           // e.g., "1 min", "Instant", "Permanent"
  college?: string;           // e.g., "Fire", "Healing"
  notes?: string;
  reference?: string;
}

// ============================================================================
// ENCUMBRANCE TYPES (GURPS B17)
// ============================================================================

/**
 * GURPS encumbrance levels (B17).
 * Each level has a weight threshold (multiple of Basic Lift) and
 * applies penalties to Move and Dodge.
 */
export type EncumbranceLevel = 0 | 1 | 2 | 3 | 4;

export interface EncumbranceLevelInfo {
  level: EncumbranceLevel;
  label: string;             // "None", "Light", "Medium", "Heavy", "X-Heavy"
  maxWeight: number;         // In lbs — threshold for this level
  movePenalty: number;       // Multiplier applied to Basic Move (1, 0.8, 0.6, 0.4, 0.2)
  dodgePenalty: number;      // Subtracted from Dodge (0, 1, 2, 3, 4)
}

export interface EncumbranceState {
  basicLift: number;         // ST×ST/5 in lbs
  carriedWeight: number;     // Total weight of equipped items
  level: EncumbranceLevel;
  adjustedMove: number;      // Basic Move × movePenalty, floored
  adjustedDodge: number;     // Dodge - dodgePenalty
  thresholds: EncumbranceLevelInfo[];
}

// ============================================================================
// EQUIPMENT TYPES
// ============================================================================

export type EquipmentCategory = 'weapon' | 'armor' | 'shield' | 'ammo' | 'general';

export interface Equipment {
  id: Id;
  name: string;
  quantity: number;
  weight: number;             // Weight per item in lbs
  cost: number;               // Cost per item in $
  equipped?: boolean;
  location?: string;          // e.g., "Belt", "Back", "Torso"
  category?: EquipmentCategory;
  notes?: string;
  reference?: string;

  // Weapon stats
  damage?: string;
  reach?: string;
  rangeHalf?: number;         // Half-damage range
  rangeFull?: number;         // Full-damage range

  // Armor stats
  dr?: number;                // Damage Resistance
  drLocations?: string[];     // Hit locations this armor covers, e.g. ["torso", "groin"]

  // Shield stats
  db?: number;                // Defense Bonus
}

// ============================================================================
// PER-LOCATION DR (derived from equipped armor)
// ============================================================================

export interface LocationDR {
  location: string;           // Hit location key, e.g. "torso", "skull"
  dr: number;                 // Total DR from all equipped armor covering this location
  sources: string[];          // Equipment names contributing DR
}

// ============================================================================
// SKILL ADVANCEMENT HISTORY
// ============================================================================

export interface SkillAdvancementEntry {
  id: Id;
  skillId: Id;               // References Skill.id
  skillName: string;         // Denormalized for history readability
  date: string;              // ISO date string (when the advancement was recorded)
  sessionLabel?: string;     // e.g., "Session 12", "Downtime after Arc 3"
  pointsAdded: number;       // Points spent in this advancement
  previousPoints: number;    // Points before advancement
  newPoints: number;         // Points after advancement
  previousLevel: number;     // Skill level before
  newLevel: number;          // Skill level after
  notes?: string;            // Optional GM notes
}

// ============================================================================
// PORTRAIT / TOKEN IMAGES
// ============================================================================

export interface CharacterImages {
  portrait?: string;         // Base64 data URL or relative path for character portrait
  token?: string;            // Base64 data URL or relative path for combat token (smaller, round)
}

// ============================================================================
// REACTION & MODIFIER TYPES
// ============================================================================

export interface Reaction {
  modifier: number;
  condition: string;          // e.g., "from others except your own kind"
}

export interface ConditionalModifier {
  modifier: number;
  condition: string;          // e.g., "to all melee attacks"
}

// ============================================================================
// FULL CHARACTER TYPE
// ============================================================================

export interface GCSCharacterData {
  // Identity
  totalPoints: number;

  // Primary Attributes
  attributes: PrimaryAttributes;
  attributePoints: PrimaryAttributePoints;

  // Secondary Attributes
  secondaryAttributes: SecondaryAttributes;

  // Point Pools
  pools: PointPools;

  // Reactions & Modifiers
  reactions: Reaction[];
  conditionalModifiers: ConditionalModifier[];

  // Traits
  advantages: Advantage[];
  perks: Perk[];
  disadvantages: Disadvantage[];
  quirks: Quirk[];

  // Skills
  skills: Skill[];

  // Spells
  spells: Spell[];

  // Equipment
  equipment: Equipment[];
  otherEquipment: string;

  // Skill Advancement History
  skillHistory?: SkillAdvancementEntry[];

  // Notes
  notes: string;
}

// ============================================================================
// NOTE: Character interface is in campaign.ts with optional gcsData field
// ============================================================================

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate derived attributes from primary attributes
 */
export function calculateDerivedAttributes(attrs: PrimaryAttributes): {
  basicSpeed: number;
  basicMove: number;
  dodge: number;
  basicLift: number;
  thrustDamage: string;
  swingDamage: string;
} {
  const basicSpeed = (attrs.DX + attrs.HT) / 4;
  const basicMove = Math.floor(basicSpeed);
  const dodge = Math.floor(basicSpeed) + 3;
  const basicLift = (attrs.ST * attrs.ST) / 5;

  return {
    basicSpeed,
    basicMove,
    dodge,
    basicLift,
    thrustDamage: calculateThrustDamage(attrs.ST),
    swingDamage: calculateSwingDamage(attrs.ST),
  };
}

/**
 * Calculate thrust damage from ST (GURPS B16)
 */
export function calculateThrustDamage(st: number): string {
  if (st <= 0) return '0';
  if (st <= 2) return '1d-6';
  if (st <= 4) return '1d-5';
  if (st <= 6) return '1d-4';
  if (st <= 8) return '1d-3';
  if (st <= 10) return '1d-2';
  if (st <= 12) return '1d-1';
  if (st <= 14) return '1d';
  if (st <= 16) return '1d+1';
  if (st <= 18) return '1d+2';
  if (st <= 20) return '2d-1';
  // Continue pattern for higher ST
  const extra = Math.floor((st - 20) / 2);
  return `2d+${extra}`;
}

/**
 * Calculate swing damage from ST (GURPS B16)
 */
export function calculateSwingDamage(st: number): string {
  if (st <= 0) return '0';
  if (st <= 2) return '1d-5';
  if (st <= 4) return '1d-4';
  if (st <= 6) return '1d-3';
  if (st <= 8) return '1d-2';
  if (st <= 10) return '1d';
  if (st <= 12) return '1d+1';
  if (st <= 14) return '2d-1';
  if (st <= 16) return '2d';
  if (st <= 18) return '2d+1';
  if (st <= 20) return '2d+2';
  // Continue pattern for higher ST
  const extra = Math.floor((st - 20) / 2);
  return `3d+${extra}`;
}

/**
 * Calculate skill level from attribute, difficulty, and points (GURPS B170).
 *
 * Point costs by difficulty:
 *   Easy:     1pt=+0, 2pt=+1, 4pt=+2, then +4pt per additional +1
 *   Average:  1pt=-1, 2pt=+0, 4pt=+1, 8pt=+2, then +4pt per additional +1
 *   Hard:     1pt=-2, 2pt=-1, 4pt=+0, 8pt=+1, then +4pt per additional +1
 *   VH:       1pt=-3, 2pt=-2, 4pt=-1, 8pt=+0, then +4pt per additional +1
 *
 * Returns the relative level (bonus/penalty from attribute).
 */
export function calculateRelativeLevel(
  difficulty: SkillDifficulty,
  points: number
): number {
  if (points <= 0) return -10; // Effectively "no skill"

  // Difficulty offset: E=0, A=-1, H=-2, VH=-3
  const diffOffset: Record<SkillDifficulty, number> = {
    'E': 0, 'A': -1, 'H': -2, 'VH': -3,
  };

  // Base relative level from points (before difficulty offset)
  // 1pt → Attr+0, 2pt → Attr+1, 4pt → Attr+2, then +4pt per +1
  let baseRelLevel: number;
  if (points < 2) {
    baseRelLevel = 0;
  } else if (points < 4) {
    baseRelLevel = 1;
  } else {
    // 4pt = +2, then every 4pt after = +1
    baseRelLevel = 2 + Math.floor((points - 4) / 4);
  }

  return diffOffset[difficulty] + baseRelLevel;
}

/**
 * Calculate skill level from attribute, difficulty, and points (GURPS B170).
 */
export function calculateSkillLevel(
  attributeValue: number,
  difficulty: SkillDifficulty,
  points: number
): number {
  return attributeValue + calculateRelativeLevel(difficulty, points);
}

/**
 * Calculate the cost in points for a given relative skill level and difficulty.
 * Inverse of calculateRelativeLevel. Returns minimum points needed.
 */
export function calculateSkillPointCost(
  difficulty: SkillDifficulty,
  relativeLevel: number
): number {
  const diffOffset: Record<SkillDifficulty, number> = {
    'E': 0, 'A': -1, 'H': -2, 'VH': -3,
  };

  // Remove difficulty offset to get base relative level
  const baseRelLevel = relativeLevel - diffOffset[difficulty];

  if (baseRelLevel <= 0) return 1;
  if (baseRelLevel === 1) return 2;
  // baseRelLevel >= 2: cost = 4 + (baseRelLevel - 2) × 4
  return 4 + (baseRelLevel - 2) * 4;
}

/**
 * Calculate total character points
 */
export function calculateTotalPoints(data: GCSCharacterData): number {
  let total = 0;

  // Attribute points (ST/HT = 10pts/level, DX/IQ = 20pts/level)
  total += data.attributePoints.ST;
  total += data.attributePoints.DX;
  total += data.attributePoints.IQ;
  total += data.attributePoints.HT;

  // Secondary attribute points
  total += data.secondaryAttributes.will.points;
  total += data.secondaryAttributes.per.points;
  total += data.secondaryAttributes.basicSpeed.points;
  total += data.secondaryAttributes.basicMove.points;

  // Pool points
  total += data.pools.HP.points;
  total += data.pools.FP.points;

  // Trait points
  total += data.advantages.reduce((sum, t) => sum + t.points, 0);
  total += data.perks.reduce((sum, t) => sum + t.points, 0);
  total += data.disadvantages.reduce((sum, t) => sum + t.points, 0);
  total += data.quirks.reduce((sum, t) => sum + t.points, 0);

  // Skill points
  total += data.skills.reduce((sum, s) => sum + s.points, 0);

  // Spell points
  total += data.spells.reduce((sum, s) => sum + s.points, 0);

  return total;
}

/**
 * Create default GCS character data
 */
export function createDefaultGCSData(): GCSCharacterData {
  return {
    totalPoints: 0,
    attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
    attributePoints: { ST: 0, DX: 0, IQ: 0, HT: 0 },
    secondaryAttributes: {
      will: { value: 10, points: 0 },
      frightCheck: { value: 10, points: 0 },
      per: { value: 10, points: 0 },
      vision: { value: 10, points: 0 },
      hearing: { value: 10, points: 0 },
      tasteSmell: { value: 10, points: 0 },
      touch: { value: 10, points: 0 },
      basicSpeed: { value: 5, points: 0 },
      basicMove: { value: 5, points: 0 },
    },
    pools: {
      HP: { current: 10, max: 10, points: 0 },
      FP: { current: 10, max: 10, points: 0 },
    },
    reactions: [],
    conditionalModifiers: [],
    advantages: [],
    perks: [],
    disadvantages: [],
    quirks: [],
    skills: [],
    spells: [],
    equipment: [],
    otherEquipment: '',
    notes: '',
  };
}

/**
 * Mapping from GURPS skill names to the lowercase activity-system keys
 * used by downtime activities (crafting, alchemy, fishing, foraging, cooking).
 *
 * When multiple GURPS skills map to the same activity key (e.g., "Smith" and
 * "Armoury" both map to "crafting"), the highest skill level wins.
 */
const GURPS_TO_ACTIVITY_KEY: Record<string, string> = {
  'Alchemy': 'alchemy',
  'Smith': 'crafting',
  'Armoury': 'crafting',
  'Engineer': 'designing',
  'Cooking': 'cooking',
  'Fishing': 'fishing',
  'Survival': 'survival',
  'Naturalist': 'naturalist',
  'Herb Lore': 'herbLore',
  'Spear': 'spear',
  'Stealth': 'stealth',
  'Physician': 'physician',
};

/**
 * Sync work.skills from gcsData.skills for activity compatibility
 * Note: This takes GCSCharacterData directly to avoid circular dependency with campaign.ts
 *
 * Produces two kinds of keys:
 * 1. Original GCS skill names (e.g., "Alchemy", "Smith (Iron)")
 * 2. Lowercase activity keys (e.g., "alchemy", "crafting") for downtime system lookups
 */
export function syncWorkSkillsFromGCS(gcsData: GCSCharacterData | undefined): Record<string, number> {
  if (!gcsData) {
    return {};
  }

  const workSkills: Record<string, number> = {};

  for (const skill of gcsData.skills) {
    // Use skill name (with specialization if present) as key
    const skillKey = skill.specialization
      ? `${skill.name} (${skill.specialization})`
      : skill.name;
    workSkills[skillKey] = skill.level;

    // Also add without specialization for easier lookup
    if (skill.specialization) {
      workSkills[skill.name] = skill.level;
    }
  }

  // Map known GURPS skill names to lowercase activity-system keys
  // so activities can look up skills.alchemy, skills.crafting, etc.
  for (const skill of gcsData.skills) {
    const activityKey = GURPS_TO_ACTIVITY_KEY[skill.name];
    if (activityKey) {
      // Take the higher value if multiple GURPS skills map to the same key
      workSkills[activityKey] = Math.max(workSkills[activityKey] ?? 0, skill.level);
    }
  }

  return workSkills;
}

// ============================================================================
// ACTIVITY SKILL UTILITIES
// ============================================================================

/** Activity types used in the downtime system */
export type DowntimeActivityId = 'fishing' | 'foraging' | 'mining' | 'alchemy' | 'crafting' | 'cooking';

/**
 * Mapping from activity ID to the skill keys that qualify a character for that activity.
 * If ANY character in the party has at least one of these skills, the activity is enabled.
 */
export const ACTIVITY_SKILL_REQUIREMENTS: Record<DowntimeActivityId, string[]> = {
  fishing: ['fishing', 'spear'],
  foraging: ['survival', 'naturalist', 'herbLore'],
  mining: ['prospecting', 'geology', 'engineerMining', 'mining'],
  alchemy: ['alchemy'],
  crafting: ['crafting', 'designing'],
  cooking: ['cooking'],
};

/**
 * Merge all skill sources for a character into a single Record.
 * Combines GCS-derived skills, work.skills, and direct character.skills.
 * Later sources override earlier ones for the same key.
 */
export function getCharacterSkills(character: any): Record<string, number> {
  const gcsSkills = character.gcsData ? syncWorkSkillsFromGCS(character.gcsData) : {};
  const workSkills = character.work?.skills || {};
  const directSkills = character.skills && typeof character.skills === 'object' ? character.skills : {};
  return { ...gcsSkills, ...workSkills, ...directSkills };
}

/**
 * Check if a character has at least one of the required skills with level > 0.
 */
export function characterHasAnySkill(character: any, requiredSkills: string[]): boolean {
  const skills = getCharacterSkills(character);
  return requiredSkills.some(sk => skills[sk] !== undefined && skills[sk] > 0);
}
