import { describe, expect, it } from 'vitest';
import {
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
  ITEM_PROMOTED,
  ITEM_DEMOTED,
  ITEM_ATTUNEMENT_SET,
  ITEM_MAGICAL_SET,
  promoteItem,
  demoteItem,
  isInventoryAction,
  type InventoryAction
} from '../inventoryActions';
import type {
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Inventory
} from '../../../types/campaign';

const mockMaterial = (overrides?: Partial<Material>): Material =>
  ({ id: 'mat-1', name: 'Iron Ingot', ...overrides }) as Material;

const mockFood = (overrides?: Partial<Food>): Food =>
  ({ id: 'food-1', name: 'Bread', ...overrides }) as Food;

const mockRecipe = (overrides?: Partial<Recipe>): Recipe =>
  ({ id: 'rec-1', name: 'Stew', ...overrides }) as Recipe;

const mockFoodType = (overrides?: Partial<FoodType>): FoodType =>
  ({ id: 'ft-1', name: 'Grain', ...overrides }) as FoodType;

const mockMaterialType = (overrides?: Partial<MaterialType>): MaterialType =>
  ({ id: 'mt-1', name: 'Metal', ...overrides }) as MaterialType;

const mockInventory = (overrides?: Partial<Inventory>): Inventory =>
  ({
    id: 'inv-1',
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [],
    food: [],
    ...overrides
  }) as Inventory;

