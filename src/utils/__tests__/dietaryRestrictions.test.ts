import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Character } from '../../types/campaign';
import {
  canEatMeal,
  computeExcludedCharacterIds,
  getMealFoodTypes,
  hasDietTraitHint,
} from '../dietaryRestrictions';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'character',
  name: 'Character',
  work: { skills: {} },
  ...overrides,
});

describe('canEatMeal', () => {
  it('rejects a meal when any excluded food type overlaps', () => {
    expect(canEatMeal({ dietExcludedFoodTypes: ['meat', 'fish'] }, ['root', 'fish'])).toBe(false);
  });

  it('allows a meal when no excluded food type overlaps', () => {
    expect(canEatMeal({ dietExcludedFoodTypes: ['meat'] }, ['fruit', 'vegetable'])).toBe(true);
  });

  it('accepts any one required food type', () => {
    expect(canEatMeal({ dietRequiredFoodTypes: ['meat', 'fish'] }, ['root', 'fish'])).toBe(true);
  });

  it('rejects a meal when none of the required food types occur', () => {
    expect(canEatMeal({ dietRequiredFoodTypes: ['meat', 'fish'] }, ['fruit'])).toBe(false);
  });

  it('applies excluded and required axes together', () => {
    expect(canEatMeal({
      dietExcludedFoodTypes: ['dairy'],
      dietRequiredFoodTypes: ['meat'],
    }, ['meat', 'dairy'])).toBe(false);
    expect(canEatMeal({
      dietExcludedFoodTypes: ['dairy'],
      dietRequiredFoodTypes: ['meat'],
    }, ['meat', 'root'])).toBe(true);
  });

  it('treats absent lists as unrestricted', () => {
    expect(canEatMeal({}, [])).toBe(true);
  });

  it('treats empty lists as unrestricted', () => {
    expect(canEatMeal({ dietExcludedFoodTypes: [], dietRequiredFoodTypes: [] }, [])).toBe(true);
  });

  it('compares food types case-insensitively after trimming', () => {
    expect(canEatMeal({ dietExcludedFoodTypes: ['  MEAT '] }, [' meat'])).toBe(false);
    expect(canEatMeal({ dietRequiredFoodTypes: [' FISH'] }, ['fish '])).toBe(true);
  });

  it('rejects a required-list character from a typeless meal', () => {
    expect(canEatMeal({ dietRequiredFoodTypes: ['meat'] }, [])).toBe(false);
  });
});

describe('getMealFoodTypes', () => {
  it('unions food types across ingredients in first-seen order', () => {
    expect(getMealFoodTypes([
      { foodTypes: ['root', 'vegetable'] },
      { foodTypes: ['vegetable', 'starchy'] },
    ])).toEqual(['root', 'vegetable', 'starchy']);
  });

  it('ignores typeless ingredients', () => {
    expect(getMealFoodTypes([{}, { foodTypes: [] }, { foodTypes: ['fruit'] }])).toEqual(['fruit']);
  });

  it('deduplicates case and whitespace drift while retaining the first spelling', () => {
    expect(getMealFoodTypes([
      { foodTypes: [' Meat '] },
      { foodTypes: ['meat', 'MEAT'] },
    ])).toEqual(['Meat']);
  });
});

describe('computeExcludedCharacterIds', () => {
  it('returns only ineligible ids from a mixed party', () => {
    const party = [
      makeCharacter({ id: 'unrestricted' }),
      makeCharacter({ id: 'vegetarian', dietExcludedFoodTypes: ['meat'] }),
      makeCharacter({ id: 'carnivore', dietRequiredFoodTypes: ['meat', 'fish'] }),
      makeCharacter({ id: 'fruitarian', dietRequiredFoodTypes: ['fruit'] }),
    ];

    expect(computeExcludedCharacterIds(party, ['meat', 'root'])).toEqual(['vegetarian', 'fruitarian']);
  });
});

describe('hasDietTraitHint', () => {
  const withTrait = (collection: 'disadvantages' | 'quirks', name: string): Character => {
    const gcsData = createDefaultGCSData();
    if (collection === 'disadvantages') {
      gcsData.disadvantages = [{
        id: 'diet-trait',
        type: 'disadvantage',
        name,
        points: -10,
      }];
    } else {
      gcsData.quirks = [{
        id: 'diet-trait',
        type: 'quirk',
        name,
        points: -1,
      }];
    }
    return makeCharacter({ gcsData });
  };

  it('matches a trimmed Restricted Diet prefix on a disadvantage', () => {
    expect(hasDietTraitHint(withTrait('disadvantages', ' Restricted Diet (Vegetarian) '))).toBe(true);
  });

  it('matches Vegetarian exactly on a quirk', () => {
    expect(hasDietTraitHint(withTrait('quirks', 'Vegetarian'))).toBe(true);
  });

  it('matches longer words that begin with the exact vegetarian prefix', () => {
    expect(hasDietTraitHint(withTrait('disadvantages', 'Vegetarianism'))).toBe(true);
  });

  it('does not match a vegetarian substring after another prefix', () => {
    expect(hasDietTraitHint(withTrait('disadvantages', 'Lacto-Vegetarian'))).toBe(false);
  });

  it('does not inspect advantages or perks', () => {
    const gcsData = createDefaultGCSData();
    gcsData.advantages = [{ id: 'adv', type: 'advantage', name: 'Vegetarian', points: 1 }];
    gcsData.perks = [{ id: 'perk', type: 'perk', name: 'Restricted Diet', points: 1 }];

    expect(hasDietTraitHint(makeCharacter({ gcsData }))).toBe(false);
  });
});
