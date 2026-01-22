import { createContext, useContext } from 'react';

/**
 * Context for inventory management (materials, foods, and types)
 *
 * This context provides access to inventory-related state and save functions
 * without prop drilling through multiple component layers.
 *
 * @typedef {Object} InventoryContextValue
 * @property {Array} materials - List of material items
 * @property {Array} foods - List of food items
 * @property {Array} foodTypes - Available food type categories
 * @property {Array} materialTypes - Available material type properties
 * @property {Function} saveMaterials - Save materials to storage
 * @property {Function} saveFoods - Save foods to storage
 * @property {Function} saveFoodTypes - Save food types to storage
 * @property {Function} saveMaterialTypes - Save material types to storage
 */

const InventoryContext = createContext(null);

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
