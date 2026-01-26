import { createContext, useContext, useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';

/**
 * Context for crafting system (crafts, designs, and templates)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore while maintaining
 * backward compatibility with the legacy API.
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
 * Crafting Provider - Bridges CampaignStore to legacy API
 */
export function CraftingProvider({ children }) {
  const { state, actions } = useCampaignStore();

  const value = useMemo(() => {
    // Convert normalized objects back to arrays for legacy API
    const crafts = denormalizeObject(state.entities.crafts);
    const craftDesigns = denormalizeObject(state.entities.craftDesigns);

    return {
      // Crafts
      crafts,
      saveCrafts: (craftsArray) => {
        actions.setCrafts(normalizeArray(craftsArray));
      },

      // Craft Designs
      craftDesigns,
      saveCraftDesigns: (designsArray) => {
        actions.setCraftDesigns(normalizeArray(designsArray));
      },

      // Custom Templates (already an object in CampaignStore)
      customTemplates: state.entities.customTemplates,
      saveCustomTemplates: (templates) => {
        actions.setCustomTemplates(templates);
      }
    };
  }, [state.entities.crafts, state.entities.craftDesigns, state.entities.customTemplates, actions]);

  return <CraftingContext.Provider value={value}>{children}</CraftingContext.Provider>;
}

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
