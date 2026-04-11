/**
 * Combat Reveal State Management (Phase 5)
 *
 * Manages progressive reveal of combat information to players.
 * Supports GM/Player view separation with granular reveal controls.
 */

import { safeDeepClone } from './helpers';

/**
 * Reveal modes for different data types
 */
export const RevealMode = {
  // Name reveal
  NAME_HIDDEN: 'hidden',
  NAME_PARTIAL: 'partial',
  NAME_FULL: 'full',

  // Numeric reveals (HP, FP, MP)
  NUMERIC_UNKNOWN: 'unknown',
  NUMERIC_BAND: 'band',
  NUMERIC_EXACT: 'exact',

  // Defense reveals
  DEFENSE_UNKNOWN: 'unknown',
  DEFENSE_APPROX: 'approx',
  DEFENSE_EXACT: 'exact',

  // DR reveals
  DR_UNKNOWN: 'unknown',
  DR_MIN_KNOWN: 'minKnown',
  DR_EXACT: 'exact',

  // Attack reveals
  ATTACKS_HIDDEN: 'hidden',
  ATTACKS_NAMES_ONLY: 'namesOnly',
  ATTACKS_FULL: 'full',

  // Notes reveals
  NOTES_HIDDEN: 'hidden',
  NOTES_FULL: 'full'
};

/**
 * HP bands for qualitative health display
 */
export const HPBand = {
  HEALTHY: 'healthy',
  INJURED: 'injured',
  CRITICAL: 'critical',
  DEAD: 'dead'
};

/**
 * Calculate HP band from current/max HP
 */
export function calculateHPBand(currentHP, maxHP) {
  if (currentHP <= 0) return HPBand.DEAD;

  const ratio = currentHP / maxHP;
  if (ratio >= 0.75) return HPBand.HEALTHY;
  if (ratio >= 0.33) return HPBand.INJURED;
  return HPBand.CRITICAL;
}

/**
 * Get display text for HP band
 */
export function getHPBandText(band) {
  switch (band) {
    case HPBand.HEALTHY: return 'Healthy';
    case HPBand.INJURED: return 'Wounded';
    case HPBand.CRITICAL: return 'Badly Wounded';
    case HPBand.DEAD: return 'Down';
    default: return 'Unknown';
  }
}

/**
 * Create default reveal state for a single combatant instance
 *
 * @param {string} instanceId - The combatant instance ID
 * @param {string} side - The combatant's side ('player', 'ally', 'enemy', 'object')
 * @param {object} participant - The participant object (for object owner detection)
 * @returns {object} Default reveal state
 */
export function createDefaultRevealForInstance(instanceId, side, participant = null) {
  // Players, allies, and objects: full reveal by default
  // Only enemies have hidden information
  if (side === 'player' || side === 'ally' || side === 'object') {
    return {
      name: RevealMode.NAME_FULL,
      tags: RevealMode.NOTES_FULL,
      hp: { mode: RevealMode.NUMERIC_EXACT },
      fp: { mode: RevealMode.NUMERIC_EXACT },
      mp: { mode: RevealMode.NUMERIC_EXACT },
      defenses: {
        dodge: RevealMode.DEFENSE_EXACT,
        parry: RevealMode.DEFENSE_EXACT,
        block: RevealMode.DEFENSE_EXACT
      },
      dr: {
        general: RevealMode.DR_EXACT,
        byLocation: {}
      },
      attacks: RevealMode.ATTACKS_FULL,
      notes: RevealMode.NOTES_FULL
    };
  }

  // Enemies only: hidden by default
  return {
    name: RevealMode.NAME_HIDDEN,
    tags: RevealMode.NOTES_HIDDEN,
    hp: { mode: RevealMode.NUMERIC_UNKNOWN },
    fp: { mode: RevealMode.NUMERIC_UNKNOWN },
    mp: { mode: RevealMode.NUMERIC_UNKNOWN },
    defenses: {
      dodge: RevealMode.DEFENSE_UNKNOWN,
      parry: RevealMode.DEFENSE_UNKNOWN,
      block: RevealMode.DEFENSE_UNKNOWN
    },
    dr: {
      general: RevealMode.DR_UNKNOWN,
      byLocation: {}
    },
    attacks: RevealMode.ATTACKS_HIDDEN,
    notes: RevealMode.NOTES_HIDDEN
  };
}

/**
 * Create initial reveal state for an entire encounter
 *
 * @param {string} encounterId - The encounter ID
 * @param {array} participants - Array of participant objects with instanceId, side
 * @returns {object} Complete reveal state
 */
export function createInitialRevealState(encounterId, participants) {
  const byInstanceId = {};

  for (const participant of participants) {
    const side = participant.category || participant.side || 'enemy'; // Use category field (category is the actual field used)
    byInstanceId[participant.instanceId] = createDefaultRevealForInstance(
      participant.instanceId,
      side,
      participant
    );
  }

  return {
    version: 1,
    encounterId,
    byInstanceId
  };
}

/**
 * Get reveal state for a specific instance (with fallback to default)
 *
 * @param {object} revealState - The full reveal state
 * @param {string} instanceId - The instance to get reveal for
 * @param {string} side - The combatant's side (for default fallback)
 * @returns {object} Reveal state for this instance
 */
export function getRevealForInstance(revealState, instanceId, side = 'enemy') {
  if (!revealState?.byInstanceId?.[instanceId]) {
    return createDefaultRevealForInstance(instanceId, side);
  }
  return revealState.byInstanceId[instanceId];
}

