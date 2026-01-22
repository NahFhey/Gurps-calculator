/**
 * Phase 6: Combat Item Effects
 *
 * Defines item effects and provides utilities for applying them to combatants.
 * Supports both structured effects (predefined) and manual effect entry.
 */

import { ConditionId, DurationType } from '../constants/conditions';

/**
 * Effect application target
 */
export const EffectTarget = {
  SELF: 'self',
  TARGET: 'target',
  AREA: 'area'  // Phase 6 doesn't implement area effects
};

/**
 * Create an effect definition
 *
 * @param {object} config - Effect configuration
 * @param {string} config.id - Unique effect ID
 * @param {string} config.label - Display name
 * @param {string} config.appliesTo - Target type (self/target/area)
 * @param {object} config.resourceDeltas - HP/FP/MP changes
 * @param {array} config.addConditions - Conditions to apply
 * @param {array} config.removeConditions - Conditions to remove
 * @param {string} config.notes - Additional notes
 * @returns {object} Effect definition
 */
export function createEffect({
  id,
  label,
  appliesTo = EffectTarget.SELF,
  resourceDeltas = {},
  addConditions = [],
  removeConditions = [],
  notes = ''
}) {
  return {
    id,
    label,
    appliesTo,
    resourceDeltas: {
      HP: resourceDeltas.HP || null,
      FP: resourceDeltas.FP || null,
      MP: resourceDeltas.MP || null
    },
    addConditions: addConditions.map(c => ({
      conditionId: c.conditionId,
      severity: c.severity || null,
      duration: c.duration || null
    })),
    removeConditions: removeConditions.map(c => ({
      conditionId: c.conditionId,
      all: c.all || false
    })),
    notes
  };
}

/**
 * Common item effects catalog
 *
 * Maps item names/types to their effects.
 * This is optional - items can also have effects stored directly on them.
 */
export const CommonItemEffects = {
  // Healing potions
  'minor-healing-potion': createEffect({
    id: 'minor-healing-potion',
    label: 'Minor Healing Potion',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { HP: 5 },
    notes: 'Restores 5 HP'
  }),

  'healing-potion': createEffect({
    id: 'healing-potion',
    label: 'Healing Potion',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { HP: 10 },
    notes: 'Restores 10 HP'
  }),

  'major-healing-potion': createEffect({
    id: 'major-healing-potion',
    label: 'Major Healing Potion',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { HP: 20 },
    notes: 'Restores 20 HP'
  }),

  // Fatigue recovery
  'energy-draught': createEffect({
    id: 'energy-draught',
    label: 'Energy Draught',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { FP: 10 },
    notes: 'Restores 10 FP'
  }),

  // Mana potions
  'mana-potion': createEffect({
    id: 'mana-potion',
    label: 'Mana Potion',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { MP: 10 },
    notes: 'Restores 10 MP'
  }),

  // Status recovery
  'antidote': createEffect({
    id: 'antidote',
    label: 'Antidote',
    appliesTo: EffectTarget.SELF,
    removeConditions: [{ conditionId: ConditionId.POISONED, all: true }],
    notes: 'Removes all poison effects'
  }),

  'smelling-salts': createEffect({
    id: 'smelling-salts',
    label: 'Smelling Salts',
    appliesTo: EffectTarget.TARGET,
    removeConditions: [{ conditionId: ConditionId.UNCONSCIOUS }],
    notes: 'Revives unconscious character'
  }),

  // Buffs
  'haste-potion': createEffect({
    id: 'haste-potion',
    label: 'Haste Potion',
    appliesTo: EffectTarget.SELF,
    addConditions: [{
      conditionId: ConditionId.HASTE,
      duration: { type: DurationType.ROUNDS, value: 5 }
    }],
    notes: 'Grants haste for 5 rounds'
  }),

  'shield-potion': createEffect({
    id: 'shield-potion',
    label: 'Shield Potion',
    appliesTo: EffectTarget.SELF,
    addConditions: [{
      conditionId: ConditionId.SHIELDED,
      severity: 2,
      duration: { type: DurationType.ROUNDS, value: 3 }
    }],
    notes: '+2 to defense for 3 rounds'
  }),

  // Bandages
  'bandage': createEffect({
    id: 'bandage',
    label: 'Bandage',
    appliesTo: EffectTarget.TARGET,
    removeConditions: [{ conditionId: ConditionId.BLEEDING, all: false }],
    notes: 'Stops one bleeding wound'
  }),

  // Stimulants
  'stimulant': createEffect({
    id: 'stimulant',
    label: 'Stimulant',
    appliesTo: EffectTarget.SELF,
    resourceDeltas: { FP: 5 },
    addConditions: [{
      conditionId: ConditionId.FATIGUED,
      duration: { type: DurationType.UNTIL_END_OF_COMBAT }
    }],
    notes: 'Restores 5 FP but causes fatigue after combat'
  })
};

