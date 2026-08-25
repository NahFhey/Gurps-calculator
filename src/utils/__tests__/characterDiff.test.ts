import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/campaign';
import type { Equipment, Skill } from '../../types/characterSheet';
import { createDefaultGCSData } from '../../types/characterSheet';
import { diffCharacters, hasChanges } from '../characterDiff';

function makeCharacter(name = 'Avery'): Character {
  return {
    id: `id-${name}`,
    name,
    isPlayer: true,
    work: { enabled: true, skills: {} },
    st: 10,
    gcsData: createDefaultGCSData(),
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Stealth',
    attribute: 'DX',
    relativeLevel: 0,
    points: 2,
    level: 12,
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'equipment-1',
    name: 'Rope',
    quantity: 1,
    cost: 10,
    weight: 3,
    ...overrides,
  };
}

describe('diffCharacters scalar changes', () => {
  it('returns an empty diff for equivalent characters with different generated IDs', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.skills.push(makeSkill({ id: 'old-id' }));
    incoming.gcsData?.skills.push(makeSkill({ id: 'new-id' }));

    const diff = diffCharacters(existing, incoming);
    expect(diff.scalarChanges).toEqual([]);
    expect(diff.skills.changed).toEqual([]);
    expect(diff.summary).toEqual({ changedFields: 0, added: 0, removed: 0, modified: 0 });
    expect(hasChanges(diff)).toBe(false);
  });

  it('reports a top-level name change', () => {
    const diff = diffCharacters(makeCharacter('Old Name'), makeCharacter('New Name'));
    expect(diff.scalarChanges).toContainEqual({
      path: 'name',
      label: 'Name',
      from: 'Old Name',
      to: 'New Name',
    });
  });

  it('reports a primary attribute change', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    if (incoming.gcsData) incoming.gcsData.attributes.ST = 13;
    const diff = diffCharacters(existing, incoming);
    expect(diff.scalarChanges).toContainEqual(expect.objectContaining({ label: 'ST', from: 10, to: 13 }));
  });

  it('reports secondary attribute values and point costs', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    if (incoming.gcsData) incoming.gcsData.secondaryAttributes.will = { value: 12, points: 10 };
    const diff = diffCharacters(existing, incoming);
    expect(diff.scalarChanges.filter((change) => change.label.startsWith('Will'))).toHaveLength(2);
  });

  it('reports point-pool changes', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    if (incoming.gcsData) incoming.gcsData.pools.HP.current = 7;
    expect(diffCharacters(existing, incoming).scalarChanges).toContainEqual(
      expect.objectContaining({ label: 'HP current', from: 10, to: 7 })
    );
  });
});

describe('diffCharacters collection changes', () => {
  it('reports an added skill', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    incoming.gcsData?.skills.push(makeSkill());
    const diff = diffCharacters(existing, incoming);
    expect(diff.skills.added).toHaveLength(1);
    expect(diff.skills.added[0]?.name).toBe('Stealth');
  });

  it('reports a removed skill', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.skills.push(makeSkill());
    expect(diffCharacters(existing, incoming).skills.removed).toEqual([expect.objectContaining({ name: 'Stealth' })]);
  });

  it('matches skill names case-insensitively and reports changed fields', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.skills.push(makeSkill({ name: 'Stealth', level: 12 }));
    incoming.gcsData?.skills.push(makeSkill({ name: 'stealth', level: 14 }));
    const diff = diffCharacters(existing, incoming);
    expect(diff.skills.added).toEqual([]);
    expect(diff.skills.removed).toEqual([]);
    expect(diff.skills.changed[0]).toMatchObject({
      name: 'stealth',
      changes: [expect.objectContaining({ label: 'Level', from: 12, to: 14 })],
    });
  });

  it('reports multiple changed fields within one skill as one modified entry', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.skills.push(makeSkill());
    incoming.gcsData?.skills.push(makeSkill({ points: 8, level: 14 }));
    const diff = diffCharacters(existing, incoming);
    expect(diff.skills.changed).toHaveLength(1);
    expect(diff.skills.changed[0]?.changes).toHaveLength(2);
    expect(diff.summary.modified).toBe(1);
  });

  it('reports an equipment quantity change', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.equipment.push(makeEquipment({ quantity: 1 }));
    incoming.gcsData?.equipment.push(makeEquipment({ quantity: 3 }));
    expect(diffCharacters(existing, incoming).equipment.changed[0]?.changes).toContainEqual(
      expect.objectContaining({ label: 'Quantity', from: 1, to: 3 })
    );
  });

  it('reports equipment additions and removals', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    existing.gcsData?.equipment.push(makeEquipment({ name: 'Torch' }));
    incoming.gcsData?.equipment.push(makeEquipment({ name: 'Lantern' }));
    const diff = diffCharacters(existing, incoming);
    expect(diff.equipment.added[0]?.name).toBe('Lantern');
    expect(diff.equipment.removed[0]?.name).toBe('Torch');
  });

  it('reports trait additions in the correct collection', () => {
    const incoming = makeCharacter();
    incoming.gcsData?.advantages.push({
      id: 'advantage-1',
      type: 'advantage',
      name: 'Fit',
      points: 5,
    });
    expect(diffCharacters(makeCharacter(), incoming).advantages.added[0]?.name).toBe('Fit');
  });
});

describe('diffCharacters summary', () => {
  it('counts scalar, added, removed, and modified entries independently', () => {
    const existing = makeCharacter();
    const incoming = makeCharacter();
    if (incoming.gcsData) incoming.gcsData.totalPoints = 125;
    existing.gcsData?.skills.push(makeSkill({ name: 'Stealth' }));
    incoming.gcsData?.skills.push(makeSkill({ name: 'Stealth', level: 13 }));
    existing.gcsData?.equipment.push(makeEquipment({ name: 'Torch' }));
    incoming.gcsData?.equipment.push(makeEquipment({ name: 'Lantern' }));

    const diff = diffCharacters(existing, incoming);
    expect(diff.summary).toEqual({ changedFields: 1, added: 1, removed: 1, modified: 1 });
    expect(hasChanges(diff)).toBe(true);
  });
});
