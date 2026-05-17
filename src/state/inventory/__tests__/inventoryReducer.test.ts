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
});