/**
 * Get effect definition for an item
 *
 * Checks if item has effects property, otherwise looks up in CommonItemEffects.
 *
 * @param {object} item - Inventory item
 * @returns {array} Array of effect definitions
 */
export function getItemEffects(item) {
  // Check if item has effects defined directly
  if (item.effects && Array.isArray(item.effects)) {
    return item.effects;
  }

  // Check if item has a single effect
  if (item.effect && typeof item.effect === 'object') {
    return [item.effect];
  }

  // Look up by item ID or name in common effects
  const itemKey = (item.id || item.name || '').toLowerCase().replace(/\s+/g, '-');
  const commonEffect = CommonItemEffects[itemKey];

  if (commonEffect) {
    return [commonEffect];
  }

  // No structured effects found
  return [];
}

/**
 * Check if an item has any effects defined
 *
 * @param {object} item - Inventory item
 * @returns {boolean} True if item has effects
 */
export function hasItemEffects(item) {
  return getItemEffects(item).length > 0;
}

/**
 * Parse manual effect entry
 *
 * Allows GM to enter effects like "+5 HP", "-3 FP", "Apply Stunned", "Remove Poisoned"
 *
 * @param {string} input - Manual effect string
 * @returns {object|null} Parsed effect or null if invalid
 */
export function parseManualEffect(input) {
  const text = String(input).trim();
  if (!text) return null;

  // Try to parse resource delta: "+10 HP", "-5 FP", "3 MP"
  const resourceMatch = text.match(/^([+-]?\d+)\s*(HP|FP|MP)$/i);
  if (resourceMatch) {
    const amount = parseInt(resourceMatch[1], 10);
    const resource = resourceMatch[2].toUpperCase();

    return createEffect({
      id: 'manual-resource',
      label: text,
      appliesTo: EffectTarget.TARGET,
      resourceDeltas: { [resource]: amount },
      notes: `Manual: ${text}`
    });
  }

  // Try to parse condition addition: "Apply Stunned", "Add Poisoned"
  const addConditionMatch = text.match(/^(?:apply|add)\s+(\w+)$/i);
  if (addConditionMatch) {
    const conditionName = addConditionMatch[1].toLowerCase();

    return createEffect({
      id: 'manual-condition-add',
      label: text,
      appliesTo: EffectTarget.TARGET,
      addConditions: [{
        conditionId: conditionName,
        duration: null  // GM will set duration separately
      }],
      notes: `Manual: ${text}`
    });
  }

  // Try to parse condition removal: "Remove Stunned", "Clear Poisoned"
  const removeConditionMatch = text.match(/^(?:remove|clear)\s+(\w+)$/i);
  if (removeConditionMatch) {
    const conditionName = removeConditionMatch[1].toLowerCase();

    return createEffect({
      id: 'manual-condition-remove',
      label: text,
      appliesTo: EffectTarget.TARGET,
      removeConditions: [{
        conditionId: conditionName,
        all: true
      }],
      notes: `Manual: ${text}`
    });
  }

  // Couldn't parse - return as note-only effect
  return createEffect({
    id: 'manual-note',
    label: text,
    appliesTo: EffectTarget.TARGET,
    notes: `Manual: ${text}`
  });
}

/**
 * Format effect for display
 *
 * @param {object} effect - Effect definition
 * @returns {string} Human-readable effect description
 */
export function formatEffect(effect) {
  const parts = [];

  // Resource deltas
  if (effect.resourceDeltas.HP) {
    const sign = effect.resourceDeltas.HP > 0 ? '+' : '';
    parts.push(`${sign}${effect.resourceDeltas.HP} HP`);
  }
  if (effect.resourceDeltas.FP) {
    const sign = effect.resourceDeltas.FP > 0 ? '+' : '';
    parts.push(`${sign}${effect.resourceDeltas.FP} FP`);
  }
  if (effect.resourceDeltas.MP) {
    const sign = effect.resourceDeltas.MP > 0 ? '+' : '';
    parts.push(`${sign}${effect.resourceDeltas.MP} MP`);
  }

  // Conditions added
  if (effect.addConditions.length > 0) {
    const conditions = effect.addConditions.map(c => {
      let text = `Apply ${c.conditionId}`;
      if (c.severity != null) {
        text += ` (${c.severity})`;
      }
      return text;
    });
    parts.push(...conditions);
  }

  // Conditions removed
  if (effect.removeConditions.length > 0) {
    const conditions = effect.removeConditions.map(c => {
      return `Remove ${c.conditionId}${c.all ? ' (all)' : ''}`;
    });
    parts.push(...conditions);
  }

  // Notes
  if (effect.notes && parts.length === 0) {
    parts.push(effect.notes);
  }

  return parts.length > 0 ? parts.join(', ') : 'No effect';
}
