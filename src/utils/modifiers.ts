/**
 * Modifier utilities for Combat Runner Phase 3
 * Handles modifier stacks, summation, and common preset modifiers
 */

// ============================================================================
// Types
// ============================================================================

export interface Modifier {
  label: string;
  value: number;
}

export interface PresetModifier {
  label: string;
  value: number | null;
  requireInput: boolean;
  placeholder?: string;
  note?: string;
}

export type ModifierCategory = 'attack' | 'defense' | 'damage';

// ============================================================================
// Functions
// ============================================================================

/**
 * Sum modifier values
 * @param modifiers - Array of modifier objects
 * @returns Total modifier value
 */
export function sumModifiers(modifiers: Modifier[]): number {
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
 * @param base - Base value
 * @param modifiers - Array of modifier objects
 * @returns Effective value (base + modifiers)
 */
export function calculateEffective(base: number, modifiers: Modifier[]): number {
  const baseValue = typeof base === 'number' ? base : 0;
  return baseValue + sumModifiers(modifiers);
}

// ============================================================================
// Preset Modifiers
// ============================================================================

/**
 * Common attack modifiers for GURPS
 * These are presets that can be quickly added to the modifier stack
 */
export const ATTACK_MODIFIERS: Record<string, PresetModifier> = {
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
export const DEFENSE_MODIFIERS: Record<string, PresetModifier> = {
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
export const DAMAGE_MODIFIERS: Record<string, PresetModifier> = {
  // All-Out Attack
  AOA_STRONG: { label: 'All-Out Attack (Strong)', value: 2, requireInput: false, note: 'or +1 per die, whichever is better' },

  // Custom
  CUSTOM: { label: 'Custom', value: null, requireInput: true, placeholder: 'Enter modifier value' }
};

// ============================================================================
// Preset Modifier Functions
// ============================================================================

/**
 * Get preset modifier by category and key
 * @param category - 'attack', 'defense', or 'damage'
 * @param key - Modifier key from the constants
 * @returns Modifier preset or null
 */
export function getPresetModifier(category: ModifierCategory, key: string): PresetModifier | null {
  const presets: Record<ModifierCategory, Record<string, PresetModifier>> = {
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
 * @param label - Modifier label/description
 * @param value - Modifier value (can be negative)
 * @returns Modifier object
 */
export function createModifier(label: string, value: number): Modifier {
  return {
    label: label || 'Unknown',
    value: typeof value === 'number' ? value : 0
  };
}

/**
 * Normalize modifiers array (ensure all have label and value)
 * @param modifiers - Array of potential modifier objects
 * @returns Normalized modifiers
 */
export function normalizeModifiers(modifiers: unknown[]): Modifier[] {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers.map(mod => {
    if (!mod || typeof mod !== 'object') {
      return { label: 'Invalid', value: 0 };
    }

    const modObj = mod as Record<string, unknown>;
    return {
      label: String(modObj.label || 'Unknown'),
      value: typeof modObj.value === 'number' ? modObj.value : 0
    };
  });
}
