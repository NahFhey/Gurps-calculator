import { describe, expect, it } from 'vitest';
import { CHARACTER_TEMPLATE_SEEDS } from '../../constants/characterTemplateSeeds';
import { ensureCharacterTemplates } from '../../persistence/dataMigration';
import { createCampaignState } from '../../state/campaignReducer';
import { calculateTotalPoints } from '../characterPoints';
import { createBlankCharacter, createCharacterFromTemplateEntity, createCharacterTemplateSnapshot } from '../characterManagement';

describe('character template entities', () => {
  it('seeds idempotently without overwriting an existing edit', () => {
    const state = createCampaignState();
    state.entities.characterTemplates = {
      [CHARACTER_TEMPLATE_SEEDS[0].id]: { ...CHARACTER_TEMPLATE_SEEDS[0], name: 'Edited Fighter' },
    };
    const once = ensureCharacterTemplates(state);
    const twice = ensureCharacterTemplates(once);
    expect(Object.keys(once.entities.characterTemplates ?? {})).toHaveLength(6);
    expect(once.entities.characterTemplates?.['builtin-fighter']?.name).toBe('Edited Fighter');
    expect(twice).toBe(once);
  });

  it('keeps a deleted built-in deleted', () => {
    const state = createCampaignState();
    state.entities.characterTemplates = {};
    state.entities.deletedBuiltinTemplateIds = ['builtin-wizard'];
    const result = ensureCharacterTemplates(state);
    expect(result.entities.characterTemplates?.['builtin-wizard']).toBeUndefined();
    expect(Object.keys(result.entities.characterTemplates ?? {})).toHaveLength(5);
  });

  it.each(CHARACTER_TEMPLATE_SEEDS)('$name is a playable honest 140–160 point build', (template) => {
    expect(template.gcsData.attributes).not.toEqual({ ST: 10, DX: 10, IQ: 10, HT: 10 });
    expect(template.gcsData.skills.length).toBeGreaterThanOrEqual(8);
    expect(template.gcsData.totalPoints).toBe(calculateTotalPoints(template.gcsData));
    expect(template.gcsData.totalPoints).toBeGreaterThanOrEqual(140);
    expect(template.gcsData.totalPoints).toBeLessThanOrEqual(160);
  });

  it('saves an images-free, career-free user snapshot', () => {
    const character = createBlankCharacter('Veteran');
    character.images = { portrait: 'data:image/png;base64,portrait', token: 'data:image/png;base64,token' };
    if (!character.gcsData) throw new Error('Expected GCS data');
    character.gcsData.unspentPoints = 12;
    character.gcsData.pointLedger = [{ id: 'award', date: '2026-01-01', kind: 'award', points: 12, label: 'Award' }];
    const template = createCharacterTemplateSnapshot(character, 'Veteran Build', 'A build', 123);
    expect(template.builtin).toBe(false);
    expect(template.gcsData.unspentPoints).toBe(0);
    expect(template.gcsData.pointLedger).toEqual([]);
    expect(template).not.toHaveProperty('images');
  });

  it('creates a deep-cloned character with fresh nested IDs', () => {
    const template = CHARACTER_TEMPLATE_SEEDS[0];
    const created = createCharacterFromTemplateEntity(template, 'Ada');
    expect(created.name).toBe('Ada');
    expect(created.gcsData).not.toBe(template.gcsData);
    expect(created.gcsData?.skills[0].id).not.toBe(template.gcsData.skills[0].id);
    if (!created.gcsData) throw new Error('Expected GCS data');
    created.gcsData.attributes.ST = 3;
    expect(template.gcsData.attributes.ST).toBe(13);
  });
});
