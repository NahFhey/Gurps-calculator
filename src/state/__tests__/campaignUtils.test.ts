import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeArray,
  denormalizeObject,
  ensureIds,
  mergeCharacters,
  migrateLegacyTemplates,
  createPartyInventory,
  createCharacterInventories,
  validateId,
  getOrDefault,
  updateInNormalized,
  removeFromNormalized,
  addToNormalized,
  normalizeTime,
  deepMerge,
  filterForPlayerExport,
  validateCampaignState
} from '../campaignUtils';
import type { Character, CustomTemplates } from '../../types/campaign';

describe('campaignUtils', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('normalizeArray', () => {
    it('converts array of objects with ids into a record', () => {
      const result = normalizeArray([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' }
      ]);
      expect(result).toEqual({
        a: { id: 'a', name: 'Alpha' },
        b: { id: 'b', name: 'Beta' }
      });
    });

    it('skips items without an id', () => {
      const result = normalizeArray([
        { id: 'a', name: 'Alpha' },
        { id: '', name: 'Empty' } as { id: string; name: string }
      ]);
      expect(result).toEqual({ a: { id: 'a', name: 'Alpha' } });
    });

    it('returns empty object and warns on non-array input', () => {
      const result = normalizeArray(null as unknown as Array<{ id: string }>);
      expect(result).toEqual({});
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('denormalizeObject', () => {
    it('returns Object.values of the record', () => {
      const result = denormalizeObject({ a: 1, b: 2 });
      expect(result).toEqual([1, 2]);
    });

    it('returns empty array and warns on invalid input', () => {
      const result = denormalizeObject(null as unknown as Record<string, number>);
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('ensureIds', () => {
    it('preserves existing ids', () => {
      const result = ensureIds([{ id: 'x', value: 1 }, { id: 'y', value: 2 }]);
      expect(result.map(r => r.id)).toEqual(['x', 'y']);
    });

    it('generates ids for items missing them', () => {
      const result = ensureIds([{ value: 1 }, { value: 2 }] as Array<{ id?: string; value: number }>);
      expect(result).toHaveLength(2);
      expect(result[0].id).toMatch(/^generated-/);
      expect(result[1].id).toMatch(/^generated-/);
      expect(result[0].id).not.toEqual(result[1].id);
    });

    it('accepts a record by converting to array first', () => {
      const result = ensureIds({ foo: { id: 'foo', value: 1 }, bar: { id: 'bar', value: 2 } });
      expect(result.map(r => r.id).sort()).toEqual(['bar', 'foo']);
    });
  });

  describe('mergeCharacters', () => {
    it('adds workers as NPC characters when they do not already exist', () => {
      const workers = [{ id: 'w1', name: 'Worker One', skills: { Smithing: 12 }, st: 11 }];
      const result = mergeCharacters(workers, {});
      expect(result.w1).toMatchObject({
        id: 'w1',
        name: 'Worker One',
        isPlayer: false,
        st: 11,
        work: { enabled: true, skills: { Smithing: 12 } }
      });
    });

    it('skips workers whose id already exists in partyCharacters', () => {
      const existing = { id: 'w1', name: 'Existing', isPlayer: true } as unknown as Character;
      const workers = [{ id: 'w1', name: 'Override', skills: {} }];
      const result = mergeCharacters(workers, { w1: existing });
      expect(result.w1).toBe(existing);
    });
  });

  describe('migrateLegacyTemplates', () => {
    it('flattens category/template pairs into toolTemplates', () => {
      const input = {
        forge: { Anvil: { someProp: 1 } },
        kitchen: { Pot: { someProp: 2 } }
      } as unknown as CustomTemplates;
      const result = migrateLegacyTemplates(input);
      expect(result['forge-Anvil']).toMatchObject({
        templateId: 'forge-Anvil',
        name: 'Anvil (forge)'
      });
      expect(result['kitchen-Pot'].activityCategories.crafting).toEqual({
        skillBonus: 0,
        qualityModifier: 0
      });
    });

    it('returns empty result for empty input', () => {
      const result = migrateLegacyTemplates({} as CustomTemplates);
      expect(result).toEqual({});
    });
  });

  describe('createPartyInventory', () => {
    it('builds the party inventory from materials and foods', () => {
      const result = createPartyInventory(
        [{ id: 'iron', name: 'Iron', type: 'metal', quantity: 5 }],
        [{ id: 'bread', name: 'Bread', types: ['grain'], quantity: 3 }]
      );
      expect(result).toMatchObject({
        id: 'party',
        ownerType: 'party',
        ownerId: null,
        materials: [{ id: 'iron', name: 'Iron', type: 'metal', quantity: 5 }],
        food: [{ id: 'bread', name: 'Bread', types: ['grain'], quantity: 3 }],
        items: [],
        tools: []
      });
      expect(result.currency).toEqual({ gold: 0, silver: 0, copper: 0 });
    });

    it('handles empty materials and foods', () => {
      const result = createPartyInventory([], []);
      expect(result.materials).toEqual([]);
      expect(result.food).toEqual([]);
    });
  });

  describe('createCharacterInventories', () => {
    it('produces a per-character inventory for each character', () => {
      const characters = {
        a: { id: 'a', name: 'A' },
        b: { id: 'b', name: 'B' }
      } as unknown as Record<string, Character>;
      const result = createCharacterInventories(characters);
      expect(Object.keys(result).sort()).toEqual(['a', 'b']);
      expect(result.a).toMatchObject({
        id: 'a',
        ownerType: 'character',
        ownerId: 'a',
        items: [],
        tools: [],
        materials: [],
        food: []
      });
    });

    it('returns empty object when no characters are provided', () => {
      expect(createCharacterInventories({})).toEqual({});
    });
  });

  describe('validateId', () => {
    it('returns true when the id exists', () => {
      expect(validateId({ x: { id: 'x' } }, 'x', 'thing')).toBe(true);
    });

    it('warns and returns false when the id is missing', () => {
      expect(validateId({}, 'missing', 'thing')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('getOrDefault', () => {
    it('returns the value when present', () => {
      expect(getOrDefault({ a: 1 }, 'a', 99)).toBe(1);
    });

    it('returns the default when missing', () => {
      expect(getOrDefault<number>({}, 'a', 99)).toBe(99);
    });
  });

  describe('updateInNormalized', () => {
    it('applies a partial update', () => {
      const obj = { a: { id: 'a', name: 'A', count: 1 } };
      const result = updateInNormalized(obj, 'a', { count: 5 });
      expect(result.a).toEqual({ id: 'a', name: 'A', count: 5 });
    });

    it('warns and returns original object when id is missing', () => {
      const obj = { a: { id: 'a', name: 'A' } };
      const result = updateInNormalized(obj, 'missing', { name: 'X' });
      expect(result).toBe(obj);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('removeFromNormalized', () => {
    it('removes the keyed entry', () => {
      const result = removeFromNormalized({ a: 1, b: 2 }, 'a');
      expect(result).toEqual({ b: 2 });
    });

    it('is a no-op when key does not exist', () => {
      const result = removeFromNormalized({ a: 1 }, 'missing');
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('addToNormalized', () => {
    it('adds a new keyed entry', () => {
      const result = addToNormalized({ a: { id: 'a', value: 1 } }, { id: 'b', value: 2 });
      expect(result).toEqual({ a: { id: 'a', value: 1 }, b: { id: 'b', value: 2 } });
    });

    it('overwrites when the same id is added again', () => {
      const result = addToNormalized({ a: { id: 'a', value: 1 } }, { id: 'a', value: 9 });
      expect(result.a).toEqual({ id: 'a', value: 9 });
    });
  });

  describe('normalizeTime', () => {
    it('passes through valid values', () => {
      expect(normalizeTime(3, 2)).toEqual({ day: 3, slot: 2 });
    });

    it('defaults zero day to 1 and preserves zero slot', () => {
      expect(normalizeTime(0, 0)).toEqual({ day: 1, slot: 0 });
    });
  });

  describe('deepMerge', () => {
    it('recursively merges nested objects', () => {
      const target: Record<string, any> = { a: 1, nested: { x: 1, y: 2 } };
      const source: Record<string, any> = { nested: { y: 99, z: 3 } };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, nested: { x: 1, y: 99, z: 3 } });
    });

    it('overwrites arrays rather than merging element-wise', () => {
      const target = { list: [1, 2, 3] };
      const source = { list: [9] };
      const result = deepMerge(target, source);
      expect(result.list).toEqual([9]);
    });

    it('does not mutate the original target', () => {
      const target = { nested: { value: 1 } };
      const source = { nested: { value: 2 } };
      const result = deepMerge(target, source);
      expect(target.nested.value).toBe(1);
      expect(result.nested.value).toBe(2);
    });
  });

  describe('filterForPlayerExport', () => {
    it('returns state unchanged (placeholder behavior)', () => {
      const state = { foo: 'bar' };
      expect(filterForPlayerExport(state)).toBe(state);
    });
  });

  describe('validateCampaignState', () => {
    it('returns true when all required keys are present', () => {
      expect(
        validateCampaignState({
          ui: {},
          meta: {},
          entities: {},
          time: {},
          activities: {}
        })
      ).toBe(true);
    });

    it('returns false when a required key is missing', () => {
      expect(
        validateCampaignState({ ui: {}, meta: {}, entities: {}, time: {} })
      ).toBe(false);
    });

    it('returns false for null or non-object input', () => {
      expect(validateCampaignState(null)).toBe(false);
      expect(validateCampaignState('string')).toBe(false);
    });
  });
});