describe('inventoryActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(MATERIAL_ADD).toBe('addMaterial');
      expect(MATERIAL_UPDATE).toBe('updateMaterial');
      expect(MATERIAL_REMOVE).toBe('removeMaterial');
      expect(MATERIALS_CONSUMED).toBe('inventory/materialsConsumed');
      expect(MATERIAL_TRANSFERRED).toBe('inventory/materialTransferred');
      expect(FOOD_ADD).toBe('addFood');
      expect(FOOD_UPDATE).toBe('updateFood');
      expect(FOOD_REMOVE).toBe('removeFood');
      expect(FOODS_CONSUMED).toBe('inventory/foodsConsumed');
      expect(FOOD_TRANSFERRED).toBe('inventory/foodTransferred');
      expect(RECIPE_ADD).toBe('addRecipe');
      expect(RECIPE_UPDATE).toBe('updateRecipe');
      expect(RECIPE_REMOVE).toBe('removeRecipe');
      expect(RECIPE_SET).toBe('setRecipes');
      expect(FOOD_TYPES_SET).toBe('setFoodTypes');
      expect(FOOD_TYPE_ADD).toBe('addFoodType');
      expect(MATERIAL_TYPES_SET).toBe('setMaterialTypes');
      expect(MATERIAL_TYPE_ADD).toBe('addMaterialType');
      expect(INVENTORY_ADD).toBe('addInventory');
      expect(INVENTORY_UPDATE).toBe('updateInventory');
      expect(INVENTORY_SET).toBe('setInventories');
      expect(ITEM_ACQUIRED).toBe('inventory/itemAcquired');
      expect(ITEM_RETAGGED).toBe('inventory/itemRetagged');
      expect(ITEM_PROMOTED).toBe('inventory/itemPromoted');
      expect(ITEM_DEMOTED).toBe('inventory/itemDemoted');
      expect(ITEM_ATTUNEMENT_SET).toBe('inventory/itemAttunementSet');
      expect(ITEM_MAGICAL_SET).toBe('inventory/itemMagicalSet');
    });

    it('constants are all unique', () => {
      const values = [
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
        ITEM_PROMOTED,
        ITEM_DEMOTED,
        ITEM_ATTUNEMENT_SET,
        ITEM_MAGICAL_SET
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isInventoryAction', () => {
    it('returns true for material actions', () => {
      const actions: InventoryAction[] = [
        { type: MATERIAL_ADD, payload: mockMaterial() },
        { type: MATERIAL_UPDATE, payload: { id: 'mat-1', changes: { name: 'Steel' } } },
        { type: MATERIAL_REMOVE, payload: 'mat-1' },
        { type: MATERIALS_CONSUMED, payload: { owner: 'party', entries: [{ name: 'Iron Ingot', quantity: 2 }] } },
        { type: MATERIAL_TRANSFERRED, payload: { sourceOwner: 'party', targetOwner: 'char-1', entryId: 'mat-1', quantity: 1 } }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns true for food actions', () => {
      const actions: InventoryAction[] = [
        { type: FOOD_ADD, payload: mockFood() },
        { type: FOOD_UPDATE, payload: { id: 'food-1', changes: { name: 'Loaf' } } },
        { type: FOOD_REMOVE, payload: 'food-1' },
        { type: FOODS_CONSUMED, payload: { owner: 'party', entries: [{ name: 'Bread', quantity: 1 }] } },
        { type: FOOD_TRANSFERRED, payload: { sourceOwner: 'party', targetOwner: 'char-1', entryId: 'food-1', quantity: 1 } }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns true for recipe actions', () => {
      const actions: InventoryAction[] = [
        { type: RECIPE_ADD, payload: mockRecipe() },
        { type: RECIPE_UPDATE, payload: { id: 'rec-1', changes: { name: 'Soup' } } },
        { type: RECIPE_REMOVE, payload: 'rec-1' },
        { type: RECIPE_SET, payload: { 'rec-1': mockRecipe() } }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns true for food/material type actions', () => {
      const actions: InventoryAction[] = [
        { type: FOOD_TYPES_SET, payload: [mockFoodType()] },
        { type: FOOD_TYPE_ADD, payload: mockFoodType() },
        { type: MATERIAL_TYPES_SET, payload: [mockMaterialType()] },
        { type: MATERIAL_TYPE_ADD, payload: mockMaterialType() }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns true for inventory entity actions', () => {
      const actions: InventoryAction[] = [
        { type: INVENTORY_ADD, payload: mockInventory() },
        { type: INVENTORY_UPDATE, payload: { id: 'inv-1', changes: { ownerType: 'character' } } },
        { type: INVENTORY_SET, payload: { 'inv-1': mockInventory() } }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns true for inventory bus actions', () => {
      const actions: InventoryAction[] = [
        {
          type: ITEM_ACQUIRED,
          payload: {
            item: { kind: 'material', id: 'm1', name: 'Iron Ore', type: 'metal', quantity: 1 },
            owner: 'party',
            source: 'gathering'
          }
        },
        { type: ITEM_RETAGGED, payload: { itemId: 'm1', newOwner: 'char-1' } },
        { type: ITEM_ATTUNEMENT_SET, payload: { itemId: 'm1', attuned: true } },
        { type: ITEM_MAGICAL_SET, payload: { itemId: 'm1', magical: true } }
      ];
      for (const action of actions) {
        expect(isInventoryAction(action)).toBe(true);
      }
    });

    it('returns false for unrelated action types', () => {
      expect(isInventoryAction({ type: 'addCharacter' })).toBe(false);
      expect(isInventoryAction({ type: 'startCombat' })).toBe(false);
      expect(isInventoryAction({ type: 'addCraft' })).toBe(false);
      expect(isInventoryAction({ type: 'addAlchemyReagent' })).toBe(false);
      expect(isInventoryAction({ type: 'addGatheringSpecies' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isInventoryAction({ type: '' })).toBe(false);
    });

    it('returns false for substrings or near-misses', () => {
      expect(isInventoryAction({ type: 'material' })).toBe(false);
      expect(isInventoryAction({ type: 'Material' })).toBe(false);
      expect(isInventoryAction({ type: 'addMat' })).toBe(false);
      expect(isInventoryAction({ type: 'setFood' })).toBe(false);
      expect(isInventoryAction({ type: 'inventory' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: MATERIAL_ADD,
        payload: mockMaterial()
      };
      if (isInventoryAction(unknownAction)) {
        expect(unknownAction.type).toBe(MATERIAL_ADD);
      } else {
        throw new Error('expected type guard to accept MATERIAL_ADD');
      }
    });
  });

  describe('equipment bridge action creators', () => {
    it('creates promotion and demotion bus actions', () => {
      expect(promoteItem({
        itemId: 'sword-1',
        characterId: 'char-1',
        equipment: {
          name: 'Sword', quantity: 1, weight: 3, cost: 500, equipped: true,
        },
      })).toMatchObject({ type: ITEM_PROMOTED });
      expect(demoteItem({ characterId: 'char-1', equipmentId: 'eq-1' })).toEqual({
        type: ITEM_DEMOTED,
        payload: { characterId: 'char-1', equipmentId: 'eq-1' },
      });
    });
  });
});
