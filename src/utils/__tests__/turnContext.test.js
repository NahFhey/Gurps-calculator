import { describe, it, expect } from 'vitest';
import { deriveTurnContext } from '../turnContext';
import { ConditionId } from '../../constants/conditions';

const DEFAULT_CONTEXT = {
  canAct: true,
  isStunned: false,
  isProne: false,
  isGrappled: false,
  isUnconscious: false,
  shockPenalty: 0,
  moveAvailable: null
};

const mkCombatant = (overrides = {}) => ({
  instanceId: 'pc-001',
  name: 'Hero',
  basicMove: 5,
  shockPenalty: 0,
  conditions: [],
  ...overrides
});

describe('deriveTurnContext', () => {
  it('returns default context when combatant is null', () => {
    expect(deriveTurnContext(null)).toEqual(DEFAULT_CONTEXT);
  });

  it('returns default context when combatant is undefined', () => {
    expect(deriveTurnContext(undefined)).toEqual(DEFAULT_CONTEXT);
  });

  it('returns a fresh object each time for null input (no shared reference)', () => {
    const a = deriveTurnContext(null);
    const b = deriveTurnContext(null);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('derives a baseline healthy combatant', () => {
    const ctx = deriveTurnContext(mkCombatant());
    expect(ctx).toEqual({
      canAct: true,
      isStunned: false,
      isProne: false,
      isGrappled: false,
      isUnconscious: false,
      shockPenalty: 0,
      moveAvailable: 5
    });
  });

  it('ignores the legacy isStunned boolean (folded into conditions by the 12a.6 migration)', () => {
    const ctx = deriveTurnContext(mkCombatant({ isStunned: true }));
    expect(ctx.isStunned).toBe(false);
  });

  it('detects stunned via condition entry', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: ConditionId.STUNNED }] })
    );
    expect(ctx.isStunned).toBe(true);
  });

  it('detects prone via boolean flag', () => {
    const ctx = deriveTurnContext(mkCombatant({ isProne: true }));
    expect(ctx.isProne).toBe(true);
  });

  it('detects prone via condition entry', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: ConditionId.PRONE }] })
    );
    expect(ctx.isProne).toBe(true);
  });

  it('detects grappled via boolean flag', () => {
    const ctx = deriveTurnContext(mkCombatant({ isGrappled: true }));
    expect(ctx.isGrappled).toBe(true);
  });

  it('detects grappled via condition entry', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: ConditionId.GRAPPLED }] })
    );
    expect(ctx.isGrappled).toBe(true);
  });

  it('ignores the legacy isUnconscious boolean (folded into conditions by the 12a.6 migration)', () => {
    const ctx = deriveTurnContext(mkCombatant({ isUnconscious: true }));
    expect(ctx.isUnconscious).toBe(false);
    expect(ctx.canAct).toBe(true);
  });

  it('treats isDead as unconscious for canAct purposes', () => {
    const ctx = deriveTurnContext(mkCombatant({ isDead: true }));
    expect(ctx.isUnconscious).toBe(true);
    expect(ctx.canAct).toBe(false);
  });

  it('detects unconscious via condition entry', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: ConditionId.UNCONSCIOUS }] })
    );
    expect(ctx.isUnconscious).toBe(true);
    expect(ctx.canAct).toBe(false);
  });

  it('propagates shockPenalty', () => {
    const ctx = deriveTurnContext(mkCombatant({ shockPenalty: -3 }));
    expect(ctx.shockPenalty).toBe(-3);
  });

  it('defaults shockPenalty to 0 when missing', () => {
    const combatant = mkCombatant();
    delete combatant.shockPenalty;
    const ctx = deriveTurnContext(combatant);
    expect(ctx.shockPenalty).toBe(0);
  });

  it('preserves explicit shockPenalty of 0', () => {
    const ctx = deriveTurnContext(mkCombatant({ shockPenalty: 0 }));
    expect(ctx.shockPenalty).toBe(0);
  });

  it('reports basicMove as moveAvailable', () => {
    const ctx = deriveTurnContext(mkCombatant({ basicMove: 7 }));
    expect(ctx.moveAvailable).toBe(7);
  });

  it('reports moveAvailable as null when basicMove is missing', () => {
    const combatant = mkCombatant();
    delete combatant.basicMove;
    const ctx = deriveTurnContext(combatant);
    expect(ctx.moveAvailable).toBeNull();
  });

  it('handles a combatant with no conditions field', () => {
    const combatant = mkCombatant();
    delete combatant.conditions;
    const ctx = deriveTurnContext(combatant);
    expect(ctx.isStunned).toBe(false);
    expect(ctx.isProne).toBe(false);
    expect(ctx.isGrappled).toBe(false);
    expect(ctx.isUnconscious).toBe(false);
  });

  it('combines multiple conditions independently', () => {
    const ctx = deriveTurnContext(
      mkCombatant({
        conditions: [
          { conditionId: ConditionId.STUNNED },
          { conditionId: ConditionId.PRONE },
          { conditionId: ConditionId.GRAPPLED }
        ]
      })
    );
    expect(ctx.isStunned).toBe(true);
    expect(ctx.isProne).toBe(true);
    expect(ctx.isGrappled).toBe(true);
    expect(ctx.isUnconscious).toBe(false);
    expect(ctx.canAct).toBe(true);
  });

  it('canAct is true for a stunned but conscious combatant', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: ConditionId.STUNNED }] })
    );
    expect(ctx.canAct).toBe(true);
  });

  it('ignores unrelated conditions', () => {
    const ctx = deriveTurnContext(
      mkCombatant({ conditions: [{ conditionId: 'shaken' }] })
    );
    expect(ctx.isStunned).toBe(false);
    expect(ctx.isProne).toBe(false);
    expect(ctx.isGrappled).toBe(false);
    expect(ctx.isUnconscious).toBe(false);
  });
});
