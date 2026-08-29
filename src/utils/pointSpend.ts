import {
  calculateDerivedAttributes,
  calculateRelativeLevel,
  calculateSkillLevel,
} from '../types/characterSheet';
import { ATTRIBUTE_COSTS, POOL_COSTS, SECONDARY_COSTS } from './characterPoints';
import { applySkillAdvancement } from './skillAdvancement';
import type {
  GCSCharacterData,
  PointLedgerEntry,
  PrimaryAttributes,
  SecondaryAttributes,
  SkillAdvancementEntry,
  SkillAttribute,
  SkillDifficulty,
} from '../types/characterSheet';

export type TraitSpendType = 'advantage' | 'perk' | 'disadvantage' | 'quirk';

export type PointSpendLine =
  | { id: string; kind: 'skill'; skillId: string; points: number }
  | { id: string; kind: 'newSkill'; name: string; specialization?: string; attribute: SkillAttribute; difficulty: SkillDifficulty; points: number }
  | { id: string; kind: 'spell'; spellId: string; points: number }
  | { id: string; kind: 'primary'; attribute: keyof PrimaryAttributes; increments: number }
  | { id: string; kind: 'secondary'; attribute: keyof SecondaryAttributes; increments: number }
  | { id: string; kind: 'pool'; pool: 'HP' | 'FP'; increments: number }
  | { id: string; kind: 'trait'; traitType: TraitSpendType; name: string; points: number };

const generatedId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function pointSpendLineCost(line: PointSpendLine): number {
  switch (line.kind) {
    case 'skill':
    case 'newSkill':
    case 'spell':
      return line.points;
    case 'primary':
      return ATTRIBUTE_COSTS[line.attribute] * line.increments;
    case 'secondary':
      return SECONDARY_COSTS[line.attribute] * line.increments;
    case 'pool':
      return POOL_COSTS[line.pool] * line.increments;
    case 'trait':
      return line.points;
  }
}

export function pointSpendCartTotal(lines: PointSpendLine[]): number {
  return lines.reduce((sum, line) => sum + pointSpendLineCost(line), 0);
}

function buildAdjustedCharacteristics(
  gcsData: GCSCharacterData,
  lines: PointSpendLine[]
): Pick<GCSCharacterData, 'attributes' | 'attributePoints' | 'secondaryAttributes' | 'pools'> {
  const attributes = { ...gcsData.attributes };
  const attributePoints = { ...gcsData.attributePoints };
  for (const line of lines) {
    if (line.kind !== 'primary') continue;
    attributes[line.attribute] += line.increments;
    attributePoints[line.attribute] += ATTRIBUTE_COSTS[line.attribute] * line.increments;
  }

  const secondaryIncrements: Partial<Record<keyof SecondaryAttributes, number>> = {};
  for (const line of lines) {
    if (line.kind === 'secondary') secondaryIncrements[line.attribute] = line.increments;
  }
  const incrementFor = (key: keyof SecondaryAttributes): number => secondaryIncrements[key] ?? 0;
  const old = gcsData.secondaryAttributes;
  const derived = calculateDerivedAttributes(attributes);
  const will = attributes.IQ + old.will.points / SECONDARY_COSTS.will + incrementFor('will');
  const per = attributes.IQ + old.per.points / SECONDARY_COSTS.per + incrementFor('per');
  const basicSpeed = derived.basicSpeed
    + old.basicSpeed.points / SECONDARY_COSTS.basicSpeed * 0.25
    + incrementFor('basicSpeed') * 0.25;
  const secondaryAttributes: SecondaryAttributes = {
    will: { value: will, points: old.will.points + incrementFor('will') * SECONDARY_COSTS.will },
    frightCheck: {
      value: will + old.frightCheck.points / SECONDARY_COSTS.frightCheck + incrementFor('frightCheck'),
      points: old.frightCheck.points + incrementFor('frightCheck') * SECONDARY_COSTS.frightCheck,
    },
    per: { value: per, points: old.per.points + incrementFor('per') * SECONDARY_COSTS.per },
    vision: {
      value: per + old.vision.points / SECONDARY_COSTS.vision + incrementFor('vision'),
      points: old.vision.points + incrementFor('vision') * SECONDARY_COSTS.vision,
    },
    hearing: {
      value: per + old.hearing.points / SECONDARY_COSTS.hearing + incrementFor('hearing'),
      points: old.hearing.points + incrementFor('hearing') * SECONDARY_COSTS.hearing,
    },
    tasteSmell: {
      value: per + old.tasteSmell.points / SECONDARY_COSTS.tasteSmell + incrementFor('tasteSmell'),
      points: old.tasteSmell.points + incrementFor('tasteSmell') * SECONDARY_COSTS.tasteSmell,
    },
    touch: {
      value: per + old.touch.points / SECONDARY_COSTS.touch + incrementFor('touch'),
      points: old.touch.points + incrementFor('touch') * SECONDARY_COSTS.touch,
    },
    basicSpeed: {
      value: basicSpeed,
      points: old.basicSpeed.points + incrementFor('basicSpeed') * SECONDARY_COSTS.basicSpeed,
    },
    basicMove: {
      value: Math.floor(basicSpeed) + old.basicMove.points / SECONDARY_COSTS.basicMove + incrementFor('basicMove'),
      points: old.basicMove.points + incrementFor('basicMove') * SECONDARY_COSTS.basicMove,
    },
  };

  const pools = {
    HP: { ...gcsData.pools.HP },
    FP: { ...gcsData.pools.FP },
  };
  for (const pool of ['HP', 'FP'] as const) {
    let increments = 0;
    for (const line of lines) {
      if (line.kind === 'pool' && line.pool === pool) increments = line.increments;
    }
    const base = pool === 'HP' ? attributes.ST : attributes.HT;
    const oldPool = gcsData.pools[pool];
    pools[pool] = {
      ...oldPool,
      max: base + oldPool.points / POOL_COSTS[pool] + increments,
      points: oldPool.points + increments * POOL_COSTS[pool],
    };
  }

  return { attributes, attributePoints, secondaryAttributes, pools };
}

