import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import { rollVsTarget } from '../dice';
import { getInfluenceSkill, INFLUENCE_SKILLS, resolveSocialAttempt } from '../social';
import type { RollVsTargetResult } from '../dice';

vi.mock('../dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);

function result(total: number, target: number): RollVsTargetResult {
  return { expression: '3d6', dice: [1, 2, total - 3], modifier: 0, total, valid: true, target, margin: target - total, success: total <= target };
}

describe('social influence engine', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('defines the six RAW influence skills and defaults', () => {
    expect(INFLUENCE_SKILLS).toEqual([
      { key: 'diplomacy', gcsName: 'Diplomacy', defaultAttribute: 'IQ', defaultPenalty: -6 },
      { key: 'fastTalk', gcsName: 'Fast-Talk', defaultAttribute: 'IQ', defaultPenalty: -5 },
      { key: 'savoirFaire', gcsName: 'Savoir-Faire', defaultAttribute: 'IQ', defaultPenalty: -4 },
      { key: 'streetwise', gcsName: 'Streetwise', defaultAttribute: 'IQ', defaultPenalty: -5 },
      { key: 'intimidation', gcsName: 'Intimidation', defaultAttribute: 'Will', defaultPenalty: -5 },
      { key: 'carousing', gcsName: 'Carousing', defaultAttribute: 'HT', defaultPenalty: -4 },
    ]);
  });

  it('uses a trained lowercase activity skill', () => expect(getInfluenceSkill({ work: { skills: { diplomacy: 14 } } }, INFLUENCE_SKILLS[0])).toEqual({ level: 14, isDefault: false }));
  it('uses a trained GCS-named skill', () => expect(getInfluenceSkill({ work: { skills: { 'Fast-Talk': 13 } } }, INFLUENCE_SKILLS[1])).toEqual({ level: 13, isDefault: false }));
  it('defaults Diplomacy from IQ', () => { const gcsData = createDefaultGCSData(); gcsData.attributes.IQ = 12; expect(getInfluenceSkill({ gcsData }, INFLUENCE_SKILLS[0])).toEqual({ level: 6, isDefault: true }); });
  it('defaults Intimidation from Will', () => { const gcsData = createDefaultGCSData(); gcsData.secondaryAttributes.will.value = 13; expect(getInfluenceSkill({ gcsData }, INFLUENCE_SKILLS[4])).toEqual({ level: 8, isDefault: true }); });
  it('defaults Carousing from HT', () => { const gcsData = createDefaultGCSData(); gcsData.attributes.HT = 11; expect(getInfluenceSkill({ gcsData }, INFLUENCE_SKILLS[5])).toEqual({ level: 7, isDefault: true }); });
  it('uses attribute 10 when character sheet data is absent', () => expect(getInfluenceSkill({}, INFLUENCE_SKILLS[2])).toEqual({ level: 6, isDefault: true }));

  it('awards +2 on critical success', () => { mockedRollVsTarget.mockReturnValue(result(4, 12)); expect(resolveSocialAttempt(12, 0).delta).toBe(2); });
  it('awards +1 on ordinary success', () => { mockedRollVsTarget.mockReturnValue(result(10, 12)); expect(resolveSocialAttempt(12, 0).delta).toBe(1); });
  it('awards 0 on ordinary failure', () => { mockedRollVsTarget.mockReturnValue(result(13, 12)); expect(resolveSocialAttempt(12, 0).delta).toBe(0); });
  it('awards -1 on critical failure', () => { mockedRollVsTarget.mockReturnValue(result(18, 12)); expect(resolveSocialAttempt(12, 0).delta).toBe(-1); });
  it('includes positive standing in the effective target', () => { mockedRollVsTarget.mockReturnValue(result(10, 14)); expect(resolveSocialAttempt(12, 2).effectiveTarget).toBe(14); expect(mockedRollVsTarget).toHaveBeenCalledWith('3d6', 14); });
  it('includes negative standing in the effective target', () => { mockedRollVsTarget.mockReturnValue(result(10, 9)); expect(resolveSocialAttempt(12, -3).effectiveTarget).toBe(9); expect(mockedRollVsTarget).toHaveBeenCalledWith('3d6', 9); });
});
