/**
 * Crafting Reducer
 *
 * Handles state mutations for crafting-related operations using Immer draft.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type CraftingAction,
  CRAFT_ADD,
  CRAFT_UPDATE,
  CRAFT_REMOVE,
  CRAFT_COMPLETE,
  CRAFTS_SET,
  CRAFT_DESIGN_ADD,
  CRAFT_DESIGN_UPDATE,
  CRAFT_DESIGN_REMOVE,
  CRAFT_DESIGNS_SET,
  CUSTOM_TEMPLATES_SET,
  CUSTOM_TEMPLATE_ADD
} from './craftingActions';

/**
 * Process crafting actions on the campaign state draft.
 */
export function handleCraftingAction(
  draft: Draft<CampaignState>,
  action: CraftingAction
): boolean {
  switch (action.type) {
    // ========================================================================
    // CRAFT ACTIONS
    // ========================================================================
    case CRAFT_ADD:
      draft.entities.crafts[action.payload.id] = action.payload;
      return true;

    case CRAFT_UPDATE:
      if (draft.entities.crafts[action.payload.id]) {
        draft.entities.crafts[action.payload.id] = {
          ...draft.entities.crafts[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case CRAFT_REMOVE:
      delete draft.entities.crafts[action.payload];
      return true;

    case CRAFT_COMPLETE:
      if (draft.entities.crafts[action.payload.id]) {
        draft.entities.crafts[action.payload.id].phase = 'complete';
        draft.entities.crafts[action.payload.id].finalStats = action.payload.finalStats;
      }
      return true;

    case CRAFTS_SET:
      draft.entities.crafts = action.payload;
      return true;

    // ========================================================================
    // CRAFT DESIGN ACTIONS
    // ========================================================================
    case CRAFT_DESIGN_ADD:
      draft.entities.craftDesigns[action.payload.id] = action.payload;
      return true;

    case CRAFT_DESIGN_UPDATE:
      if (draft.entities.craftDesigns[action.payload.id]) {
        draft.entities.craftDesigns[action.payload.id] = {
          ...draft.entities.craftDesigns[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case CRAFT_DESIGN_REMOVE:
      delete draft.entities.craftDesigns[action.payload];
      return true;

    case CRAFT_DESIGNS_SET:
      draft.entities.craftDesigns = action.payload;
      return true;

    // ========================================================================
    // CUSTOM TEMPLATES ACTIONS
    // ========================================================================
    case CUSTOM_TEMPLATES_SET:
      draft.entities.customTemplates = action.payload;
      return true;

    case CUSTOM_TEMPLATE_ADD:
      draft.entities.customTemplates[action.payload.category][action.payload.templateName] =
        action.payload.template;
      return true;

    default:
      return false;
  }
}
