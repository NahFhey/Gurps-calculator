import type { CampaignState } from '../state/campaignReducer';
import type { Id } from '../types/campaign';
import { getCharacterSkills } from '../types/characterSheet';
import { selectOwnerFoodHoldings } from '../state/selectors/inventorySelectors';

export interface ProvisionEstimate {
  foodUnits: number;
  days: number;
  bestCookName: string | null;
}

export function estimateProvisionDays(
  state: CampaignState,
  memberIds: Id[]
): ProvisionEstimate {
  const foodUnits = selectOwnerFoodHoldings(state, 'party')
    .reduce((sum, food) => sum + Math.max(0, food.quantity), 0);
  const cooks = memberIds.flatMap((id) => {
    const character = state.entities.characters[id];
    if (!character) return [];
    const level = getCharacterSkills(character).cooking;
    return typeof level === 'number' && level > 0 ? [{ character, level }] : [];
  }).sort((a, b) => b.level - a.level || a.character.name.localeCompare(b.character.name));
  return {
    foodUnits,
    days: Math.floor(foodUnits / Math.max(1, memberIds.length)),
    bestCookName: cooks[0]?.character.name ?? null,
  };
}
