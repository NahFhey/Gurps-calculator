/**
 * Inventory State Module
 *
 * Exports for the inventory system state slice.
 * Handles materials, foods, recipes, types, and inventory entities.
 */

// Reducer
export { handleInventoryAction } from './inventoryReducer';

// Actions
export {
  // Action type constants
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
  INVENTORY_SET,
  ITEM_ACQUIRED,
  ITEM_RETAGGED,
  ITEM_ATTUNEMENT_SET,
  ITEM_MAGICAL_SET,
  // Type guard
  isInventoryAction,
  // Types
  type InventoryAction,
  type AddMaterialAction,
  type UpdateMaterialAction,
  type RemoveMaterialAction,
  type ConsumeMaterialsAction,
  type SetMaterialsAction,
  type AddFoodAction,
  type UpdateFoodAction,
  type RemoveFoodAction,
  type ConsumeFoodsAction,
  type SetFoodsAction,
  type AddRecipeAction,
  type UpdateRecipeAction,
  type RemoveRecipeAction,
  type SetRecipesAction,
  type SetFoodTypesAction,
  type AddFoodTypeAction,
  type SetMaterialTypesAction,
  type AddMaterialTypeAction,
  type AddInventoryAction,
  type UpdateInventoryAction,
  type SetInventoriesAction,
  type ItemAcquiredAction,
  type ItemRetaggedAction,
  type ItemAttunementSetAction,
  type ItemMagicalSetAction
} from './inventoryActions';

// Re-export selectors from central location
export {
  // Materials
  selectMaterialsRecord,
  selectAllMaterials,
  selectMaterialById,
  selectMaterialsByType,
  selectMaterialQuantityByType,
  // Foods
  selectFoodsRecord,
  selectAllFoods,
  selectFoodById,
  selectFoodsByType,
  selectFoodQuantityByType,
  // Recipes
  selectRecipesRecord,
  selectAllRecipes,
  selectRecipeById,
  selectRecipesBySkill,
  // Types
  selectFoodTypes,
  selectFoodTypeByName,
  selectMaterialTypes,
  selectMaterialTypeByName,
  // Inventory entities
  selectInventoriesRecord,
  selectAllInventories,
  selectInventoryById,
  selectInventoryByOwner,
  selectCharacterInventory,
  selectPartyInventory,
  selectMageryLevel,
  selectAttunementCapacity,
  selectAttunedItems,
  // UI state
  selectInventoryActiveTab
} from '../selectors/inventorySelectors';
