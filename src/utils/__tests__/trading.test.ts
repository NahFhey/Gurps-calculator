import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import { rollVsTarget } from '../dice';
import {
  computeLineTotal,
  computeTradeTotals,
  getMerchantSkill,
  makePriceBookKey,
  resolveHaggle,
} from '../trading';
import type { RollVsTargetResult } from '../dice';
import type { TradeLine } from '../trading';

vi.mock('../dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);

function result(total: number, target: number): RollVsTargetResult {
  return {
    expression: '3d6',
    dice: [1, 1, total - 2],
    modifier: 0,
    total,
    valid: true,
    target,
    margin: target - total,
    success: total <= target,
  };
}

function line(changes: Partial<TradeLine> = {}): TradeLine {
  return { id: 'line', kind: 'sell', itemKind: 'material', name: 'Iron', quantity: 2, unitPrice: 10, ...changes };
}

describe('trading engine', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('computes a favorable Quick Contest shift from net margins', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(10, 13)).mockReturnValueOnce(result(11, 12));
    expect(resolveHaggle(13, 12).shiftPct).toBe(10);
  });

  it('computes an unfavorable Quick Contest shift', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(14, 12)).mockReturnValueOnce(result(9, 12));
    expect(resolveHaggle(12, 12).shiftPct).toBe(-25);
  });

  it('computes a tie as zero shift', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(11, 12)).mockReturnValueOnce(result(10, 11));
    expect(resolveHaggle(12, 11).shiftPct).toBe(0);
  });

  it('clamps a large win to +30%', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(10, 20)).mockReturnValueOnce(result(17, 5));
    expect(resolveHaggle(20, 5).shiftPct).toBe(30);
  });

  it('clamps a large loss to -30%', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(16, 8)).mockReturnValueOnce(result(8, 18));
    expect(resolveHaggle(8, 18).shiftPct).toBe(-30);
  });

  it('turns leader critical success into +30%', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(4, 10)).mockReturnValueOnce(result(6, 16));
    const haggle = resolveHaggle(10, 16);
    expect(haggle.leaderCritSuccess).toBe(true);
    expect(haggle.shiftPct).toBe(30);
  });

  it('breaks the deal and zeroes shift on leader critical failure', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(18, 14)).mockReturnValueOnce(result(12, 12));
    const haggle = resolveHaggle(14, 12);
    expect(haggle.dealBroken).toBe(true);
    expect(haggle.shiftPct).toBe(0);
  });

  it('reads trained Merchant skill', () => {
    expect(getMerchantSkill({ work: { skills: { merchant: 13 } } })).toEqual({ level: 13, isDefault: false });
  });

  it('uses IQ-5 when Merchant is untrained', () => {
    const gcsData = createDefaultGCSData();
    gcsData.attributes.IQ = 12;
    expect(getMerchantSkill({ gcsData, work: { skills: {} } })).toEqual({ level: 7, isDefault: true });
  });

  it('defaults missing character sheet IQ to 10', () => {
    expect(getMerchantSkill({})).toEqual({ level: 5, isDefault: true });
  });

  it('raises sell totals and lowers buy totals on a favorable shift', () => {
    expect(computeLineTotal(line(), 10)).toBe(22);
    expect(computeLineTotal(line({ kind: 'buy' }), 10)).toBe(18);
  });

  it('rounds shifted line totals', () => {
    expect(computeLineTotal(line({ quantity: 3, unitPrice: 5 }), 10)).toBe(17);
  });

  it('clamps sell and buy line totals at zero', () => {
    expect(computeLineTotal(line({ unitPrice: -10 }), 0)).toBe(0);
    expect(computeLineTotal(line({ kind: 'buy', unitPrice: -10 }), 0)).toBe(0);
  });

  it('passes signed adjustment values through unchanged', () => {
    expect(computeLineTotal(line({ kind: 'adjust', itemKind: undefined, quantity: 1, unitPrice: -7 }), 30)).toBe(-7);
  });

  it('computes mixed basket proceeds, costs, adjustments, and net', () => {
    expect(computeTradeTotals([
      line({ id: 'sell', kind: 'sell', quantity: 2, unitPrice: 10 }),
      line({ id: 'buy', kind: 'buy', quantity: 1, unitPrice: 8 }),
      line({ id: 'adjust', kind: 'adjust', itemKind: undefined, quantity: 1, unitPrice: -3 }),
    ], 10)).toEqual({ proceeds: 22, costs: 7, adjustNet: -3, net: 12 });
  });

  it('normalizes price book keys by kind, case, and outer whitespace', () => {
    expect(makePriceBookKey('material', '  Iron Ore  ')).toBe('material:iron ore');
  });
});
