import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  parseDamageExpression,
  rollDamage,
  applyDR,
  getSwingDamage,
  getThrustDamage,
  resolveDamageExpression,
} from '../damage';

describe('parseDamageExpression', () => {
  it('parses a standard dice expression', () => {
    const result = parseDamageExpression('2d+1');
    expect(result.parseable).toBe(true);
    expect(result.expression).toBe('2d+1');
    expect(result.needsLookup).toBe(false);
    expect(result.lookupType).toBeUndefined();
  });

  it('flags swing expressions for ST lookup', () => {
    const result = parseDamageExpression('sw+2');
    expect(result.parseable).toBe(true);
    expect(result.needsLookup).toBe(true);
    expect(result.lookupType).toBe('swing');
  });

  it('flags thrust expressions for ST lookup', () => {
    const result = parseDamageExpression('thr-1');
    expect(result.parseable).toBe(true);
    expect(result.needsLookup).toBe(true);
    expect(result.lookupType).toBe('thrust');
  });

  it('lowercases and trims input', () => {
    const result = parseDamageExpression('  2D+1  ');
    expect(result.parseable).toBe(true);
    expect(result.expression).toBe('2d+1');
  });

  it('returns unparseable for empty string', () => {
    const result = parseDamageExpression('');
    expect(result.parseable).toBe(false);
    expect(result.needsLookup).toBe(false);
  });

  it('returns unparseable for non-string input', () => {
    // @ts-expect-error testing runtime guard
    const result = parseDamageExpression(null);
    expect(result.parseable).toBe(false);
  });

  it('returns unparseable for garbage input', () => {
    const result = parseDamageExpression('not-a-roll');
    expect(result.parseable).toBe(false);
    expect(result.needsLookup).toBe(false);
  });
});

describe('rollDamage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a valid result with a deterministic RNG', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = rollDamage('2d+1');
    expect(result.valid).toBe(true);
    expect(result.dice).toHaveLength(2);
    expect(result.modifier).toBe(1);
    const sumOfDice = result.dice.reduce((acc, d) => acc + d, 0);
    expect(result.total).toBe(sumOfDice + 1);
  });

  it('returns invalid for unparseable expression', () => {
    const result = rollDamage('not-a-roll');
    expect(result.valid).toBe(false);
  });
});

describe('applyDR', () => {
  it('subtracts DR from raw damage', () => {
    expect(applyDR(10, 3)).toEqual({ raw: 10, dr: 3, penetrating: 7 });
  });

  it('floors penetrating at zero when DR exceeds damage', () => {
    expect(applyDR(2, 5)).toEqual({ raw: 2, dr: 5, penetrating: 0 });
  });

  it('defaults DR to 0 when omitted', () => {
    expect(applyDR(7)).toEqual({ raw: 7, dr: 0, penetrating: 7 });
  });

  it('throws when given non-numeric inputs', () => {
    // @ts-expect-error testing runtime guard
    expect(() => applyDR('5', 1)).toThrow(/numeric/);
  });
});

describe('getSwingDamage', () => {
  it('returns 1d-2 at the low end (ST <= 8)', () => {
    expect(getSwingDamage(1)).toBe('1d-2');
    expect(getSwingDamage(8)).toBe('1d-2');
  });

  it('returns canonical mid-range values', () => {
    expect(getSwingDamage(9)).toBe('1d-1');
    expect(getSwingDamage(10)).toBe('1d');
    expect(getSwingDamage(13)).toBe('1d+1');
    expect(getSwingDamage(20)).toBe('2d');
  });

  it('caps at 6d for very high ST', () => {
    expect(getSwingDamage(81)).toBe('6d');
    expect(getSwingDamage(200)).toBe('6d');
  });
});

describe('getThrustDamage', () => {
  it('returns 1d-2 at the low end (ST <= 10)', () => {
    expect(getThrustDamage(1)).toBe('1d-2');
    expect(getThrustDamage(10)).toBe('1d-2');
  });

  it('returns canonical mid-range values', () => {
    expect(getThrustDamage(11)).toBe('1d-1');
    expect(getThrustDamage(13)).toBe('1d');
    expect(getThrustDamage(20)).toBe('1d+1');
    expect(getThrustDamage(28)).toBe('2d');
  });

  it('caps at 5d for very high ST', () => {
    expect(getThrustDamage(81)).toBe('5d');
    expect(getThrustDamage(200)).toBe('5d');
  });
});

describe('resolveDamageExpression', () => {
  it('passes through dice expressions unchanged', () => {
    const result = resolveDamageExpression('2d+1', 10);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('2d+1');
  });

  it('resolves sw with positive modifier against ST', () => {
    // ST 12 swing = 1d, +2 modifier => 1d+2
    const result = resolveDamageExpression('sw+2', 12);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('1d+2');
  });

  it('resolves thr with negative modifier and folds modifiers', () => {
    // ST 13 thrust = 1d, -1 modifier => 1d-1
    const result = resolveDamageExpression('thr-1', 13);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('1d-1');
  });

  it('cancels modifiers that sum to zero', () => {
    // ST 9 swing = 1d-1, +1 modifier => 1d (modifier dropped)
    const result = resolveDamageExpression('sw+1', 9);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('1d');
  });

  it('resolves bare sw using default ST 10', () => {
    // ST 10 swing = 1d
    const result = resolveDamageExpression('sw');
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('1d');
  });

  it('returns invalid for unparseable input', () => {
    const result = resolveDamageExpression('garbage', 10);
    expect(result.valid).toBe(false);
    expect(result.resolved).toBe('garbage');
  });
});
