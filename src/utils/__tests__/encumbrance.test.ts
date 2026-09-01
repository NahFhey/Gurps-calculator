import { describe, it, expect } from 'vitest';
import {
  calculateBasicLift,
  getEncumbranceThresholds,
  getEncumbranceLevel,
  calculateCarriedWeight,
  calculateEncumbrance,
  calculateLocationDR,
  calculateCharacterEncumbrance,
  getWorstGroupEncumbranceLevel,
} from '../encumbrance';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Equipment, PrimaryAttributes, SecondaryAttributes } from '../../types/characterSheet';

// ============================================================================
// Basic Lift (GURPS B17: BL = ST×ST / 5)
// ============================================================================

describe('calculateBasicLift', () => {
  it('returns 0 for ST 0 or negative', () => {
    expect(calculateBasicLift(0)).toBe(0);
    expect(calculateBasicLift(-5)).toBe(0);
  });

  it('calculates BL for ST 10 (standard human)', () => {
    // 10×10/5 = 20
    expect(calculateBasicLift(10)).toBe(20);
  });

  it('calculates BL for ST 8', () => {
    // 8×8/5 = 12.8 → rounds to 13
    expect(calculateBasicLift(8)).toBe(13);
  });

  it('calculates BL for ST 12', () => {
    // 12×12/5 = 28.8 → rounds to 29
    expect(calculateBasicLift(12)).toBe(29);
  });

  it('calculates BL for ST 14', () => {
    // 14×14/5 = 39.2 → rounds to 39
    expect(calculateBasicLift(14)).toBe(39);
  });

  it('calculates BL for ST 20', () => {
    // 20×20/5 = 80
    expect(calculateBasicLift(20)).toBe(80);
  });
});

// ============================================================================
// Encumbrance Thresholds
// ============================================================================

describe('getEncumbranceThresholds', () => {
  it('returns 5 levels with correct multipliers for BL 20', () => {
    const thresholds = getEncumbranceThresholds(20);
    expect(thresholds).toHaveLength(5);
    expect(thresholds[0]).toMatchObject({ level: 0, label: 'None', maxWeight: 20, dodgePenalty: 0 });
    expect(thresholds[1]).toMatchObject({ level: 1, label: 'Light', maxWeight: 40, dodgePenalty: 1 });
    expect(thresholds[2]).toMatchObject({ level: 2, label: 'Medium', maxWeight: 60, dodgePenalty: 2 });
    expect(thresholds[3]).toMatchObject({ level: 3, label: 'Heavy', maxWeight: 120, dodgePenalty: 3 });
    expect(thresholds[4]).toMatchObject({ level: 4, label: 'X-Heavy', maxWeight: 200, dodgePenalty: 4 });
  });
});

// ============================================================================
// Encumbrance Level Determination
// ============================================================================

describe('getEncumbranceLevel', () => {
  const BL = 20; // ST 10

  it('returns 0 (None) for weight at or below BL', () => {
    expect(getEncumbranceLevel(0, BL)).toBe(0);
    expect(getEncumbranceLevel(15, BL)).toBe(0);
    expect(getEncumbranceLevel(20, BL)).toBe(0);
  });

  it('returns 1 (Light) for weight up to 2×BL', () => {
    expect(getEncumbranceLevel(21, BL)).toBe(1);
    expect(getEncumbranceLevel(40, BL)).toBe(1);
  });

  it('returns 2 (Medium) for weight up to 3×BL', () => {
    expect(getEncumbranceLevel(41, BL)).toBe(2);
    expect(getEncumbranceLevel(60, BL)).toBe(2);
  });

  it('returns 3 (Heavy) for weight up to 6×BL', () => {
    expect(getEncumbranceLevel(61, BL)).toBe(3);
    expect(getEncumbranceLevel(120, BL)).toBe(3);
  });

  it('returns 4 (X-Heavy) for weight above 6×BL', () => {
    expect(getEncumbranceLevel(121, BL)).toBe(4);
    expect(getEncumbranceLevel(200, BL)).toBe(4);
    expect(getEncumbranceLevel(999, BL)).toBe(4);
  });

  it('returns 4 for zero BL (ST 0)', () => {
    expect(getEncumbranceLevel(5, 0)).toBe(4);
  });
});

// ============================================================================
// Carried Weight Calculation
// ============================================================================

