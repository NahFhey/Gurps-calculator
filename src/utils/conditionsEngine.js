/**
 * Phase 6: Conditions Engine
 *
 * Manages condition application, removal, duration tracking, and expiry.
 */

import { generateId } from './combatHelpers';
import {
  ConditionCatalog,
  ConditionId,
  DurationType,
  StackingRule,
  getCondition,
  isConditionObvious
} from '../constants/conditions';

/**
 * Create a condition instance from a condition ID
 *
 * @param {string} conditionId - Condition ID from ConditionCatalog
 * @param {object} options - Configuration options
 * @param {number} options.round - Current round when applied
 * @param {number} options.turn - Current turn when applied
 * @param {object|null} options.duration - Duration override (or null for default)
 * @param {number} options.severity - Condition severity (optional)
 * @param {string} options.source - Source of condition (e.g., "Burning Hands", "Goblin #1")
 * @param {string} options.notes - Additional notes
 * @param {string} options.revealed - Player visibility override ('closed' | 'half' | 'open');
 *   defaults from the catalog isObvious flag
 * @returns {object|null} Condition instance or null if invalid
 */
export function createConditionInstance(conditionId, options = {}) {
  const definition = getCondition(conditionId);
  if (!definition) {
    console.warn(`Unknown condition ID: ${conditionId}`);
    return null;
  }

  const {
    round = 0,
    turn = 0,
    duration = null,
    severity = null,
    source = null,
    notes = null,
    revealed = null
  } = options;

  // Use provided duration or default from catalog
  const finalDuration = duration !== null ? duration : definition.defaultDuration;

  // Calculate expiry
  const expiresAt = calculateExpiry(finalDuration, round, turn);

  return {
    instanceId: generateId(),
    conditionId,
    label: definition.label,
    severity,
    source,
    startedAtRound: round,
    startedAtTurn: turn,
    duration: finalDuration,
    expiresAt,
    notes,
    // Phase 12a.6: seed player visibility from the catalog default.
    // Half-open is never a default — always a deliberate GM choice.
    revealed: revealed !== null ? revealed : (definition.isObvious ? 'open' : 'closed')
  };
}

// ============================================================================
// Phase 12a.6: Condition visibility (per-instance eye state)
// ============================================================================

/**
 * Advance the three-state eye control: closed → half → open → closed.
 * Unknown/legacy values (undefined) are treated as visible, so the first
 * click always hides.
 *
 * @param {string|undefined} revealed - Current reveal state
 * @returns {string} Next reveal state
 */
export function cycleRevealed(revealed) {
  switch (revealed) {
    case 'closed':
      return 'half';
    case 'half':
      return 'open';
    default:
      return 'closed';
  }
}

/**
 * Cycle the eye state of one condition instance on a combatant.
 *
 * @param {object} combatant - Combatant carrying the condition
 * @param {string} instanceId - Condition instance to cycle
 * @returns {object} Updated combatant (same reference if instance not found)
 */
export function cycleConditionRevealed(combatant, instanceId) {
  const conditions = combatant.conditions || [];
  if (!conditions.some(c => c.instanceId === instanceId)) {
    return combatant;
  }
  return {
    ...combatant,
    conditions: conditions.map(c =>
      c.instanceId === instanceId ? { ...c, revealed: cycleRevealed(c.revealed) } : c
    )
  };
}

/**
 * Phase 12a.6 migration helper: bring one participant up to the
 * condition-visibility shape. Pure and idempotent — safe to run on every load.
 *
 * 1. Folds legacy `isStunned` / `isUnconscious` booleans into `conditions[]`
 *    (permanent duration, matching the sticky-until-cleared bool semantics),
 *    skipping the insert when a matching condition already exists.
 * 2. Removes the boolean fields regardless of value.
 * 3. Backfills `revealed` on instances that predate the eye state, from the
 *    catalog isObvious default.
 *
 * @param {object} participant - Participant (possibly legacy-shaped)
 * @returns {object} Migrated participant (same reference if nothing to do)
 */
