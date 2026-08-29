import {
  calculateRelativeLevel,
  calculateSkillLevel,
  getCharacterSkills,
} from '../types/characterSheet';
import { STUDY_HOURS_PER_SLOT } from '../constants';
import type { StudyProject } from '../types/campaign';
import type {
  GCSCharacterData,
  Skill,
  SkillAdvancementEntry,
  SkillAttribute,
} from '../types/characterSheet';

export interface CharacterLike {
  gcsData?: GCSCharacterData;
  work?: { skills?: Record<string, number> };
  skills?: Record<string, number> | unknown[];
}

export interface CharacterWithGCS extends CharacterLike {
  gcsData: GCSCharacterData;
}

/** 4 full-rate hours when a teacher helper or good materials are present, else 2. */
export function computeStudyHours(hasTeacher: boolean, goodMaterials: boolean): number {
  return hasTeacher || goodMaterials ? STUDY_HOURS_PER_SLOT : STUDY_HOURS_PER_SLOT / 2;
}

const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';

/** Find a current character-sheet entry using normalized name and specialization. */
export function findStudiedSkill(
  character: CharacterLike,
  skillName: string,
  specialization?: string
): Skill | undefined {
  const nameKey = normalize(skillName);
  const specializationKey = normalize(specialization);
  return character.gcsData?.skills.find((skill) =>
    normalize(skill.name) === nameKey && normalize(skill.specialization) === specializationKey
  );
}

const findMergedSkillLevel = (
  character: CharacterLike,
  skillName: string,
  specialization?: string
): number => {
  const skills = getCharacterSkills(character);
  const keys = specialization?.trim()
    ? [`${skillName.trim()} (${specialization.trim()})`, skillName.trim()]
    : [skillName.trim()];
  for (const wanted of keys) {
    const matched = Object.entries(skills).find(([key]) => normalize(key) === normalize(wanted));
    if (matched) return matched[1];
  }
  return 0;
};

/** A teacher must know the skill at a higher level than the student. */
export function isEligibleTeacher(
  teacher: CharacterLike,
  student: CharacterLike,
  skillName: string,
  specialization?: string
): boolean {
  const teacherLevel = findMergedSkillLevel(teacher, skillName, specialization);
  const studentSkill = findStudiedSkill(student, skillName, specialization);
  return teacherLevel > (studentSkill?.level ?? 0);
}

export interface StudyAwardComputation {
  isNewSkill: boolean;
  previousPoints: number;
  newPoints: number;
  previousLevel: number;
  newLevel: number;
  previousRelativeLevel: number;
  newRelativeLevel: number;
  updatedSkills: Skill[];
  historyEntry: SkillAdvancementEntry;
}

const getAttributeValue = (gcsData: GCSCharacterData, attribute: SkillAttribute): number => {
  if (attribute === 'Will') return gcsData.secondaryAttributes.will.value;
  if (attribute === 'Per') return gcsData.secondaryAttributes.per.value;
  return gcsData.attributes[attribute];
};

const generateAwardId = (): string => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(16).slice(2);
  return `adv-${Date.now()}-${suffix}`;
};

/** Compute the character-sheet skill replacement and matching advancement history entry. */
export function computeStudyAward(
  character: CharacterWithGCS,
  project: StudyProject,
  dayKey: number
): StudyAwardComputation {
  const existing = findStudiedSkill(character, project.skillName, project.specialization);
  const isNewSkill = existing === undefined;
  const attribute = existing?.attribute ?? project.attribute;
  const difficulty = existing?.difficulty ?? project.difficulty;
  const attributeValue = getAttributeValue(character.gcsData, attribute);
  const previousPoints = existing?.points ?? 0;
  const newPoints = previousPoints + 1;
  const previousLevel = existing?.level ?? 0;
  const newLevel = calculateSkillLevel(attributeValue, difficulty, newPoints);
  const previousRelativeLevel = existing?.relativeLevel ?? calculateRelativeLevel(difficulty, previousPoints);
  const newRelativeLevel = calculateRelativeLevel(difficulty, newPoints);
  const skillId = existing?.id ?? `skill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const updatedSkill: Skill = existing
    ? {
        ...existing,
        points: newPoints,
        level: newLevel,
        relativeLevel: newRelativeLevel,
      }
    : {
        id: skillId,
        name: project.skillName.trim(),
        ...(project.specialization?.trim() ? { specialization: project.specialization.trim() } : {}),
        attribute,
        difficulty,
        points: newPoints,
        level: newLevel,
        relativeLevel: newRelativeLevel,
      };
  const updatedSkills = existing
    ? character.gcsData.skills.map((skill) => skill.id === existing.id ? updatedSkill : skill)
    : [...character.gcsData.skills, updatedSkill];
  const displayName = project.specialization?.trim()
    ? `${project.skillName.trim()} (${project.specialization.trim()})`
    : project.skillName.trim();
  const historyEntry: SkillAdvancementEntry = {
    id: generateAwardId(),
    skillId,
    skillName: displayName,
    date: new Date().toISOString(),
    sessionLabel: `Study — Day ${dayKey}`,
    pointsAdded: 1,
    previousPoints,
    newPoints,
    previousLevel,
    newLevel,
  };

  return {
    isNewSkill,
    previousPoints,
    newPoints,
    previousLevel,
    newLevel,
    previousRelativeLevel,
    newRelativeLevel,
    updatedSkills,
    historyEntry,
  };
}
