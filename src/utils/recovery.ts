import type { HealingEstimate } from '../types/combatTracker';
import { getCharacterSkills } from '../types/characterSheet';
import type { GCSCharacterData } from '../types/characterSheet';
import { rollVsTarget } from './dice';
import type { RollVsTargetResult } from './dice';

export interface CharacterLike {
  gcsData?: GCSCharacterData;
  work?: { skills?: Record<string, number> };
  skills?: Record<string, number>;
}

/** Estimate natural HP and resting FP recovery time from raw losses. */
export function estimateHealing(hpLost: number, fpLost: number): HealingEstimate {
  return {
    daysToFullHP: Math.max(0, hpLost),
    daysToFullFP: fpLost > 0 ? Math.max(1, Math.ceil(fpLost * 10 / 60 / 24)) : 0,
    firstAidEstimate: {
      min: Math.max(0, Math.min(hpLost, 1)),
      max: Math.min(hpLost, 4),
    },
  };
}

/** Return the best Physician skill level exposed by a character. */
export function getPhysicianLevel(character: CharacterLike): number {
  const skills = getCharacterSkills(character);
  return Math.max(0, skills.physician ?? 0, skills.Physician ?? 0);
}

export interface RestRecoveryInput {
  restType: 'sleep' | 'light_rest' | 'meditation';
  recoveryBonus: number;
  ht: number;
  currentHP: number;
  maxHP: number;
  currentFP: number;
  maxFP: number;
  restedFullDay: boolean;
  physicianLevel?: number;
  starvationFpDebt?: number;
}

export interface RestRecoveryResult {
  fpRestored: number;
  hpRollMade: boolean;
  physicianRoll?: RollVsTargetResult;
  physicianSuccess?: boolean;
  recoveryTarget?: number;
  recoveryRoll?: RollVsTargetResult;
  hpRestored: number;
}

export function resolveRestRecovery(input: RestRecoveryInput): RestRecoveryResult {
  const fpRestored = Math.max(
    0,
    input.maxFP - (input.starvationFpDebt ?? 0) - input.currentFP
  );
  const hpRollMade = input.restType === 'sleep'
    && input.restedFullDay
    && input.currentHP < input.maxHP;

  if (!hpRollMade) {
    return { fpRestored, hpRollMade: false, hpRestored: 0 };
  }

  const physicianRoll = input.physicianLevel && input.physicianLevel > 0
    ? rollVsTarget('3d6', input.physicianLevel)
    : undefined;
  const physicianSuccess = physicianRoll?.success;
  const recoveryTarget = input.ht + input.recoveryBonus + (physicianSuccess ? 1 : 0);
  const recoveryRoll = rollVsTarget('3d6', recoveryTarget);
  const recoveredOnSuccess = physicianSuccess ? 2 : 1;
  const hpRestored = recoveryRoll.success
    ? Math.max(0, Math.min(recoveredOnSuccess, input.maxHP - input.currentHP))
    : 0;

  return {
    fpRestored,
    hpRollMade: true,
    ...(physicianRoll ? { physicianRoll, physicianSuccess } : {}),
    recoveryTarget,
    recoveryRoll,
    hpRestored,
  };
}
