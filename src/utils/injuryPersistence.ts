import { conditionPersistsAfterCombat } from '../constants/conditions';
import type { CharacterStatus, PersistedCondition } from '../types/campaign';
import type { ConditionInstance, Participant } from '../types/combatTracker';

/** Filter a participant's end-of-combat conditions down to persistent, trimmed records. */
export function buildPersistedConditions(
  conditions: ConditionInstance[] | undefined
): PersistedCondition[] {
  return (conditions ?? []).flatMap((condition) => {
    if (!conditionPersistsAfterCombat(condition.conditionId)) return [];
    if (condition.expiresAt?.type === 'endOfCombat') return [];
    if (condition.expiresAt?.type === 'turn'
      && typeof condition.expiresAt.turnsRemaining === 'number'
      && condition.expiresAt.turnsRemaining <= 0) return [];

    const persisted: PersistedCondition = {
      instanceId: condition.instanceId,
      conditionId: condition.conditionId,
      label: condition.label,
    };
    if (typeof condition.severity === 'number') persisted.severity = condition.severity;
    if (typeof condition.source === 'string') persisted.source = condition.source;
    if (typeof condition.notes === 'string') persisted.notes = condition.notes;
    if (condition.revealed !== undefined) persisted.revealed = condition.revealed;
    return [persisted];
  });
}

/** Remove empty members and collapse an all-clear status to undefined. */
export function compactCharacterStatus(
  status: CharacterStatus | undefined
): CharacterStatus | undefined {
  if (!status) return undefined;
  const compacted: CharacterStatus = {};
  if (status.conditions?.length) compacted.conditions = [...status.conditions];
  if (status.crippled?.length) compacted.crippled = [...status.crippled];
  if (status.dead === true) compacted.dead = true;
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

/** Build the replacement status a party character should carry after combat. */
export function buildCharacterStatus(participant: Participant): CharacterStatus | undefined {
  return compactCharacterStatus({
    conditions: buildPersistedConditions(participant.conditions),
    crippled: participant.crippled ? [...participant.crippled] : undefined,
    dead: participant.isDead === true ? true : undefined,
  });
}

/** Seed persisted injury state into a fresh combat participant. */
export function seedParticipantFromStatus(
  status: CharacterStatus | undefined
): { conditions: ConditionInstance[]; crippled: string[] } {
  return {
    conditions: (status?.conditions ?? []).map((condition) => ({
      ...condition,
      duration: { type: 'permanent' },
      expiresAt: null,
    })),
    crippled: [...(status?.crippled ?? [])],
  };
}
