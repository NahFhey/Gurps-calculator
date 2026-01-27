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
// EQUIPMENT TYPES
// ============================================================================

export interface Equipment {
  id: Id;
  name: string;
  quantity: number;
  weight: number;             // Weight per item in lbs
  cost: number;               // Cost per item in $
  equipped?: boolean;
  location?: string;          // e.g., "Belt", "Back", "Torso"
  notes?: string;
  reference?: string;

  // Optional weapon/armor stats
  damage?: string;
  dr?: number;
  reach?: string;
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
 * Calculate skill level from attribute, difficulty, and points
 */
export function calculateSkillLevel(
  attributeValue: number,
  difficulty: SkillDifficulty,
  points: number
): number {
  // Difficulty offsets: E=0, A=-1, H=-2, VH=-3
  const difficultyOffset: Record<SkillDifficulty, number> = {
    'E': 0,
    'A': -1,
    'H': -2,
    'VH': -3,
  };

  // Points to relative level: 1=0, 2=+1, 4=+2, 8=+3, etc.
  let relativeLevel = 0;
  if (points >= 1) relativeLevel = 0;
  if (points >= 2) relativeLevel = 1;
  if (points >= 4) relativeLevel = 2;
  if (points >= 8) relativeLevel = 3;
  if (points >= 12) relativeLevel = 4;
  if (points >= 16) relativeLevel = 5;
  if (points >= 20) relativeLevel = 6;
  if (points >= 24) relativeLevel = 7;
  if (points >= 28) relativeLevel = 8;

  return attributeValue + difficultyOffset[difficulty] + relativeLevel;
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
 * Sync work.skills from gcsData.skills for activity compatibility
 * Note: This takes GCSCharacterData directly to avoid circular dependency with campaign.ts
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

  return workSkills;
}
