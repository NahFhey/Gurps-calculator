import { createContext, useContext } from 'react';

/**
 * Context for alchemy system (reagents, formulas, batches, labs, and settings)
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
