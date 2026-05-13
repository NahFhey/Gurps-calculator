import { describe, it, expect } from 'vitest';
import {
  DAMAGE_TYPES,
  DAMAGE_TYPE_LABELS,
  getBaseWoundingMultiplier,
  getWoundingMultiplier,
  calculateInjury,
  getDamageTypeOptions,
  isValidDamageType,
  type HitLocation,
} from '../wounding';

describe('getBaseWoundingMultiplier', () => {
  it('returns correct multipliers for known damage types', () => {
    expect(getBaseWoundingMultiplier(DAMAGE_TYPES.CR)).toBe(1);
    expect(getBaseWoundingMultiplier(DAMAGE_TYPES.CUT)).toBe(1.5);
    expect(getBaseWoundingMultiplier(DAMAGE_TYPES.IMP)).toBe(2);
    expect(getBaseWoundingMultiplier(DAMAGE_TYPES.PI_MINUS)).toBe(0.5);
    expect(getBaseWoundingMultiplier(DAMAGE_TYPES.PI_PLUSPLUS)).toBe(2);
  });

  it('returns 1 for unknown damage type', () => {
    expect(getBaseWoundingMultiplier('bogus')).toBe(1);
    expect(getBaseWoundingMultiplier('')).toBe(1);
  });
});

describe('getWoundingMultiplier', () => {
  it('returns base multiplier when no location given', () => {
    expect(getWoundingMultiplier(DAMAGE_TYPES.CUT)).toBe(1.5);
    expect(getWoundingMultiplier(DAMAGE_TYPES.IMP, null)).toBe(2);
  });

  it('skull boosts imp/pi+/pi++ to x4, pi to x3, cr to x2', () => {
    const skull: HitLocation = { key: 'skull', label: 'Skull' };
    expect(getWoundingMultiplier(DAMAGE_TYPES.IMP, skull)).toBe(4);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI_PLUS, skull)).toBe(4);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI_PLUSPLUS, skull)).toBe(4);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI, skull)).toBe(3);
    expect(getWoundingMultiplier(DAMAGE_TYPES.CR, skull)).toBe(2);
  });

  it('face boosts imp/pi+/pi++ to x4 and pi to x3, but not cr', () => {
    const face: HitLocation = { key: 'face', label: 'Face' };
    expect(getWoundingMultiplier(DAMAGE_TYPES.IMP, face)).toBe(4);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI, face)).toBe(3);
    expect(getWoundingMultiplier(DAMAGE_TYPES.CR, face)).toBe(1);
  });

  it('neck boosts imp/pi+/pi++ to x3 and cut to x2', () => {
    const neck: HitLocation = { key: 'neck', label: 'Neck' };
    expect(getWoundingMultiplier(DAMAGE_TYPES.IMP, neck)).toBe(3);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI_PLUSPLUS, neck)).toBe(3);
    expect(getWoundingMultiplier(DAMAGE_TYPES.CUT, neck)).toBe(2);
  });

  it('extremities cap imp/pi/pi+/pi++ at x1', () => {
    const arm: HitLocation = { key: 'arm', label: 'Arm', isExtremity: true };
    expect(getWoundingMultiplier(DAMAGE_TYPES.IMP, arm)).toBe(1);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI_PLUS, arm)).toBe(1);
    expect(getWoundingMultiplier(DAMAGE_TYPES.PI, arm)).toBe(1);
    // cut still uses base
    expect(getWoundingMultiplier(DAMAGE_TYPES.CUT, arm)).toBe(1.5);
  });

  it('falls through to base for unmodified location/type combos', () => {
    const torso: HitLocation = { key: 'torso', label: 'Torso' };
    expect(getWoundingMultiplier(DAMAGE_TYPES.CR, torso)).toBe(1);
    expect(getWoundingMultiplier(DAMAGE_TYPES.CUT, torso)).toBe(1.5);
  });

  it('returns 1 for unknown damage type with no location modifier', () => {
    expect(getWoundingMultiplier('mystery')).toBe(1);
  });
});

describe('calculateInjury', () => {
  it('returns 0 for non-positive penetrating damage', () => {
    expect(calculateInjury(0, DAMAGE_TYPES.CUT)).toBe(0);
    expect(calculateInjury(-5, DAMAGE_TYPES.IMP)).toBe(0);
  });

  it('floors the result of penetrating * multiplier', () => {
    // 5 * 1.5 = 7.5 → 7
    expect(calculateInjury(5, DAMAGE_TYPES.CUT)).toBe(7);
    // 3 * 0.5 = 1.5 → 1
    expect(calculateInjury(3, DAMAGE_TYPES.PI_MINUS)).toBe(1);
  });

  it('applies location modifier (skull imp x4)', () => {
    const skull: HitLocation = { key: 'skull', label: 'Skull' };
    expect(calculateInjury(3, DAMAGE_TYPES.IMP, skull)).toBe(12);
  });

  it('extremity caps impaling injury at penetrating x1', () => {
    const leg: HitLocation = { key: 'leg', label: 'Leg', isExtremity: true };
    expect(calculateInjury(10, DAMAGE_TYPES.IMP, leg)).toBe(10);
  });
});

describe('getDamageTypeOptions', () => {
  it('returns one option per damage type with matching labels', () => {
    const options = getDamageTypeOptions();
    expect(options).toHaveLength(Object.keys(DAMAGE_TYPE_LABELS).length);
    const cr = options.find((o) => o.value === DAMAGE_TYPES.CR);
    expect(cr?.label).toBe('Crushing');
  });
});

describe('isValidDamageType', () => {
  it('returns true for known damage types', () => {
    expect(isValidDamageType('cr')).toBe(true);
    expect(isValidDamageType('pi++')).toBe(true);
  });

  it('returns false for unknown strings', () => {
    expect(isValidDamageType('bogus')).toBe(false);
    expect(isValidDamageType('')).toBe(false);
  });
});
