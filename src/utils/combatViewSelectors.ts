import { RevealMode, getRevealForInstance } from './combatReveal';

type AnyRecord = Record<string, any>;
type CombatStateLike = unknown;
type RevealStateLike = unknown;

export function getDefenderDefenseBase(
  combatState: CombatStateLike | null | undefined,
  defenderId: string | null | undefined,
  type: string | null | undefined
): number | null {
  if (!combatState || !defenderId || !type) return null;
  const defender = (combatState as AnyRecord).participants.find(
    (p: AnyRecord) => p.instanceId === defenderId
  );
  if (!defender) return null;
  const defenseValue = defender.defenses?.[type] ?? defender[type];

  return typeof defenseValue === 'number' ? defenseValue : defenseValue ?? null;
}

export function getPublicDefenderLabel(
  combatState: CombatStateLike | null | undefined,
  revealState: RevealStateLike | null | undefined,
  defenderId: string | null | undefined
): string {
  if (!combatState || !defenderId) return 'Unknown Foe';
  const defender = (combatState as AnyRecord).participants.find(
    (p: AnyRecord) => p.instanceId === defenderId
  );
  if (!defender) return 'Unknown Foe';

  const side = defender.category || defender.side || 'enemy';
  const reveal = getRevealForInstance(
    revealState as AnyRecord | null | undefined,
    defenderId,
    side
  );

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
  combatState: CombatStateLike,
  revealState: RevealStateLike | null | undefined,
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

  const defender = (combatState as AnyRecord).participants.find(
    (p: AnyRecord) => p.instanceId === defenderId
  );
  const side = defender?.category || defender?.side || 'enemy';
  const reveal = getRevealForInstance(
    revealState as AnyRecord | null | undefined,
    defenderId,
    side
  );
  const mode = reveal?.defenses?.[type] || RevealMode.DEFENSE_UNKNOWN;

  if (mode === RevealMode.DEFENSE_EXACT || mode === RevealMode.DEFENSE_APPROX) {
    return `Base: ${baseValue}`;
  }

  return 'Base: ?';
}
