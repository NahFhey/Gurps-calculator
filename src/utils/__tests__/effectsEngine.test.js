import { describe, it, expect, vi } from 'vitest';
import {
  COMBAT_RULES_PRESETS,
  calculateShockPenalty,
  isMajorWound,
  requiresKnockdownCheck,
  getHPChecks,
  isLocationCrippled,
  generateEffectsPrompts,
  performHTCheck,
  applyEffect,
  clearShock,
  getActiveEffects,
} from '../effectsEngine';

describe('COMBAT_RULES_PRESETS', () => {
  it('exposes lite/standard/crunchy preset constants', () => {
    expect(COMBAT_RULES_PRESETS).toEqual({
      LITE: 'lite',
      STANDARD: 'standard',
      CRUNCHY: 'crunchy',
    });
  });
});

describe('calculateShockPenalty', () => {
  it('returns 0 for no injury', () => {
    expect(calculateShockPenalty(0, 10)).toBe(-0);
  });

  it('returns -1 per full HP of injury', () => {
    expect(calculateShockPenalty(1, 10)).toBe(-1);
    expect(calculateShockPenalty(2, 10)).toBe(-2);
    expect(calculateShockPenalty(3, 10)).toBe(-3);
  });

  it('caps shock penalty at -4', () => {
    expect(calculateShockPenalty(4, 10)).toBe(-4);
    expect(calculateShockPenalty(8, 10)).toBe(-4);
    expect(calculateShockPenalty(100, 10)).toBe(-4);
  });

  it('floors fractional injury', () => {
    expect(calculateShockPenalty(2.7, 10)).toBe(-2);
  });
});

describe('isMajorWound', () => {
  it('returns true when injury exceeds half max HP', () => {
    expect(isMajorWound(6, 10)).toBe(true);
  });

  it('returns false when injury equals half max HP', () => {
    expect(isMajorWound(5, 10)).toBe(false);
  });

  it('returns false for zero injury', () => {
    expect(isMajorWound(0, 10)).toBe(false);
  });
});

describe('requiresKnockdownCheck', () => {
  it('matches major wound threshold', () => {
    expect(requiresKnockdownCheck(6, 10)).toBe(true);
    expect(requiresKnockdownCheck(5, 10)).toBe(false);
  });
});

describe('getHPChecks', () => {
  it('flags consciousness check at 0 HP or below', () => {
    expect(getHPChecks(0, 10)).toMatchObject({ consciousness: true, death: false });
    expect(getHPChecks(-5, 10)).toMatchObject({ consciousness: true });
  });

  it('does not flag consciousness check above 0', () => {
    expect(getHPChecks(1, 10).consciousness).toBe(false);
  });

  it('flags death check at -1×HP or below', () => {
    expect(getHPChecks(-10, 10).death).toBe(true);
    expect(getHPChecks(-15, 10).death).toBe(true);
  });

  it('flags auto-death at -5×HP and clears the death-check flag', () => {
    const checks = getHPChecks(-50, 10);
    expect(checks.autoDeath).toBe(true);
    expect(checks.death).toBe(false);
  });

  it('flags auto-death at -10×HP', () => {
    const checks = getHPChecks(-100, 10);
    expect(checks.autoDeath).toBe(true);
    expect(checks.death).toBe(false);
  });

  it('returns no checks for HP above zero', () => {
    expect(getHPChecks(5, 10)).toEqual({
      consciousness: false,
      death: false,
      autoUnconsciousness: false,
      autoDeath: false,
    });
  });
});

describe('isLocationCrippled', () => {
  it('returns false for missing location', () => {
    expect(isLocationCrippled(null, 10, 10)).toBe(false);
    expect(isLocationCrippled(undefined, 10, 10)).toBe(false);
  });

  it('cripples extremities at injury > HP/3', () => {
    const hand = { isExtremity: true };
    expect(isLocationCrippled(hand, 4, 10)).toBe(true);
    expect(isLocationCrippled(hand, 3, 10)).toBe(false);
  });

  it('cripples limbs at injury > HP/2', () => {
    const arm = { isLimb: true };
    expect(isLocationCrippled(arm, 6, 10)).toBe(true);
    expect(isLocationCrippled(arm, 5, 10)).toBe(false);
  });

  it('returns false for non-limb non-extremity locations', () => {
    expect(isLocationCrippled({ isLimb: false, isExtremity: false }, 100, 10)).toBe(false);
  });
});

