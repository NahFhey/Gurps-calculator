import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Inventory,
} from '../../../types/campaign';
import {
  selectMaterialsRecord,
  selectAllMaterials,
  selectMaterialById,
  selectMaterialsByType,
  selectMaterialQuantityByType,
  selectFoodsRecord,
  selectAllFoods,
  selectFoodById,
  selectFoodsByType,
  selectFoodQuantityByType,
  selectRecipesRecord,
  selectAllRecipes,
  selectRecipeById,
  selectRecipesBySkill,
  selectFoodTypes,
  selectFoodTypeByName,
  selectMaterialTypes,
  selectMaterialTypeByName,
  selectInventoriesRecord,
  selectAllInventories,
  selectInventoryById,
  selectInventoryByOwner,
  selectCharacterInventory,
  selectPartyInventory,
  selectInventoryActiveTab,
} from '../inventorySelectors';

const ironOre: Material = {
  id: 'mat1',
  name: 'Iron Ore',
  type: 'metal',
  quantity: 5,
};

const moreIron: Material = {
  id: 'mat2',
  name: 'Iron Ingot',
  type: 'metal',
  quantity: 3,
};

const oakWood: Material = {
  id: 'mat3',
  name: 'Oak Wood',
  type: 'wood',
  quantity: 7,
};

const apple: Food = {
  id: 'food1',
  name: 'Apple',
  type: 'fruit',
  quantity: 4,
};

const trailMix: Food = {
  id: 'food2',
  name: 'Trail Mix',
  types: ['fruit', 'nut'],
  quantity: 2,
};

const breadLoaf: Food = {
  id: 'food3',
  name: 'Bread',
  type: 'grain',
  quantity: 6,
};

const stew: Recipe = {
  id: 'rec1',
  name: 'Stew',
  ingredients: [{ type: 'food', id: 'food1', amount: 1 }],
  skill: 'Cooking',
  difficulty: 0,
  prepTime: 30,
  servings: 4,
};

const sword: Recipe = {
  id: 'rec2',
  name: 'Sword',
  ingredients: [{ type: 'material', id: 'mat1', amount: 2 }],
  skill: 'Smithing',
  difficulty: 2,
  prepTime: 240,
  servings: 1,
};

const fruitType: FoodType = { name: 'fruit', color: '#ff0000' };
const grainType: FoodType = { name: 'grain', color: '#deb887' };

const metalType: MaterialType = {
  name: 'metal',
  difficulty: 1,
  effects: 'sturdy',
  ht: 12,
  drShift: 1,
  weightMod: 100,
  hpMod: 100,
};
const woodType: MaterialType = {
  name: 'wood',
  difficulty: 0,
  effects: 'light',
  ht: 8,
  drShift: 0,
  weightMod: 60,
  hpMod: 70,
};

const partyInv: Inventory = {
  id: 'inv-party',
  ownerType: 'party',
  ownerId: null,
  currency: { gp: 100 },
  items: [],
  tools: [],
  materials: [],
  food: [],
};

const aliceInv: Inventory = {
  id: 'inv-alice',
  ownerType: 'character',
  ownerId: 'char-alice',
  currency: { gp: 5 },
  items: [],
  tools: [],
  materials: [],
  food: [],
};

const bobInv: Inventory = {
  id: 'inv-bob',
  ownerType: 'character',
  ownerId: 'char-bob',
  currency: {},
  items: [],
  tools: [],
  materials: [],
  food: [],
};

function buildState(): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: {
      ...base.entities,
      materials: { mat1: ironOre, mat2: moreIron, mat3: oakWood },
      foods: { food1: apple, food2: trailMix, food3: breadLoaf },
      recipes: { rec1: stew, rec2: sword },
      foodTypes: [fruitType, grainType],
      materialTypes: [metalType, woodType],
      inventories: { 'inv-party': partyInv, 'inv-alice': aliceInv, 'inv-bob': bobInv },
    },
    inventory: { activeTab: 'foods' },
  };
}

describe('inventorySelectors — materials', () => {
  it('selects materials record, array, and by id', () => {
    const state = buildState();
    expect(selectMaterialsRecord(state)).toEqual({
      mat1: ironOre,
      mat2: moreIron,
      mat3: oakWood,
    });
    expect(selectAllMaterials(state)).toHaveLength(3);
    expect(selectMaterialById(state, 'mat1')).toEqual(ironOre);
    expect(selectMaterialById(state, 'missing')).toBeUndefined();
  });

  it('filters materials by type', () => {
    const state = buildState();
    expect(selectMaterialsByType(state, 'metal')).toEqual([ironOre, moreIron]);
    expect(selectMaterialsByType(state, 'wood')).toEqual([oakWood]);
    expect(selectMaterialsByType(state, 'gem')).toEqual([]);
  });

  it('sums material quantity by type', () => {
    const state = buildState();
    expect(selectMaterialQuantityByType(state, 'metal')).toBe(8);
    expect(selectMaterialQuantityByType(state, 'wood')).toBe(7);
    expect(selectMaterialQuantityByType(state, 'missing')).toBe(0);
  });

  it('returns empty results on initial state', () => {
    expect(selectAllMaterials(initialCampaignState)).toEqual([]);
    expect(selectMaterialsByType(initialCampaignState, 'metal')).toEqual([]);
    expect(selectMaterialQuantityByType(initialCampaignState, 'metal')).toBe(0);
  });
});

