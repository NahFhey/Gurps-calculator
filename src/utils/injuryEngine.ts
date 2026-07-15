/**
 * Injury Engine
 * Coordinates damage resolution pipeline: raw → DR → penetrating → wounding → injury
 */

import { getLocationDR } from './hitLocations';
import { calculateInjury, getWoundingMultiplier, getBaseWoundingMultiplier } from './wounding';
import type { HitLocation } from './wounding';

export interface InjuryTarget {
  dr?: number;
  drByLocation?: Record<string, number>;
}

export interface ResolveInjuryParams {
  rawDamage: number;
  damageType: string;
  location: HitLocation | null;
  target: InjuryTarget;
  combatRulesPreset?: string;
}

export interface InjuryResolution {
  rawDamage: number;
  damageType: string;
  locationDR: number;
  penetrating: number;
  woundingMultiplier: number;
  baseWoundingMultiplier: number;
  locationWoundingMultiplier: number;
  injury: number;
  location: {
    key: string;
    label: string;
    isVital: boolean;
    isLimb: boolean;
    isExtremity: boolean;
  } | null;
}

export interface InjuryBreakdown {
  raw: number;
  dr: number;
  penetrating: number;
  damageType: string;
  woundingMultiplier: number;
  baseWoundingMultiplier: number;
  locationWoundingMultiplier: number;
  locationLabel: string | null;
  injuryApplied: number;
}

export interface HitLocationRollData {
  dice: number[];
  total: number;
}

export interface HitLocationLogData {
  profileId: string;
  locationKey: string;
  locationLabel: string;
  rolled: { dice: number[]; total: number } | null;
}

/**
 * Apply damage resolution pipeline
 */
export function resolveInjury({
  rawDamage,
  damageType,
  location,
  target,
  combatRulesPreset = 'standard'
}: ResolveInjuryParams): InjuryResolution {
  // Step 1: Get DR for location
  const locationDR = location ? getLocationDR(target, location.key) : (target.dr || 0);

  // Step 2: Calculate penetrating damage
  const penetrating = Math.max(0, rawDamage - locationDR);

  // Step 3: Get wounding multiplier (only if not 'lite' preset)
  let woundingMultiplier = 1;
  let baseWoundingMultiplier = getBaseWoundingMultiplier(damageType);
  let locationWoundingMultiplier = 1;
  let injury = penetrating;

  if (combatRulesPreset !== 'lite') {
    woundingMultiplier = getWoundingMultiplier(damageType, location);
    locationWoundingMultiplier = baseWoundingMultiplier ? woundingMultiplier / baseWoundingMultiplier : woundingMultiplier;
    injury = calculateInjury(penetrating, damageType, location);
  } else {
    // Lite mode: no wounding multipliers
    baseWoundingMultiplier = 1;
    locationWoundingMultiplier = 1;
    injury = penetrating;
  }

  // Step 4: Build result
  return {
    rawDamage,
    damageType,
    locationDR,
    penetrating,
    woundingMultiplier,
    baseWoundingMultiplier,
    locationWoundingMultiplier,
    injury,
    location: location ? {
      key: location.key,
      label: location.label,
      isVital: location.isVital || false,
      isLimb: location.isLimb || false,
      isExtremity: location.isExtremity || false
    } : null
  };
}

/**
 * Generate injury breakdown for logging
 */
export function createInjuryBreakdown(injuryResult: InjuryResolution): InjuryBreakdown {
  return {
    raw: injuryResult.rawDamage,
    dr: injuryResult.locationDR,
    penetrating: injuryResult.penetrating,
    damageType: injuryResult.damageType,
    woundingMultiplier: injuryResult.woundingMultiplier,
    baseWoundingMultiplier: injuryResult.baseWoundingMultiplier,
    locationWoundingMultiplier: injuryResult.locationWoundingMultiplier,
    locationLabel: injuryResult.location?.label || null,
    injuryApplied: injuryResult.injury
  };
}

/**
 * Generate hit location data for logging
 */
export function createHitLocationLog(
  profileId: string,
  location: HitLocation,
  rollData: HitLocationRollData | null = null
): HitLocationLogData {
  return {
    profileId,
    locationKey: location.key,
    locationLabel: location.label,
    rolled: rollData ? {
      dice: rollData.dice,
      total: rollData.total
    } : null
  };
}

/**
 * Calculate new HP after injury
 */
export function applyInjuryToHP(currentHP: number, injury: number): number {
  return currentHP - injury;
}

/**
 * Format injury summary for display
 */
export function formatInjurySummary(injuryResult: InjuryResolution): string {
  const { rawDamage, locationDR, penetrating, woundingMultiplier, injury, location } = injuryResult;

  let summary = `${rawDamage} damage`;

  if (location) {
    summary += ` to ${location.label}`;
  }

  if (locationDR > 0) {
    summary += ` (- ${locationDR} DR)`;
  }

  summary += ` = ${penetrating} penetrating`;

  if (woundingMultiplier !== 1) {
    summary += ` × ${woundingMultiplier}`;
  }

  summary += ` = ${injury} injury`;

  return summary;
}