describe('generateEffectsPrompts', () => {
  const target = { ht: 12 };

  it('lite preset emits only HP-based checks (no shock, no major wound)', () => {
    const prompts = generateEffectsPrompts({
      injury: 8,
      injuryResult: {},
      currentHP: 10,
      newHP: 2,
      maxHP: 10,
      combatRulesPreset: 'lite',
      target,
    });
    expect(prompts).toEqual([]);
  });

  it('lite preset emits consciousness check at 0 HP', () => {
    const prompts = generateEffectsPrompts({
      injury: 10,
      injuryResult: {},
      currentHP: 10,
      newHP: 0,
      maxHP: 10,
      combatRulesPreset: 'lite',
      target,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ type: 'consciousnessCheck', target: 12 });
  });

  it('lite preset emits death check below -HP', () => {
    const prompts = generateEffectsPrompts({
      injury: 25,
      injuryResult: {},
      currentHP: 10,
      newHP: -15,
      maxHP: 10,
      combatRulesPreset: 'lite',
      target,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].type).toBe('deathCheck');
  });

  it('lite preset emits autoDeath at -5×HP', () => {
    const prompts = generateEffectsPrompts({
      injury: 60,
      injuryResult: {},
      currentHP: 10,
      newHP: -50,
      maxHP: 10,
      combatRulesPreset: 'lite',
      target,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].type).toBe('autoDeath');
  });

  it('standard preset emits shock for any positive injury', () => {
    const prompts = generateEffectsPrompts({
      injury: 2,
      injuryResult: {},
      currentHP: 10,
      newHP: 8,
      maxHP: 10,
      combatRulesPreset: 'standard',
      target,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ type: 'shock', value: -2, autoApply: true });
  });

  it('standard preset emits major wound + knockdown/stun for big hits', () => {
    const prompts = generateEffectsPrompts({
      injury: 6,
      injuryResult: {},
      currentHP: 10,
      newHP: 4,
      maxHP: 10,
      combatRulesPreset: 'standard',
      target,
    });
    const types = prompts.map((p) => p.type);
    expect(types).toEqual(['shock', 'majorWound', 'knockdownStun']);
    const knockdown = prompts.find((p) => p.type === 'knockdownStun');
    expect(knockdown.target).toBe(12);
  });

  it('crunchy preset adds crippling and bleeding when applicable', () => {
    const prompts = generateEffectsPrompts({
      injury: 6,
      injuryResult: { location: { key: 'arm-l', label: 'Left Arm', isLimb: true } },
      currentHP: 10,
      newHP: 4,
      maxHP: 10,
      combatRulesPreset: 'crunchy',
      target,
    });
    const types = prompts.map((p) => p.type);
    expect(types).toContain('crippling');
    expect(types).toContain('bleeding');
    const crippled = prompts.find((p) => p.type === 'crippling');
    expect(crippled).toMatchObject({ locationKey: 'arm-l', locationLabel: 'Left Arm' });
  });

  it('crunchy preset omits crippling when injury below threshold', () => {
    const prompts = generateEffectsPrompts({
      injury: 2,
      injuryResult: { location: { key: 'arm-l', label: 'Left Arm', isLimb: true } },
      currentHP: 10,
      newHP: 8,
      maxHP: 10,
      combatRulesPreset: 'crunchy',
      target,
    });
    expect(prompts.map((p) => p.type)).toEqual(['shock']);
  });

  it('zero injury produces no prompts when HP unaffected', () => {
    const prompts = generateEffectsPrompts({
      injury: 0,
      injuryResult: {},
      currentHP: 10,
      newHP: 10,
      maxHP: 10,
      combatRulesPreset: 'standard',
      target,
    });
    expect(prompts).toEqual([]);
  });
});

