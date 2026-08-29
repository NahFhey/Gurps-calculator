import {
  calculateRelativeLevel,
  calculateSkillLevel,
} from '../types/characterSheet';
import type { Id } from '../types/campaign';
import type {
  GCSCharacterData,
  Skill,
  SkillAdvancementEntry,
  SkillAttribute,
  SkillDifficulty,
} from '../types/characterSheet';

export interface SkillAdvancementInput {
  skillId?: Id;
  newSkill?: {
    name: string;
    specialization?: string;
    attribute: SkillAttribute;
    difficulty: SkillDifficulty;
  };
  pointsToAdd: number;
  sessionLabel?: string;
  notes?: string;
}

const generatedId = (prefix: string): string => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${suffix}`;
};

const attributeValue = (gcsData: GCSCharacterData, attribute: SkillAttribute): number => {
  if (attribute === 'Will') return gcsData.secondaryAttributes.will.value;
  if (attribute === 'Per') return gcsData.secondaryAttributes.per.value;
  return gcsData.attributes[attribute];
};

export function applySkillAdvancement(
  gcsData: GCSCharacterData,
  input: SkillAdvancementInput
): { updatedSkills: Skill[]; historyEntry: SkillAdvancementEntry } {
  if (!Number.isFinite(input.pointsToAdd) || input.pointsToAdd < 1) {
    throw new Error('pointsToAdd must be at least 1');
  }

  const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';
  const existing = input.skillId
    ? gcsData.skills.find((skill) => skill.id === input.skillId)
    : input.newSkill
      ? gcsData.skills.find((skill) =>
          normalize(skill.name) === normalize(input.newSkill?.name)
          && normalize(skill.specialization) === normalize(input.newSkill?.specialization))
      : undefined;
  if (input.skillId && !existing) throw new Error(`Unknown skill: ${input.skillId}`);
  if (!existing && !input.newSkill) throw new Error('Provide skillId or newSkill');

  const definition = existing ?? input.newSkill;
  if (!definition) throw new Error('Skill definition is required');
  const difficulty = existing?.difficulty ?? input.newSkill?.difficulty ?? 'A';
  const pointsBefore = existing?.points ?? 0;
  const pointsAfter = pointsBefore + input.pointsToAdd;
  const value = attributeValue(gcsData, definition.attribute);
  const levelBefore = existing?.level ?? 0;
  const levelAfter = calculateSkillLevel(value, difficulty, pointsAfter);
  const skillId = existing?.id ?? generatedId('skill');
  const name = definition.name.trim();
  const specialization = definition.specialization?.trim();
  const updatedSkill: Skill = existing
    ? {
        ...existing,
        points: pointsAfter,
        level: levelAfter,
        relativeLevel: calculateRelativeLevel(difficulty, pointsAfter),
      }
    : {
        id: skillId,
        name,
        ...(specialization ? { specialization } : {}),
        attribute: definition.attribute,
        difficulty,
        points: pointsAfter,
        level: levelAfter,
        relativeLevel: calculateRelativeLevel(difficulty, pointsAfter),
      };
  const updatedSkills = existing
    ? gcsData.skills.map((skill) => skill.id === existing.id ? updatedSkill : skill)
    : [...gcsData.skills, updatedSkill];

  return {
    updatedSkills,
    historyEntry: {
      id: generatedId('adv'),
      skillId,
      skillName: specialization ? `${name} (${specialization})` : name,
      date: new Date().toISOString(),
      ...(input.sessionLabel?.trim() ? { sessionLabel: input.sessionLabel.trim() } : {}),
      pointsAdded: input.pointsToAdd,
      previousPoints: pointsBefore,
      newPoints: pointsAfter,
      previousLevel: levelBefore,
      newLevel: levelAfter,
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    },
  };
}
