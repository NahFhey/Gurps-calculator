import { calculateRelativeLevel, getCharacterSkills } from '../types/characterSheet';
import { applySkillAdvancement } from './skillAdvancement';
import { STUDY_HOURS_PER_SLOT } from '../constants';
import type { StudyProject } from '../types/campaign';
import type {
  GCSCharacterData,
  Skill,
  SkillAdvancementEntry,
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

/** Compute the character-sheet skill replacement and matching advancement history entry. */
export function computeStudyAward(
  character: CharacterWithGCS,
  project: StudyProject,
  dayKey: number
): StudyAwardComputation {
  const existing = findStudiedSkill(character, project.skillName, project.specialization);
  const isNewSkill = existing === undefined;
  const difficulty = existing?.difficulty ?? project.difficulty;
  const previousPoints = existing?.points ?? 0;
  const previousLevel = existing?.level ?? 0;
  const previousRelativeLevel = existing?.relativeLevel ?? calculateRelativeLevel(difficulty, previousPoints);
  const advancement = applySkillAdvancement(character.gcsData, existing
    ? { skillId: existing.id, pointsToAdd: 1, sessionLabel: `Study — Day ${dayKey}` }
    : {
        newSkill: {
          name: project.skillName,
          specialization: project.specialization,
          attribute: project.attribute,
          difficulty: project.difficulty,
        },
        pointsToAdd: 1,
        sessionLabel: `Study — Day ${dayKey}`,
      });
  const updatedSkill = advancement.updatedSkills.find((skill) => skill.id === advancement.historyEntry.skillId);
  if (!updatedSkill) throw new Error('Study advancement did not produce a skill');

  return {
    isNewSkill,
    previousPoints,
    newPoints: advancement.historyEntry.newPoints,
    previousLevel,
    newLevel: advancement.historyEntry.newLevel,
    previousRelativeLevel,
    newRelativeLevel: updatedSkill.relativeLevel,
    updatedSkills: advancement.updatedSkills,
    historyEntry: advancement.historyEntry,
  };
}
