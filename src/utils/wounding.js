/**
 * Wounding System
 * Handles damage types and wounding multipliers based on location and damage type
 */

/**
 * Damage types supported
 */
export const DAMAGE_TYPES = {
  CR: 'cr',        // Crushing
  CUT: 'cut',      // Cutting
  IMP: 'imp',      // Impaling
  PI_MINUS: 'pi-', // Small piercing
  PI: 'pi',        // Piercing
  PI_PLUS: 'pi+',  // Large piercing
  PI_PLUSPLUS: 'pi++', // Huge piercing
  BURN: 'burn',    // Burning
  TOX: 'tox',      // Toxic
  COR: 'cor',      // Corrosion
  FAT: 'fat'       // Fatigue
};

/**
 * Damage type display labels
 */
export const DAMAGE_TYPE_LABELS = {
  [DAMAGE_TYPES.CR]: 'Crushing',
  [DAMAGE_TYPES.CUT]: 'Cutting',
  [DAMAGE_TYPES.IMP]: 'Impaling',
  [DAMAGE_TYPES.PI_MINUS]: 'Small Piercing',
  [DAMAGE_TYPES.PI]: 'Piercing',
  [DAMAGE_TYPES.PI_PLUS]: 'Large Piercing',
  [DAMAGE_TYPES.PI_PLUSPLUS]: 'Huge Piercing',
  [DAMAGE_TYPES.BURN]: 'Burning',
  [DAMAGE_TYPES.TOX]: 'Toxic',
  [DAMAGE_TYPES.COR]: 'Corrosion',
  [DAMAGE_TYPES.FAT]: 'Fatigue'
};

/**
 * Base wounding multipliers by damage type
 * These are the default multipliers before location modifiers
 */
const BASE_WOUNDING_MULTIPLIERS = {
  [DAMAGE_TYPES.CR]: 1,
  [DAMAGE_TYPES.CUT]: 1.5,
  [DAMAGE_TYPES.IMP]: 2,
  [DAMAGE_TYPES.PI_MINUS]: 0.5,
  [DAMAGE_TYPES.PI]: 1,
  [DAMAGE_TYPES.PI_PLUS]: 1.5,
  [DAMAGE_TYPES.PI_PLUSPLUS]: 2,
  [DAMAGE_TYPES.BURN]: 1,
  [DAMAGE_TYPES.TOX]: 1,
  [DAMAGE_TYPES.COR]: 1,
  [DAMAGE_TYPES.FAT]: 1
};

/**
 * Get base wounding multiplier for damage type
 * @param {string} damageType
 * @returns {number}
 */
export function getBaseWoundingMultiplier(damageType) {
  return BASE_WOUNDING_MULTIPLIERS[damageType] || 1;
}

/**
 * Get wounding multiplier for damage type and location
 * @param {string} damageType - Damage type (e.g., 'cr', 'cut', 'imp')
 * @param {Object} location - Location object with flags (isVital, isExtremity, etc.)
 * @returns {number} Wounding multiplier
 */
export function getWoundingMultiplier(damageType, location) {
  const baseMultiplier = BASE_WOUNDING_MULTIPLIERS[damageType] || 1;

  // Special cases for location modifiers

  // Skull: impaling/piercing becomes x4, crushing x2
  if (location && location.key === 'skull') {
    if (damageType === DAMAGE_TYPES.IMP ||
        damageType === DAMAGE_TYPES.PI_PLUSPLUS ||
        damageType === DAMAGE_TYPES.PI_PLUS) {
      return 4;
    }
    if (damageType === DAMAGE_TYPES.PI) {
      return 3;
    }
    if (damageType === DAMAGE_TYPES.CR) {
      return 2;
    }
  }

  // Face: same as skull for impaling
  if (location && location.key === 'face') {
    if (damageType === DAMAGE_TYPES.IMP ||
        damageType === DAMAGE_TYPES.PI_PLUSPLUS ||
        damageType === DAMAGE_TYPES.PI_PLUS) {
      return 4;
    }
    if (damageType === DAMAGE_TYPES.PI) {
      return 3;
    }
  }

  // Neck/Vitals: impaling/piercing gets x2 (brain/vitals)
  if (location && location.key === 'neck') {
    if (damageType === DAMAGE_TYPES.IMP ||
        damageType === DAMAGE_TYPES.PI_PLUSPLUS ||
        damageType === DAMAGE_TYPES.PI_PLUS) {
      return 3;
    }
    if (damageType === DAMAGE_TYPES.CUT) {
      return 2;
    }
  }

  // Vitals (torso hit to vitals): x3 for imp/pi++, x2 for pi+/pi
  if (location && location.isVital && location.key === 'torso') {
    // Not implemented in Phase 4 - torso doesn't have isVital flag
    // Reserved for future called shots to vitals
  }

  // Extremities: Impaling and piercing do not get multipliers
  if (location && location.isExtremity) {
    if (damageType === DAMAGE_TYPES.IMP ||
        damageType === DAMAGE_TYPES.PI_PLUSPLUS ||
        damageType === DAMAGE_TYPES.PI_PLUS ||
        damageType === DAMAGE_TYPES.PI) {
      return 1;
    }
  }

  // Default to base multiplier
  return baseMultiplier;
}

/**
 * Calculate injury from penetrating damage
 * @param {number} penetrating - Penetrating damage (after DR)
 * @param {string} damageType - Damage type
 * @param {Object} location - Location object
 * @returns {number} Injury applied to HP
 */
export function calculateInjury(penetrating, damageType, location) {
  if (penetrating <= 0) return 0;

  const multiplier = getWoundingMultiplier(damageType, location);
  return Math.floor(penetrating * multiplier);
}

/**
 * Get all damage types as options for UI
 * @returns {Array} Array of {value, label} objects
 */
export function getDamageTypeOptions() {
  return Object.entries(DAMAGE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label
  }));
}

/**
 * Validate damage type
 * @param {string} damageType - Damage type to validate
 * @returns {boolean} True if valid
 */
export function isValidDamageType(damageType) {
  return Object.values(DAMAGE_TYPES).includes(damageType);
}
