/**
 * Inventory Reducer
 *
 * Handles state mutations for inventory-related operations using Immer draft.
 * This reducer operates on the entities slice of the campaign state.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import type {
  AcquiredItem,
  AcquisitionSource,
  FoodEntry,
  Id,
  Inventory,
  InventoryOwner,
  MaterialEntry
} from '../../types/campaign';
import type { CombatState } from '../../types/combatTracker';
import {
  type InventoryAction,
  MATERIAL_ADD,
  MATERIAL_UPDATE,
  MATERIAL_REMOVE,
  MATERIALS_CONSUMED,
  MATERIAL_TRANSFERRED,
  FOOD_ADD,
  FOOD_UPDATE,
  FOOD_REMOVE,
  FOODS_CONSUMED,
  FOOD_TRANSFERRED,
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
  ITEM_MAGICAL_SET,
  ITEM_CONSUMED,
  ITEM_CONSUMPTION_REVERTED,
  REAGENT_PROMOTED
} from './inventoryActions';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Stack a material into one owner's authoritative holdings by name + type.
 */
function stackMaterial(inventory: Draft<Inventory>, material: MaterialEntry): Id {
  const existing = inventory.materials.find(
    (m) => m.name === material.name && m.type === material.type
  );
  if (existing) {
    existing.quantity += material.quantity;
    return existing.id;
  }
  inventory.materials.push(material);
  return material.id;
}

/**
 * Stack food into one owner's authoritative holdings by name + type(s).
 */