export interface AppliedPointSpend {
  gcsData: GCSCharacterData;
  historyEntries: SkillAdvancementEntry[];
  total: number;
  summary: string;
}

export function applyPointSpend(
  gcsData: GCSCharacterData,
  lines: PointSpendLine[],
  campaignDay: number,
  now = new Date()
): AppliedPointSpend {
  if (lines.length === 0) throw new Error('Cannot apply an empty point-spend cart');
  const total = pointSpendCartTotal(lines);
  if (total > (gcsData.unspentPoints ?? 0)) throw new Error('Insufficient unspent points');

  const characteristics = buildAdjustedCharacteristics(gcsData, lines);
  let working: GCSCharacterData = { ...gcsData, ...characteristics };
  const historyEntries: SkillAdvancementEntry[] = [];
  const summaries: string[] = [];

  for (const line of lines) {
    if (line.kind === 'skill') {
      const result = applySkillAdvancement(working, {
        skillId: line.skillId,
        pointsToAdd: line.points,
        sessionLabel: `Point spend — Day ${campaignDay}`,
      });
      working = { ...working, skills: result.updatedSkills };
      historyEntries.push(result.historyEntry);
      summaries.push(`Raised ${result.historyEntry.skillName} ${result.historyEntry.previousLevel}→${result.historyEntry.newLevel}`);
    } else if (line.kind === 'newSkill') {
      const result = applySkillAdvancement(working, {
        newSkill: {
          name: line.name,
          specialization: line.specialization,
          attribute: line.attribute,
          difficulty: line.difficulty,
        },
        pointsToAdd: line.points,
        sessionLabel: `Point spend — Day ${campaignDay}`,
      });
      working = { ...working, skills: result.updatedSkills };
      historyEntries.push(result.historyEntry);
      summaries.push(`Added ${result.historyEntry.skillName}`);
    }
  }

  const spells = working.spells.map((spell) => {
    const line = lines.find((candidate) => candidate.kind === 'spell' && candidate.spellId === spell.id);
    const addedPoints = line?.kind === 'spell' ? line.points : 0;
    const points = spell.points + addedPoints;
    const relativeLevel = calculateRelativeLevel('H', points);
    if (addedPoints > 0) {
      summaries.push(`Raised ${spell.name} ${spell.level}→${calculateSkillLevel(working.attributes.IQ, 'H', points)}`);
    }
    return { ...spell, points, relativeLevel, level: working.attributes.IQ + relativeLevel };
  });

  for (const line of lines) {
    if (line.kind === 'primary') summaries.push(`+${line.increments} ${line.attribute}`);
    if (line.kind === 'secondary') summaries.push(`+${line.increments}${line.attribute === 'basicSpeed' ? ' step' : ''} ${line.attribute}`);
    if (line.kind === 'pool') summaries.push(`+${line.increments} ${line.pool}`);
  }

  const traitCollections = {
    advantages: [...working.advantages],
    perks: [...working.perks],
    disadvantages: [...working.disadvantages],
    quirks: [...working.quirks],
  };
  for (const line of lines) {
    if (line.kind !== 'trait') continue;
    const traitBase = { id: generatedId(line.traitType), name: line.name.trim(), points: line.points };
    switch (line.traitType) {
      case 'advantage': traitCollections.advantages.push({ ...traitBase, type: 'advantage' }); break;
      case 'perk': traitCollections.perks.push({ ...traitBase, type: 'perk' }); break;
      case 'disadvantage': traitCollections.disadvantages.push({ ...traitBase, type: 'disadvantage' }); break;
      case 'quirk': traitCollections.quirks.push({ ...traitBase, type: 'quirk' }); break;
    }
    summaries.push(`${line.name.trim()} (${line.points >= 0 ? '+' : ''}${line.points})`);
  }

  const summary = summaries.join(', ');
  const ledgerEntry: PointLedgerEntry = {
    id: generatedId('points-spend'),
    date: now.toISOString(),
    kind: 'spend',
    points: -Math.abs(total),
    label: summary,
  };
  working = {
    ...working,
    ...traitCollections,
    spells,
    skillHistory: [...(working.skillHistory ?? []), ...historyEntries],
    unspentPoints: (working.unspentPoints ?? 0) - total,
    pointLedger: [...(working.pointLedger ?? []), ledgerEntry],
  };

  // Attribute changes affect every skill, including skills not explicitly advanced.
  working = {
    ...working,
    skills: working.skills.map((skill) => {
      const value = skill.attribute === 'Will'
        ? working.secondaryAttributes.will.value
        : skill.attribute === 'Per'
          ? working.secondaryAttributes.per.value
          : working.attributes[skill.attribute];
      const relativeLevel = calculateRelativeLevel(skill.difficulty ?? 'A', skill.points);
      return { ...skill, relativeLevel, level: value + relativeLevel };
    }),
  };

  return { gcsData: working, historyEntries, total, summary };
}