describe('calculateCarriedWeight', () => {
  it('returns 0 for empty equipment', () => {
    expect(calculateCarriedWeight([])).toBe(0);
  });

  it('sums weight × quantity for equipped items', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Sword', quantity: 1, weight: 3, cost: 500, equipped: true },
      { id: '2', name: 'Shield', quantity: 1, weight: 15, cost: 40, equipped: true },
    ];
    expect(calculateCarriedWeight(equipment)).toBe(18);
  });

  it('excludes unequipped items', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Sword', quantity: 1, weight: 3, cost: 500, equipped: true },
      { id: '2', name: 'Tent', quantity: 1, weight: 20, cost: 50, equipped: false },
    ];
    expect(calculateCarriedWeight(equipment)).toBe(3);
  });

  it('treats items without equipped field as equipped (backward compat)', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Sword', quantity: 1, weight: 3, cost: 500 },
      { id: '2', name: 'Armor', quantity: 1, weight: 25, cost: 200 },
    ];
    expect(calculateCarriedWeight(equipment)).toBe(28);
  });

  it('handles quantity > 1', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Arrow', quantity: 20, weight: 0.1, cost: 1, equipped: true },
    ];
    expect(calculateCarriedWeight(equipment)).toBeCloseTo(2);
  });
});

// ============================================================================
// Full Encumbrance Calculation
// ============================================================================

describe('calculateEncumbrance', () => {
  it('calculates no encumbrance for lightly loaded ST 10 character', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Sword', quantity: 1, weight: 3, cost: 500, equipped: true },
      { id: '2', name: 'Light Armor', quantity: 1, weight: 10, cost: 150, equipped: true },
    ];
    // BL = 20, carried = 13, Level 0 (None)
    const result = calculateEncumbrance(10, 5, 8, equipment);
    expect(result.basicLift).toBe(20);
    expect(result.carriedWeight).toBe(13);
    expect(result.level).toBe(0);
    expect(result.adjustedMove).toBe(5); // 5 × 1.0
    expect(result.adjustedDodge).toBe(8); // 8 - 0
  });

  it('calculates light encumbrance', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Heavy Armor', quantity: 1, weight: 30, cost: 500, equipped: true },
    ];
    // BL = 20, carried = 30, Level 1 (Light)
    const result = calculateEncumbrance(10, 5, 8, equipment);
    expect(result.level).toBe(1);
    expect(result.adjustedMove).toBe(4); // floor(5 × 0.8)
    expect(result.adjustedDodge).toBe(7); // 8 - 1
  });

  it('calculates heavy encumbrance', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'All My Stuff', quantity: 1, weight: 100, cost: 1000, equipped: true },
    ];
    // BL = 20, carried = 100, Level 3 (Heavy: up to 6×BL = 120)
    const result = calculateEncumbrance(10, 5, 8, equipment);
    expect(result.level).toBe(3);
    expect(result.adjustedMove).toBe(2); // floor(5 × 0.4)
    expect(result.adjustedDodge).toBe(5); // 8 - 3
  });

  it('enforces minimum move/dodge of 1', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Way Too Much', quantity: 1, weight: 200, cost: 0, equipped: true },
    ];
    // BL = 20, carried = 200, Level 4 (X-Heavy)
    const result = calculateEncumbrance(10, 5, 4, equipment);
    expect(result.level).toBe(4);
    expect(result.adjustedMove).toBe(1); // floor(5 × 0.2) = 1
    expect(result.adjustedDodge).toBe(1); // max(1, 4 - 4) = 1 (minimum 1)
  });
});

// ============================================================================
// Per-Location DR
// ============================================================================

