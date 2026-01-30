/**
 * Alchemy Selectors
 *
 * Centralized selectors for accessing alchemy system data (reagents, formulas,
 * batches, labs, settings) from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type {
  Id,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  AlchemySettings
} from '../../types/campaign';

// ============================================================================
// REAGENT SELECTORS
// ============================================================================

/**
 * Select all alchemy reagents as a record
 */
export const selectAlchemyReagentsRecord = (state: CampaignState): Record<Id, AlchemyReagent> =>
  state.entities.alchemyReagents;

/**
 * Select all alchemy reagents as an array
 */
export const selectAllAlchemyReagents = (state: CampaignState): AlchemyReagent[] =>
  Object.values(state.entities.alchemyReagents);

/**
 * Select an alchemy reagent by ID
 */
export const selectAlchemyReagentById = (
  state: CampaignState,
  id: Id
): AlchemyReagent | undefined => state.entities.alchemyReagents[id];

/**
 * Select alchemy reagent count
 */
export const selectAlchemyReagentCount = (state: CampaignState): number =>
  Object.keys(state.entities.alchemyReagents).length;

// ============================================================================
// FORMULA SELECTORS
// ============================================================================

/**
 * Select all alchemy formulas as a record
 */
export const selectAlchemyFormulasRecord = (state: CampaignState): Record<Id, AlchemyFormula> =>
  state.entities.alchemyFormulas;

/**
 * Select all alchemy formulas as an array
 */
export const selectAllAlchemyFormulas = (state: CampaignState): AlchemyFormula[] =>
  Object.values(state.entities.alchemyFormulas);

/**
 * Select an alchemy formula by ID
 */
export const selectAlchemyFormulaById = (
  state: CampaignState,
  id: Id
): AlchemyFormula | undefined => state.entities.alchemyFormulas[id];

/**
 * Select alchemy formula count
 */
export const selectAlchemyFormulaCount = (state: CampaignState): number =>
  Object.keys(state.entities.alchemyFormulas).length;

// ============================================================================
// BATCH SELECTORS
// ============================================================================

/**
 * Select all alchemy batches as a record
 */
export const selectAlchemyBatchesRecord = (state: CampaignState): Record<Id, AlchemyBatch> =>
  state.entities.alchemyBatches;

/**
 * Select all alchemy batches as an array
 */
export const selectAllAlchemyBatches = (state: CampaignState): AlchemyBatch[] =>
  Object.values(state.entities.alchemyBatches);

/**
 * Select an alchemy batch by ID
 */
export const selectAlchemyBatchById = (state: CampaignState, id: Id): AlchemyBatch | undefined =>
  state.entities.alchemyBatches[id];

/**
 * Select the active alchemy batch ID from UI state
 */
export const selectActiveAlchemyBatchId = (state: CampaignState): string | null | undefined =>
  state.alchemy.activeBatch;

/**
 * Select the active alchemy batch
 */
export const selectActiveAlchemyBatch = (state: CampaignState): AlchemyBatch | undefined => {
  const id = state.alchemy.activeBatch;
  return id ? state.entities.alchemyBatches[id] : undefined;
};

/**
 * Select alchemy batch count
 */
export const selectAlchemyBatchCount = (state: CampaignState): number =>
  Object.keys(state.entities.alchemyBatches).length;

// ============================================================================
// LAB SELECTORS
// ============================================================================

/**
 * Select all alchemy labs as a record
 */
export const selectAlchemyLabsRecord = (state: CampaignState): Record<Id, AlchemyLab> =>
  state.entities.alchemyLabs;

/**
 * Select all alchemy labs as an array
 */
export const selectAllAlchemyLabs = (state: CampaignState): AlchemyLab[] =>
  Object.values(state.entities.alchemyLabs);

/**
 * Select an alchemy lab by ID
 */
export const selectAlchemyLabById = (state: CampaignState, id: Id): AlchemyLab | undefined =>
  state.entities.alchemyLabs[id];

/**
 * Select the default alchemy lab
 */
export const selectDefaultAlchemyLab = (state: CampaignState): AlchemyLab | undefined =>
  state.entities.alchemyLabs['default'];

// ============================================================================
// SETTINGS SELECTORS
// ============================================================================

/**
 * Select alchemy settings
 */
export const selectAlchemySettings = (state: CampaignState): AlchemySettings =>
  state.entities.alchemySettings;

/**
 * Select default lab rating from settings
 */
export const selectDefaultLabRating = (state: CampaignState): number =>
  state.entities.alchemySettings.defaultLabRating;

/**
 * Select work block minutes from settings
 */
export const selectWorkBlockMinutes = (state: CampaignState): number =>
  state.entities.alchemySettings.workBlockMinutes;
