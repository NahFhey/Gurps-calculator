import { describe, expect, it } from 'vitest';
import {
  sumModifiers,
  calculateEffective,
  getPresetModifier,
  createModifier,
  normalizeModifiers,
  ATTACK_MODIFIERS,
  DEFENSE_MODIFIERS,
  DAMAGE_MODIFIERS,
  type Modifier,
} from '../modifiers';

describe('sumModifiers', () => {
  it('returns 0 for an empty array', () => {
    expect(sumModifiers([])).toBe(0);
  });

  it('sums positive and negative values', () => {
    const mods: Modifier[] = [
      { label: 'a', value: 4 },
      { label: 'b', value: -2 },
      { label: 'c', value: 1 },
    ];
    expect(sumModifiers(mods)).toBe(3);
  });

  it('treats non-numeric values as 0', () => {
    const mods = [
      { label: 'a', value: 2 },
      { label: 'b', value: 'bad' as unknown as number },
      { label: 'c', value: null as unknown as number },
    ];
    expect(sumModifiers(mods)).toBe(2);
  });

  it('returns 0 when given a non-array', () => {
    expect(sumModifiers(null as unknown as Modifier[])).toBe(0);
    expect(sumModifiers(undefined as unknown as Modifier[])).toBe(0);
    expect(sumModifiers('oops' as unknown as Modifier[])).toBe(0);
  });
});

describe('calculateEffective', () => {
  it('adds modifiers to the base', () => {
    const result = calculateEffective(14, [
      { label: 'AoA', value: 4 },
      { label: 'Dark', value: -10 },
    ]);
    expect(result).toBe(8);
  });

  it('returns base when no modifiers given', () => {
    expect(calculateEffective(12, [])).toBe(12);
  });

  it('treats non-numeric base as 0', () => {
    const result = calculateEffective(
      'bad' as unknown as number,
      [{ label: 'a', value: 3 }],
    );
    expect(result).toBe(3);
  });
});

describe('getPresetModifier', () => {
  it('returns an attack preset by key', () => {
    const preset = getPresetModifier('attack', 'AOA_DETERMINED_MELEE');
    expect(preset).not.toBeNull();
    expect(preset?.value).toBe(4);
    expect(preset?.requireInput).toBe(false);
  });

  it('returns a defense preset by key', () => {
    const preset = getPresetModifier('defense', 'STUNNED');
    expect(preset?.value).toBe(-4);
  });

  it('returns a damage preset by key', () => {
    const preset = getPresetModifier('damage', 'AOA_STRONG');
    expect(preset?.value).toBe(2);
    expect(preset?.note).toContain('per die');
  });

  it('returns null for an unknown key', () => {
    expect(getPresetModifier('attack', 'NOPE_NOT_REAL')).toBeNull();
  });

  it('returns null for an unknown category', () => {
    expect(
      getPresetModifier('nonsense' as unknown as 'attack', 'CUSTOM'),
    ).toBeNull();
  });

  it('returns presets requiring input with value=null', () => {
    const preset = getPresetModifier('attack', 'DECEPTIVE_ATTACK');
    expect(preset?.requireInput).toBe(true);
    expect(preset?.value).toBeNull();
    expect(preset?.placeholder).toBeDefined();
  });
});

describe('createModifier', () => {
  it('builds a modifier from label and value', () => {
    expect(createModifier('Aim', 2)).toEqual({ label: 'Aim', value: 2 });
  });

  it('defaults label when falsy', () => {
    expect(createModifier('', 5)).toEqual({ label: 'Unknown', value: 5 });
  });

  it('defaults value to 0 when non-numeric', () => {
    const mod = createModifier('x', 'bad' as unknown as number);
    expect(mod.value).toBe(0);
  });
});

describe('normalizeModifiers', () => {
  it('returns [] for a non-array input', () => {
    expect(normalizeModifiers(null as unknown as unknown[])).toEqual([]);
    expect(normalizeModifiers('nope' as unknown as unknown[])).toEqual([]);
  });

  it('passes through valid modifiers', () => {
    const input = [{ label: 'a', value: 3 }];
    expect(normalizeModifiers(input)).toEqual([{ label: 'a', value: 3 }]);
  });

  it('replaces non-object entries with Invalid/0', () => {
    const result = normalizeModifiers([null, undefined, 42, 'oops']);
    expect(result).toHaveLength(4);
    for (const r of result) {
      expect(r).toEqual({ label: 'Invalid', value: 0 });
    }
  });

  it('coerces missing or wrong-typed fields', () => {
    const result = normalizeModifiers([
      { label: 'a' },
      { value: 5 },
      { label: 7, value: 'bad' },
    ]);
    expect(result[0]).toEqual({ label: 'a', value: 0 });
    expect(result[1]).toEqual({ label: 'Unknown', value: 5 });
    expect(result[2]).toEqual({ label: '7', value: 0 });
  });
});

describe('preset modifier tables', () => {
  it('expose a CUSTOM entry in every category', () => {
    expect(ATTACK_MODIFIERS.CUSTOM.requireInput).toBe(true);
    expect(DEFENSE_MODIFIERS.CUSTOM.requireInput).toBe(true);
    expect(DAMAGE_MODIFIERS.CUSTOM.requireInput).toBe(true);
  });

  it('have non-empty labels for every preset', () => {
    const all = [
      ...Object.values(ATTACK_MODIFIERS),
      ...Object.values(DEFENSE_MODIFIERS),
      ...Object.values(DAMAGE_MODIFIERS),
    ];
    for (const preset of all) {
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });
});
