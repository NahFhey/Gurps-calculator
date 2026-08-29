import { getCharacterSkills } from '../types/characterSheet';
import type { GCSCharacterData } from '../types/characterSheet';
import type { InventoryOwner } from '../types/campaign';
import { isCriticalFailure, isCriticalSuccess } from './gathering';
import { rollVsTarget } from './dice';
import type { RollVsTargetResult } from './dice';

export interface CharacterLike {
  gcsData?: GCSCharacterData;
  work?: { skills?: Record<string, number> };
  skills?: Record<string, number>;
}

export interface HaggleResult {
  leaderRoll: RollVsTargetResult;
  opponentRoll: RollVsTargetResult;
  leaderCritSuccess: boolean;
  dealBroken: boolean;
  shiftPct: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

export function resolveHaggle(leaderSkill: number, opposingSkill: number): HaggleResult {
  const leaderRoll = rollVsTarget('3d6', leaderSkill);
  const opponentRoll = rollVsTarget('3d6', opposingSkill);
  const leaderCritSuccess = isCriticalSuccess(leaderRoll.total, leaderSkill);
  const dealBroken = isCriticalFailure(leaderRoll.total, leaderSkill);
  const shiftPct = dealBroken
    ? 0
    : leaderCritSuccess
      ? 30
      : clamp(5 * (leaderRoll.margin - opponentRoll.margin), -30, 30);

  return { leaderRoll, opponentRoll, leaderCritSuccess, dealBroken, shiftPct };
}

export function getMerchantSkill(character: CharacterLike): { level: number; isDefault: boolean } {
  const skills = getCharacterSkills(character);
  const trainedLevel = Math.max(skills.merchant ?? 0, skills.Merchant ?? 0);
  if (trainedLevel > 0) return { level: trainedLevel, isDefault: false };
  return { level: (character.gcsData?.attributes.IQ ?? 10) - 5, isDefault: true };
}

export interface TradeLine {
  id: string;
  kind: 'sell' | 'buy' | 'adjust';
  itemKind?: 'material' | 'food' | 'item';
  name: string;
  quantity: number;
  unitPrice: number;
  itemId?: string;
  owner?: InventoryOwner;
  materialType?: string;
}

export function computeLineTotal(line: TradeLine, shiftPct: number): number {
  if (line.kind === 'adjust') return line.unitPrice;
  const multiplier = line.kind === 'sell'
    ? 1 + shiftPct / 100
    : 1 - shiftPct / 100;
  return Math.max(0, Math.round(line.quantity * line.unitPrice * multiplier));
}

export function computeTradeTotals(
  lines: TradeLine[],
  shiftPct: number
): { proceeds: number; costs: number; adjustNet: number; net: number } {
  let proceeds = 0;
  let costs = 0;
  let adjustNet = 0;
  for (const line of lines) {
    const total = computeLineTotal(line, shiftPct);
    if (line.kind === 'sell') proceeds += total;
    else if (line.kind === 'buy') costs += total;
    else adjustNet += total;
  }
  return { proceeds, costs, adjustNet, net: proceeds - costs + adjustNet };
}

export function makePriceBookKey(kind: 'material' | 'food' | 'item', name: string): string {
  return `${kind}:${name.toLowerCase().trim()}`;
}