export function ensureParticipantConditionVisibility(participant) {
  if (!participant || typeof participant !== 'object') {
    return participant;
  }

  const conditions = Array.isArray(participant.conditions) ? participant.conditions : [];
  const hasLegacyBools = 'isStunned' in participant || 'isUnconscious' in participant;
  const needsBackfill = conditions.some(
    c => c && typeof c === 'object' && c.revealed === undefined
  );

  if (!hasLegacyBools && !needsBackfill) {
    return participant;
  }

  let next = [...conditions];

  const foldBool = (flag, conditionId) => {
    if (flag !== true) return;
    if (next.some(c => c && c.conditionId === conditionId)) return;
    next.push(
      createConditionInstance(conditionId, {
        duration: { type: DurationType.PERMANENT, value: null }
      })
    );
  };

  foldBool(participant.isStunned, ConditionId.STUNNED);
  foldBool(participant.isUnconscious, ConditionId.UNCONSCIOUS);

  next = next.map(c => {
    if (!c || typeof c !== 'object' || c.revealed !== undefined) return c;
    return { ...c, revealed: isConditionObvious(c.conditionId) ? 'open' : 'closed' };
  });

  const migrated = { ...participant, conditions: next };
  delete migrated.isStunned;
  delete migrated.isUnconscious;
  return migrated;
}

/**
 * Calculate when a condition expires based on duration
 *
 * @param {object|null} duration - Duration specification
 * @param {number} currentRound - Current combat round
 * @param {number} currentTurn - Current turn index
 * @returns {object|null} Expiry specification or null if permanent
 */
function calculateExpiry(duration, currentRound, currentTurn) {
  if (!duration) return null;

  switch (duration.type) {
    case DurationType.TURNS:
      return {
        type: 'turn',
        turnsRemaining: duration.value || 1
      };

    case DurationType.ROUNDS:
      return {
        type: 'round',
        round: currentRound + (duration.value || 1)
      };

    case DurationType.UNTIL_END_OF_COMBAT:
      return {
        type: 'endOfCombat'
      };

    case DurationType.PERMANENT:
    default:
      return null;
  }
}

/**
 * Apply a condition to a combatant
 *
 * @param {object} combatant - Combatant to apply condition to
 * @param {string} conditionId - Condition ID
 * @param {object} options - Application options (round, turn, duration, etc.)
 * @returns {object} Updated combatant with condition applied
 */
export function applyCondition(combatant, conditionId, options = {}) {
  const definition = getCondition(conditionId);
  if (!definition) {
    console.warn(`Cannot apply unknown condition: ${conditionId}`);
    return combatant;
  }

  const newInstance = createConditionInstance(conditionId, options);
  if (!newInstance) {
    return combatant;
  }

  const conditions = combatant.conditions || [];

  // Handle stacking rules
  switch (definition.stackingRule) {
    case StackingRule.REPLACE: {
      // Remove all existing instances of this condition
      const filtered = conditions.filter(c => c.conditionId !== conditionId);
      return {
        ...combatant,
        conditions: [...filtered, newInstance]
      };
    }

    case StackingRule.MAX: {
      // Keep the instance with longest duration
      const existing = conditions.find(c => c.conditionId === conditionId);
      if (existing) {
        const existingRemaining = getRemainingDuration(existing);
        const newRemaining = getRemainingDuration(newInstance);

        if (newRemaining > existingRemaining) {
          // New one lasts longer, replace
          const filtered = conditions.filter(c => c.conditionId !== conditionId);
          return {
            ...combatant,
            conditions: [...filtered, newInstance]
          };
        } else {
          // Keep existing
          return combatant;
        }
      } else {
        // First instance
        return {
          ...combatant,
          conditions: [...conditions, newInstance]
        };
      }
    }

    case StackingRule.STACK:
    default: {
      // Allow multiple instances
      return {
        ...combatant,
        conditions: [...conditions, newInstance]
      };
    }
  }
}

