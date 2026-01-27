import { createContext, useContext, useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';

/**
 * Context for inventory management (materials, foods, and types)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore while maintaining
 * backward compatibility with the legacy API. Components can continue using
 * the same hooks and methods without changes.
 *
 * @typedef {Object} InventoryContextValue
 * @property {Array} materials - List of material items
 * @property {Array} foods - List of food items
 * @property {Array} recipes - List of recipes
 * @property {Array} foodTypes - Available food type categories
 * @property {Array} materialTypes - Available material type properties
 * @property {Function} saveMaterials - Save materials to storage
 * @property {Function} saveFoods - Save foods to storage
 * @property {Function} saveRecipes - Save recipes to storage
 * @property {Function} saveFoodTypes - Save food types to storage
 * @property {Function} saveMaterialTypes - Save material types to storage
 */

const InventoryContext = createContext(null);

/**
 * Inventory Provider - Bridges CampaignStore to legacy API
 *
 * This provider wraps CampaignStore and exposes the same API that legacy
 * components expect, allowing for a gradual migration.
 */
export function InventoryProvider({ children }) {
  const { state, actions } = useCampaignStore();

  const value = useMemo(() => {
    // Convert normalized objects back to arrays for legacy API
    const materials = denormalizeObject(state.entities.materials);
    const foods = denormalizeObject(state.entities.foods);
    const recipes = denormalizeObject(state.entities.recipes);

    return {
      // Materials
      materials,
      saveMaterials: (materialsArray) => {
        actions.setMaterials(normalizeArray(materialsArray));
      },

      // Foods
      foods,
      saveFoods: (foodsArray) => {
        actions.setFoods(normalizeArray(foodsArray));
      },

      // Recipes
      recipes,
      saveRecipes: (recipesArray) => {
        actions.setRecipes(normalizeArray(recipesArray));
      },

      // Food Types (already arrays in CampaignStore)
      foodTypes: state.entities.foodTypes,
      saveFoodTypes: (types) => {
        actions.setFoodTypes(types);
      },

      // Material Types (already arrays in CampaignStore)
      materialTypes: state.entities.materialTypes,
      saveMaterialTypes: (types) => {
        actions.setMaterialTypes(types);
      }
    };
  }, [state.entities.materials, state.entities.foods, state.entities.recipes, state.entities.foodTypes, state.entities.materialTypes, actions]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

/**
 * Hook to access inventory context
 * @returns {InventoryContextValue}
 * @throws {Error} If used outside of InventoryProvider
 */
export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}

export default InventoryContext;
