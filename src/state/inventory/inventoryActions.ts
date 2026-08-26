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
  Inventory,
  AlchemyReagent,
  AcquiredItem,
  InventoryOwner,
  AcquisitionSource
} from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Material actions
export const MATERIAL_ADD = 'addMaterial' as const;
export const MATERIAL_UPDATE = 'updateMaterial' as const;
export const MATERIAL_REMOVE = 'removeMaterial' as const;
export const MATERIALS_CONSUMED = 'inventory/materialsConsumed' as const;
export const MATERIAL_TRANSFERRED = 'inventory/materialTransferred' as const;

// Food actions
export const FOOD_ADD = 'addFood' as const;
export const FOOD_UPDATE = 'updateFood' as const;
export const FOOD_REMOVE = 'removeFood' as const;
export const FOODS_CONSUMED = 'inventory/foodsConsumed' as const;
export const FOOD_TRANSFERRED = 'inventory/foodTransferred' as const;

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

// Inventory integration bus actions (Phase 12a.5)
export const ITEM_ACQUIRED = 'inventory/itemAcquired' as const;
export const ITEM_RETAGGED = 'inventory/itemRetagged' as const;
export const ITEM_ATTUNEMENT_SET = 'inventory/itemAttunementSet' as const;
export const ITEM_MAGICAL_SET = 'inventory/itemMagicalSet' as const;
export const ITEM_CONSUMED = 'inventory/itemConsumed' as const;
export const ITEM_CONSUMPTION_REVERTED = 'inventory/itemConsumptionReverted' as const;
export const REAGENT_PROMOTED = 'inventory/reagentPromoted' as const;

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
export type MaterialsConsumedAction = {
  type: typeof MATERIALS_CONSUMED;
  payload: { owner: InventoryOwner; entries: Array<{ name?: string; type?: string; quantity: number }> };
};
export type MaterialTransferredAction = {
  type: typeof MATERIAL_TRANSFERRED;
  payload: { sourceOwner: InventoryOwner; targetOwner: InventoryOwner; entryId?: Id; name?: string; type?: string; quantity: number };
};

// Food action types
export type AddFoodAction = { type: typeof FOOD_ADD; payload: Food };
export type UpdateFoodAction = {
  type: typeof FOOD_UPDATE;
  payload: { id: Id; changes: Partial<Food> };
};
export type RemoveFoodAction = { type: typeof FOOD_REMOVE; payload: Id };
export type FoodsConsumedAction = {
  type: typeof FOODS_CONSUMED;
  payload: { owner: InventoryOwner; entries: Array<{ name?: string; type?: string; quantity: number }> };
};
export type FoodTransferredAction = {
  type: typeof FOOD_TRANSFERRED;
  payload: { sourceOwner: InventoryOwner; targetOwner: InventoryOwner; entryId?: Id; name?: string; type?: string; quantity: number };
};

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

// Inventory integration bus action types (Phase 12a.5)
// Both actions are always-succeed: no validation paths, no rejection.
export type ItemAcquiredAction = {
  type: typeof ITEM_ACQUIRED;
  payload: { item: AcquiredItem; owner: InventoryOwner; source: AcquisitionSource };
};
export type ItemRetaggedAction = {
  type: typeof ITEM_RETAGGED;
  payload: { itemId: Id; newOwner: InventoryOwner };
};
export type ItemAttunementSetAction = {
  type: typeof ITEM_ATTUNEMENT_SET;
  payload: { itemId: Id; attuned: boolean };
};
export type ItemMagicalSetAction = {
  type: typeof ITEM_MAGICAL_SET;
  payload: { itemId: Id; magical: boolean };
};
export type ItemConsumedAction = {
  type: typeof ITEM_CONSUMED;
  payload: {
    itemId: Id;
    quantity?: number;
    combat?: { participantId: Id; participantName: string; round: number };
  };
};
export type ItemConsumptionRevertedAction = {
  type: typeof ITEM_CONSUMPTION_REVERTED;
  payload: { entryId: Id };
};
export type ReagentPromotedAction = {
  type: typeof REAGENT_PROMOTED;
  payload: {
    source: { kind: 'material' | 'food'; name: string; type?: string; quantity: number };
    target:
      | { mode: 'existing'; reagentId: Id }
      | { mode: 'new'; reagent: AlchemyReagent };
  };
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type InventoryAction =
  // Material actions
  | AddMaterialAction
  | UpdateMaterialAction
  | RemoveMaterialAction
  | MaterialsConsumedAction
  | MaterialTransferredAction
  // Food actions
  | AddFoodAction
  | UpdateFoodAction
  | RemoveFoodAction
  | FoodsConsumedAction
  | FoodTransferredAction
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
  | SetInventoriesAction
  // Inventory integration bus actions
  | ItemAcquiredAction
  | ItemRetaggedAction
  | ItemAttunementSetAction
  | ItemMagicalSetAction
  | ItemConsumedAction
  | ItemConsumptionRevertedAction
  | ReagentPromotedAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const INVENTORY_ACTION_TYPES = new Set([
  MATERIAL_ADD,
  MATERIAL_UPDATE,
  MATERIAL_REMOVE,
  MATERIALS_CONSUMED,
  MATERIAL_TRANSFERRED,
  FOOD_ADD,
  FOOD_UPDATE,
  FOOD_REMOVE,
  FOODS_CONSUMED,
  FOOD_TRANSFERRED,
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
  INVENTORY_SET,
  ITEM_ACQUIRED,
  ITEM_RETAGGED,
  ITEM_ATTUNEMENT_SET,
  ITEM_MAGICAL_SET,
  ITEM_CONSUMED,
  ITEM_CONSUMPTION_REVERTED,
  REAGENT_PROMOTED
]);

/**
 * Type guard to check if an action is an inventory action
 */
export function isInventoryAction(action: { type: string }): action is InventoryAction {
  return INVENTORY_ACTION_TYPES.has(action.type as typeof MATERIAL_ADD);
}