/**
 * Remove a condition from a combatant
 *
 * @param {object} combatant - Combatant to remove condition from
 * @param {string} instanceId - Specific condition instance ID to remove
 * @param {boolean} removeAll - If true, remove all instances of this condition type
 * @returns {object} Updated combatant with condition removed
 */
export function removeCondition(combatant, instanceId, removeAll = false) {
  const conditions = combatant.conditions || [];

  if (removeAll) {
    // Find the condition ID for this instance
    const instance = conditions.find(c => c.instanceId === instanceId);
    if (!instance) return combatant;

    // Remove all instances with same conditionId
    return {
      ...combatant,
      conditions: conditions.filter(c => c.conditionId !== instance.conditionId)
    };
  } else {
    // Remove just this instance
    return {
      ...combatant,
      conditions: conditions.filter(c => c.instanceId !== instanceId)
    };
  }
}

/**
 * Remove all instances of a condition type
 *
 * @param {object} combatant - Combatant to remove conditions from
 * @param {string} conditionId - Condition type to remove
 * @returns {object} Updated combatant
 */
export function removeConditionType(combatant, conditionId) {
  const conditions = combatant.conditions || [];
  return {
    ...combatant,
    conditions: conditions.filter(c => c.conditionId !== conditionId)
  };
}

/**
 * Update condition duration (for manual editing)
 *
 * @param {object} combatant - Combatant
 * @param {string} instanceId - Condition instance ID
 * @param {object} newDuration - New duration specification
 * @param {number} currentRound - Current round
 * @param {number} currentTurn - Current turn
 * @returns {object} Updated combatant
 */
export function updateConditionDuration(combatant, instanceId, newDuration, currentRound, currentTurn) {
  const conditions = combatant.conditions || [];

  return {
    ...combatant,
    conditions: conditions.map(c => {
      if (c.instanceId === instanceId) {
        const expiresAt = calculateExpiry(newDuration, currentRound, currentTurn);
        return {
          ...c,
          duration: newDuration,
          expiresAt
        };
      }
      return c;
    })
  };
}

/**
 * Tick conditions forward by one turn
 *
 * Decrements turn-based durations and returns expired conditions.
 *
 * @param {object} combatant - Combatant whose conditions to tick
 * @param {number} currentRound - Current round
 * @returns {object} { combatant: updated combatant, expired: array of expired conditions }
 */
export function tickConditionsTurn(combatant, currentRound) {
  const conditions = combatant.conditions || [];
  const expired = [];
  const remaining = [];

  for (const condition of conditions) {
    if (!condition.expiresAt) {
      // Permanent condition
      remaining.push(condition);
      continue;
    }

    if (condition.expiresAt.type === 'turn') {
      // Decrement turns remaining
      const turnsRemaining = (condition.expiresAt.turnsRemaining || 0) - 1;

      if (turnsRemaining <= 0) {
        expired.push(condition);
      } else {
        remaining.push({
          ...condition,
          expiresAt: {
            ...condition.expiresAt,
            turnsRemaining
          }
        });
      }
    } else {
      // Not a turn-based condition
      remaining.push(condition);
    }
  }

  return {
    combatant: {
      ...combatant,
      conditions: remaining
    },
    expired
  };
}

/**
 * Tick conditions forward by one round
 *
 * Decrements round-based durations and returns expired conditions.
 *
 * @param {object} combatant - Combatant whose conditions to tick
 * @param {number} currentRound - Current round
 * @returns {object} { combatant: updated combatant, expired: array of expired conditions }
 */
export function tickConditionsRound(combatant, currentRound) {
  const conditions = combatant.conditions || [];
  const expired = [];
  const remaining = [];

  for (const condition of conditions) {
    if (!condition.expiresAt) {
      // Permanent condition
      remaining.push(condition);
      continue;
    }

    if (condition.expiresAt.type === 'round') {
      // Check if expired
      if (currentRound >= condition.expiresAt.round) {
        expired.push(condition);
      } else {
        remaining.push(condition);
      }
    } else {
      // Not a round-based condition
      remaining.push(condition);
    }
  }

  return {
    combatant: {
      ...combatant,
      conditions: remaining
    },
    expired
  };
}

