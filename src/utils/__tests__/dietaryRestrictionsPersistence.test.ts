import { beforeEach, describe, expect, it } from 'vitest';
import { loadCampaignState, saveCampaignState } from '../../persistence/campaignStorage';
import { createCampaignState } from '../../state/campaignReducer';

describe('dietary restriction persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips optional character lists and the meal exclusion snapshot', async () => {
    const state = createCampaignState();
    state.entities.characters = {
      soren: {
        id: 'soren',
        name: 'Soren',
        work: { skills: {} },
        dietExcludedFoodTypes: ['meat'],
        dietRequiredFoodTypes: ['root'],
      },
    };
    state.mealBuff = {
      day: 2,
      recipeId: 'stew',
      recipeName: 'Stew',
      skills: ['Cooking'],
      excludedCharacterIds: ['soren'],
    };

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.entities.characters.soren.dietExcludedFoodTypes).toEqual(['meat']);
    expect(loaded.entities.characters.soren.dietRequiredFoodTypes).toEqual(['root']);
    expect(loaded.mealBuff?.excludedCharacterIds).toEqual(['soren']);
  });

  it('loads an old character without optional lists as unrestricted', async () => {
    const state = createCampaignState();
    state.entities.characters = {
      old: { id: 'old', name: 'Old Save', work: { skills: {} } },
    };

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.entities.characters.old.dietExcludedFoodTypes).toBeUndefined();
    expect(loaded.entities.characters.old.dietRequiredFoodTypes).toBeUndefined();
  });
});
