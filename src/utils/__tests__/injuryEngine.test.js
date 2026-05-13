import { describe, expect, it } from 'vitest';
import {
  resolveInjury,
  createInjuryBreakdown,
  createHitLocationLog,
  applyInjuryToHP,
  formatInjurySummary,
} from '../injuryEngine';

const torso = { key: 'torso', label: 'Torso' };
const skull = { key: 'skull', label: 'Skull', isVital: true };
const hand = { key: 'hand', label: 'Hand', isExtremity: true, isLimb: true };

describe('resolveInjury', () => {
  it('subtracts DR from raw damage to compute penetrating', () => {
    const target = { dr: 3 };
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'cr',
      location: null,
      target,
    });
    expect(result.locationDR).toBe(3);
    expect(result.penetrating).toBe(7);
    expect(result.injury).toBe(7);
    expect(result.woundingMultiplier).toBe(1);
    expect(result.location).toBeNull();
  });

  it('floors penetrating damage at zero when DR exceeds raw damage', () => {
    const result = resolveInjury({
      rawDamage: 2,
      damageType: 'cut',
      location: null,
      target: { dr: 5 },
    });
    expect(result.penetrating).toBe(0);
    expect(result.injury).toBe(0);
  });

  it('uses location DR when a location is provided', () => {
    const target = { drByLocation: { torso: 4 }, dr: 0 };
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'cut',
      location: torso,
      target,
    });
    expect(result.locationDR).toBe(4);
    expect(result.penetrating).toBe(6);
    // cut wounding multiplier is 1.5, floor(6 * 1.5) = 9
    expect(result.injury).toBe(9);
    expect(result.woundingMultiplier).toBe(1.5);
    expect(result.location).toEqual({
      key: 'torso',
      label: 'Torso',
      isVital: false,
      isLimb: false,
      isExtremity: false,
    });
  });

  it('applies skull wounding multipliers for impaling damage', () => {
    const target = { drByLocation: { skull: 2 }, dr: 0 };
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'imp',
      location: skull,
      target,
    });
    expect(result.locationDR).toBe(2);
    expect(result.penetrating).toBe(8);
    // skull + imp = x4
    expect(result.woundingMultiplier).toBe(4);
    expect(result.baseWoundingMultiplier).toBe(2);
    expect(result.locationWoundingMultiplier).toBe(2);
    expect(result.injury).toBe(32);
    expect(result.location?.isVital).toBe(true);
  });

  it('lite preset disables wounding multipliers', () => {
    const target = { drByLocation: { skull: 0 }, dr: 0 };
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'imp',
      location: skull,
      target,
      combatRulesPreset: 'lite',
    });
    expect(result.penetrating).toBe(10);
    expect(result.injury).toBe(10);
    expect(result.woundingMultiplier).toBe(1);
    expect(result.baseWoundingMultiplier).toBe(1);
    expect(result.locationWoundingMultiplier).toBe(1);
  });

  it('caps extremity wounding multiplier at 1 for impaling', () => {
    const target = { drByLocation: { hand: 0 }, dr: 0 };
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'imp',
      location: hand,
      target,
    });
    expect(result.woundingMultiplier).toBe(1);
    expect(result.injury).toBe(10);
    expect(result.location?.isExtremity).toBe(true);
    expect(result.location?.isLimb).toBe(true);
  });

  it('falls back to target.dr when no location is provided', () => {
    const result = resolveInjury({
      rawDamage: 5,
      damageType: 'cr',
      location: null,
      target: {},
    });
    expect(result.locationDR).toBe(0);
    expect(result.penetrating).toBe(5);
  });
});

describe('createInjuryBreakdown', () => {
  it('extracts the structured breakdown fields from a result', () => {
    const result = resolveInjury({
      rawDamage: 8,
      damageType: 'cut',
      location: torso,
      target: { drByLocation: { torso: 2 } },
    });
    const breakdown = createInjuryBreakdown(result);
    expect(breakdown).toEqual({
      raw: 8,
      dr: 2,
      penetrating: 6,
      damageType: 'cut',
      woundingMultiplier: 1.5,
      baseWoundingMultiplier: 1.5,
      locationWoundingMultiplier: 1,
      locationLabel: 'Torso',
      injuryApplied: 9,
    });
  });

  it('uses null location label when no location is provided', () => {
    const result = resolveInjury({
      rawDamage: 4,
      damageType: 'cr',
      location: null,
      target: { dr: 1 },
    });
    expect(createInjuryBreakdown(result).locationLabel).toBeNull();
  });
});

describe('createHitLocationLog', () => {
  it('returns minimal data when no roll is supplied', () => {
    const log = createHitLocationLog('humanoid', torso);
    expect(log).toEqual({
      profileId: 'humanoid',
      locationKey: 'torso',
      locationLabel: 'Torso',
      rolled: null,
    });
  });

  it('captures roll details when supplied', () => {
    const log = createHitLocationLog('humanoid', skull, { dice: '3d6', total: 4 });
    expect(log.rolled).toEqual({ dice: '3d6', total: 4 });
    expect(log.locationKey).toBe('skull');
  });
});

describe('applyInjuryToHP', () => {
  it('subtracts injury from current HP', () => {
    expect(applyInjuryToHP(10, 3)).toBe(7);
  });

  it('can produce negative HP', () => {
    expect(applyInjuryToHP(2, 5)).toBe(-3);
  });

  it('returns current HP unchanged when injury is zero', () => {
    expect(applyInjuryToHP(10, 0)).toBe(10);
  });
});

describe('formatInjurySummary', () => {
  it('formats summary with location, DR, multiplier, and injury', () => {
    const result = resolveInjury({
      rawDamage: 10,
      damageType: 'imp',
      location: skull,
      target: { drByLocation: { skull: 2 } },
    });
    const summary = formatInjurySummary(result);
    expect(summary).toBe('10 damage to Skull (- 2 DR) = 8 penetrating × 4 = 32 injury');
  });

  it('omits DR phrase when DR is zero', () => {
    const result = resolveInjury({
      rawDamage: 6,
      damageType: 'cr',
      location: null,
      target: { dr: 0 },
    });
    const summary = formatInjurySummary(result);
    expect(summary).toBe('6 damage = 6 penetrating = 6 injury');
  });

  it('omits multiplier phrase when multiplier is 1', () => {
    const result = resolveInjury({
      rawDamage: 5,
      damageType: 'cr',
      location: torso,
      target: { drByLocation: { torso: 1 } },
    });
    const summary = formatInjurySummary(result);
    expect(summary).toBe('5 damage to Torso (- 1 DR) = 4 penetrating = 4 injury');
  });
});
