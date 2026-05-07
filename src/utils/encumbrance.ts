/**
 * GURPS Encumbrance Calculation Utilities (B17, B19)
 *
 * Encumbrance in GURPS is based on Basic Lift (BL = ST×ST/5).
 * Five levels based on carried weight relative to BL:
 *   Level 0 (None):    up to BL          → Move ×1.0, Dodge -0
 *   Level 1 (Light):   up to 2×BL        → Move ×0.8, Dodge -1
 *   Level 2 (Medium):  up to 3×BL        → Move ×0.6, Dodge -2
 *   Level 3 (Heavy):   up to 6×BL        → Move ×0.4, Dodge -3
 *   Level 4 (X-Heavy): up to 10×BL       → Move ×0.2, Dodge -4
 *
 * Carried weight above 10×BL means the character cannot move.
 */

import type {
  EncumbranceLevel,
  EncumbranceLevelInfo,
  EncumbranceState,
  Equipment,
  LocationDR,
  PrimaryAttributes,
  SecondaryAttributes,
} from '../types/characterSheet';

// ============================================================================
// CONSTANTS
// ============================================================================

/** BL multipliers for each encumbrance level (GURPS B17) */
const BL_MULTIPLIERS: readonly number[] = [1, 2, 3, 6, 10];

/** Labels for each encumbrance level */
const LEVEL_LABELS: readonly string[] = ['None', 'Light', 'Medium', 'Heavy', 'X-Heavy'];

/** Move multipliers for each encumbrance level */
const MOVE_MULTIPLIERS: readonly number[] = [1.0, 0.8, 0.6, 0.4, 0.2];

/** Dodge penalties for each encumbrance level */
const DODGE_PENALTIES: readonly number[] = [0, 1, 2, 3, 4];

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate Basic Lift from ST (GURPS B17).
 * BL = ST×ST / 5, rounded to nearest whole number.
 * Minimum BL is 0.
 */
export function calculateBasicLift(st: number): number {
  if (st <= 0) return 0;
  return Math.round((st * st) / 5);
}

/**
 * Get the encumbrance thresholds for a given Basic Lift.
 */
export function getEncumbranceThresholds(basicLift: number): EncumbranceLevelInfo[] {
  return [0, 1, 2, 3, 4].map((level) => ({
    level: level as EncumbranceLevel,
    label: LEVEL_LABELS[level],
    maxWeight: Math.round(basicLift * BL_MULTIPLIERS[level] * 10) / 10,
    movePenalty: MOVE_MULTIPLIERS[level],
    dodgePenalty: DODGE_PENALTIES[level],
  }));
}

/**
 * Determine encumbrance level from carried weight and Basic Lift.
 */
export function getEncumbranceLevel(carriedWeight: number, basicLift: number): EncumbranceLevel {
  if (basicLift <= 0) return 4;
  const ratio = carriedWeight / basicLift;
  if (ratio <= 1) return 0;
  if (ratio <= 2) return 1;
  if (ratio <= 3) return 2;
  if (ratio <= 6) return 3;
  return 4;
}

/**
 * Calculate total carried weight from equipped items only.
 */
export function calculateCarriedWeight(equipment: Equipment[]): number {
  return equipment
    .filter((item) => item.equipped !== false) // Default to equipped if not set
    .reduce((total, item) => total + item.weight * item.quantity, 0);
}

/**
 * Calculate full encumbrance state for a character.
 *
 * @param st - Character's ST
 * @param basicMove - Character's Basic Move (from secondary attributes)
 * @param dodge - Character's Dodge (typically floor(Basic Speed) + 3)
 * @param equipment - Character's equipment list
 */
export function calculateEncumbrance(
  st: number,
  basicMove: number,
  dodge: number,
  equipment: Equipment[]
): EncumbranceState {
  const basicLift = calculateBasicLift(st);
  const carriedWeight = calculateCarriedWeight(equipment);
  const level = getEncumbranceLevel(carriedWeight, basicLift);
  const thresholds = getEncumbranceThresholds(basicLift);

  const adjustedMove = Math.max(1, Math.floor(basicMove * MOVE_MULTIPLIERS[level]));
  const adjustedDodge = Math.max(1, dodge - DODGE_PENALTIES[level]);

  return {
    basicLift,
    carriedWeight: Math.round(carriedWeight * 10) / 10,
    level,
    adjustedMove,
    adjustedDodge,
    thresholds,
  };
}

// ============================================================================
// PER-LOCATION DR
// ============================================================================

/**
 * Calculate per-location DR from equipped armor items.
 * An armor item contributes its DR to each location in its drLocations array.
 * If drLocations is empty/undefined, falls back to the item's `location` field.
 * Multiple armor pieces on the same location stack their DR.
 */
export function calculateLocationDR(equipment: Equipment[]): LocationDR[] {
  const drMap = new Map<string, { dr: number; sources: string[] }>();

  for (const item of equipment) {
    // Only equipped armor/shields with DR contribute
    if (item.equipped === false) continue;
    if (item.dr === undefined || item.dr <= 0) continue;

    const locations = item.drLocations?.length
      ? item.drLocations
      : item.location
        ? [item.location.toLowerCase()]
        : [];

    for (const loc of locations) {
      const key = loc.toLowerCase();
      const existing = drMap.get(key);
      if (existing) {
        existing.dr += item.dr;
        existing.sources.push(item.name);
      } else {
        drMap.set(key, { dr: item.dr, sources: [item.name] });
      }
    }
  }

  return Array.from(drMap.entries())
    .map(([location, data]) => ({
      location,
      dr: data.dr,
      sources: data.sources,
    }))
    .sort((a, b) => a.location.localeCompare(b.location));
}

// ============================================================================
// CONVENIENCE: Full encumbrance from character data
// ============================================================================

/**
 * Calculate encumbrance from GCS character data.
 * Pulls ST, Basic Move, and Dodge from the character's attributes.
 */
export function calculateCharacterEncumbrance(
  attributes: PrimaryAttributes,
  secondaryAttributes: SecondaryAttributes,
  equipment: Equipment[]
): EncumbranceState {
  const basicMove = secondaryAttributes.basicMove.value;
  // Dodge = floor(Basic Speed) + 3
  const dodge = Math.floor(secondaryAttributes.basicSpeed.value) + 3;

  return calculateEncumbrance(attributes.ST, basicMove, dodge, equipment);
}
