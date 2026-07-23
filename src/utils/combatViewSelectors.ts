import { RevealMode, getRevealForInstance } from './combatReveal';
import type { CombatState, Participant, RevealState } from '../types/combatTracker';

type DefenseType = 'dodge' | 'parry' | 'block';

function isDefenseType(type: string): type is DefenseType {
  return type === 'dodge' || type === 'parry' || type === 'block';
}

/** Legacy participants may carry `side` where modern ones use `category`. */
function participantSide(p: Participant): string {
  return p.category || (p as Participant & { side?: string }).side || 'enemy';
}

function findParticipant(
  combatState: CombatState,
  defenderId: string
): Participant | undefined {
  return combatState.participants.find((p) => p.instanceId === defenderId);
}

export function getDefenderDefenseBase(
  combatState: CombatState | null | undefined,
  defenderId: string | null | undefined,
  type: string | null | undefined
): number | null {
  if (!combatState || !defenderId || !type || !isDefenseType(type)) return null;
  const defender = findParticipant(combatState, defenderId);
  if (!defender) return null;
  const defenseValue = defender.defenses?.[type] ?? defender[type];

  return typeof defenseValue === 'number' ? defenseValue : defenseValue ?? null;
}

export function getPublicDefenderLabel(
  combatState: CombatState | null | undefined,
  revealState: RevealState | null | undefined,
  defenderId: string | null | undefined
): string {
  if (!combatState || !defenderId) return 'Unknown Foe';
  const defender = findParticipant(combatState, defenderId);
  if (!defender) return 'Unknown Foe';

  const reveal = getRevealForInstance(revealState, defenderId, participantSide(defender));

  switch (reveal.name) {
    case RevealMode.NAME_FULL:
      return defender.name;
    case RevealMode.NAME_PARTIAL:
      return `Unknown #${defenderId.slice(-4)}`;
    case RevealMode.NAME_HIDDEN:
    default:
      return 'Unknown Foe';
  }
}

export function getPublicDefenseLabel(
  combatState: CombatState,
  revealState: RevealState | null | undefined,
  defenderId: string,
  type: string
): string {
  const baseValue = getDefenderDefenseBase(combatState, defenderId, type);
  if (baseValue === null || baseValue === undefined) {
    return 'Not set';
  }

  if (!revealState) {
    return `Base: ${baseValue}`;
  }

  const defender = findParticipant(combatState, defenderId);
  const side = defender ? participantSide(defender) : 'enemy';
  const reveal = getRevealForInstance(revealState, defenderId, side);
  const mode =
    (isDefenseType(type) ? reveal?.defenses?.[type] : undefined) || RevealMode.DEFENSE_UNKNOWN;

  if (mode === RevealMode.DEFENSE_EXACT || mode === RevealMode.DEFENSE_APPROX) {
    return `Base: ${baseValue}`;
  }

  return 'Base: ?';
}
