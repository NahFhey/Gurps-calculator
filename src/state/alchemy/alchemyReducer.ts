/**
 * Alchemy Reducer
 *
 * Handles state mutations for alchemy-related operations using Immer draft.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type AlchemyAction,
  ALCHEMY_REAGENT_ADD,
  ALCHEMY_REAGENT_UPDATE,
  ALCHEMY_REAGENT_REMOVE,
  ALCHEMY_REAGENTS_SET,
  ALCHEMY_FORMULA_ADD,
  ALCHEMY_FORMULA_UPDATE,
  ALCHEMY_FORMULA_REMOVE,
  ALCHEMY_FORMULAS_SET,
  ALCHEMY_BATCH_ADD,
  ALCHEMY_BATCH_UPDATE,
  ALCHEMY_BATCH_REMOVE,
  ALCHEMY_BATCHES_SET,
  ALCHEMY_LABS_SET,
  ALCHEMY_LAB_ADD,
  ALCHEMY_SETTINGS_UPDATE
} from './alchemyActions';

/**
 * Process alchemy actions on the campaign state draft.
 */
export function handleAlchemyAction(
  draft: Draft<CampaignState>,
  action: AlchemyAction
): boolean {
  switch (action.type) {
    // ========================================================================
    // REAGENT ACTIONS
    // ========================================================================
    case ALCHEMY_REAGENT_ADD:
      draft.entities.alchemyReagents[action.payload.id] = action.payload;
      return true;

    case ALCHEMY_REAGENT_UPDATE:
      if (draft.entities.alchemyReagents[action.payload.id]) {
        draft.entities.alchemyReagents[action.payload.id] = {
          ...draft.entities.alchemyReagents[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case ALCHEMY_REAGENT_REMOVE:
      delete draft.entities.alchemyReagents[action.payload];
      return true;

    case ALCHEMY_REAGENTS_SET:
      draft.entities.alchemyReagents = action.payload;
      return true;

    // ========================================================================
    // FORMULA ACTIONS
    // ========================================================================
    case ALCHEMY_FORMULA_ADD:
      draft.entities.alchemyFormulas[action.payload.id] = action.payload;
      return true;

    case ALCHEMY_FORMULA_UPDATE:
      if (draft.entities.alchemyFormulas[action.payload.id]) {
        draft.entities.alchemyFormulas[action.payload.id] = {
          ...draft.entities.alchemyFormulas[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case ALCHEMY_FORMULA_REMOVE:
      delete draft.entities.alchemyFormulas[action.payload];
      return true;

    case ALCHEMY_FORMULAS_SET:
      draft.entities.alchemyFormulas = action.payload;
      return true;

    // ========================================================================
    // BATCH ACTIONS
    // ========================================================================
    case ALCHEMY_BATCH_ADD:
      draft.entities.alchemyBatches[action.payload.id] = action.payload;
      return true;

    case ALCHEMY_BATCH_UPDATE:
      if (draft.entities.alchemyBatches[action.payload.id]) {
        draft.entities.alchemyBatches[action.payload.id] = {
          ...draft.entities.alchemyBatches[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case ALCHEMY_BATCH_REMOVE:
      delete draft.entities.alchemyBatches[action.payload];
      return true;

    case ALCHEMY_BATCHES_SET:
      draft.entities.alchemyBatches = action.payload;
      return true;

    // ========================================================================
    // LAB ACTIONS
    // ========================================================================
    case ALCHEMY_LABS_SET:
      draft.entities.alchemyLabs = action.payload;
      return true;

    case ALCHEMY_LAB_ADD:
      draft.entities.alchemyLabs[action.payload.id] = action.payload;
      return true;

    // ========================================================================
    // SETTINGS ACTIONS
    // ========================================================================
    case ALCHEMY_SETTINGS_UPDATE:
      draft.entities.alchemySettings = {
        ...draft.entities.alchemySettings,
        ...action.payload
      };
      return true;

    default:
      return false;
  }
}
