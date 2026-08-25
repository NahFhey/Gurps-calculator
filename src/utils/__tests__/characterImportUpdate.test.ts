import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/campaign';
import { createDefaultGCSData } from '../../types/characterSheet';
import { parseCharacterText } from '../characterImport';
import {
  getCharacterTextSections,
  getNonEmptyCharacterTextSections,
} from '../characterImportValidation';
import { buildCharacterImportUpdate } from '../characterImportUpdate';

function makeExisting(): Character {
  const gcsData = createDefaultGCSData();
  gcsData.notes = 'Keep this note';
  gcsData.equipment = [{
    id: 'rope-id',
    name: 'Rope',
    quantity: 1,
    cost: 10,
    weight: 3,
    equipped: true,
    location: 'Pack',
  }];
  gcsData.skills = [{
    id: 'stealth-id',
    name: 'Stealth',
    attribute: 'DX',
    relativeLevel: 0,
    points: 2,
    level: 12,
    notes: 'Trained by Mira',
  }];

  return {
    id: 'existing-id',
    name: 'Hero',
    images: { portrait: 'portrait-data' },
    work: { enabled: false, skills: { legacy: 9 } },
    st: 10,
    gcsData,
  };
}

function updateFromText(existing: Character, text: string) {
  return buildCharacterImportUpdate(existing, parseCharacterText(text), {
    source: 'text',
    presentSections: getCharacterTextSections(text),
    nonEmptySections: getNonEmptyCharacterTextSections(text),
  });
}

describe('buildCharacterImportUpdate', () => {
  it('preserves top-level fields and absent GCS sections', () => {
    const changes = updateFromText(makeExisting(), 'Name: Hero (100)');
    expect(changes).not.toHaveProperty('id');
    expect(changes).not.toHaveProperty('images');
    expect(changes.gcsData?.notes).toBe('Keep this note');
    expect(changes.gcsData?.equipment[0]?.name).toBe('Rope');
  });

  it('allows an explicitly present Notes section to replace notes', () => {
    const changes = updateFromText(makeExisting(), 'Name: Hero (100)\nNotes: New note');
    expect(changes.gcsData?.notes).toBe('New note');
  });

  it('allows an explicitly empty collection to clear existing entries', () => {
    const changes = updateFromText(makeExisting(), 'Name: Hero (100)\nEquipment:');
    expect(changes.gcsData?.equipment).toEqual([]);
  });

  it('does not erase a collection when non-empty source content unexpectedly parsed empty', () => {
    const changes = updateFromText(
      makeExisting(),
      'Name: Hero (100)\nEquipment: 1 Rope [$10; 3 lb];'
    );
    expect(changes.gcsData?.equipment[0]).toMatchObject({
      id: 'rope-id',
      equipped: true,
      location: 'Pack',
    });
  });

  it('preserves unexported metadata on a matched collection entry', () => {
    const changes = updateFromText(
      makeExisting(),
      'Name: Hero (100)\nSkills: Stealth DX+1 [4]-13;'
    );
    expect(changes.gcsData?.skills[0]).toMatchObject({
      id: 'stealth-id',
      name: 'Stealth',
      level: 13,
      notes: 'Trained by Mira',
    });
  });

  it('keeps the existing work enabled flag while resynchronizing skills', () => {
    const changes = updateFromText(
      makeExisting(),
      'Name: Hero (100)\nSkills: Stealth DX+1 [4]-13;'
    );
    expect(changes.work?.enabled).toBe(false);
    expect(changes.work?.skills.Stealth).toBe(13);
  });
});
