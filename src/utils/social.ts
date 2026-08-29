import { getCharacterSkills } from '../types/characterSheet';
import { rollVsTarget } from './dice';
import { isCriticalFailure, isCriticalSuccess } from './gathering';
import type { RollVsTargetResult } from './dice';
import type { CharacterLike } from './trading';

export interface InfluenceSkillDef {
  key: string;
  gcsName: string;
  defaultAttribute: 'IQ' | 'Will' | 'HT';
  defaultPenalty: number;
}

export const INFLUENCE_SKILLS: InfluenceSkillDef[] = [
  { key: 'diplomacy', gcsName: 'Diplomacy', defaultAttribute: 'IQ', defaultPenalty: -6 },
  { key: 'fastTalk', gcsName: 'Fast-Talk', defaultAttribute: 'IQ', defaultPenalty: -5 },
  { key: 'savoirFaire', gcsName: 'Savoir-Faire', defaultAttribute: 'IQ', defaultPenalty: -4 },
  { key: 'streetwise', gcsName: 'Streetwise', defaultAttribute: 'IQ', defaultPenalty: -5 },
  { key: 'intimidation', gcsName: 'Intimidation', defaultAttribute: 'Will', defaultPenalty: -5 },
  { key: 'carousing', gcsName: 'Carousing', defaultAttribute: 'HT', defaultPenalty: -4 },
];

export function getInfluenceSkill(
  character: CharacterLike,
  def: InfluenceSkillDef
): { level: number; isDefault: boolean } {
  const skills = getCharacterSkills(character);
  const trainedLevel = Math.max(skills[def.key] ?? 0, skills[def.gcsName] ?? 0);
  if (trainedLevel > 0) return { level: trainedLevel, isDefault: false };

  const attribute = def.defaultAttribute === 'Will'
    ? character.gcsData?.secondaryAttributes.will.value ?? 10
    : character.gcsData?.attributes[def.defaultAttribute] ?? 10;
  return { level: attribute + def.defaultPenalty, isDefault: true };
}

export interface SocialAttemptResult {
  roll: RollVsTargetResult;
  effectiveTarget: number;
  critSuccess: boolean;
  critFailure: boolean;
  delta: number;
}

export function resolveSocialAttempt(skillLevel: number, currentModifier: number): SocialAttemptResult {
  const effectiveTarget = skillLevel + currentModifier;
  const roll = rollVsTarget('3d6', effectiveTarget);
  const critSuccess = isCriticalSuccess(roll.total, effectiveTarget);
  const critFailure = isCriticalFailure(roll.total, effectiveTarget);
  const delta = critSuccess ? 2 : critFailure ? -1 : roll.success ? 1 : 0;
  return { roll, effectiveTarget, critSuccess, critFailure, delta };
}
