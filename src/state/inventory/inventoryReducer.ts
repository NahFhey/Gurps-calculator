/**
 * Inventory Reducer
 *
 * Handles state mutations for inventory-related operations using Immer draft.
 * This reducer operates on the entities slice of the campaign state.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type InventoryAction,
  MATERIAL_ADD,
  MATERIAL_UPDATE,
  MATERIAL_REMOVE,
  MATERIAL_CONSUME,
  MATERIAL_SET,
  FOOD_ADD,
  FOOD_UPDATE,
  FOOD_REMOVE,
  FOOD_CONSUME,
  FOOD_SET,
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
  INVENTORY_SET
} from './inventoryActions';

/**
 * Process inventory actions on the campaign state draft.
 * This function is called from the main campaignReducer within the Immer produce() call.
 *
 * @param draft - The Immer draft of the full CampaignState
 * @param action - The inventory action to process
 * @returns true if the action was handled, false otherwise
 */
export function handleInventoryAction(
  draft: Draft<CampaignState>,
  action: InventoryAction
): boolean {
  switch (action.type) {
    // ========================================================================
    // MATERIAL ACTIONS
    // ========================================================================
    case MATERIAL_ADD:
      draft.entities.materials[action.payload.id] = action.payload;
      return true;

    case MATERIAL_UPDATE:
      if (draft.entities.materials[action.payload.id]) {
        draft.entities.materials[action.payload.id] = {
          ...draft.entities.materials[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case MATERIAL_REMOVE:
      delete draft.entities.materials[action.payload];
      return true;

    case MATERIAL_CONSUME:
      action.payload.forEach(({ id, amount }) => {
        if (draft.entities.materials[id]) {
          draft.entities.materials[id].quantity -= amount;
          if (draft.entities.materials[id].quantity <= 0) {
            delete draft.entities.materials[id];
          }
        }
      });
      return true;

    case MATERIAL_SET:
      draft.entities.materials = action.payload;
      return true;

    // ========================================================================
    // FOOD ACTIONS
    // ========================================================================
    case FOOD_ADD:
      draft.entities.foods[action.payload.id] = action.payload;
      return true;

    case FOOD_UPDATE:
      if (draft.entities.foods[action.payload.id]) {
        draft.entities.foods[action.payload.id] = {
          ...draft.entities.foods[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case FOOD_REMOVE:
      delete draft.entities.foods[action.payload];
      return true;

    case FOOD_CONSUME:
      action.payload.forEach(({ id, amount }) => {
        if (draft.entities.foods[id]) {
          draft.entities.foods[id].quantity -= amount;
          if (draft.entities.foods[id].quantity <= 0) {
            delete draft.entities.foods[id];
          }
        }
      });
      return true;

    case FOOD_SET:
      draft.entities.foods = action.payload;
      return true;

    // ========================================================================
    // RECIPE ACTIONS
    // ========================================================================
    case RECIPE_ADD:
      draft.entities.recipes[action.payload.id] = action.payload;
      return true;

    case RECIPE_UPDATE:
      if (draft.entities.recipes[action.payload.id]) {
        draft.entities.recipes[action.payload.id] = {
          ...draft.entities.recipes[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case RECIPE_REMOVE:
      delete draft.entities.recipes[action.payload];
      return true;

    case RECIPE_SET:
      draft.entities.recipes = action.payload;
      return true;

    // ========================================================================
    // FOOD TYPE & MATERIAL TYPE ACTIONS
    // ========================================================================
    case FOOD_TYPES_SET:
      draft.entities.foodTypes = action.payload;
      return true;

    case FOOD_TYPE_ADD:
      draft.entities.foodTypes.push(action.payload);
      return true;

    case MATERIAL_TYPES_SET:
      draft.entities.materialTypes = action.payload;
      return true;

    case MATERIAL_TYPE_ADD:
      draft.entities.materialTypes.push(action.payload);
      return true;

    // ========================================================================
    // INVENTORY ENTITY ACTIONS
    // ========================================================================
    case INVENTORY_ADD:
      draft.entities.inventories[action.payload.id] = action.payload;
      return true;

    case INVENTORY_UPDATE:
      if (draft.entities.inventories[action.payload.id]) {
        draft.entities.inventories[action.payload.id] = {
          ...draft.entities.inventories[action.payload.id],
          ...action.payload.changes
        };
      }
      return true;

    case INVENTORY_SET:
      draft.entities.inventories = action.payload;
      return true;

    default:
      return false;
  }
}