describe('inventorySelectors — foods', () => {
  it('selects foods record, array, and by id', () => {
    const state = buildState();
    expect(selectFoodsRecord(state)).toEqual({
      food1: apple,
      food2: trailMix,
      food3: breadLoaf,
    });
    expect(selectAllFoods(state)).toHaveLength(3);
    expect(selectFoodById(state, 'food1')).toEqual(apple);
    expect(selectFoodById(state, 'missing')).toBeUndefined();
  });

  it('filters foods by type — matching both legacy `type` and multi-type `types`', () => {
    const state = buildState();
    expect(selectFoodsByType(state, 'fruit')).toEqual([apple, trailMix]);
    expect(selectFoodsByType(state, 'nut')).toEqual([trailMix]);
    expect(selectFoodsByType(state, 'grain')).toEqual([breadLoaf]);
    expect(selectFoodsByType(state, 'missing')).toEqual([]);
  });

  it('sums food quantity by type across legacy and multi-type', () => {
    const state = buildState();
    expect(selectFoodQuantityByType(state, 'fruit')).toBe(6); // apple(4) + trailMix(2)
    expect(selectFoodQuantityByType(state, 'nut')).toBe(2);
    expect(selectFoodQuantityByType(state, 'grain')).toBe(6);
    expect(selectFoodQuantityByType(state, 'missing')).toBe(0);
  });
});

describe('inventorySelectors — recipes', () => {
  it('selects recipes record, array, and by id', () => {
    const state = buildState();
    expect(selectRecipesRecord(state)).toEqual({ rec1: stew, rec2: sword });
    expect(selectAllRecipes(state)).toHaveLength(2);
    expect(selectRecipeById(state, 'rec1')).toEqual(stew);
    expect(selectRecipeById(state, 'missing')).toBeUndefined();
  });

  it('filters recipes by skill', () => {
    const state = buildState();
    expect(selectRecipesBySkill(state, 'Cooking')).toEqual([stew]);
    expect(selectRecipesBySkill(state, 'Smithing')).toEqual([sword]);
    expect(selectRecipesBySkill(state, 'missing')).toEqual([]);
  });
});

describe('inventorySelectors — type definitions', () => {
  it('returns food types and looks up by name', () => {
    const state = buildState();
    expect(selectFoodTypes(state)).toEqual([fruitType, grainType]);
    expect(selectFoodTypeByName(state, 'fruit')).toEqual(fruitType);
    expect(selectFoodTypeByName(state, 'missing')).toBeUndefined();
  });

  it('returns material types and looks up by name', () => {
    const state = buildState();
    expect(selectMaterialTypes(state)).toEqual([metalType, woodType]);
    expect(selectMaterialTypeByName(state, 'metal')).toEqual(metalType);
    expect(selectMaterialTypeByName(state, 'missing')).toBeUndefined();
  });
});

describe('inventorySelectors — inventory entities', () => {
  it('selects inventories record, array, and by id', () => {
    const state = buildState();
    expect(selectInventoriesRecord(state)).toEqual({
      'inv-party': partyInv,
      'inv-alice': aliceInv,
      'inv-bob': bobInv,
    });
    expect(selectAllInventories(state)).toHaveLength(3);
    expect(selectInventoryById(state, 'inv-alice')).toEqual(aliceInv);
    expect(selectInventoryById(state, 'missing')).toBeUndefined();
  });

  it('selects inventory by owner type and id', () => {
    const state = buildState();
    expect(selectInventoryByOwner(state, 'character', 'char-alice')).toEqual(aliceInv);
    expect(selectInventoryByOwner(state, 'character', 'char-bob')).toEqual(bobInv);
    expect(selectInventoryByOwner(state, 'character', 'missing')).toBeUndefined();
    expect(selectInventoryByOwner(state, 'party', 'anything')).toBeUndefined();
  });

  it('selects character inventory regardless of ownerId match position', () => {
    const state = buildState();
    expect(selectCharacterInventory(state, 'char-alice')).toEqual(aliceInv);
    expect(selectCharacterInventory(state, 'char-bob')).toEqual(bobInv);
    expect(selectCharacterInventory(state, 'missing')).toBeUndefined();
  });

  it('selects party inventory (single record across the campaign)', () => {
    const state = buildState();
    expect(selectPartyInventory(state)).toEqual(partyInv);
  });

  it('returns undefined party inventory when none exists', () => {
    const state: CampaignState = {
      ...buildState(),
      entities: {
        ...buildState().entities,
        inventories: { 'inv-alice': aliceInv },
      },
    };
    expect(selectPartyInventory(state)).toBeUndefined();
  });

  it('returns inventories array consistent with the record on initial state', () => {
    expect(selectAllInventories(initialCampaignState)).toEqual(
      Object.values(selectInventoriesRecord(initialCampaignState))
    );
  });
});

describe('inventorySelectors — UI state', () => {
  it('returns active inventory tab from state', () => {
    expect(selectInventoryActiveTab(buildState())).toBe('foods');
  });

  it('returns the default initial active tab', () => {
    expect(selectInventoryActiveTab(initialCampaignState)).toBe('materials');
  });
});