describe('calculateLocationDR', () => {
  it('returns empty array for no armor', () => {
    const equipment: Equipment[] = [
      { id: '1', name: 'Sword', quantity: 1, weight: 3, cost: 500, equipped: true },
    ];
    expect(calculateLocationDR(equipment)).toEqual([]);
  });

  it('calculates DR by location from drLocations array', () => {
    const equipment: Equipment[] = [
      {
        id: '1', name: 'Chain Mail', quantity: 1, weight: 25, cost: 150,
        equipped: true, dr: 4, drLocations: ['torso', 'groin'],
      },
      {
        id: '2', name: 'Helmet', quantity: 1, weight: 5, cost: 100,
        equipped: true, dr: 4, drLocations: ['skull'],
      },
    ];
    const result = calculateLocationDR(equipment);
    expect(result).toHaveLength(3);
    expect(result.find(l => l.location === 'torso')).toMatchObject({ dr: 4, sources: ['Chain Mail'] });
    expect(result.find(l => l.location === 'groin')).toMatchObject({ dr: 4, sources: ['Chain Mail'] });
    expect(result.find(l => l.location === 'skull')).toMatchObject({ dr: 4, sources: ['Helmet'] });
  });

  it('stacks DR from multiple armor pieces on same location', () => {
    const equipment: Equipment[] = [
      {
        id: '1', name: 'Chain Mail', quantity: 1, weight: 25, cost: 150,
        equipped: true, dr: 4, drLocations: ['torso'],
      },
      {
        id: '2', name: 'Surcoat', quantity: 1, weight: 5, cost: 30,
        equipped: true, dr: 1, drLocations: ['torso'],
      },
    ];
    const result = calculateLocationDR(equipment);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ dr: 5, sources: ['Chain Mail', 'Surcoat'] });
  });

  it('excludes unequipped armor', () => {
    const equipment: Equipment[] = [
      {
        id: '1', name: 'Heavy Plate', quantity: 1, weight: 50, cost: 1000,
        equipped: false, dr: 7, drLocations: ['torso'],
      },
    ];
    expect(calculateLocationDR(equipment)).toEqual([]);
  });

  it('falls back to location field when drLocations is empty', () => {
    const equipment: Equipment[] = [
      {
        id: '1', name: 'Leather Jacket', quantity: 1, weight: 4, cost: 50,
        equipped: true, dr: 1, location: 'Torso',
      },
    ];
    const result = calculateLocationDR(equipment);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ location: 'torso', dr: 1 });
  });
});

// ============================================================================
// Character-Level Convenience Function
// ============================================================================

describe('calculateCharacterEncumbrance', () => {
  it('calculates encumbrance from character attributes', () => {
    const attrs: PrimaryAttributes = { ST: 12, DX: 10, IQ: 10, HT: 10 };
    const secondary: SecondaryAttributes = {
      will: { value: 10, points: 0 },
      frightCheck: { value: 10, points: 0 },
      per: { value: 10, points: 0 },
      vision: { value: 10, points: 0 },
      hearing: { value: 10, points: 0 },
      tasteSmell: { value: 10, points: 0 },
      touch: { value: 10, points: 0 },
      basicSpeed: { value: 5, points: 0 },
      basicMove: { value: 5, points: 0 },
    };
    const equipment: Equipment[] = [
      { id: '1', name: 'Gear', quantity: 1, weight: 25, cost: 0, equipped: true },
    ];

    // BL = 12×12/5 = 28.8 → 29
    // Carried = 25, Level 0 (under BL of 29)
    const result = calculateCharacterEncumbrance(attrs, secondary, equipment);
    expect(result.basicLift).toBe(29);
    expect(result.level).toBe(0);
    expect(result.adjustedMove).toBe(5);
    // Dodge = floor(5) + 3 = 8
    expect(result.adjustedDodge).toBe(8);
  });
});

describe('getWorstGroupEncumbranceLevel', () => {
  it('returns the worst level and bottleneck name', () => {
    const light = createDefaultGCSData();
    const heavy = createDefaultGCSData();
    heavy.equipment = [{ id: 'load', name: 'Load', quantity: 1, weight: 100, cost: 0 }];
    expect(getWorstGroupEncumbranceLevel([
      { id: 'a', name: 'Light', work: { skills: {} }, gcsData: light },
      { id: 'b', name: 'Heavy', work: { skills: {} }, gcsData: heavy },
    ])).toEqual({ level: 3, bottleneckName: 'Heavy' });
  });

  it('counts a member without gcsData as level zero', () => {
    expect(getWorstGroupEncumbranceLevel([{ id: 'a', name: 'Legacy', work: { skills: {} } }]))
      .toEqual({ level: 0, bottleneckName: null });
  });

  it('clamps loads beyond ten times Basic Lift to level four', () => {
    const data = createDefaultGCSData();
    data.equipment = [{ id: 'load', name: 'Impossible load', quantity: 1, weight: 10_000, cost: 0 }];
    expect(getWorstGroupEncumbranceLevel([{ id: 'a', name: 'Porter', work: { skills: {} }, gcsData: data }]))
      .toEqual({ level: 4, bottleneckName: 'Porter' });
  });
});