/**
 * Remove all "untilEndOfCombat" conditions
 *
 * Called when combat ends.
 *
 * @param {object} combatant - Combatant
 * @returns {object} Updated combatant
 */
export function clearEndOfCombatConditions(combatant) {
  const conditions = combatant.conditions || [];

  return {
    ...combatant,
    conditions: conditions.filter(c => {
      return !(c.expiresAt?.type === 'endOfCombat');
    })
  };
}

/**
 * Get all active conditions for a combatant
 *
 * @param {object} combatant - Combatant
 * @returns {array} Array of condition instances
 */
export function getActiveConditions(combatant) {
  return combatant.conditions || [];
}

/**
 * Check if combatant has a specific condition
 *
 * @param {object} combatant - Combatant
 * @param {string} conditionId - Condition ID to check
 * @returns {boolean} True if combatant has condition
 */
export function hasCondition(combatant, conditionId) {
  const conditions = combatant.conditions || [];
  return conditions.some(c => c.conditionId === conditionId);
}

/**
 * Get all instances of a specific condition type
 *
 * @param {object} combatant - Combatant
 * @param {string} conditionId - Condition ID
 * @returns {array} Array of condition instances
 */
export function getConditionInstances(combatant, conditionId) {
  const conditions = combatant.conditions || [];
  return conditions.filter(c => c.conditionId === conditionId);
}

/**
 * Get remaining duration for a condition (for comparison)
 *
 * @param {object} conditionInstance - Condition instance
 * @returns {number} Remaining duration (higher = longer), Infinity for permanent
 */
function getRemainingDuration(conditionInstance) {
  if (!conditionInstance.expiresAt) {
    return Infinity;
  }

  switch (conditionInstance.expiresAt.type) {
    case 'turn':
      return conditionInstance.expiresAt.turnsRemaining || 0;
    case 'round':
      // Assume current round is 0 for comparison purposes
      return conditionInstance.expiresAt.round || 0;
    case 'endOfCombat':
      return 999;  // Arbitrary large number
    default:
      return Infinity;
  }
}

/**
 * Format condition duration for display
 *
 * @param {object} conditionInstance - Condition instance
 * @param {number} currentRound - Current combat round
 * @returns {string} Formatted duration string
 */
export function formatConditionDuration(conditionInstance, currentRound = 0) {
  if (!conditionInstance.expiresAt) {
    return 'Permanent';
  }

  switch (conditionInstance.expiresAt.type) {
    case 'turn': {
      const remaining = conditionInstance.expiresAt.turnsRemaining || 0;
      return `${remaining} turn${remaining !== 1 ? 's' : ''}`;
    }
    case 'round': {
      const remaining = Math.max(0, conditionInstance.expiresAt.round - currentRound);
      return `${remaining} round${remaining !== 1 ? 's' : ''}`;
    }
    case 'endOfCombat':
      return 'Until end of combat';
    default:
      return 'Unknown';
  }
}

/**
 * Format condition for tooltip/display
 *
 * @param {object} conditionInstance - Condition instance
 * @param {number} currentRound - Current combat round
 * @returns {string} Formatted condition description
 */
export function formatConditionTooltip(conditionInstance, currentRound = 0) {
  const definition = getCondition(conditionInstance.conditionId);
  if (!definition) return conditionInstance.label || 'Unknown';

  let text = `${conditionInstance.label}`;

  if (conditionInstance.severity != null) {
    text += ` (${conditionInstance.severity})`;
  }

  const duration = formatConditionDuration(conditionInstance, currentRound);
  text += `\nDuration: ${duration}`;

  if (conditionInstance.source) {
    text += `\nSource: ${conditionInstance.source}`;
  }

  if (definition.description) {
    text += `\n\n${definition.description}`;
  }

  if (conditionInstance.notes) {
    text += `\n\nNotes: ${conditionInstance.notes}`;
  }

  return text;
}
