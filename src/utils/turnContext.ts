import { ConditionId } from '../constants/conditions';
import type { Participant, TurnContext } from '../types/combatTracker';

const DEFAULT_TURN_CONTEXT: TurnContext = {
  canAct: true,
  isStunned: false,
  isProne: false,
  isGrappled: false,
  isUnconscious: false,
  shockPenalty: 0,
  moveAvailable: null
};

const hasCondition = (
  combatant: Participant | null | undefined,
  conditionId: string
): boolean => {
  const conditions = combatant?.conditions || [];
  return conditions.some(condition => condition.conditionId === conditionId);
};

/**
 * Phase 7: Derive turn context for maneuver filtering and UI
 *
 * @param {object} combatant - Active combatant state
 * @returns {object} Turn context object
 */
export function deriveTurnContext(
  combatant: Participant | null | undefined
): TurnContext {
  if (!combatant) {
    return { ...DEFAULT_TURN_CONTEXT };
  }

  // Since Phase 12a.6, stun/unconsciousness live only in conditions[]
  // (the legacy isStunned/isUnconscious booleans were folded on migration).
  const isStunned = hasCondition(combatant, ConditionId.STUNNED);
  const isProne = Boolean(combatant.isProne) || hasCondition(combatant, ConditionId.PRONE);
  const isGrappled = Boolean(combatant.isGrappled) || hasCondition(combatant, ConditionId.GRAPPLED);
  const isUnconscious = Boolean(combatant.isDead) || hasCondition(combatant, ConditionId.UNCONSCIOUS);
  const shockPenalty = combatant.shockPenalty ?? 0;
  const moveAvailable = combatant.basicMove ?? null;

  return {
    canAct: !isUnconscious,
    isStunned,
    isProne,
    isGrappled,
    isUnconscious,
    shockPenalty,
    moveAvailable
  };
}
