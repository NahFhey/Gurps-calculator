import { ConditionId } from '../constants/conditions';

const DEFAULT_TURN_CONTEXT = {
  canAct: true,
  isStunned: false,
  isProne: false,
  isGrappled: false,
  isUnconscious: false,
  shockPenalty: 0,
  moveAvailable: null
};

const hasCondition = (combatant, conditionId) => {
  const conditions = combatant?.conditions || [];
  return conditions.some(condition => condition.conditionId === conditionId);
};

/**
 * Phase 7: Derive turn context for maneuver filtering and UI
 *
 * @param {object} combatant - Active combatant state
 * @returns {object} Turn context object
 */
export function deriveTurnContext(combatant) {
  if (!combatant) {
    return { ...DEFAULT_TURN_CONTEXT };
  }

  const isStunned = Boolean(combatant.isStunned) || hasCondition(combatant, ConditionId.STUNNED);
  const isProne = Boolean(combatant.isProne) || hasCondition(combatant, ConditionId.PRONE);
  const isGrappled = Boolean(combatant.isGrappled) || hasCondition(combatant, ConditionId.GRAPPLED);
  const isUnconscious = Boolean(combatant.isUnconscious || combatant.isDead) || hasCondition(combatant, ConditionId.UNCONSCIOUS);
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
