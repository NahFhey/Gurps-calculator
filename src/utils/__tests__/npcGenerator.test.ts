import { describe, expect, it } from 'vitest';
import { CHARACTER_TEMPLATE_SEEDS } from '../../constants/characterTemplateSeeds';
import { calculateTotalPoints } from '../characterPoints';
import { generateNpc, generateNpcName } from '../npcGenerator';

function repeatingRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('npcGenerator', () => {
  const rogue = CHARACTER_TEMPLATE_SEEDS.find((entry) => entry.id === 'builtin-rogue');
  if (!rogue) throw new Error('Missing rogue seed');

  it('keeps the build exact with no variance apart from identity IDs', () => {
    const npc = generateNpc(rogue, 'none', repeatingRng([0.1, 0.2, 0.3, 0.9]));
    expect(npc.isPlayer).toBe(false);
    expect(npc.gcsData?.attributes).toEqual(rogue.gcsData.attributes);
    expect(npc.gcsData?.skills.map((skill) => skill.points)).toEqual(rogue.gcsData.skills.map((skill) => skill.points));
  });

  it('bounds light attribute jitter and updates DX-based skill levels', () => {
    const npc = generateNpc(rogue, 'light', repeatingRng([0.999, 0.999, 0.999, 0.999, 0.1, 0.2, 0.3, 0.9]));
    expect(npc.gcsData?.attributes).toEqual({ ST: 10, DX: 15, IQ: 12, HT: 11 });
    const originalStealth = rogue.gcsData.skills.find((skill) => skill.name === 'Stealth');
    const stealth = npc.gcsData?.skills.find((skill) => skill.name === 'Stealth');
    expect(stealth?.level).toBe((originalStealth?.level ?? 0) + 1);
    expect(npc.gcsData?.totalPoints).toBe(npc.gcsData ? calculateTotalPoints(npc.gcsData) : -1);
  });

  it('bounds heavy attribute and skill-point jitter and keeps minimum skill points at one', () => {
    const npc = generateNpc(rogue, 'heavy', repeatingRng([0, 0.999, 0, 0.999]));
    if (!npc.gcsData) throw new Error('Expected GCS data');
    for (const key of ['ST', 'DX', 'IQ', 'HT'] as const) {
      expect(Math.abs(npc.gcsData.attributes[key] - rogue.gcsData.attributes[key])).toBeLessThanOrEqual(2);
    }
    npc.gcsData.skills.forEach((skill, index) => {
      expect(skill.points).toBeGreaterThanOrEqual(1);
      expect(Math.abs(skill.points - rogue.gcsData.skills[index].points)).toBeLessThanOrEqual(4);
    });
    expect(npc.gcsData.totalPoints).toBe(calculateTotalPoints(npc.gcsData));
  });

  it('generates shaped names with deterministic reroll variety', () => {
    const first = generateNpcName(repeatingRng([0.1, 0.1, 0.2, 0.9]));
    const second = generateNpcName(repeatingRng([0.8, 0.8, 0.7, 0.6, 0.2, 0.4]));
    expect(first).toMatch(/^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/);
    expect(second).toMatch(/^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/);
    expect(second).not.toBe(first);
  });
});
