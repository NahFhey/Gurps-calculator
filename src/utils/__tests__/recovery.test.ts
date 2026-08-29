import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateHealing, getPhysicianLevel, resolveRestRecovery } from '../recovery';
import { rollVsTarget } from '../dice';
import type { RollVsTargetResult } from '../dice';

vi.mock('../dice', () => ({ rollVsTarget: vi.fn() }));

const mockedRollVsTarget = vi.mocked(rollVsTarget);

function rollResult(total: number, target: number, success: boolean): RollVsTargetResult {
  return {
    expression: '3d6',
    dice: [3, 3, total - 6],
    modifier: 0,
    total,
    valid: true,
    target,
    margin: target - total,
    success,
  };
}

const baseInput = {
  restType: 'sleep' as const,
  recoveryBonus: 0,
  ht: 11,
  currentHP: 7,
  maxHP: 10,
  currentFP: 6,
  maxFP: 10,
  restedFullDay: true,
};

describe('resolveRestRecovery', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it.each(['sleep', 'light_rest', 'meditation'] as const)('restores FP to max for %s', (restType) => {
    const result = resolveRestRecovery({ ...baseInput, restType, currentHP: 10 });
    expect(result.fpRestored).toBe(4);
  });

  it('restores no FP when already full', () => {
    expect(resolveRestRecovery({ ...baseInput, currentHP: 10, currentFP: 10 }).fpRestored).toBe(0);
  });

  it.each(['light_rest', 'meditation'] as const)('makes no HP roll for %s', (restType) => {
    expect(resolveRestRecovery({ ...baseInput, restType }).hpRollMade).toBe(false);
    expect(mockedRollVsTarget).not.toHaveBeenCalled();
  });

  it('makes no HP roll at full HP', () => {
    expect(resolveRestRecovery({ ...baseInput, currentHP: 10 }).hpRollMade).toBe(false);
  });

  it('makes no HP roll without a full day of rest', () => {
    expect(resolveRestRecovery({ ...baseInput, restedFullDay: false }).hpRollMade).toBe(false);
  });

  it('restores 1 HP on a successful sleep recovery roll', () => {
    mockedRollVsTarget.mockReturnValueOnce(rollResult(9, 11, true));
    const result = resolveRestRecovery(baseInput);
    expect(result.hpRollMade).toBe(true);
    expect(result.hpRestored).toBe(1);
  });

  it('restores 0 HP on a failed sleep recovery roll', () => {
    mockedRollVsTarget.mockReturnValueOnce(rollResult(14, 11, false));
    expect(resolveRestRecovery(baseInput).hpRestored).toBe(0);
  });

  it('does not make a physician roll when the level is zero', () => {
    mockedRollVsTarget.mockReturnValueOnce(rollResult(9, 11, true));
    const result = resolveRestRecovery({ ...baseInput, physicianLevel: 0 });
    expect(mockedRollVsTarget).toHaveBeenCalledOnce();
    expect(result.physicianRoll).toBeUndefined();
  });

  it('adds +1 to the target and doubles HP after successful physician care', () => {
    mockedRollVsTarget
      .mockReturnValueOnce(rollResult(10, 14, true))
      .mockReturnValueOnce(rollResult(9, 12, true));
    const result = resolveRestRecovery({ ...baseInput, physicianLevel: 14 });
    expect(result.physicianSuccess).toBe(true);
    expect(result.recoveryTarget).toBe(12);
    expect(result.hpRestored).toBe(2);
  });

  it('restores 0 HP when physician care succeeds but recovery fails', () => {
    mockedRollVsTarget
      .mockReturnValueOnce(rollResult(10, 14, true))
      .mockReturnValueOnce(rollResult(15, 12, false));
    expect(resolveRestRecovery({ ...baseInput, physicianLevel: 14 }).hpRestored).toBe(0);
  });

  it('clamps doubled healing to max HP', () => {
    mockedRollVsTarget
      .mockReturnValueOnce(rollResult(10, 14, true))
      .mockReturnValueOnce(rollResult(9, 12, true));
    expect(resolveRestRecovery({ ...baseInput, currentHP: 9, physicianLevel: 14 }).hpRestored).toBe(1);
  });
});

describe('estimateHealing', () => {
  it('returns zero estimates for zero loss', () => {
    expect(estimateHealing(0, 0)).toEqual({
      daysToFullHP: 0,
      daysToFullFP: 0,
      firstAidEstimate: { min: 0, max: 0 },
    });
  });

  it('estimates five days for five HP lost', () => {
    expect(estimateHealing(5, 0).daysToFullHP).toBe(5);
  });

  it('uses the original first-aid min/max formula', () => {
    expect(estimateHealing(2, 0).firstAidEstimate).toEqual({ min: 1, max: 2 });
    expect(estimateHealing(8, 0).firstAidEstimate).toEqual({ min: 1, max: 4 });
  });
});

describe('getPhysicianLevel', () => {
  it('returns the higher lowercase or title-case Physician key', () => {
    expect(getPhysicianLevel({ skills: { physician: 12, Physician: 14 } })).toBe(14);
  });

  it('returns zero when Physician is absent', () => {
    expect(getPhysicianLevel({ work: { skills: { FirstAid: 15 } } })).toBe(0);
  });
});
