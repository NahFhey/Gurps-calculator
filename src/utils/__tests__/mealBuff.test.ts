import { describe, expect, it } from 'vitest';
import type { MealBuff } from '../../types/campaign';
import { isMealBuffActive } from '../mealBuff';

const buff: MealBuff = {
  day: 6,
  recipeId: 'root-stew',
  recipeName: 'Root Stew',
  skills: ['Cryptography'],
};

describe('isMealBuffActive', () => {
  it('returns false for a null buff', () => {
    expect(isMealBuffActive(null, 6)).toBe(false);
  });

  it('returns true when the buff was cooked on the current day', () => {
    expect(isMealBuffActive(buff, 6)).toBe(true);
  });

  it('returns false when the current day is later than the cook day', () => {
    expect(isMealBuffActive(buff, 7)).toBe(false);
  });
});
