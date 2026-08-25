/**
 * Inventory Selectors
 *
 * Centralized selectors for accessing inventory data (materials, foods, recipes,
 * types, and inventory entities) from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type {
  Id,
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Inventory,
  ItemInstance
} from '../../types/campaign';

// ============================================================================
// MATERIAL SELECTORS
// ============================================================================

/**
 * Select all materials as a record
 */
export const selectMaterialsRecord = (state: CampaignState): Record<Id, Material> =>
  state.entities.materials;

/**
 * Select all materials as an array
 */
export const selectAllMaterials = (state: CampaignState): Material[] =>
  Object.values(state.entities.materials);

/**
 * Select a material by ID
 */
export const selectMaterialById = (state: CampaignState, id: Id): Material | undefined =>
  state.entities.materials[id];

/**
 * Select materials by type
 */
export const selectMaterialsByType = (state: CampaignState, type: string): Material[] =>
  Object.values(state.entities.materials).filter((m) => m.type === type);

/**
 * Select total quantity of a material type
 */
export const selectMaterialQuantityByType = (state: CampaignState, type: string): number =>
  Object.values(state.entities.materials)
    .filter((m) => m.type === type)
    .reduce((sum, m) => sum + m.quantity, 0);

// ============================================================================
// FOOD SELECTORS
// ============================================================================

/**
 * Select all foods as a record
 */
export const selectFoodsRecord = (state: CampaignState): Record<Id, Food> =>
  state.entities.foods;

/**
 * Select all foods as an array
 */
export const selectAllFoods = (state: CampaignState): Food[] =>
  Object.values(state.entities.foods);

/**
 * Select a food by ID
 */
export const selectFoodById = (state: CampaignState, id: Id): Food | undefined =>
  state.entities.foods[id];

/**
 * Select foods by type (supports both single type and multi-type)
 */
export const selectFoodsByType = (state: CampaignState, type: string): Food[] =>
  Object.values(state.entities.foods).filter(
    (f) => f.type === type || (f.types && f.types.includes(type))
  );

/**
 * Select total food quantity by type
 */
export const selectFoodQuantityByType = (state: CampaignState, type: string): number =>
  Object.values(state.entities.foods)
    .filter((f) => f.type === type || (f.types && f.types.includes(type)))
    .reduce((sum, f) => sum + f.quantity, 0);

// ============================================================================
// RECIPE SELECTORS
// ============================================================================

/**
 * Select all recipes as a record
 */
export const selectRecipesRecord = (state: CampaignState): Record<Id, Recipe> =>
  state.entities.recipes;

/**
 * Select all recipes as an array
 */
export const selectAllRecipes = (state: CampaignState): Recipe[] =>
  Object.values(state.entities.recipes);

/**
 * Select a recipe by ID
 */
export const selectRecipeById = (state: CampaignState, id: Id): Recipe | undefined =>
  state.entities.recipes[id];

/**
 * Select recipes by skill
 */
export const selectRecipesBySkill = (state: CampaignState, skill: string): Recipe[] =>
  Object.values(state.entities.recipes).filter((r) => r.skill === skill);

// ============================================================================
// TYPE SELECTORS
// ============================================================================

/**
 * Select all food types
 */
export const selectFoodTypes = (state: CampaignState): FoodType[] =>
  state.entities.foodTypes;

/**
 * Select food type by name
 */
export const selectFoodTypeByName = (state: CampaignState, name: string): FoodType | undefined =>
  state.entities.foodTypes.find((ft) => ft.name === name);

/**
 * Select all material types
 */
export const selectMaterialTypes = (state: CampaignState): MaterialType[] =>
  state.entities.materialTypes;

/**
 * Select material type by name
 */
export const selectMaterialTypeByName = (
  state: CampaignState,
  name: string
): MaterialType | undefined =>
  state.entities.materialTypes.find((mt) => mt.name === name);

// ============================================================================
// INVENTORY ENTITY SELECTORS
// ============================================================================

/**
 * Select all inventories as a record
 */
export const selectInventoriesRecord = (state: CampaignState): Record<Id, Inventory> =>
  state.entities.inventories;

/**
 * Select all inventories as an array
 */
export const selectAllInventories = (state: CampaignState): Inventory[] =>
  Object.values(state.entities.inventories);

/**
 * Select an inventory by ID
 */
export const selectInventoryById = (state: CampaignState, id: Id): Inventory | undefined =>
  state.entities.inventories[id];

/**
 * Select inventory by owner
 */
export const selectInventoryByOwner = (
  state: CampaignState,
  ownerType: string,
  ownerId: string
): Inventory | undefined =>
  Object.values(state.entities.inventories).find(
    (inv) => inv.ownerType === ownerType && inv.ownerId === ownerId
  );

/**
 * Select character inventory
 */
export const selectCharacterInventory = (
  state: CampaignState,
  characterId: string
): Inventory | undefined =>
  Object.values(state.entities.inventories).find(
    (inv) => inv.ownerType === 'character' && inv.ownerId === characterId
  );

/**
 * Select party inventory
 */
export const selectPartyInventory = (state: CampaignState): Inventory | undefined =>
  Object.values(state.entities.inventories).find((inv) => inv.ownerType === 'party');

/** Return the first matching Magery advantage's level, or null when absent. */
export const selectMageryLevel = (state: CampaignState, characterId: Id): number | null => {
  const advantage = state.entities.characters[characterId]?.gcsData?.advantages.find(
    (entry) => entry.name.trim().toLowerCase().startsWith('magery')
  );
  return advantage ? advantage.level ?? 0 : null;
};

/** A character with Magery has one more attunement slot than their Magery level. */
export const selectAttunementCapacity = (state: CampaignState, characterId: Id): number => {
  const magery = selectMageryLevel(state, characterId);
  return magery === null ? 0 : magery + 1;
};

/** Attuned item records owned by one character. Item quantity does not affect slots. */
export const selectAttunedItems = (state: CampaignState, characterId: Id): ItemInstance[] =>
  selectCharacterInventory(state, characterId)?.items.filter((item) => item.attuned) ?? [];

// ============================================================================
// UI STATE SELECTORS
// ============================================================================

/**
 * Select active inventory tab
 */
export const selectInventoryActiveTab = (state: CampaignState): string | undefined =>
  state.inventory.activeTab;
