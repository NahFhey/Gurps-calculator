import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../campaignReducer';
import type { MealBuff } from '../../types/campaign';

const lunchBuff: MealBuff = {
  day: 4,
  recipeId: 'root-stew',
  recipeName: 'Root Stew',
  skills: ['Cryptography', 'Guns'],
};

describe('campaignReducer setMealBuff', () => {
  it('writes a meal buff record', () => {
    const state = createCampaignState();
    const next = campaignReducer(state, { type: 'setMealBuff', payload: lunchBuff });

    expect(next.mealBuff).toEqual(lunchBuff);
  });

  it('overwrites an existing meal buff with the latest one', () => {
    const state = createCampaignState();
    state.mealBuff = lunchBuff;
    const dinnerBuff: MealBuff = {
      day: 4,
      recipeId: 'venison-pie',
      recipeName: 'Venison Pie',
      skills: ['Survival'],
    };

    const next = campaignReducer(state, { type: 'setMealBuff', payload: dinnerBuff });

    expect(next.mealBuff).toEqual(dinnerBuff);
  });

  it('accepts null to clear the record', () => {
    const state = createCampaignState();
    state.mealBuff = lunchBuff;

    const next = campaignReducer(state, { type: 'setMealBuff', payload: null });

    expect(next.mealBuff).toBeNull();
  });

  it('leaves the rest of campaign state untouched', () => {
    const state = createCampaignState();
    const next = campaignReducer(state, { type: 'setMealBuff', payload: lunchBuff });
    const { mealBuff: previousBuff, ...previousRest } = state;
    const { mealBuff: nextBuff, ...nextRest } = next;

    expect(previousBuff).toBeNull();
    expect(nextBuff).toEqual(lunchBuff);
    expect(nextRest).toEqual(previousRest);
  });
});
