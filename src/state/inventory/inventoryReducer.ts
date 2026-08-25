/**
 * Inventory Reducer
 *
 * Handles state mutations for inventory-related operations using Immer draft.
 * This reducer operates on the entities slice of the campaign state.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import type {
  Food,
  Id,
  Inventory,
  InventoryOwner,
  Material,
  MaterialEntry
} from '../../types/campaign';
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
  INVENTORY_SET,
  ITEM_ACQUIRED,
  ITEM_RETAGGED,
  ITEM_ATTUNEMENT_SET,
  ITEM_MAGICAL_SET
} from './inventoryActions';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Stack a material into the global pool using the existing stack rule
 * (same name + type merge quantities). Returns the id of the record the
 * quantity landed in.
 */
function stackMaterial(draft: Draft<CampaignState>, material: Material): Id {
  const existing = Object.values(draft.entities.materials).find(
    (m) => m.name === material.name && m.type === material.type
  );
  if (existing) {
    existing.quantity += material.quantity;
    return existing.id;
  }
  draft.entities.materials[material.id] = material;
  return material.id;
}

/**
 * Stack a food into the global pool using the existing stack rule
 * (same name + type(s) merge quantities). Returns the id of the record the
 * quantity landed in.
 */
function stackFood(draft: Draft<CampaignState>, food: Food): Id {
  const foodTypeKey = food.type ?? food.types?.join(',') ?? '';
  const existing = Object.values(draft.entities.foods).find((f) => {
    const fType = f.type ?? f.types?.join(',') ?? '';
    return f.name === food.name && fType === foodTypeKey;
  });
  if (existing) {
    existing.quantity += food.quantity;
    return existing.id;
  }
  draft.entities.foods[food.id] = food;
  return food.id;
}

/**
 * Find the Inventory record for an owner, creating an empty one if missing.
 * Always succeeds — the bus actions must never reject for lack of a record.
 */
function ensureInventoryRecord(
  draft: Draft<CampaignState>,
  owner: InventoryOwner
): Draft<Inventory> {
  const ownerType = owner === 'party' ? 'party' : 'character';
  const existing = Object.values(draft.entities.inventories).find((inv) =>
    ownerType === 'party'
      ? inv.ownerType === 'party'
      : inv.ownerType === 'character' && inv.ownerId === owner
  );
  if (existing) return existing;

  const created: Inventory = {
    id: owner === 'party' ? 'party' : `inv-${owner}`,
    ownerType,
    ownerId: owner === 'party' ? null : owner,
    currency: {},
    items: [],
    tools: [],
    materials: [],
    food: []
  };
  draft.entities.inventories[created.id] = created;
  return draft.entities.inventories[created.id];
}

/**
 * Merge a quantity ref into a MaterialEntry/FoodEntry list (upsert by id).
 *
 * These refs are advisory/provenance-grade — the consume paths
 * (`MATERIAL_CONSUME`/`FOOD_CONSUME`) decrement only the global pool and never
 * these refs, so they intentionally drift above real holdings. The pool total is
 * authoritative. See {@link MaterialEntry} and INVENTORY_INTEGRATION_FOLLOWUPS.md #8.
 */
function upsertEntryRef(entries: Draft<MaterialEntry>[], id: Id, quantity: number): void {
  const existing = entries.find((e) => e.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    entries.push({ id, quantity });
  }
}

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
      // Stack with existing material that has the same name and type
      stackMaterial(draft, action.payload);
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
      // Stack with existing food that has the same name and type(s)
      stackFood(draft, action.payload);
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

    // ========================================================================
    // INVENTORY INTEGRATION BUS (Phase 12a.5) — always-succeed, no rejection
    // ========================================================================
    case ITEM_ACQUIRED: {
      const { item, owner, source } = action.payload;
      const inventory = ensureInventoryRecord(draft, owner);

      switch (item.kind) {
        case 'material': {
          const materialId = stackMaterial(draft, {
            id: item.id,
            name: item.name,
            type: item.type,
            quantity: item.quantity,
            source: item.source ?? source,
            notes: item.notes
          });
          upsertEntryRef(inventory.materials, materialId, item.quantity);
          return true;
        }
        case 'food': {
          const foodId = stackFood(draft, {
            id: item.id,
            name: item.name,
            types: item.types,
            quantity: item.quantity,
            source: item.source ?? source,
            notes: item.notes
          });
          upsertEntryRef(inventory.food, foodId, item.quantity);
          return true;
        }
        case 'equipment':
        case 'other':
          inventory.items.push({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            ...(item.magical !== undefined ? { magical: item.magical } : {}),
            value: item.value,
            notes: item.notes,
            source
          });
          return true;
        case 'currency':
          inventory.currency[item.currencyKey] =
            (inventory.currency[item.currencyKey] ?? 0) + item.amount;
          return true;
      }
      return true;
    }

    case ITEM_RETAGGED: {
      const { itemId, newOwner } = action.payload;
      const inventories = Object.values(draft.entities.inventories);

      // ItemInstance move (equipment/other)
      for (const inv of inventories) {
        const idx = inv.items.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
          inv.items[idx].attuned = false;
          const target = ensureInventoryRecord(draft, newOwner);
          if (target.id !== inv.id) {
            const [moved] = inv.items.splice(idx, 1);
            target.items.push(moved);
          }
          return true;
        }
      }

      // Material/food quantity-ref move (whole entry)
      for (const inv of inventories) {
        const mIdx = inv.materials.findIndex((e) => e.id === itemId);
        if (mIdx >= 0) {
          const target = ensureInventoryRecord(draft, newOwner);
          if (target.id !== inv.id) {
            const [moved] = inv.materials.splice(mIdx, 1);
            upsertEntryRef(target.materials, moved.id, moved.quantity);
          }
          return true;
        }
        const fIdx = inv.food.findIndex((e) => e.id === itemId);
        if (fIdx >= 0) {
          const target = ensureInventoryRecord(draft, newOwner);
          if (target.id !== inv.id) {
            const [moved] = inv.food.splice(fIdx, 1);
            upsertEntryRef(target.food, moved.id, moved.quantity);
          }
          return true;
        }
      }

      // Unknown id: always-succeed contract makes this a no-op
      return true;
    }

    case ITEM_ATTUNEMENT_SET:
      for (const inv of Object.values(draft.entities.inventories)) {
        const item = inv.items.find((candidate) => candidate.id === action.payload.itemId);
        if (item) {
          item.attuned = action.payload.attuned;
          return true;
        }
      }
      return true;

    case ITEM_MAGICAL_SET:
      for (const inv of Object.values(draft.entities.inventories)) {
        const item = inv.items.find((candidate) => candidate.id === action.payload.itemId);
        if (item) {
          item.magical = action.payload.magical;
          return true;
        }
      }
      return true;

    default:
      return false;
  }
}
