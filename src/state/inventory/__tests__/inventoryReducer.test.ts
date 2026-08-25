import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleInventoryAction } from '../inventoryReducer';
import {
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
  ITEM_MAGICAL_SET,
  type InventoryAction,
} from '../inventoryActions';
import type { CampaignState } from '../../campaignReducer';
import type {
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Inventory,
} from '../../../types/campaign';

const material = (id: string, overrides: Partial<Material> = {}): Material => ({
  id,
  name: `mat-${id}`,
  type: 'wood',
  quantity: 1,
  ...overrides,
});

const food = (id: string, overrides: Partial<Food> = {}): Food => ({
  id,
  name: `food-${id}`,
  type: 'fruit',
  quantity: 1,
  ...overrides,
});

const recipe = (id: string, overrides: Partial<Recipe> = {}): Recipe => ({
  id,
  name: `recipe-${id}`,
  ingredients: [],
  skill: 'Cooking',
  difficulty: 0,
  prepTime: 10,
  servings: 1,
  ...overrides,
});

const foodType = (name: string): FoodType => ({ name, color: '#fff' });
const materialType = (name: string): MaterialType =>
  ({ name, difficulty: 0, effects: '', ht: 10, drShift: 0, weightMod: 0, hpMod: 0 }) as MaterialType;

const inventory = (id: string, overrides: Partial<Inventory> = {}): Inventory => ({
  id,
  ownerType: 'party',
  ownerId: null,
  currency: {},
  items: [],
  tools: [],
  materials: [],
  food: [],
  ...overrides,
});

const createMinimalCampaignState = (): CampaignState =>
  ({
    entities: {
      materials: {},
      foods: {},
      recipes: {},
      foodTypes: [],
      materialTypes: [],
      inventories: {},
    },
  }) as unknown as CampaignState;

function applyAction(state: CampaignState, action: InventoryAction): CampaignState {
  return produce(state, draft => {
    handleInventoryAction(draft, action);
  });
}

