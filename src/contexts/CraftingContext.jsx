import { createContext, useContext } from 'react';

/**
 * Context for crafting system (crafts, designs, and templates)
 *
 * @typedef {Object} CraftingContextValue
 * @property {Array} crafts - Active crafting projects
 * @property {Array} craftDesigns - Saved craft designs
 * @property {Object} customTemplates - Custom item templates
 * @property {Function} saveCrafts - Save crafts to storage
 * @property {Function} saveCraftDesigns - Save craft designs to storage
 * @property {Function} saveCustomTemplates - Save custom templates to storage
 */

const CraftingContext = createContext(null);

/**
 * Hook to access crafting context
 * @returns {CraftingContextValue}
 * @throws {Error} If used outside of CraftingProvider
 */
export function useCrafting() {
  const context = useContext(CraftingContext);
  if (!context) {
    throw new Error('useCrafting must be used within a CraftingProvider');
  }
  return context;
}

export default CraftingContext;
