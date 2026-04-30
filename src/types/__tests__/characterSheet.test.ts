import { describe, it, expect } from 'vitest';
import {
  calculateSkillLevel,
  calculateRelativeLevel,
  calculateSkillPointCost,
  calculateDerivedAttributes,
} from '../characterSheet';

// ============================================================================
// Skill Level Calculation (GURPS B170)
// ============================================================================

describe('calculateRelativeLevel', () => {
  // Easy: 1pt=+0, 2pt=+1, 4pt=+2, 8pt=+3, 12pt=+4
  it('calculates Easy skill progression', () => {
    expect(calculateRelativeLevel('E', 1)).toBe(0);   // 1pt → attr+0
    expect(calculateRelativeLevel('E', 2)).toBe(1);   // 2pt → attr+1
    expect(calculateRelativeLevel('E', 4)).toBe(2);   // 4pt → attr+2
    expect(calculateRelativeLevel('E', 8)).toBe(3);   // 8pt → attr+3
    expect(calculateRelativeLevel('E', 12)).toBe(4);  // 12pt → attr+4
  });

  // Average: 1pt=-1, 2pt=+0, 4pt=+1, 8pt=+2, 12pt=+3
  it('calculates Average skill progression', () => {
    expect(calculateRelativeLevel('A', 1)).toBe(-1);  // 1pt → attr-1
    expect(calculateRelativeLevel('A', 2)).toBe(0);   // 2pt → attr+0
    expect(calculateRelativeLevel('A', 4)).toBe(1);   // 4pt → attr+1
    expect(calculateRelativeLevel('A', 8)).toBe(2);   // 8pt → attr+2
    expect(calculateRelativeLevel('A', 12)).toBe(3);  // 12pt → attr+3
  });

  // Hard: 1pt=-2, 2pt=-1, 4pt=+0, 8pt=+1, 12pt=+2
  it('calculates Hard skill progression', () => {
    expect(calculateRelativeLevel('H', 1)).toBe(-2);
    expect(calculateRelativeLevel('H', 2)).toBe(-1);
    expect(calculateRelativeLevel('H', 4)).toBe(0);
    expect(calculateRelativeLevel('H', 8)).toBe(1);
    expect(calculateRelativeLevel('H', 12)).toBe(2);
  });

  // VH: 1pt=-3, 2pt=-2, 4pt=-1, 8pt=+0, 12pt=+1
  it('calculates Very Hard skill progression', () => {
    expect(calculateRelativeLevel('VH', 1)).toBe(-3);
    expect(calculateRelativeLevel('VH', 2)).toBe(-2);
    expect(calculateRelativeLevel('VH', 4)).toBe(-1);
    expect(calculateRelativeLevel('VH', 8)).toBe(0);
    expect(calculateRelativeLevel('VH', 12)).toBe(1);
    expect(calculateRelativeLevel('VH', 16)).toBe(2);
  });

  it('returns -10 for zero points', () => {
    expect(calculateRelativeLevel('A', 0)).toBe(-10);
  });

  it('handles in-between point values', () => {
    // 3 points: not yet 4, so same as 2pt
    expect(calculateRelativeLevel('E', 3)).toBe(1);
    // 6 points: not yet 8, so same as 4pt → +2, then (6-4)/4 = 0 extra
    expect(calculateRelativeLevel('E', 6)).toBe(2);
  });
});

describe('calculateSkillLevel', () => {
  it('calculates absolute skill level for IQ 12, Average, 4 points', () => {
    // Average 4pt = attr+1 → 12+1 = 13
    expect(calculateSkillLevel(12, 'A', 4)).toBe(13);
  });

  it('calculates for DX 14, Hard, 8 points', () => {
    // Hard 8pt = attr+1 → 14+1 = 15
    expect(calculateSkillLevel(14, 'H', 8)).toBe(15);
  });
});

describe('calculateSkillPointCost (inverse)', () => {
  it('returns minimum points for Easy skills', () => {
    expect(calculateSkillPointCost('E', 0)).toBe(1);   // attr+0 → 1pt
    expect(calculateSkillPointCost('E', 1)).toBe(2);   // attr+1 → 2pt
    expect(calculateSkillPointCost('E', 2)).toBe(4);   // attr+2 → 4pt
    expect(calculateSkillPointCost('E', 3)).toBe(8);   // attr+3 → 8pt
  });

  it('returns minimum points for Average skills', () => {
    expect(calculateSkillPointCost('A', -1)).toBe(1);  // attr-1 → 1pt
    expect(calculateSkillPointCost('A', 0)).toBe(2);   // attr+0 → 2pt
    expect(calculateSkillPointCost('A', 1)).toBe(4);   // attr+1 → 4pt
    expect(calculateSkillPointCost('A', 2)).toBe(8);   // attr+2 → 8pt
  });

  it('returns minimum points for VH skills', () => {
    expect(calculateSkillPointCost('VH', -3)).toBe(1);
    expect(calculateSkillPointCost('VH', -2)).toBe(2);
    expect(calculateSkillPointCost('VH', -1)).toBe(4);
    expect(calculateSkillPointCost('VH', 0)).toBe(8);
    expect(calculateSkillPointCost('VH', 1)).toBe(12);
  });
});

// ============================================================================
// Basic Lift (already covered in encumbrance tests, sanity check here)
// ============================================================================

describe('calculateDerivedAttributes', () => {
  it('derives all attributes for ST 10, DX 10, IQ 10, HT 10', () => {
    const result = calculateDerivedAttributes({ ST: 10, DX: 10, IQ: 10, HT: 10 });
    expect(result.basicSpeed).toBe(5);
    expect(result.basicMove).toBe(5);
    expect(result.dodge).toBe(8);
    expect(result.basicLift).toBe(20);
    expect(result.thrustDamage).toBe('1d-2');
    expect(result.swingDamage).toBe('1d');
  });
});
