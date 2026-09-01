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
  ITEM_PROMOTED,
  ITEM_DEMOTED,
  ITEM_ATTUNEMENT_SET,
  ITEM_MAGICAL_SET,
  ITEM_CONSUMED,
  ITEM_CONSUMPTION_REVERTED,
  CURRENCY_SPENT,
  // Type guard
  isInventoryAction,
  promoteItem,
  demoteItem,
  // Types
  type InventoryAction,
  type AddMaterialAction,
  type UpdateMaterialAction,
  type RemoveMaterialAction,
  type MaterialsConsumedAction,
  type MaterialTransferredAction,
  type AddFoodAction,
  type UpdateFoodAction,
  type RemoveFoodAction,
  type FoodsConsumedAction,
  type FoodTransferredAction,
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
  type ItemPromotedAction,
  type ItemDemotedAction,
  type ItemAttunementSetAction,
  type ItemMagicalSetAction,
  type ItemConsumedAction,
  type ItemConsumptionRevertedAction,
  type CurrencySpentAction
} from './inventoryActions';

// Re-export selectors from central location
export {
  // Materials
  selectMaterialsRecord,
  selectAllMaterials,
  selectMaterialById,
  selectMaterialsByType,
  selectMaterialQuantityByType,
  selectOwnerMaterialHoldings,
  selectMaterialOwnerBreakdown,
  // Foods
  selectFoodsRecord,
  selectAllFoods,
  selectFoodById,
  selectFoodsByType,
  selectFoodQuantityByType,
  selectOwnerFoodHoldings,
  selectFoodOwnerBreakdown,
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