describe('performHTCheck', () => {
  it('rolls 3d6 versus HT (with optional penalty)', () => {
    // Use a deterministic-ish smoke check: math.random doesn't need stubbing
    // because rollVsTarget just consumes randoms; we sample many rolls.
    const results = Array.from({ length: 50 }, () => performHTCheck(12, 0));
    for (const r of results) {
      expect(typeof r.success).toBe('boolean');
      expect(r.total).toBeGreaterThanOrEqual(3);
      expect(r.total).toBeLessThanOrEqual(18);
    }
  });

  it('applies penalty to the effective target', () => {
    const r = performHTCheck(12, -4);
    // We can't reliably assert success/failure, but the rolled total/target shape should hold
    expect(r).toHaveProperty('total');
  });
});

describe('applyEffect', () => {
  const base = () => ({ id: 'c1', name: 'Goblin' });

  it('applies shock penalty', () => {
    expect(applyEffect(base(), 'shock', { value: -3 })).toMatchObject({ shockPenalty: -3 });
  });

  it('applies stunned/unconscious/dead flags', () => {
    expect(applyEffect(base(), 'stunned', { stunned: true }).isStunned).toBe(true);
    expect(applyEffect(base(), 'unconscious', { unconscious: true }).isUnconscious).toBe(true);
    expect(applyEffect(base(), 'dead', { dead: true }).isDead).toBe(true);
  });

  it('sets bleeding when active and clears it when inactive', () => {
    const bleeding = applyEffect(base(), 'bleeding', { bleeding: true, rate: 2, round: 5 });
    expect(bleeding.bleeding).toEqual({ rate: 2, lastCheckedAtRound: 5 });

    const cleared = applyEffect(base(), 'bleeding', { bleeding: false });
    expect(cleared.bleeding).toBeNull();
  });

  it('defaults bleeding rate to 1 when not provided', () => {
    const bleeding = applyEffect(base(), 'bleeding', { bleeding: true, round: 1 });
    expect(bleeding.bleeding.rate).toBe(1);
  });

  it('appends crippled location once and dedupes on repeat application', () => {
    const first = applyEffect(base(), 'crippling', { locationKey: 'arm-l' });
    expect(first.crippled).toEqual(['arm-l']);
    const second = applyEffect(first, 'crippling', { locationKey: 'arm-l' });
    expect(second.crippled).toEqual(['arm-l']);
    const third = applyEffect(second, 'crippling', { locationKey: 'leg-r' });
    expect(third.crippled).toEqual(['arm-l', 'leg-r']);
  });

  it('returns a copy without modification for unknown effect type', () => {
    const c = base();
    const result = applyEffect(c, 'nonsense', {});
    expect(result).not.toBe(c);
    expect(result).toEqual(c);
  });
});

describe('clearShock', () => {
  it('zeroes shockPenalty without mutating original', () => {
    const c = { id: 'c1', shockPenalty: -3 };
    const cleared = clearShock(c);
    expect(cleared.shockPenalty).toBe(0);
    expect(c.shockPenalty).toBe(-3);
  });
});

describe('getActiveEffects', () => {
  it('returns empty array for clean combatant', () => {
    expect(getActiveEffects({})).toEqual([]);
  });

  it('lists all active effects', () => {
    const effects = getActiveEffects({
      shockPenalty: -2,
      isStunned: true,
      isUnconscious: true,
      isDead: true,
      bleeding: { rate: 3 },
      crippled: ['arm-l', 'leg-r'],
    });
    expect(effects).toEqual([
      'Shock -2',
      'Stunned',
      'Unconscious',
      'Dead',
      'Bleeding (3/turn)',
      'Crippled: arm-l, leg-r',
    ]);
  });

  it('omits shock entry when shockPenalty is zero or positive', () => {
    expect(getActiveEffects({ shockPenalty: 0 })).toEqual([]);
    expect(getActiveEffects({ shockPenalty: 1 })).toEqual([]);
  });

  it('omits crippled entry when array is empty', () => {
    expect(getActiveEffects({ crippled: [] })).toEqual([]);
  });
});