/**
 * Update reveal state for a specific instance field
 *
 * @param {object} revealState - Current reveal state
 * @param {string} instanceId - The instance to update
 * @param {string} field - Field path (e.g., 'name', 'hp.mode', 'dr.general')
 * @param {any} value - New value
 * @returns {object} Updated reveal state
 */
export function updateReveal(revealState, instanceId, field, value) {
  const newState = safeDeepClone(revealState); // Deep clone

  if (!newState.byInstanceId[instanceId]) {
    newState.byInstanceId[instanceId] = createDefaultRevealForInstance(instanceId, 'enemy');
  }

  const parts = field.split('.');
  let target = newState.byInstanceId[instanceId];

  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }

  target[parts[parts.length - 1]] = value;

  return newState;
}

/**
 * Replace reveal data for a specific instance.
 *
 * @param {object} revealState - Current reveal state
 * @param {string} instanceId - The instance to update
 * @param {object} nextReveal - Full reveal data to set
 * @returns {object} Updated reveal state
 */
export function setRevealForInstance(revealState, instanceId, nextReveal) {
  const newState = safeDeepClone(revealState);
  if (!newState.byInstanceId) {
    newState.byInstanceId = {};
  }
  newState.byInstanceId[instanceId] = nextReveal;
  return newState;
}

/**
 * Reveal a defense base value after a successful defense.
 */
export function revealDefenseForInstance(revealState, instanceId, defenseType) {
  if (!revealState || !instanceId || !defenseType) return revealState;
  const current = getRevealForInstance(revealState, instanceId, 'enemy');
  if (current?.defenses?.[defenseType] === RevealMode.DEFENSE_EXACT) {
    return revealState;
  }
  return updateReveal(revealState, instanceId, `defenses.${defenseType}`, RevealMode.DEFENSE_EXACT);
}

/**
 * Reveal a combatant name after they take damage.
 */
export function revealNameForInstance(revealState, instanceId) {
  if (!revealState || !instanceId) return revealState;
  const current = getRevealForInstance(revealState, instanceId, 'enemy');
  if (current?.name === RevealMode.NAME_FULL) {
    return revealState;
  }
  return updateReveal(revealState, instanceId, 'name', RevealMode.NAME_FULL);
}

/**
 * Reveal HP exact values once HP reaches 0 or below.
 */
export function revealHPAtZero(revealState, instanceId) {
  if (!revealState || !instanceId) return revealState;
  const current = getRevealForInstance(revealState, instanceId, 'enemy');
  if (current?.hp?.mode === RevealMode.NUMERIC_EXACT) {
    return revealState;
  }
  return updateReveal(revealState, instanceId, 'hp.mode', RevealMode.NUMERIC_EXACT);
}

/**
 * Add new combatant to reveal state (when added mid-combat)
 *
 * @param {object} revealState - Current reveal state
 * @param {string} instanceId - New instance ID
 * @param {string} side - Combatant's side
 * @returns {object} Updated reveal state
 */
export function addCombatantToReveal(revealState, instanceId, side) {
  const newState = safeDeepClone(revealState);
  newState.byInstanceId[instanceId] = createDefaultRevealForInstance(instanceId, side);
  return newState;
}

/**
 * Ensure reveal state entries match current participants
 *
 * @param {object} revealState - Current reveal state
 * @param {array} participants - Active combat participants
 * @returns {object} Updated reveal state
 */
export function syncRevealStateForParticipants(revealState, participants) {
  if (!revealState) return revealState;

  const updated = safeDeepClone(revealState);
  const participantIds = new Set(participants.map(p => p.instanceId));

  // Remove entries for missing participants
  for (const instanceId of Object.keys(updated.byInstanceId || {})) {
    if (!participantIds.has(instanceId)) {
      delete updated.byInstanceId[instanceId];
    }
  }

  // Add defaults for new participants
  for (const participant of participants) {
    if (!updated.byInstanceId[participant.instanceId]) {
      const side = participant.category || participant.side || 'enemy';
      updated.byInstanceId[participant.instanceId] = createDefaultRevealForInstance(
        participant.instanceId,
        side,
        participant
      );
    }
  }

  return updated;
}

/**
 * Remove combatant from reveal state (when removed from combat)
 *
 * @param {object} revealState - Current reveal state
 * @param {string} instanceId - Instance to remove
 * @returns {object} Updated reveal state
 */
export function removeCombatantFromReveal(revealState, instanceId) {
  const newState = safeDeepClone(revealState);
  delete newState.byInstanceId[instanceId];
  return newState;
}

/**
 * Check if any information is revealed for an instance
 * (useful for UI indicators)
 */
export function hasAnyReveals(revealForInstance) {
  if (!revealForInstance) return false;

  return (
    revealForInstance.name !== RevealMode.NAME_HIDDEN ||
    revealForInstance.hp?.mode !== RevealMode.NUMERIC_UNKNOWN ||
    revealForInstance.defenses?.dodge !== RevealMode.DEFENSE_UNKNOWN ||
    revealForInstance.defenses?.parry !== RevealMode.DEFENSE_UNKNOWN ||
    revealForInstance.defenses?.block !== RevealMode.DEFENSE_UNKNOWN ||
    revealForInstance.dr?.general !== RevealMode.DR_UNKNOWN ||
    revealForInstance.attacks !== RevealMode.ATTACKS_HIDDEN
  );
}
