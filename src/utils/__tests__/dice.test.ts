import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  parseDiceExpression,
  roll,
  rollVsTarget,
  formatRoll,
} from '../dice';

// TODO(types): parseDiceExpression's expression parameter excludes the null crash-path input its runtime rejects gracefully.
const parseMalformedDiceExpression = parseDiceExpression as (
  expression: unknown
) => ReturnType<typeof parseDiceExpression>;

// TODO(types): rollVsTarget's target parameter excludes the non-numeric crash-path input its runtime rejects gracefully.
const rollVsMalformedTarget = rollVsTarget as (
  expression: string,
  target: unknown
) => ReturnType<typeof rollVsTarget>;

describe('parseDiceExpression', () => {
  it('parses a standard XdY expression', () => {
    const result = parseDiceExpression('3d6');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(0);
  });

  it('parses XdY+Z with positive modifier', () => {
    const result = parseDiceExpression('2d6+3');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(3);
  });

  it('parses XdY-Z with negative modifier', () => {
    const result = parseDiceExpression('4d6-2');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(4);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(-2);
  });

  it('defaults to d6 when sides are omitted', () => {
    const result = parseDiceExpression('2d+1');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(1);
  });

  it('parses a constant integer as a modifier-only expression', () => {
    const result = parseDiceExpression('5');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
    expect(result.sides).toBe(0);
    expect(result.modifier).toBe(5);
  });

  it('parses a negative constant', () => {
    const result = parseDiceExpression('-3');
    expect(result.valid).toBe(true);
    expect(result.modifier).toBe(-3);
  });

  it('trims whitespace and is case-insensitive', () => {
    const result = parseDiceExpression('  3D6+1  ');
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(1);
  });

  it('rejects an empty string', () => {
    const result = parseDiceExpression('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid expression');
  });

  it('rejects a non-string input', () => {
    const result = parseMalformedDiceExpression(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid expression');
  });

  it('rejects malformed expressions', () => {
    const result = parseDiceExpression('foo');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid dice format');
  });

  it('rejects dice count above 100', () => {
    const result = parseDiceExpression('101d6');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Dice count must be 1-100');
  });

  it('rejects dice sides below 2', () => {
    const result = parseDiceExpression('3d1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Dice sides must be 2-100');
  });

  it('rejects dice sides above 100', () => {
    const result = parseDiceExpression('3d101');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Dice sides must be 2-100');
  });
});

describe('roll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls the right number of dice and sums them with the modifier', () => {
    // Math.random() => 0.5 → Math.floor(0.5 * 6) + 1 = 4
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = roll('3d6+2');
    expect(result.valid).toBe(true);
    expect(result.dice).toEqual([4, 4, 4]);
    expect(result.modifier).toBe(2);
    expect(result.total).toBe(14);
    expect(result.expression).toBe('3d6+2');
  });

  it('returns die values within [1, sides] for many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const result = roll('5d6');
      expect(result.valid).toBe(true);
      expect(result.dice).toHaveLength(5);
      for (const die of result.dice) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
      expect(result.total).toBe(result.dice.reduce((a, b) => a + b, 0));
    }
  });

  it('handles a constant-only expression with no dice', () => {
    const result = roll('7');
    expect(result.valid).toBe(true);
    expect(result.dice).toEqual([]);
    expect(result.modifier).toBe(7);
    expect(result.total).toBe(7);
  });

  it('returns an invalid result for a malformed expression', () => {
    const result = roll('not-a-roll');
    expect(result.valid).toBe(false);
    expect(result.dice).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.error).toBe('Invalid dice format');
    expect(result.expression).toBe('not-a-roll');
  });
});

describe('rollVsTarget', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports success when total <= target with positive margin', () => {
    // Force total of 10 (3d6: 4+4+4=12, but use 1d to control easily)
    vi.spyOn(Math, 'random').mockReturnValue(0); // every die rolls 1
    const result = rollVsTarget('3d6', 14);
    expect(result.total).toBe(3);
    expect(result.target).toBe(14);
    expect(result.margin).toBe(11);
    expect(result.success).toBe(true);
  });

  it('reports failure when total > target with negative margin', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999); // every die rolls max
    const result = rollVsTarget('3d6', 10);
    expect(result.total).toBe(18);
    expect(result.target).toBe(10);
    expect(result.margin).toBe(-8);
    expect(result.success).toBe(false);
  });

  it('propagates parse errors and marks failure', () => {
    const result = rollVsTarget('garbage', 12);
    expect(result.valid).toBe(false);
    expect(result.success).toBe(false);
    expect(result.target).toBe(12);
    expect(result.margin).toBe(0);
    expect(result.error).toBe('Invalid dice format');
  });

  it('rejects a non-numeric target', () => {
    const result = rollVsMalformedTarget('3d6', 'high');
    expect(result.valid).toBe(false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid target number');
  });
});

describe('formatRoll', () => {
  it('formats a basic roll with dice and modifier', () => {
    const out = formatRoll({
      expression: '3d6+2',
      dice: [3, 4, 5],
      modifier: 2,
      total: 14,
      valid: true,
    });
    expect(out).toBe('3d6+2: [3, 4, 5]+2 = 14');
  });

  it('omits the modifier when zero', () => {
    const out = formatRoll({
      expression: '3d6',
      dice: [1, 2, 3],
      modifier: 0,
      total: 6,
      valid: true,
    });
    expect(out).toBe('3d6: [1, 2, 3] = 6');
  });

  it('formats a negative modifier without an extra sign', () => {
    const out = formatRoll({
      expression: '3d6-2',
      dice: [4, 4, 4],
      modifier: -2,
      total: 10,
      valid: true,
    });
    expect(out).toBe('3d6-2: [4, 4, 4]-2 = 10');
  });

  it('formats a constant-only roll as just the total', () => {
    const out = formatRoll({
      expression: '5',
      dice: [],
      modifier: 5,
      total: 5,
      valid: true,
    });
    expect(out).toBe('5');
  });

  it('formats a vs-target SUCCESS result', () => {
    const out = formatRoll({
      expression: '3d6',
      dice: [3, 4, 3],
      modifier: 0,
      total: 10,
      valid: true,
      target: 14,
      margin: 4,
      success: true,
    });
    expect(out).toBe('3d6: [3, 4, 3] = 10 vs 14 [+4] SUCCESS');
  });

  it('formats a vs-target FAILURE result with negative margin', () => {
    const out = formatRoll({
      expression: '3d6',
      dice: [6, 6, 6],
      modifier: 0,
      total: 18,
      valid: true,
      target: 10,
      margin: -8,
      success: false,
    });
    expect(out).toBe('3d6: [6, 6, 6] = 18 vs 10 [-8] FAILURE');
  });

  it('formats invalid roll results', () => {
    const out = formatRoll({
      expression: 'bad',
      dice: [],
      modifier: 0,
      total: 0,
      valid: false,
      error: 'Invalid dice format',
    });
    expect(out).toBe('Invalid roll: Invalid dice format');
  });
});