describe('inventoryReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('materials', () => {
    it('MATERIAL_ADD inserts a new material', () => {
      const m = material('m1');
      const next = applyAction(state, { type: MATERIAL_ADD, payload: m });
      expect(next.entities.materials['m1']).toEqual(m);
    });

    it('MATERIAL_ADD stacks quantities when name+type match', () => {
      const existing = material('m1', { quantity: 3 });
      state.entities.materials['m1'] = existing;
      const incoming = material('m2', { name: 'mat-m1', type: 'wood', quantity: 5 });
      const next = applyAction(state, { type: MATERIAL_ADD, payload: incoming });
      expect(next.entities.materials['m1'].quantity).toBe(8);
      expect(next.entities.materials['m2']).toBeUndefined();
    });

    it('MATERIAL_ADD does not stack when type differs', () => {
      state.entities.materials['m1'] = material('m1', { quantity: 3 });
      const incoming = material('m2', { name: 'mat-m1', type: 'stone', quantity: 5 });
      const next = applyAction(state, { type: MATERIAL_ADD, payload: incoming });
      expect(next.entities.materials['m1'].quantity).toBe(3);
      expect(next.entities.materials['m2']).toEqual(incoming);
    });

    it('MATERIAL_UPDATE merges changes onto existing material', () => {
      state.entities.materials['m1'] = material('m1', { quantity: 2 });
      const next = applyAction(state, {
        type: MATERIAL_UPDATE,
        payload: { id: 'm1', changes: { quantity: 10, notes: 'updated' } },
      });
      expect(next.entities.materials['m1'].quantity).toBe(10);
      expect(next.entities.materials['m1'].notes).toBe('updated');
    });

    it('MATERIAL_UPDATE is a no-op when id is missing', () => {
      const next = applyAction(state, {
        type: MATERIAL_UPDATE,
        payload: { id: 'missing', changes: { quantity: 10 } },
      });
      expect(next.entities.materials['missing']).toBeUndefined();
    });

    it('MATERIAL_REMOVE deletes the entry', () => {
      state.entities.materials['m1'] = material('m1');
      const next = applyAction(state, { type: MATERIAL_REMOVE, payload: 'm1' });
      expect(next.entities.materials['m1']).toBeUndefined();
    });

    it('MATERIAL_CONSUME decrements quantities and removes when depleted', () => {
      state.entities.materials['m1'] = material('m1', { quantity: 5 });
      state.entities.materials['m2'] = material('m2', { quantity: 2 });
      const next = applyAction(state, {
        type: MATERIAL_CONSUME,
        payload: [
          { id: 'm1', amount: 2 },
          { id: 'm2', amount: 2 },
        ],
      });
      expect(next.entities.materials['m1'].quantity).toBe(3);
      expect(next.entities.materials['m2']).toBeUndefined();
    });

    it('MATERIAL_CONSUME ignores unknown ids', () => {
      state.entities.materials['m1'] = material('m1', { quantity: 5 });
      const next = applyAction(state, {
        type: MATERIAL_CONSUME,
        payload: [{ id: 'missing', amount: 100 }],
      });
      expect(next.entities.materials['m1'].quantity).toBe(5);
    });

    it('MATERIAL_SET replaces the entire map', () => {
      state.entities.materials['old'] = material('old');
      const payload = { m1: material('m1') };
      const next = applyAction(state, { type: MATERIAL_SET, payload });
      expect(next.entities.materials).toEqual(payload);
    });
  });

  describe('foods', () => {
    it('FOOD_ADD inserts a new food', () => {
      const f = food('f1');
      const next = applyAction(state, { type: FOOD_ADD, payload: f });
      expect(next.entities.foods['f1']).toEqual(f);
    });

    it('FOOD_ADD stacks by name + single type', () => {
      state.entities.foods['f1'] = food('f1', { quantity: 2 });
      const incoming = food('f2', { name: 'food-f1', type: 'fruit', quantity: 4 });
      const next = applyAction(state, { type: FOOD_ADD, payload: incoming });
      expect(next.entities.foods['f1'].quantity).toBe(6);
      expect(next.entities.foods['f2']).toBeUndefined();
    });

    it('FOOD_ADD stacks by name + types array', () => {
      state.entities.foods['f1'] = food('f1', {
        type: undefined,
        types: ['fruit', 'sweet'],
        quantity: 1,
      });
      const incoming = food('f2', {
        name: 'food-f1',
        type: undefined,
        types: ['fruit', 'sweet'],
        quantity: 3,
      });
      const next = applyAction(state, { type: FOOD_ADD, payload: incoming });
      expect(next.entities.foods['f1'].quantity).toBe(4);
      expect(next.entities.foods['f2']).toBeUndefined();
    });

    it('FOOD_ADD does not stack when types differ', () => {
      state.entities.foods['f1'] = food('f1', { type: 'fruit', quantity: 2 });
      const incoming = food('f2', { name: 'food-f1', type: 'meat', quantity: 4 });
      const next = applyAction(state, { type: FOOD_ADD, payload: incoming });
      expect(next.entities.foods['f1'].quantity).toBe(2);
      expect(next.entities.foods['f2']).toEqual(incoming);
    });

    it('FOOD_UPDATE merges changes', () => {
      state.entities.foods['f1'] = food('f1');
      const next = applyAction(state, {
        type: FOOD_UPDATE,
        payload: { id: 'f1', changes: { quantity: 9 } },
      });
      expect(next.entities.foods['f1'].quantity).toBe(9);
    });

    it('FOOD_UPDATE is a no-op on missing id', () => {
      const next = applyAction(state, {
        type: FOOD_UPDATE,
        payload: { id: 'missing', changes: { quantity: 9 } },
      });
      expect(next.entities.foods['missing']).toBeUndefined();
    });

    it('FOOD_REMOVE deletes the entry', () => {
      state.entities.foods['f1'] = food('f1');
      const next = applyAction(state, { type: FOOD_REMOVE, payload: 'f1' });
      expect(next.entities.foods['f1']).toBeUndefined();
    });

    it('FOOD_CONSUME decrements and deletes depleted entries', () => {
      state.entities.foods['f1'] = food('f1', { quantity: 5 });
      state.entities.foods['f2'] = food('f2', { quantity: 1 });
      const next = applyAction(state, {
        type: FOOD_CONSUME,
        payload: [
          { id: 'f1', amount: 3 },
          { id: 'f2', amount: 1 },
        ],
      });
      expect(next.entities.foods['f1'].quantity).toBe(2);
      expect(next.entities.foods['f2']).toBeUndefined();
    });

    it('FOOD_CONSUME ignores unknown ids', () => {
      state.entities.foods['f1'] = food('f1', { quantity: 5 });
      const next = applyAction(state, {
        type: FOOD_CONSUME,
        payload: [{ id: 'missing', amount: 99 }],
      });
      expect(next.entities.foods['f1'].quantity).toBe(5);
    });

    it('FOOD_SET replaces the food map', () => {
      state.entities.foods['old'] = food('old');
      const payload = { f1: food('f1') };
      const next = applyAction(state, { type: FOOD_SET, payload });
      expect(next.entities.foods).toEqual(payload);
    });
  });

  describe('recipes', () => {
    it('RECIPE_ADD inserts by id', () => {
      const r = recipe('r1');
      const next = applyAction(state, { type: RECIPE_ADD, payload: r });
      expect(next.entities.recipes['r1']).toEqual(r);
    });

    it('RECIPE_UPDATE merges changes', () => {
      state.entities.recipes['r1'] = recipe('r1');
      const next = applyAction(state, {
        type: RECIPE_UPDATE,
        payload: { id: 'r1', changes: { servings: 4, prepTime: 30 } },
      });
      expect(next.entities.recipes['r1'].servings).toBe(4);
      expect(next.entities.recipes['r1'].prepTime).toBe(30);
    });

    it('RECIPE_UPDATE is a no-op on missing id', () => {
      const next = applyAction(state, {
        type: RECIPE_UPDATE,
        payload: { id: 'missing', changes: { servings: 4 } },
      });
      expect(next.entities.recipes['missing']).toBeUndefined();
    });

    it('RECIPE_REMOVE deletes the entry', () => {
      state.entities.recipes['r1'] = recipe('r1');
      const next = applyAction(state, { type: RECIPE_REMOVE, payload: 'r1' });
      expect(next.entities.recipes['r1']).toBeUndefined();
    });

    it('RECIPE_SET replaces the map', () => {
      state.entities.recipes['old'] = recipe('old');
      const payload = { r1: recipe('r1') };
      const next = applyAction(state, { type: RECIPE_SET, payload });
      expect(next.entities.recipes).toEqual(payload);
    });
  });

  describe('food + material types', () => {
    it('FOOD_TYPES_SET replaces the array', () => {
      state.entities.foodTypes = [foodType('old')];
      const payload = [foodType('fruit'), foodType('meat')];
      const next = applyAction(state, { type: FOOD_TYPES_SET, payload });
      expect(next.entities.foodTypes).toEqual(payload);
    });

    it('FOOD_TYPE_ADD appends to the array', () => {
      state.entities.foodTypes = [foodType('fruit')];
      const next = applyAction(state, { type: FOOD_TYPE_ADD, payload: foodType('meat') });
      expect(next.entities.foodTypes).toHaveLength(2);
      expect(next.entities.foodTypes[1]).toEqual(foodType('meat'));
    });

    it('MATERIAL_TYPES_SET replaces the array', () => {
      state.entities.materialTypes = [materialType('old')];
      const payload = [materialType('wood'), materialType('stone')];
      const next = applyAction(state, { type: MATERIAL_TYPES_SET, payload });
      expect(next.entities.materialTypes).toEqual(payload);
    });

    it('MATERIAL_TYPE_ADD appends to the array', () => {
      state.entities.materialTypes = [materialType('wood')];
      const next = applyAction(state, {
        type: MATERIAL_TYPE_ADD,
        payload: materialType('stone'),
      });
      expect(next.entities.materialTypes).toHaveLength(2);
      expect(next.entities.materialTypes[1].name).toBe('stone');
    });
  });

  describe('inventories', () => {
    it('INVENTORY_ADD inserts by id', () => {
      const inv = inventory('i1');
      const next = applyAction(state, { type: INVENTORY_ADD, payload: inv });
      expect(next.entities.inventories['i1']).toEqual(inv);
    });

    it('INVENTORY_UPDATE merges changes', () => {
      state.entities.inventories['i1'] = inventory('i1');
      const next = applyAction(state, {
        type: INVENTORY_UPDATE,
        payload: { id: 'i1', changes: { currency: { gp: 100 } } },
      });
      expect(next.entities.inventories['i1'].currency).toEqual({ gp: 100 });
    });

    it('INVENTORY_UPDATE is a no-op on missing id', () => {
      const next = applyAction(state, {
        type: INVENTORY_UPDATE,
        payload: { id: 'missing', changes: { currency: { gp: 1 } } },
      });
      expect(next.entities.inventories['missing']).toBeUndefined();
    });

    it('INVENTORY_SET replaces the map', () => {
      state.entities.inventories['old'] = inventory('old');
      const payload = { i1: inventory('i1') };
      const next = applyAction(state, { type: INVENTORY_SET, payload });
      expect(next.entities.inventories).toEqual(payload);
    });
  });

  describe('unknown actions', () => {
    it('returns false and leaves state untouched', () => {
      const before = JSON.stringify(state);
      const result = handleInventoryAction(
        state as unknown as Parameters<typeof handleInventoryAction>[0],
        { type: 'unknownAction' } as unknown as InventoryAction,
      );
      expect(result).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    });
  });

  describe('ITEM_ACQUIRED (inventory bus)', () => {
    it('material acquisition stacks into the pool and refs the owner inventory', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'material', id: 'm1', name: 'Iron Ore', type: 'metal', quantity: 3 },
          owner: 'party',
          source: 'gathering',
        },
      });
      expect(next.entities.materials['m1']).toMatchObject({
        name: 'Iron Ore',
        type: 'metal',
        quantity: 3,
        source: 'gathering',
      });
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.materials).toEqual([{ id: 'm1', quantity: 3 }]);
    });

    it('material acquisition merges with an existing pool stack by name+type', () => {
      state.entities.materials['m1'] = material('m1', { name: 'Iron Ore', type: 'metal', quantity: 5 });
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'material', id: 'm2', name: 'Iron Ore', type: 'metal', quantity: 2 },
          owner: 'party',
          source: 'loot',
        },
      });
      expect(next.entities.materials['m1'].quantity).toBe(7);
      expect(next.entities.materials['m2']).toBeUndefined();
      // The owner ref points at the record the quantity landed in
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.materials).toEqual([{ id: 'm1', quantity: 2 }]);
    });

    it('material acquisition preserves a descriptive source label when provided', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'material', id: 'm1', name: 'Pine Log', type: 'wood', quantity: 1, source: 'Foraging at Greenwood' },
          owner: 'party',
          source: 'gathering',
        },
      });
      expect(next.entities.materials['m1'].source).toBe('Foraging at Greenwood');
    });

    it('food acquisition stacks into the pool and refs the owner inventory', () => {
      state.entities.foods['f1'] = food('f1', { name: 'Berries', type: undefined, types: ['fruit'], quantity: 4 });
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'food', id: 'f2', name: 'Berries', types: ['fruit'], quantity: 6 },
          owner: 'party',
          source: 'gathering',
        },
      });
      expect(next.entities.foods['f1'].quantity).toBe(10);
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.food).toEqual([{ id: 'f1', quantity: 6 }]);
    });

    it('equipment acquisition lands an ItemInstance in the owner inventory', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'equipment', id: 'sword-1', name: 'Fine Longsword', quantity: 1, value: 4000, notes: 'fine quality' },
          owner: 'char-1',
          source: 'crafting',
        },
      });
      const charInv = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-1'
      );
      expect(charInv?.items).toEqual([
        { id: 'sword-1', name: 'Fine Longsword', quantity: 1, value: 4000, notes: 'fine quality', source: 'crafting' },
      ]);
    });

    it('equipment acquisition carries the magical flag', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'equipment', id: 'wand-1', name: 'Oak Wand', quantity: 1, magical: true },
          owner: 'char-1',
          source: 'loot',
        },
      });
      const charInv = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-1'
      );
      expect(charInv?.items[0].magical).toBe(true);
    });

    it('equipment acquisition carries crafter attribution', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: {
            kind: 'equipment',
            id: 'crafted-blade-1',
            name: 'Crafted Blade',
            quantity: 1,
            crafterId: 'char-smith',
          },
          owner: 'party',
          source: 'crafting',
        },
      });
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.items[0].crafterId).toBe('char-smith');
    });

    it('equipment acquisition omits crafter attribution when it is not provided', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'equipment', id: 'loot-blade-1', name: 'Looted Blade', quantity: 1 },
          owner: 'party',
          source: 'loot',
        },
      });
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.items[0]).not.toHaveProperty('crafterId');
    });

    it('other acquisition carries an explicit false magical flag', () => {
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'other', id: 'trinket-1', name: 'Trinket', quantity: 1, magical: false },
          owner: 'party',
          source: 'loot',
        },
      });
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party?.items[0].magical).toBe(false);
    });

    it('auto-creates a missing owner inventory record (always-succeed)', () => {
      expect(Object.keys(state.entities.inventories)).toHaveLength(0);
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'other', id: 'rope-1', name: 'Rope', quantity: 1 },
          owner: 'party',
          source: 'loot',
        },
      });
      const party = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(party).toBeDefined();
      expect(party?.items).toHaveLength(1);
    });

    it('reuses an existing owner inventory record instead of duplicating', () => {
      state.entities.inventories['party'] = inventory('party');
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'other', id: 'rope-1', name: 'Rope', quantity: 1 },
          owner: 'party',
          source: 'loot',
        },
      });
      expect(Object.keys(next.entities.inventories)).toHaveLength(1);
      expect(next.entities.inventories['party'].items).toHaveLength(1);
    });

    it('currency acquisition adds to the owner currency map', () => {
      state.entities.inventories['party'] = inventory('party', { currency: { gold: 10 } });
      const next = applyAction(state, {
        type: ITEM_ACQUIRED,
        payload: {
          item: { kind: 'currency', currencyKey: 'gold', amount: 25 },
          owner: 'party',
          source: 'loot',
        },
      });
      expect(next.entities.inventories['party'].currency.gold).toBe(35);
    });
  });

  describe('ITEM_RETAGGED (inventory bus)', () => {
    it('moves an ItemInstance from party to a character inventory', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'sword-1', name: 'Longsword', quantity: 1 }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'sword-1', newOwner: 'char-1' },
      });
      expect(next.entities.inventories['party'].items).toHaveLength(0);
      const charInv = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-1'
      );
      expect(charInv?.items).toEqual([
        { id: 'sword-1', name: 'Longsword', quantity: 1, attuned: false },
      ]);
    });

    it('preserves crafter attribution when moving an item', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{
          id: 'crafted-blade-1',
          name: 'Crafted Blade',
          quantity: 1,
          source: 'crafting',
          crafterId: 'char-smith',
        }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'crafted-blade-1', newOwner: 'char-1' },
      });
      const characterInventory = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-1'
      );
      expect(characterInventory?.items[0].crafterId).toBe('char-smith');
    });

    it('clears attunement when moving an item from party to character', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1, magical: true, attuned: true }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'wand-1', newOwner: 'char-1' },
      });
      const target = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-1'
      );
      expect(target?.items[0].attuned).toBe(false);
    });

    it('clears attunement when moving an item from character to party', () => {
      state.entities.inventories['inv-char-1'] = inventory('inv-char-1', {
        ownerType: 'character',
        ownerId: 'char-1',
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1, magical: true, attuned: true }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'wand-1', newOwner: 'party' },
      });
      const target = Object.values(next.entities.inventories).find(i => i.ownerType === 'party');
      expect(target?.items[0].attuned).toBe(false);
    });

    it('clears attunement when moving an item between characters', () => {
      state.entities.inventories['inv-char-1'] = inventory('inv-char-1', {
        ownerType: 'character',
        ownerId: 'char-1',
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1, magical: true, attuned: true }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'wand-1', newOwner: 'char-2' },
      });
      const target = Object.values(next.entities.inventories).find(
        i => i.ownerType === 'character' && i.ownerId === 'char-2'
      );
      expect(target?.items[0].attuned).toBe(false);
    });

    it('clears attunement on a same-owner retag', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1, magical: true, attuned: true }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'wand-1', newOwner: 'party' },
      });
      expect(next.entities.inventories['party'].items[0].attuned).toBe(false);
    });

    it('moves a material quantity ref between inventories, merging on arrival', () => {
      state.entities.inventories['party'] = inventory('party', {
        materials: [{ id: 'm1', quantity: 5 }],
      });
      state.entities.inventories['inv-char-1'] = inventory('inv-char-1', {
        ownerType: 'character',
        ownerId: 'char-1',
        materials: [{ id: 'm1', quantity: 2 }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'm1', newOwner: 'char-1' },
      });
      expect(next.entities.inventories['party'].materials).toHaveLength(0);
      expect(next.entities.inventories['inv-char-1'].materials).toEqual([{ id: 'm1', quantity: 7 }]);
    });

    it('retag to the current owner is a no-op', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'sword-1', name: 'Longsword', quantity: 1 }],
      });
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'sword-1', newOwner: 'party' },
      });
      expect(next.entities.inventories['party'].items).toHaveLength(1);
    });

    it('unknown itemId is a silent no-op (always-succeed)', () => {
      state.entities.inventories['party'] = inventory('party');
      const before = JSON.stringify(state.entities.inventories);
      const next = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'does-not-exist', newOwner: 'char-1' },
      });
      expect(JSON.stringify(next.entities.inventories)).toBe(before);
    });

    it('is idempotent: retagging twice equals retagging once', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'sword-1', name: 'Longsword', quantity: 1 }],
      });
      const once = applyAction(state, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'sword-1', newOwner: 'char-1' },
      });
      const twice = applyAction(once, {
        type: ITEM_RETAGGED,
        payload: { itemId: 'sword-1', newOwner: 'char-1' },
      });
      expect(JSON.stringify(twice.entities.inventories)).toBe(
        JSON.stringify(once.entities.inventories)
      );
    });
  });

  describe('ITEM_ATTUNEMENT_SET', () => {
    beforeEach(() => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1, magical: true }],
      });
    });

    it('sets and unsets attunement explicitly', () => {
      const set = applyAction(state, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'wand-1', attuned: true },
      });
      expect(set.entities.inventories['party'].items[0].attuned).toBe(true);

      const unset = applyAction(set, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'wand-1', attuned: false },
      });
      expect(unset.entities.inventories['party'].items[0].attuned).toBe(false);
    });

    it('is idempotent when setting the same value twice', () => {
      const once = applyAction(state, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'wand-1', attuned: true },
      });
      const twice = applyAction(once, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'wand-1', attuned: true },
      });
      expect(twice).toEqual(once);
    });

    it('silently ignores a missing item', () => {
      const next = applyAction(state, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'missing', attuned: true },
      });
      expect(next).toEqual(state);
    });

    it('accepts an attunement write for a mundane item', () => {
      state.entities.inventories['party'].items[0].magical = false;
      const next = applyAction(state, {
        type: ITEM_ATTUNEMENT_SET,
        payload: { itemId: 'wand-1', attuned: true },
      });
      expect(next.entities.inventories['party'].items[0].attuned).toBe(true);
    });
  });

  describe('ITEM_MAGICAL_SET', () => {
    it('sets and unsets the magical flag', () => {
      state.entities.inventories['party'] = inventory('party', {
        items: [{ id: 'wand-1', name: 'Wand', quantity: 1 }],
      });
      const set = applyAction(state, {
        type: ITEM_MAGICAL_SET,
        payload: { itemId: 'wand-1', magical: true },
      });
      expect(set.entities.inventories['party'].items[0].magical).toBe(true);
      const unset = applyAction(set, {
        type: ITEM_MAGICAL_SET,
        payload: { itemId: 'wand-1', magical: false },
      });
      expect(unset.entities.inventories['party'].items[0].magical).toBe(false);
    });

    it('silently ignores a missing item', () => {
      const next = applyAction(state, {
        type: ITEM_MAGICAL_SET,
        payload: { itemId: 'missing', magical: true },
      });
      expect(next).toEqual(state);
    });
  });
});
