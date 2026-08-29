import type {
  GCSCharacterData,
  PointPools,
  PrimaryAttributes,
  SecondaryAttributes,
} from '../types/characterSheet';

export const ATTRIBUTE_COSTS: Record<keyof PrimaryAttributes, number> = {
  ST: 10,
  DX: 20,
  IQ: 20,
  HT: 10,
};

export const SECONDARY_COSTS: Record<keyof SecondaryAttributes, number> = {
  will: 5,
  frightCheck: 2,
  per: 5,
  vision: 2,
  hearing: 2,
  tasteSmell: 2,
  touch: 2,
  basicSpeed: 5,
  basicMove: 5,
};

export const POOL_COSTS: Record<keyof PointPools, number> = {
  HP: 2,
  FP: 3,
};

export function calculateTotalPoints(data: GCSCharacterData): number {
  const attributeTotal = Object.values(data.attributePoints)
    .reduce((sum, points) => sum + points, 0);
  const secondaryTotal = Object.values(data.secondaryAttributes)
    .reduce((sum, attribute) => sum + attribute.points, 0);
  const poolTotal = Object.values(data.pools)
    .reduce((sum, pool) => sum + pool.points, 0);
  const traitTotal = [
    ...data.advantages,
    ...data.perks,
    ...data.disadvantages,
    ...data.quirks,
  ].reduce((sum, trait) => sum + trait.points, 0);
  const skillTotal = data.skills.reduce((sum, skill) => sum + skill.points, 0);
  const spellTotal = data.spells.reduce((sum, spell) => sum + spell.points, 0);

  return attributeTotal + secondaryTotal + poolTotal + traitTotal + skillTotal + spellTotal;
}
