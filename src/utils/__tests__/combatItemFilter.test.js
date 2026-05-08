import { describe, it, expect } from 'vitest';
import {
  isCombatUsable,
  filterCombatItems,
  groupCombatItems,
  sortItemsByName
} from '../combatItemFilter';
import { ItemTag } from '../itemTags';

const mkItem = (name, tags = []) => ({ name, tags });

describe('combatItemFilter', () => {
  describe('isCombatUsable', () => {
    it('returns true when item has the combat-usable tag', () => {
      expect(isCombatUsable(mkItem('Sword', [ItemTag.COMBAT_USABLE]))).toBe(true);
    });

    it('returns false when item lacks the combat-usable tag', () => {
      expect(isCombatUsable(mkItem('Rock', ['mundane']))).toBe(false);
    });

    it('returns false for items with no tags', () => {
      expect(isCombatUsable(mkItem('Bare'))).toBe(false);
    });
  });

  describe('filterCombatItems', () => {
    const items = [
      mkItem('Healing Potion', [ItemTag.COMBAT_USABLE, ItemTag.POTION]),
      mkItem('Throwing Knife', [ItemTag.COMBAT_USABLE, ItemTag.THROWABLE]),
      mkItem('Bedroll', ['camping']),
      mkItem('Mana Potion', [ItemTag.COMBAT_USABLE, ItemTag.POTION])
    ];

    it('returns only combat-usable items by default', () => {
      const result = filterCombatItems(items);
      expect(result).toHaveLength(3);
      expect(result.every(it => it.tags.includes(ItemTag.COMBAT_USABLE))).toBe(true);
    });

    it('returns all items when showAll is true', () => {
      expect(filterCombatItems(items, { showAll: true })).toHaveLength(4);
    });

    it('filters by search query against name', () => {
      const result = filterCombatItems(items, { search: 'healing' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Healing Potion');
    });

    it('filters by search query against tags', () => {
      const result = filterCombatItems(items, { search: 'throwable' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Throwing Knife');
    });

    it('search is case-insensitive and trims whitespace', () => {
      const result = filterCombatItems(items, { search: '  POTION  ' });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when items is null or undefined', () => {
      expect(filterCombatItems(null)).toEqual([]);
      expect(filterCombatItems(undefined)).toEqual([]);
    });

    it('handles items with missing name and tags fields', () => {
      const messy = [{}, { name: 'Named' }, { tags: [ItemTag.COMBAT_USABLE] }];
      const result = filterCombatItems(messy, { showAll: true, search: 'named' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Named');
    });

    it('uses default options when none provided', () => {
      expect(filterCombatItems(items, {})).toHaveLength(3);
    });
  });

  describe('groupCombatItems', () => {
    it('groups items into potions, consumables, throwables, and other', () => {
      const items = [
        mkItem('Healing Potion', [ItemTag.POTION]),
        mkItem('Trail Rations', [ItemTag.CONSUMABLE]),
        mkItem('Throwing Knife', [ItemTag.THROWABLE]),
        mkItem('Sword', [ItemTag.COMBAT_USABLE])
      ];
      const grouped = groupCombatItems(items);
      expect(grouped.potions).toHaveLength(1);
      expect(grouped.consumables).toHaveLength(1);
      expect(grouped.throwables).toHaveLength(1);
      expect(grouped.other).toHaveLength(1);
      expect(grouped.other[0].name).toBe('Sword');
    });

    it('prioritizes potion over consumable when both tags are present', () => {
      const items = [mkItem('Elixir', [ItemTag.POTION, ItemTag.CONSUMABLE])];
      const grouped = groupCombatItems(items);
      expect(grouped.potions).toHaveLength(1);
      expect(grouped.consumables).toHaveLength(0);
    });

    it('returns empty buckets for empty input', () => {
      const grouped = groupCombatItems([]);
      expect(grouped).toEqual({ potions: [], consumables: [], throwables: [], other: [] });
    });
  });

  describe('sortItemsByName', () => {
    it('sorts items alphabetically by name (case-insensitive)', () => {
      const items = [mkItem('charlie'), mkItem('Alpha'), mkItem('bravo')];
      const sorted = sortItemsByName(items);
      expect(sorted.map(i => i.name)).toEqual(['Alpha', 'bravo', 'charlie']);
    });

    it('does not mutate the input array', () => {
      const items = [mkItem('B'), mkItem('A')];
      const original = [...items];
      sortItemsByName(items);
      expect(items).toEqual(original);
    });

    it('handles items with missing names', () => {
      const items = [{ name: 'Beta' }, {}, { name: 'Alpha' }];
      const sorted = sortItemsByName(items);
      expect(sorted[0].name).toBeUndefined();
      expect(sorted[1].name).toBe('Alpha');
      expect(sorted[2].name).toBe('Beta');
    });

    it('returns empty array when given empty input', () => {
      expect(sortItemsByName([])).toEqual([]);
    });
  });
});
