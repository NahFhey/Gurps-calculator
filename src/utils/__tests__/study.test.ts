import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import {
  computeStudyAward,
  computeStudyHours,
  findStudiedSkill,
  isEligibleTeacher,
} from '../study';
import type { StudyProject } from '../../types/campaign';
import type { CharacterWithGCS } from '../study';

function characterWithSkill(points = 1, difficulty: 'E' | 'A' | 'H' | 'VH' = 'A'): CharacterWithGCS {
  const gcsData = createDefaultGCSData();
  gcsData.attributes.IQ = 12;
  gcsData.skills = [{
    id: 'skill-1',
    name: 'Research',
    specialization: 'Archives',
    attribute: 'IQ',
    difficulty,
    points,
    relativeLevel: points === 1 ? -1 : 0,
    level: points === 1 ? 11 : 12,
  }];
  return { gcsData, work: { skills: {} } };
}

function project(overrides: Partial<StudyProject> = {}): StudyProject {
  return {
    id: 'project-1',
    characterId: 'student',
    skillName: 'Research',
    specialization: 'Archives',
    attribute: 'IQ',
    difficulty: 'A',
    accumulatedHours: 200,
    pointsAwarded: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('computeStudyHours', () => {
  it.each([
    [false, false, 2],
    [true, false, 4],
    [false, true, 4],
    [true, true, 4],
  ])('teacher=%s materials=%s credits %sh', (teacher, materials, expected) => {
    expect(computeStudyHours(teacher, materials)).toBe(expected);
  });
});

describe('findStudiedSkill', () => {
  it('matches name and specialization', () => {
    expect(findStudiedSkill(characterWithSkill(), 'Research', 'Archives')?.id).toBe('skill-1');
  });

  it('matches case-insensitively after trimming', () => {
    expect(findStudiedSkill(characterWithSkill(), ' research ', ' ARCHIVES ')?.id).toBe('skill-1');
  });

  it('does not match a different specialization', () => {
    expect(findStudiedSkill(characterWithSkill(), 'Research', 'Fieldwork')).toBeUndefined();
  });

  it('matches an unspecialized skill only when no specialization is requested', () => {
    const character = characterWithSkill();
    character.gcsData.skills[0] = { ...character.gcsData.skills[0], specialization: undefined };
    expect(findStudiedSkill(character, 'Research')).toBeDefined();
    expect(findStudiedSkill(character, 'Research', 'Archives')).toBeUndefined();
  });
});

describe('isEligibleTeacher', () => {
  const student = characterWithSkill();

  it('accepts a teacher above the student level', () => {
    expect(isEligibleTeacher({ work: { skills: { 'Research (Archives)': 12 } } }, student, 'Research', 'Archives')).toBe(true);
  });

  it('rejects an equal teacher level', () => {
    expect(isEligibleTeacher({ work: { skills: { Research: 11 } } }, student, 'Research', 'Archives')).toBe(false);
  });

  it('rejects a lower teacher level', () => {
    expect(isEligibleTeacher({ work: { skills: { Research: 10 } } }, student, 'Research', 'Archives')).toBe(false);
  });

  it('accepts any positive teacher level for an unskilled student', () => {
    expect(isEligibleTeacher({ skills: { Research: 1 } }, { work: { skills: {} } }, 'Research')).toBe(true);
  });

  it('rejects an unskilled teacher', () => {
    expect(isEligibleTeacher({ work: { skills: {} } }, { work: { skills: {} } }, 'Research')).toBe(false);
  });
});

describe('computeStudyAward', () => {
  it('recomputes an Average skill across the 1 to 2 point breakpoint', () => {
    const result = computeStudyAward(characterWithSkill(1, 'A'), project(), 7);
    expect(result).toMatchObject({
      isNewSkill: false,
      previousPoints: 1,
      newPoints: 2,
      previousLevel: 11,
      newLevel: 12,
      previousRelativeLevel: -1,
      newRelativeLevel: 0,
    });
    expect(result.updatedSkills[0]).toMatchObject({ points: 2, level: 12, relativeLevel: 0 });
  });

  it('recomputes a Hard skill across the 3 to 4 point breakpoint', () => {
    const character = characterWithSkill(3, 'H');
    character.gcsData.skills[0] = { ...character.gcsData.skills[0], level: 11, relativeLevel: -1 };
    const result = computeStudyAward(character, project({ difficulty: 'H' }), 8);
    expect(result).toMatchObject({ previousPoints: 3, newPoints: 4, newLevel: 12, newRelativeLevel: 0 });
  });

  it('creates a new one-point skill with a generated id and computed level', () => {
    const character = characterWithSkill();
    character.gcsData.skills = [];
    character.gcsData.secondaryAttributes.will.value = 13;
    const result = computeStudyAward(character, project({ skillName: 'Meditation', specialization: undefined, attribute: 'Will', difficulty: 'H' }), 9);
    expect(result.isNewSkill).toBe(true);
    expect(result.updatedSkills[0]).toMatchObject({ name: 'Meditation', points: 1, level: 11, relativeLevel: -2 });
    expect(result.updatedSkills[0]?.id).toMatch(/^skill-\d+-.+/);
  });

  it('creates a complete Study history entry with a randomized id', () => {
    const result = computeStudyAward(characterWithSkill(), project(), 12);
    expect(result.historyEntry).toMatchObject({
      skillId: 'skill-1',
      skillName: 'Research (Archives)',
      sessionLabel: 'Study — Day 12',
      pointsAdded: 1,
      previousPoints: 1,
      newPoints: 2,
      previousLevel: 11,
      newLevel: 12,
    });
    expect(result.historyEntry.id).toMatch(/^adv-\d+-.+/);
    expect(new Date(result.historyEntry.date).toString()).not.toBe('Invalid Date');
  });
});
