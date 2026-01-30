/**
 * Inventory Actions
 *
 * Action type constants and type definitions for inventory-related state changes.
 * Covers materials, foods, recipes, food types, material types, and inventory entities.
 */

import type {
  Id,
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Inventory
} from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Material actions
export const MATERIAL_ADD = 'addMaterial' as const;
export const MATERIAL_UPDATE = 'updateMaterial' as const;
export const MATERIAL_REMOVE = 'removeMaterial' as const;
export const MATERIAL_CONSUME = 'consumeMaterials' as const;
export const MATERIAL_SET = 'setMaterials' as const;

// Food actions
export const FOOD_ADD = 'addFood' as const;
export const FOOD_UPDATE = 'updateFood' as const;
export const FOOD_REMOVE = 'removeFood' as const;
export const FOOD_CONSUME = 'consumeFoods' as const;
export const FOOD_SET = 'setFoods' as const;

// Recipe actions
export const RECIPE_ADD = 'addRecipe' as const;
export const RECIPE_UPDATE = 'updateRecipe' as const;
export const RECIPE_REMOVE = 'removeRecipe' as const;
export const RECIPE_SET = 'setRecipes' as const;

// Type actions
export const FOOD_TYPES_SET = 'setFoodTypes' as const;
export const FOOD_TYPE_ADD = 'addFoodType' as const;
export const MATERIAL_TYPES_SET = 'setMaterialTypes' as const;
export const MATERIAL_TYPE_ADD = 'addMaterialType' as const;

// Inventory entity actions
export const INVENTORY_ADD = 'addInventory' as const;
export const INVENTORY_UPDATE = 'updateInventory' as const;
export const INVENTORY_SET = 'setInventories' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

// Material action types
export type AddMaterialAction = { type: typeof MATERIAL_ADD; payload: Material };
export type UpdateMaterialAction = {
  type: typeof MATERIAL_UPDATE;
  payload: { id: Id; changes: Partial<Material> };
};
export type RemoveMaterialAction = { type: typeof MATERIAL_REMOVE; payload: Id };
export type ConsumeMaterialsAction = {
  type: typeof MATERIAL_CONSUME;
  payload: Array<{ id: Id; amount: number }>;
};
export type SetMaterialsAction = {
  type: typeof MATERIAL_SET;
  payload: Record<Id, Material>;
};

// Food action types
export type AddFoodAction = { type: typeof FOOD_ADD; payload: Food };
export type UpdateFoodAction = {
  type: typeof FOOD_UPDATE;
  payload: { id: Id; changes: Partial<Food> };
};
export type RemoveFoodAction = { type: typeof FOOD_REMOVE; payload: Id };
export type ConsumeFoodsAction = {
  type: typeof FOOD_CONSUME;
  payload: Array<{ id: Id; amount: number }>;
};
export type SetFoodsAction = { type: typeof FOOD_SET; payload: Record<Id, Food> };

// Recipe action types
export type AddRecipeAction = { type: typeof RECIPE_ADD; payload: Recipe };
export type UpdateRecipeAction = {
  type: typeof RECIPE_UPDATE;
  payload: { id: Id; changes: Partial<Recipe> };
};
export type RemoveRecipeAction = { type: typeof RECIPE_REMOVE; payload: Id };
export type SetRecipesAction = { type: typeof RECIPE_SET; payload: Record<Id, Recipe> };

// Type action types
export type SetFoodTypesAction = { type: typeof FOOD_TYPES_SET; payload: FoodType[] };
export type AddFoodTypeAction = { type: typeof FOOD_TYPE_ADD; payload: FoodType };
export type SetMaterialTypesAction = {
  type: typeof MATERIAL_TYPES_SET;
  payload: MaterialType[];
};
export type AddMaterialTypeAction = { type: typeof MATERIAL_TYPE_ADD; payload: MaterialType };

// Inventory entity action types
export type AddInventoryAction = { type: typeof INVENTORY_ADD; payload: Inventory };
export type UpdateInventoryAction = {
  type: typeof INVENTORY_UPDATE;
  payload: { id: Id; changes: Partial<Inventory> };
};
export type SetInventoriesAction = {
  type: typeof INVENTORY_SET;
  payload: Record<Id, Inventory>;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type InventoryAction =
  // Material actions
  | AddMaterialAction
  | UpdateMaterialAction
  | RemoveMaterialAction
  | ConsumeMaterialsAction
  | SetMaterialsAction
  // Food actions
  | AddFoodAction
  | UpdateFoodAction
  | RemoveFoodAction
  | ConsumeFoodsAction
  | SetFoodsAction
  // Recipe actions
  | AddRecipeAction
  | UpdateRecipeAction
  | RemoveRecipeAction
  | SetRecipesAction
  // Type actions
  | SetFoodTypesAction
  | AddFoodTypeAction
  | SetMaterialTypesAction
  | AddMaterialTypeAction
  // Inventory entity actions
  | AddInventoryAction
  | UpdateInventoryAction
  | SetInventoriesAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const INVENTORY_ACTION_TYPES = new Set([
  MATERIAL_ADD,
  MATERIAL_UPDATE,
  MATERIAL_REMOVE,
  MATERIAL_CONSUME,
  MATERIAL_SET,
  FOOD_ADD,
  FOOD_UPDATE,
  FOOD_REMOVE,
  FOOD_CONSUME,
  FOOD_SET,
  RECIPE_ADD,
  RECIPE_UPDATE,
  RECIPE_REMOVE,
  RECIPE_SET,
  FOOD_TYPES_SET,
  FOOD_TYPE_ADD,
  MATERIAL_TYPES_SET,
  MATERIAL_TYPE_ADD,
  INVENTORY_ADD,
  INVENTORY_UPDATE,
  INVENTORY_SET
]);

/**
 * Type guard to check if an action is an inventory action
 */
export function isInventoryAction(action: { type: string }): action is InventoryAction {
  return INVENTORY_ACTION_TYPES.has(action.type);
}
