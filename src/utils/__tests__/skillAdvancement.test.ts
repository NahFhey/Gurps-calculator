import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import { applySkillAdvancement } from '../skillAdvancement';

describe('applySkillAdvancement', () => {
  it('increments an existing skill across point breakpoints', () => {
    const data = createDefaultGCSData();
    data.attributes.DX = 12;
    data.skills = [{ id: 'sword', name: 'Broadsword', attribute: 'DX', difficulty: 'A', points: 1, relativeLevel: -1, level: 11 }];

    const twoPoints = applySkillAdvancement(data, { skillId: 'sword', pointsToAdd: 1 });
    expect(twoPoints.updatedSkills[0]).toMatchObject({ points: 2, relativeLevel: 0, level: 12 });
    const fourPoints = applySkillAdvancement({ ...data, skills: twoPoints.updatedSkills }, { skillId: 'sword', pointsToAdd: 2 });
    expect(fourPoints.updatedSkills[0]).toMatchObject({ points: 4, relativeLevel: 1, level: 13 });
  });

  it('creates a new computed skill', () => {
    const data = createDefaultGCSData();
    data.attributes.IQ = 13;
    const result = applySkillAdvancement(data, {
      newSkill: { name: 'Alchemy', specialization: 'Elixirs', attribute: 'IQ', difficulty: 'VH' },
      pointsToAdd: 2,
    });
    expect(result.updatedSkills[0]).toMatchObject({ name: 'Alchemy', specialization: 'Elixirs', points: 2, relativeLevel: -2, level: 11 });
    expect(result.updatedSkills[0]?.id).toMatch(/^skill-\d+-.+/);
  });

  it('reads Will and Per from secondary attributes', () => {
    const data = createDefaultGCSData();
    data.attributes.IQ = 9;
    data.secondaryAttributes.will.value = 14;
    data.secondaryAttributes.per.value = 12;
    const will = applySkillAdvancement(data, { newSkill: { name: 'Meditation', attribute: 'Will', difficulty: 'H' }, pointsToAdd: 1 });
    const per = applySkillAdvancement(data, { newSkill: { name: 'Search', attribute: 'Per', difficulty: 'E' }, pointsToAdd: 1 });
    expect(will.updatedSkills[0]?.level).toBe(12);
    expect(per.updatedSkills[0]?.level).toBe(12);
  });

  it('returns a complete randomized history entry', () => {
    const data = createDefaultGCSData();
    data.skills = [{ id: 'research', name: 'Research', attribute: 'IQ', difficulty: 'A', points: 1, relativeLevel: -1, level: 9 }];
    const result = applySkillAdvancement(data, { skillId: 'research', pointsToAdd: 3, sessionLabel: 'Session 4', notes: 'Library work' });
    expect(result.historyEntry).toMatchObject({
      skillId: 'research', skillName: 'Research', pointsAdded: 3,
      previousPoints: 1, newPoints: 4, previousLevel: 9, newLevel: 11,
      sessionLabel: 'Session 4', notes: 'Library work',
    });
    expect(result.historyEntry.id).toMatch(/^adv-\d+-.+/);
    expect(new Date(result.historyEntry.date).toString()).not.toBe('Invalid Date');
  });
});

describe('applySkillAdvancement newSkill dedup', () => {
  it('increments an existing same-name skill instead of duplicating it', () => {
    const gcsData = createDefaultGCSData();
    gcsData.skills = [{
      id: 'skill-swim', name: 'Swimming', attribute: 'HT' as const,
      difficulty: 'E' as const, points: 1, level: 10, relativeLevel: 0,
    }];
    const result = applySkillAdvancement(gcsData, {
      newSkill: { name: '  swimming ', attribute: 'HT', difficulty: 'E' },
      pointsToAdd: 1,
    });
    expect(result.updatedSkills).toHaveLength(1);
    expect(result.updatedSkills[0]).toMatchObject({ id: 'skill-swim', points: 2, level: 11 });
    expect(result.historyEntry.previousPoints).toBe(1);
  });
});
