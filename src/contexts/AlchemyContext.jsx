import { createContext, useContext, useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';

/**
 * Context for alchemy system (reagents, formulas, batches, labs, and settings)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore while maintaining
 * backward compatibility with the legacy API.
 *
 * @typedef {Object} AlchemyContextValue
 * @property {Array} alchemyReagents - Available reagents
 * @property {Array} alchemyFormulas - Saved formulas
 * @property {Array} alchemyBatches - Active and completed batches
 * @property {Array} alchemyLabs - Available alchemy labs
 * @property {Object} alchemySettings - Alchemy system settings
 * @property {Object} effectFamilyMap - Effect family mapping
 * @property {Function} saveAlchemyReagents - Save reagents to storage
 * @property {Function} saveAlchemyFormulas - Save formulas to storage
 * @property {Function} saveAlchemyBatches - Save batches to storage
 * @property {Function} saveAlchemyLabs - Save labs to storage
 * @property {Function} saveAlchemySettings - Save settings to storage
 * @property {Function} saveEffectFamilyMap - Save effect family map to storage
 */

const AlchemyContext = createContext(null);

/**
 * Alchemy Provider - Bridges CampaignStore to legacy API
 */
export function AlchemyProvider({ children }) {
  const { state, actions } = useCampaignStore();

  const value = useMemo(() => {
    // Convert normalized objects back to arrays for legacy API
    const alchemyReagents = denormalizeObject(state.entities.alchemyReagents);
    const alchemyFormulas = denormalizeObject(state.entities.alchemyFormulas);
    const alchemyBatches = denormalizeObject(state.entities.alchemyBatches);
    const alchemyLabs = denormalizeObject(state.entities.alchemyLabs);

    return {
      // Reagents
      alchemyReagents,
      saveAlchemyReagents: (reagentsArray) => {
        actions.setAlchemyReagents(normalizeArray(reagentsArray));
      },

      // Formulas
      alchemyFormulas,
      saveAlchemyFormulas: (formulasArray) => {
        actions.setAlchemyFormulas(normalizeArray(formulasArray));
      },

      // Batches
      alchemyBatches,
      saveAlchemyBatches: (batchesArray) => {
        actions.setAlchemyBatches(normalizeArray(batchesArray));
      },

      // Labs
      alchemyLabs,
      saveAlchemyLabs: (labsArray) => {
        actions.setAlchemyLabs(normalizeArray(labsArray));
      },

      // Settings (already an object)
      alchemySettings: state.entities.alchemySettings,
      saveAlchemySettings: (settings) => {
        actions.updateAlchemySettings(settings);
      },

      // Effect Family Map (already an object)
      effectFamilyMap: state.entities.effectFamilyMap,
      saveEffectFamilyMap: (map) => {
        actions.setEffectFamilyMap(map);
      }
    };
  }, [
    state.entities.alchemyReagents,
    state.entities.alchemyFormulas,
    state.entities.alchemyBatches,
    state.entities.alchemyLabs,
    state.entities.alchemySettings,
    state.entities.effectFamilyMap,
    actions
  ]);

  return <AlchemyContext.Provider value={value}>{children}</AlchemyContext.Provider>;
}

/**
 * Hook to access alchemy context
 * @returns {AlchemyContextValue}
 * @throws {Error} If used outside of AlchemyProvider
 */
export function useAlchemy() {
  const context = useContext(AlchemyContext);
  if (!context) {
    throw new Error('useAlchemy must be used within an AlchemyProvider');
  }
  return context;
}

export default AlchemyContext;