function stackFood(inventory: Draft<Inventory>, food: FoodEntry): Id {
  const foodTypeKey = food.type ?? food.types?.join(',') ?? '';
  const existing = inventory.food.find((f) => {
    const fType = f.type ?? f.types?.join(',') ?? '';
    return f.name === food.name && fType === foodTypeKey;
  });
  if (existing) {
    existing.quantity += food.quantity;
    return existing.id;
  }
  inventory.food.push(food);
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

function findInventoryRecord(
  draft: Draft<CampaignState>,
  owner: InventoryOwner
): Draft<Inventory> | undefined {
  return Object.values(draft.entities.inventories).find((inventory) =>
    owner === 'party'
      ? inventory.ownerType === 'party'
      : inventory.ownerType === 'character' && inventory.ownerId === owner
  );
}

/**
 * Land an acquired item using the inventory bus rules. Revert calls this same
 * helper so a restore remains an acquire-semantic write inside one reducer pass.
 */
function acquireInventoryItem(
  draft: Draft<CampaignState>,
  item: AcquiredItem,
  owner: InventoryOwner,
  source: AcquisitionSource
): void {
  const inventory = ensureInventoryRecord(draft, owner);

  switch (item.kind) {
    case 'material': {
      stackMaterial(inventory, {
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: item.quantity,
        source: item.source ?? source,
        notes: item.notes
      });
      return;
    }
    case 'food': {
      stackFood(inventory, {
        id: item.id,
        name: item.name,
        types: item.types,
        quantity: item.quantity,
        source: item.source ?? source,
        notes: item.notes
      });
      return;
    }
    case 'equipment':
    case 'other': {
      const existing = inventory.items.find((candidate) => candidate.id === item.id);
      if (existing) {
        existing.quantity = (existing.quantity ?? 0) + item.quantity;
        return;
      }
      inventory.items.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        ...(item.crafterId !== undefined ? { crafterId: item.crafterId } : {}),
        ...(item.magical !== undefined ? { magical: item.magical } : {}),
        value: item.value,
        notes: item.notes,
        source: item.source ?? source
      });
      return;
    }
    case 'currency':
      inventory.currency[item.currencyKey] =
        (inventory.currency[item.currencyKey] ?? 0) + item.amount;
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
      stackMaterial(ensureInventoryRecord(draft, 'party'), action.payload);
      return true;

    case MATERIAL_UPDATE:
      {
        const material = findInventoryRecord(draft, 'party')?.materials.find(
          (entry) => entry.id === action.payload.id
        );
        if (material) Object.assign(material, action.payload.changes);
      }
      return true;

    case MATERIAL_REMOVE:
      {
        const materials = findInventoryRecord(draft, 'party')?.materials;
        const index = materials?.findIndex((entry) => entry.id === action.payload) ?? -1;
        if (materials && index >= 0) materials.splice(index, 1);
      }
      return true;

    case MATERIALS_CONSUMED: {
      const inventory = findInventoryRecord(draft, action.payload.owner);
      if (!inventory) return true;
      for (const consumed of action.payload.entries) {
        if ((consumed.name === undefined && consumed.type === undefined) || consumed.quantity <= 0) continue;
        const index = inventory.materials.findIndex((entry) =>
          (consumed.name === undefined || entry.name === consumed.name) &&
          (consumed.type === undefined || entry.type === consumed.type)
        );
        if (index >= 0) {
          inventory.materials[index].quantity = Math.max(
            0,
            inventory.materials[index].quantity - consumed.quantity
          );
          if (inventory.materials[index].quantity === 0) inventory.materials.splice(index, 1);
        }
      }
      return true;
    }

    case MATERIAL_TRANSFERRED: {
      const { sourceOwner, targetOwner, entryId, name, type, quantity } = action.payload;
      const source = findInventoryRecord(draft, sourceOwner);
      if (!source || sourceOwner === targetOwner || quantity <= 0) return true;
      const index = source.materials.findIndex((entry) =>
        (entryId !== undefined ? entry.id === entryId : true) &&
        (name === undefined || entry.name === name) &&
        (type === undefined || entry.type === type)
      );
      if (index < 0) return true;
      const sourceEntry = source.materials[index];
      const movedQuantity = Math.min(quantity, sourceEntry.quantity);
      const moved: MaterialEntry = { ...sourceEntry, quantity: movedQuantity };
      sourceEntry.quantity -= movedQuantity;
      if (sourceEntry.quantity === 0) source.materials.splice(index, 1);
      stackMaterial(ensureInventoryRecord(draft, targetOwner), moved);
      return true;
    }

    // ========================================================================
    // FOOD ACTIONS
    // ========================================================================
    case FOOD_ADD:
      stackFood(ensureInventoryRecord(draft, 'party'), action.payload);
      return true;

    case FOOD_UPDATE:
      {
        const food = findInventoryRecord(draft, 'party')?.food.find(
          (entry) => entry.id === action.payload.id
        );
        if (food) Object.assign(food, action.payload.changes);
      }
      return true;

    case FOOD_REMOVE:
      {
        const foods = findInventoryRecord(draft, 'party')?.food;
        const index = foods?.findIndex((entry) => entry.id === action.payload) ?? -1;
        if (foods && index >= 0) foods.splice(index, 1);
      }
      return true;

    case FOODS_CONSUMED: {
      const inventory = findInventoryRecord(draft, action.payload.owner);
      if (!inventory) return true;
      for (const consumed of action.payload.entries) {
        if ((consumed.name === undefined && consumed.type === undefined) || consumed.quantity <= 0) continue;
        const index = inventory.food.findIndex((entry) => {
          const entryType = entry.type ?? entry.types?.join(',') ?? '';
          const matchesType = consumed.type === undefined || entryType === consumed.type;
          return (consumed.name === undefined || entry.name === consumed.name) && matchesType;
        });
        if (index >= 0) {
          inventory.food[index].quantity = Math.max(
            0,
            inventory.food[index].quantity - consumed.quantity
          );
          if (inventory.food[index].quantity === 0) inventory.food.splice(index, 1);
        }
      }
      return true;
    }

    case FOOD_TRANSFERRED: {
      const { sourceOwner, targetOwner, entryId, name, type, quantity } = action.payload;
      const source = findInventoryRecord(draft, sourceOwner);
      if (!source || sourceOwner === targetOwner || quantity <= 0) return true;
      const index = source.food.findIndex((entry) => {
        const entryType = entry.type ?? entry.types?.join(',') ?? '';
        const matchesType = type === undefined || entryType === type;
        return (entryId !== undefined ? entry.id === entryId : true) &&
          (name === undefined || entry.name === name) && matchesType;
      });
      if (index < 0) return true;
      const sourceEntry = source.food[index];
      const movedQuantity = Math.min(quantity, sourceEntry.quantity);
      const moved: FoodEntry = { ...sourceEntry, quantity: movedQuantity };
      sourceEntry.quantity -= movedQuantity;
      if (sourceEntry.quantity === 0) source.food.splice(index, 1);
      stackFood(ensureInventoryRecord(draft, targetOwner), moved);
      return true;
    }

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
      acquireInventoryItem(draft, item, owner, source);
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

    case ITEM_CONSUMED: {
      for (const inventory of Object.values(draft.entities.inventories)) {
        const itemIndex = inventory.items.findIndex(
          (candidate) => candidate.id === action.payload.itemId
        );
        if (itemIndex < 0) continue;

        const item = inventory.items[itemIndex];
        const itemSnapshot = { ...item };
        const currentQuantity = item.quantity ?? 0;
        const requestedQuantity = action.payload.quantity ?? 1;
        const consumedQuantity = Math.min(requestedQuantity, currentQuantity);
        item.quantity = Math.max(0, currentQuantity - requestedQuantity);
        if (item.quantity === 0) {
          inventory.items.splice(itemIndex, 1);
        }

        // combat.activeSession is declared as the legacy CombatSession but holds the
        // tracker's CombatState at runtime (see useCombatStore.ts saveCombatActive note).
        const activeSession = draft.combat.activeSession as unknown as Draft<CombatState> | null;
        if (action.payload.combat && activeSession) {
          const { participantId, participantName, round } = action.payload.combat;
          activeSession.consumptions ??= [];
          activeSession.consumptions.push({
            id: `consumption-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            participantId,
            participantName,
            characterId: inventory.ownerId ?? participantId,
            itemSnapshot,
            quantity: consumedQuantity,
            round
          });
        }
        return true;
      }
      return true;
    }

    case ITEM_CONSUMPTION_REVERTED: {
      // Same legacy CombatSession/CombatState seam as ITEM_CONSUMED above.
      const activeSession = draft.combat.activeSession as unknown as Draft<CombatState> | null;
      const entryIndex = activeSession?.consumptions?.findIndex(
        (entry) => entry.id === action.payload.entryId
      ) ?? -1;
      if (!activeSession?.consumptions || entryIndex < 0) return true;

      const entry = activeSession.consumptions[entryIndex];
      acquireInventoryItem(
        draft,
        {
          kind: 'equipment',
          id: entry.itemSnapshot.id,
          name: entry.itemSnapshot.name ?? 'Unnamed item',
          quantity: entry.quantity,
          crafterId: entry.itemSnapshot.crafterId,
          magical: entry.itemSnapshot.magical,
          value: entry.itemSnapshot.value,
          notes: entry.itemSnapshot.notes,
          source: entry.itemSnapshot.source
        },
        entry.characterId,
        'loot'
      );
      activeSession.consumptions.splice(entryIndex, 1);
      return true;
    }

    case REAGENT_PROMOTED: {
      const { source, target } = action.payload;
      if (source.quantity <= 0) return true;

      const existingReagent = target.mode === 'existing'
        ? draft.entities.alchemyReagents[target.reagentId]
        : undefined;
      if (target.mode === 'existing' && !existingReagent) return true;

      const inventory = findInventoryRecord(draft, 'party');
      if (!inventory) return true;

      const entries = source.kind === 'material' ? inventory.materials : inventory.food;
      const sourceIndex = entries.findIndex((entry) => {
        if (entry.name !== source.name) return false;
        if (source.type === undefined) return true;
        if (source.kind === 'material') return entry.type === source.type;
        const foodEntry = entry as Draft<FoodEntry>;
        return (foodEntry.type ?? foodEntry.types?.join(',') ?? '') === source.type;
      });
      if (sourceIndex < 0) return true;

      const sourceEntry = entries[sourceIndex];
      const promotedQuantity = Math.min(source.quantity, Math.max(0, sourceEntry.quantity));
      if (promotedQuantity <= 0) return true;

      sourceEntry.quantity = Math.max(0, sourceEntry.quantity - promotedQuantity);
      if (sourceEntry.quantity === 0) entries.splice(sourceIndex, 1);

      if (target.mode === 'existing') {
        draft.entities.alchemyReagents[target.reagentId].quantity += promotedQuantity;
      } else {
        draft.entities.alchemyReagents[target.reagent.id] =
          promotedQuantity === source.quantity
            ? target.reagent
            : { ...target.reagent, quantity: promotedQuantity };
      }
      return true;
    }

    default:
      return false;
  }
}
