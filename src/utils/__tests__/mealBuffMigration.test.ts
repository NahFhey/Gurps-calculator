import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { loadCampaignState, saveCampaignState } from '../../persistence/campaignStorage';
import { migrateData } from '../dataMigrations';

describe('meal buff schema migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds a null meal buff to a 1.5.1 payload without the field', () => {
    const migrated = migrateData({ schemaVersion: '1.5.1', foods: [] }, '1.5.1', '1.5.2');

    expect(migrated.mealBuff).toBeNull();
    expect(migrated.schemaVersion).toBe('1.5.2');
  });

  it('is idempotent when the 1.5.2 migration is re-run', () => {
    const migrated = migrateData({ schemaVersion: '1.5.1' }, '1.5.1', '1.5.2');
    const migratedAgain = migrateData(migrated, '1.5.1', '1.5.2');

    expect(migratedAgain).toEqual(migrated);
  });

  it('round-trips a non-null meal buff through save and load', async () => {
    const state = createCampaignState();
    state.mealBuff = {
      day: 9,
      recipeId: 'root-stew',
      recipeName: 'Root Stew',
      skills: ['Cryptography', 'Guns', 'Artist'],
    };

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.mealBuff).toEqual(state.mealBuff);
  });
});
