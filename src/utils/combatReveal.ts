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
  NOTES_FULL: 'full',
} as const;

/**
 * HP bands for qualitative health display
 */
export const HPBand = {
  HEALTHY: 'healthy',
  INJURED: 'injured',
  CRITICAL: 'critical',
  DEAD: 'dead',
} as const;

export type HPBandValue = typeof HPBand[keyof typeof HPBand];

// Loose runtime types — the canonical `RevealState` lives in
// `src/types/combatTracker.ts` but the runtime data shape produced here is
// richer and call sites cast freely. Keeping these signatures permissive
// preserves the original untyped JS behavior without forcing a wider refactor.
type AnyRecord = Record<string, any>;
type RevealStateLike = AnyRecord;
type ParticipantLike = AnyRecord;

/**
 * Calculate HP band from current/max HP
 */
export function calculateHPBand(currentHP: number, maxHP: number): HPBandValue {
  if (currentHP <= 0) return HPBand.DEAD;

  const ratio = currentHP / maxHP;
  if (ratio >= 0.75) return HPBand.HEALTHY;
  if (ratio >= 0.33) return HPBand.INJURED;
  return HPBand.CRITICAL;
}

/**
 * Get display text for HP band
 */
export function getHPBandText(band: HPBandValue | string): string {
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
 */
export function createDefaultRevealForInstance(
  instanceId: string,
  side: string,
  participant: ParticipantLike | null = null
): AnyRecord {
  void instanceId;
  void participant;
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
        block: RevealMode.DEFENSE_EXACT,
      },
      dr: {
        general: RevealMode.DR_EXACT,
        byLocation: {},
      },
      attacks: RevealMode.ATTACKS_FULL,
      notes: RevealMode.NOTES_FULL,
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
      block: RevealMode.DEFENSE_UNKNOWN,
    },
    dr: {
      general: RevealMode.DR_UNKNOWN,
      byLocation: {},
    },
    attacks: RevealMode.ATTACKS_HIDDEN,
    notes: RevealMode.NOTES_HIDDEN,
  };
}

/**
 * Create initial reveal state for an entire encounter
 */
export function createInitialRevealState(
  encounterId: string,
  participants: ParticipantLike[]
): AnyRecord {
  const byInstanceId: Record<string, AnyRecord> = {};

  for (const participant of participants) {
    const side: string = participant.category || participant.side || 'enemy';
    byInstanceId[participant.instanceId] = createDefaultRevealForInstance(
      participant.instanceId,
      side,
      participant
    );
  }

  return {
    version: 1,
    encounterId,
    byInstanceId,
  };
}

/**
 * Get reveal state for a specific instance (with fallback to default)
 */
export function getRevealForInstance(
  revealState: RevealStateLike | null | undefined,
  instanceId: string,
  side: string = 'enemy'
): AnyRecord {
  if (!revealState?.byInstanceId?.[instanceId]) {
    return createDefaultRevealForInstance(instanceId, side);
  }
  return revealState.byInstanceId[instanceId];
}

/**
 * Update reveal state for a specific instance field
 */
export function updateReveal(
  revealState: RevealStateLike,
  instanceId: string,
  field: string,
  value: unknown
): AnyRecord {
  const newState: AnyRecord = safeDeepClone(revealState);

  if (!newState.byInstanceId[instanceId]) {
    newState.byInstanceId[instanceId] = createDefaultRevealForInstance(instanceId, 'enemy');
  }

  const parts = field.split('.');
  let target: AnyRecord = newState.byInstanceId[instanceId];

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
 */
export function setRevealForInstance(
  revealState: RevealStateLike,
  instanceId: string,
  nextReveal: AnyRecord
): AnyRecord {
  const newState: AnyRecord = safeDeepClone(revealState);
  if (!newState.byInstanceId) {
    newState.byInstanceId = {};
  }
  newState.byInstanceId[instanceId] = nextReveal;
  return newState;
}

/**
 * Reveal a defense base value after a successful defense.
 */
export function revealDefenseForInstance(
  revealState: RevealStateLike | null | undefined,
  instanceId: string,
  defenseType: string
): RevealStateLike | null | undefined {
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
export function revealNameForInstance(
  revealState: RevealStateLike | null | undefined,
  instanceId: string
): RevealStateLike | null | undefined {
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
export function revealHPAtZero(
  revealState: RevealStateLike | null | undefined,
  instanceId: string
): RevealStateLike | null | undefined {
  if (!revealState || !instanceId) return revealState;
  const current = getRevealForInstance(revealState, instanceId, 'enemy');
  if (current?.hp?.mode === RevealMode.NUMERIC_EXACT) {
    return revealState;
  }
  return updateReveal(revealState, instanceId, 'hp.mode', RevealMode.NUMERIC_EXACT);
}

/**
 * Add new combatant to reveal state (when added mid-combat)
 */
export function addCombatantToReveal(
  revealState: RevealStateLike,
  instanceId: string,
  side: string
): AnyRecord {
  const newState: AnyRecord = safeDeepClone(revealState);
  newState.byInstanceId[instanceId] = createDefaultRevealForInstance(instanceId, side);
  return newState;
}

/**
 * Ensure reveal state entries match current participants
 */
export function syncRevealStateForParticipants(
  revealState: RevealStateLike | null | undefined,
  participants: ParticipantLike[]
): RevealStateLike | null | undefined {
  if (!revealState) return revealState;

  const updated: AnyRecord = safeDeepClone(revealState);
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
      const side: string = participant.category || participant.side || 'enemy';
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
 */
export function removeCombatantFromReveal(
  revealState: RevealStateLike,
  instanceId: string
): AnyRecord {
  const newState: AnyRecord = safeDeepClone(revealState);
  delete newState.byInstanceId[instanceId];
  return newState;
}

/**
 * Check if any information is revealed for an instance
 * (useful for UI indicators)
 */
export function hasAnyReveals(revealForInstance: AnyRecord | null | undefined): boolean {
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
