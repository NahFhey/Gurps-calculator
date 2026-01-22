/**
 * Injury Engine
 * Coordinates damage resolution pipeline: raw → DR → penetrating → wounding → injury
 */

import { getLocationDR } from './hitLocations';
import { calculateInjury, getWoundingMultiplier } from './wounding';

/**
 * Apply damage resolution pipeline
 * @param {Object} params - Damage parameters
 * @returns {Object} Complete injury breakdown
 */
export function resolveInjury({
  rawDamage,
  damageType,
  location,
  target,
  combatRulesPreset = 'standard'
}) {
  // Step 1: Get DR for location
  const locationDR = location ? getLocationDR(target, location.key) : (target.dr || 0);

  // Step 2: Calculate penetrating damage
  const penetrating = Math.max(0, rawDamage - locationDR);

  // Step 3: Get wounding multiplier (only if not 'lite' preset)
  let woundingMultiplier = 1;
  let injury = penetrating;

  if (combatRulesPreset !== 'lite') {
    woundingMultiplier = getWoundingMultiplier(damageType, location);
    injury = calculateInjury(penetrating, damageType, location);
  } else {
    // Lite mode: no wounding multipliers
    injury = penetrating;
  }

  // Step 4: Build result
  return {
    rawDamage,
    damageType,
    locationDR,
    penetrating,
    woundingMultiplier,
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
 * @param {Object} injuryResult - Result from resolveInjury
 * @returns {Object} Structured breakdown for log entry
 */
export function createInjuryBreakdown(injuryResult) {
  return {
    raw: injuryResult.rawDamage,
    dr: injuryResult.locationDR,
    penetrating: injuryResult.penetrating,
    damageType: injuryResult.damageType,
    woundingMultiplier: injuryResult.woundingMultiplier,
    injuryApplied: injuryResult.injury
  };
}

/**
 * Generate hit location data for logging
 * @param {string} profileId - Hit location profile ID
 * @param {Object} location - Location object
 * @param {Object} rollData - Optional roll data if location was rolled
 * @returns {Object} Hit location log data
 */
export function createHitLocationLog(profileId, location, rollData = null) {
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
 * @param {number} currentHP - Current HP
 * @param {number} injury - Injury amount (positive for damage)
 * @returns {number} New HP value
 */
export function applyInjuryToHP(currentHP, injury) {
  return currentHP - injury;
}

/**
 * Format injury summary for display
 * @param {Object} injuryResult - Result from resolveInjury
 * @returns {string} Human-readable summary
 */
export function formatInjurySummary(injuryResult) {
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
