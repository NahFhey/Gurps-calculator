/**
 * Modifier utilities for Combat Runner Phase 3
 * Handles modifier stacks, summation, and common preset modifiers
 */

/**
 * Sum modifier values
 * @param {Array<{label: string, value: number}>} modifiers - Array of modifier objects
 * @returns {number} Total modifier value
 */
export function sumModifiers(modifiers) {
  if (!Array.isArray(modifiers)) {
    return 0;
  }

  return modifiers.reduce((sum, mod) => {
    const value = typeof mod.value === 'number' ? mod.value : 0;
    return sum + value;
  }, 0);
}

/**
 * Calculate effective value with modifiers
 * @param {number} base - Base value
 * @param {Array<{label: string, value: number}>} modifiers - Array of modifier objects
 * @returns {number} Effective value (base + modifiers)
 */
export function calculateEffective(base, modifiers) {
  const baseValue = typeof base === 'number' ? base : 0;
  return baseValue + sumModifiers(modifiers);
}

/**
 * Common attack modifiers for GURPS
 * These are presets that can be quickly added to the modifier stack
 */
export const ATTACK_MODIFIERS = {
  // All-Out Attack
  AOA_DETERMINED_MELEE: { label: 'All-Out Attack (Determined, melee)', value: 4, requireInput: false },
  AOA_DETERMINED_RANGED: { label: 'All-Out Attack (Determined, ranged)', value: 1, requireInput: false },

  // Deceptive Attack
  DECEPTIVE_ATTACK: { label: 'Deceptive Attack', value: null, requireInput: true, placeholder: 'Penalty (-2, -4, etc.)' },

  // Range modifiers (ranged attacks)
  RANGE_PENALTY: { label: 'Range penalty', value: null, requireInput: true, placeholder: 'Enter penalty' },

  // Size modifier
  SIZE_MODIFIER: { label: 'Target Size Modifier (SM)', value: null, requireInput: true, placeholder: 'Enter SM' },

  // Visibility/Concealment
  TOTAL_DARKNESS: { label: 'Total darkness / invisible target', value: -10, requireInput: false },
  CANT_SEE_FOE: { label: "Can't see foe", value: -6, requireInput: false },
  PARTIAL_DARKNESS: { label: 'Partial darkness / fog / smoke', value: null, requireInput: true, placeholder: 'Enter -1 to -9' },
  LIGHT_CONCEALMENT: { label: 'Light concealment (bushes, etc.)', value: -2, requireInput: false },

  // Aim
  AIM_1: { label: 'Aim (1 turn)', value: 1, requireInput: false },
  AIM_2: { label: 'Aim (2 turns)', value: 2, requireInput: false },
  AIM_3: { label: 'Aim (3+ turns)', value: 3, requireInput: false },

  // Posture
  POSTURE_KNEELING: { label: 'Kneeling/Sitting', value: -2, requireInput: false },
  POSTURE_CRAWLING: { label: 'Crawling/Lying', value: -4, requireInput: false },

  // Other common modifiers
  RAPID_FIRE: { label: 'Rapid Fire', value: null, requireInput: true, placeholder: 'Enter RoF bonus' },
  BRACED: { label: 'Braced', value: 1, requireInput: false },
  CUSTOM: { label: 'Custom', value: null, requireInput: true, placeholder: 'Enter modifier value' }
};

/**
 * Common defense modifiers for GURPS
 */
export const DEFENSE_MODIFIERS = {
  // All-Out Defense
  AOD_INCREASED: { label: 'All-Out Defense (Increased)', value: 2, requireInput: false },

  // Retreat
  RETREAT_DODGE: { label: 'Retreat (Dodge)', value: 3, requireInput: false },
  RETREAT_PARRY_BLOCK: { label: 'Retreat (Parry/Block)', value: 1, requireInput: false },

  // Dodge and Drop (vs ranged)
  DODGE_AND_DROP: { label: 'Dodge and Drop (vs ranged)', value: 3, requireInput: false },

  // Status effects
  STUNNED: { label: 'Stunned', value: -4, requireInput: false },
  CANT_SEE_ATTACKER: { label: "Can't see attacker", value: -4, requireInput: false },

  // Posture
  POSTURE_KNEELING: { label: 'Kneeling/Sitting', value: -2, requireInput: false },
  POSTURE_CRAWLING: { label: 'Crawling/Lying', value: -3, requireInput: false },

  // Multiple defenses
  EXTRA_PARRY_2: { label: 'Extra Parry #2', value: -4, requireInput: false },
  EXTRA_PARRY_3: { label: 'Extra Parry #3', value: -4, requireInput: false },
  EXTRA_PARRY_4: { label: 'Extra Parry #4', value: -4, requireInput: false },

  // Off-hand
  OFF_HAND_PARRY: { label: 'Off-hand parry', value: -2, requireInput: false },

  // Shield
  SHIELD_DB: { label: 'Shield DB', value: null, requireInput: true, placeholder: 'Enter DB (1-3)' },

  // Deceptive Attack (applied to defender)
  DECEPTIVE_ATTACK_DEFENSE: { label: 'vs Deceptive Attack', value: null, requireInput: true, placeholder: 'Enter -1 per -2 attacker took' },

  // Feint
  FEINT_PENALTY: { label: 'vs Feint', value: null, requireInput: true, placeholder: "Enter attacker's margin" },

  // Other
  CUSTOM: { label: 'Custom', value: null, requireInput: true, placeholder: 'Enter modifier value' }
};

/**
 * Damage modifiers (mostly simple adds/subtracts for Phase 3)
 */
export const DAMAGE_MODIFIERS = {
  // All-Out Attack
  AOA_STRONG: { label: 'All-Out Attack (Strong)', value: 2, requireInput: false, note: 'or +1 per die, whichever is better' },

  // Custom
  CUSTOM: { label: 'Custom', value: null, requireInput: true, placeholder: 'Enter modifier value' }
};

/**
 * Get preset modifier by category and key
 * @param {string} category - 'attack', 'defense', or 'damage'
 * @param {string} key - Modifier key from the constants
 * @returns {object|null} Modifier preset or null
 */
export function getPresetModifier(category, key) {
  const presets = {
    attack: ATTACK_MODIFIERS,
    defense: DEFENSE_MODIFIERS,
    damage: DAMAGE_MODIFIERS
  };

  const categoryPresets = presets[category];
  if (!categoryPresets) {
    return null;
  }

  return categoryPresets[key] || null;
}

/**
 * Create a modifier object for the stack
 * @param {string} label - Modifier label/description
 * @param {number} value - Modifier value (can be negative)
 * @returns {{label: string, value: number}}
 */
export function createModifier(label, value) {
  return {
    label: label || 'Unknown',
    value: typeof value === 'number' ? value : 0
  };
}

/**
 * Normalize modifiers array (ensure all have label and value)
 * @param {Array} modifiers - Array of potential modifier objects
 * @returns {Array<{label: string, value: number}>} Normalized modifiers
 */
export function normalizeModifiers(modifiers) {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers.map(mod => {
    if (!mod || typeof mod !== 'object') {
      return { label: 'Invalid', value: 0 };
    }

    return {
      label: String(mod.label || 'Unknown'),
      value: typeof mod.value === 'number' ? mod.value : 0
    };
  });
}
