import type { Character, CharacterTemplateEntity } from '../types/campaign';
import type { GCSCharacterData, SkillAttribute } from '../types/characterSheet';
import { calculateDerivedAttributes, calculateRelativeLevel, calculateSkillLevel, syncWorkSkillsFromGCS } from '../types/characterSheet';
import { ATTRIBUTE_COSTS, POOL_COSTS, SECONDARY_COSTS, calculateTotalPoints } from './characterPoints';
import { regenerateGCSDataIds } from './characterManagement';
import { safeDeepClone } from './helpers';

export type NpcVariance = 'none' | 'light' | 'heavy';

const STARTS = ['al', 'bel', 'cor', 'dar', 'el', 'fen', 'gar', 'hal', 'jor', 'ka', 'lor', 'mar', 'nor', 'or', 'rin', 'sar', 'tor', 'val'];
const MIDDLES = ['a', 'e', 'i', 'o', 'u', 'an', 'en', 'ir', 'or'];
const ENDS = ['den', 'dor', 'fin', 'len', 'mir', 'ra', 'ric', 'sa', 'th', 'wen'];
const SURNAMES = ['Ash', 'Briar', 'Dale', 'Fell', 'Marsh', 'Reed', 'Stone', 'Vale', 'Ward', 'Wood'];

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function generateNpcName(rng: () => number): string {
  const syllables = rng() < 0.55 ? 2 : 3;
  const first = `${pick(STARTS, rng)}${syllables === 3 ? pick(MIDDLES, rng) : ''}${pick(ENDS, rng)}`;
  const normalized = first.charAt(0).toUpperCase() + first.slice(1);
  return rng() < 0.45 ? `${normalized} ${pick(SURNAMES, rng)}` : normalized;
}

function jitter(rng: () => number, radius: number): number {
  return Math.floor(rng() * (radius * 2 + 1)) - radius;
}

function skillAttributeValue(data: GCSCharacterData, attribute: SkillAttribute): number {
  if (attribute === 'Will') return data.secondaryAttributes.will.value;
  if (attribute === 'Per') return data.secondaryAttributes.per.value;
  return data.attributes[attribute];
}

function recomputeDerived(data: GCSCharacterData): void {
  data.attributePoints = {
    ST: (data.attributes.ST - 10) * ATTRIBUTE_COSTS.ST,
    DX: (data.attributes.DX - 10) * ATTRIBUTE_COSTS.DX,
    IQ: (data.attributes.IQ - 10) * ATTRIBUTE_COSTS.IQ,
    HT: (data.attributes.HT - 10) * ATTRIBUTE_COSTS.HT,
  };
  const old = data.secondaryAttributes;
  const derived = calculateDerivedAttributes(data.attributes);
  const will = data.attributes.IQ + old.will.points / SECONDARY_COSTS.will;
  const per = data.attributes.IQ + old.per.points / SECONDARY_COSTS.per;
  const basicSpeed = derived.basicSpeed + old.basicSpeed.points / SECONDARY_COSTS.basicSpeed * 0.25;
  data.secondaryAttributes = {
    will: { value: will, points: old.will.points },
    frightCheck: { value: will + old.frightCheck.points / SECONDARY_COSTS.frightCheck, points: old.frightCheck.points },
    per: { value: per, points: old.per.points },
    vision: { value: per + old.vision.points / SECONDARY_COSTS.vision, points: old.vision.points },
    hearing: { value: per + old.hearing.points / SECONDARY_COSTS.hearing, points: old.hearing.points },
    tasteSmell: { value: per + old.tasteSmell.points / SECONDARY_COSTS.tasteSmell, points: old.tasteSmell.points },
    touch: { value: per + old.touch.points / SECONDARY_COSTS.touch, points: old.touch.points },
    basicSpeed: { value: basicSpeed, points: old.basicSpeed.points },
    basicMove: { value: Math.floor(basicSpeed) + old.basicMove.points / SECONDARY_COSTS.basicMove, points: old.basicMove.points },
  };
  data.pools = {
    HP: {
      max: data.attributes.ST + data.pools.HP.points / POOL_COSTS.HP,
      current: data.attributes.ST + data.pools.HP.points / POOL_COSTS.HP,
      points: data.pools.HP.points,
    },
    FP: {
      max: data.attributes.HT + data.pools.FP.points / POOL_COSTS.FP,
      current: data.attributes.HT + data.pools.FP.points / POOL_COSTS.FP,
      points: data.pools.FP.points,
    },
  };
  data.skills = data.skills.map((skill) => {
    const difficulty = skill.difficulty ?? 'A';
    const relativeLevel = calculateRelativeLevel(difficulty, skill.points);
    return { ...skill, relativeLevel, level: calculateSkillLevel(skillAttributeValue(data, skill.attribute), difficulty, skill.points) };
  });
  data.spells = data.spells.map((spell) => {
    const relativeLevel = calculateRelativeLevel('H', spell.points);
    return { ...spell, relativeLevel, level: data.attributes.IQ + relativeLevel };
  });
  data.totalPoints = calculateTotalPoints(data);
}

export function generateNpc(
  template: CharacterTemplateEntity,
  variance: NpcVariance,
  rng: () => number
): Character {
  const gcsData = safeDeepClone(template.gcsData);
  const radius = variance === 'light' ? 1 : variance === 'heavy' ? 2 : 0;
  if (radius > 0) {
    for (const key of ['ST', 'DX', 'IQ', 'HT'] as const) {
      gcsData.attributes[key] = Math.max(1, gcsData.attributes[key] + jitter(rng, radius));
    }
  }
  if (variance === 'heavy') {
    gcsData.skills = gcsData.skills.map((skill) => ({ ...skill, points: Math.max(1, skill.points + jitter(rng, 4)) }));
  }
  if (variance !== 'none') recomputeDerived(gcsData);
  regenerateGCSDataIds(gcsData);
  const name = generateNpcName(rng);
  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    isPlayer: false,
    st: gcsData.attributes.ST,
    work: { enabled: true, skills: syncWorkSkillsFromGCS(gcsData) },
    gcsData,
  };
}
