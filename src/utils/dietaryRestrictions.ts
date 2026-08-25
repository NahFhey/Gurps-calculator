import type { Character, Id } from '../types/campaign';

type DietCharacter = Pick<Character, 'dietExcludedFoodTypes' | 'dietRequiredFoodTypes'>;

const normalizeFoodType = (foodType: string): string => foodType.trim().toLowerCase();

export function canEatMeal(
  character: DietCharacter,
  mealFoodTypes: readonly string[],
): boolean {
  const mealTypes = new Set(mealFoodTypes.map(normalizeFoodType).filter(Boolean));
  const excludedTypes = (character.dietExcludedFoodTypes ?? [])
    .map(normalizeFoodType)
    .filter(Boolean);
  const requiredTypes = (character.dietRequiredFoodTypes ?? [])
    .map(normalizeFoodType)
    .filter(Boolean);

  const containsExcludedType = excludedTypes.some(foodType => mealTypes.has(foodType));
  const satisfiesRequiredType = requiredTypes.length === 0
    || requiredTypes.some(foodType => mealTypes.has(foodType));

  return !containsExcludedType && satisfiesRequiredType;
}

export function getMealFoodTypes(
  ingredients: readonly { foodTypes?: string[] }[],
): string[] {
  const foodTypes = new Map<string, string>();
  for (const ingredient of ingredients) {
    for (const foodType of ingredient.foodTypes ?? []) {
      const trimmedFoodType = foodType.trim();
      const normalizedFoodType = normalizeFoodType(foodType);
      if (normalizedFoodType && !foodTypes.has(normalizedFoodType)) {
        foodTypes.set(normalizedFoodType, trimmedFoodType);
      }
    }
  }
  return [...foodTypes.values()];
}

export function computeExcludedCharacterIds(
  characters: Character[],
  mealFoodTypes: readonly string[],
): Id[] {
  return characters
    .filter(character => !canEatMeal(character, mealFoodTypes))
    .map(character => character.id);
}

export function hasDietTraitHint(character: Character): boolean {
  const dietTraits = [
    ...(character.gcsData?.disadvantages ?? []),
    ...(character.gcsData?.quirks ?? []),
  ];

  return dietTraits.some(({ name }) => {
    const normalizedName = name.trim().toLowerCase();
    return normalizedName.startsWith('restricted diet')
      || normalizedName.startsWith('vegetarian');
  });
}
