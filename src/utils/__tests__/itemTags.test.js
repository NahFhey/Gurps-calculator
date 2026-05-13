import { describe, it, expect } from 'vitest';
import {
  normalizeTags,
  hasTag,
  addTag,
  removeTag,
  setTags,
  hasAnyTag,
  hasAllTags,
  ItemTag
} from '../itemTags';

describe('itemTags', () => {
  describe('normalizeTags', () => {
    it('returns empty array for undefined or non-array input', () => {
      expect(normalizeTags(undefined)).toEqual([]);
      expect(normalizeTags(null)).toEqual([]);
      expect(normalizeTags('foo')).toEqual([]);
      expect(normalizeTags({})).toEqual([]);
    });

    it('lowercases, trims, and dedupes', () => {
      expect(normalizeTags(['  Foo  ', 'BAR', 'foo', 'bar'])).toEqual(['foo', 'bar']);
    });

    it('filters out empty strings', () => {
      expect(normalizeTags(['', '   ', 'keep'])).toEqual(['keep']);
    });

    it('coerces non-string values to strings', () => {
      expect(normalizeTags([123, true, 'tag'])).toEqual(['123', 'true', 'tag']);
    });

    it('returns empty array for empty input', () => {
      expect(normalizeTags([])).toEqual([]);
    });
  });

  describe('hasTag', () => {
    it('returns true when item has the tag (case-insensitive)', () => {
      const item = { tags: ['combat-usable', 'potion'] };
      expect(hasTag(item, 'combat-usable')).toBe(true);
      expect(hasTag(item, 'COMBAT-USABLE')).toBe(true);
      expect(hasTag(item, 'Potion')).toBe(true);
    });

    it('returns false when item does not have the tag', () => {
      expect(hasTag({ tags: ['potion'] }, 'scroll')).toBe(false);
    });

    it('handles items with no tags property', () => {
      expect(hasTag({}, 'potion')).toBe(false);
      expect(hasTag(null, 'potion')).toBe(false);
      expect(hasTag(undefined, 'potion')).toBe(false);
    });
  });

  describe('addTag', () => {
    it('adds a tag immutably', () => {
      const item = { id: '1', tags: ['potion'] };
      const result = addTag(item, 'combat-usable');
      expect(result.tags).toEqual(['potion', 'combat-usable']);
      expect(item.tags).toEqual(['potion']);
      expect(result.id).toBe('1');
    });

    it('does not duplicate existing tags', () => {
      const item = { tags: ['potion'] };
      expect(addTag(item, 'potion').tags).toEqual(['potion']);
      expect(addTag(item, 'POTION').tags).toEqual(['potion']);
    });

    it('handles items without a tags property', () => {
      const result = addTag({ id: '1' }, 'potion');
      expect(result.tags).toEqual(['potion']);
      expect(result.id).toBe('1');
    });

    it('normalizes the added tag', () => {
      expect(addTag({ tags: [] }, '  POTION  ').tags).toEqual(['potion']);
    });
  });

  describe('removeTag', () => {
    it('removes a tag immutably', () => {
      const item = { id: '1', tags: ['potion', 'combat-usable'] };
      const result = removeTag(item, 'potion');
      expect(result.tags).toEqual(['combat-usable']);
      expect(item.tags).toEqual(['potion', 'combat-usable']);
    });

    it('is case-insensitive', () => {
      expect(removeTag({ tags: ['potion'] }, 'POTION').tags).toEqual([]);
    });

    it('is a no-op when tag does not exist', () => {
      expect(removeTag({ tags: ['potion'] }, 'scroll').tags).toEqual(['potion']);
    });

    it('handles items without a tags property', () => {
      expect(removeTag({ id: '1' }, 'potion').tags).toEqual([]);
    });
  });

  describe('setTags', () => {
    it('replaces all tags', () => {
      const item = { id: '1', tags: ['old'] };
      const result = setTags(item, ['new1', 'new2']);
      expect(result.tags).toEqual(['new1', 'new2']);
      expect(item.tags).toEqual(['old']);
    });

    it('normalizes the provided tags', () => {
      expect(setTags({}, ['  FOO  ', 'foo', 'BAR']).tags).toEqual(['foo', 'bar']);
    });

    it('clears tags with empty array', () => {
      expect(setTags({ tags: ['a', 'b'] }, []).tags).toEqual([]);
    });
  });

  describe('hasAnyTag', () => {
    it('returns true when item has at least one of the tags', () => {
      const item = { tags: ['potion', 'consumable'] };
      expect(hasAnyTag(item, ['scroll', 'potion'])).toBe(true);
    });

    it('returns false when item has none of the tags', () => {
      expect(hasAnyTag({ tags: ['potion'] }, ['scroll', 'wand'])).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(hasAnyTag({ tags: ['potion'] }, ['POTION'])).toBe(true);
    });

    it('returns false for empty check array', () => {
      expect(hasAnyTag({ tags: ['potion'] }, [])).toBe(false);
    });

    it('handles items without tags', () => {
      expect(hasAnyTag({}, ['potion'])).toBe(false);
    });
  });

  describe('hasAllTags', () => {
    it('returns true when item has all of the tags', () => {
      const item = { tags: ['potion', 'consumable', 'combat-usable'] };
      expect(hasAllTags(item, ['potion', 'consumable'])).toBe(true);
    });

    it('returns false when item is missing one of the tags', () => {
      expect(hasAllTags({ tags: ['potion'] }, ['potion', 'consumable'])).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(hasAllTags({ tags: ['potion', 'consumable'] }, ['POTION', 'CONSUMABLE'])).toBe(true);
    });

    it('returns true for empty check array (vacuous truth)', () => {
      expect(hasAllTags({ tags: ['potion'] }, [])).toBe(true);
    });

    it('handles items without tags', () => {
      expect(hasAllTags({}, ['potion'])).toBe(false);
      expect(hasAllTags({}, [])).toBe(true);
    });
  });

  describe('ItemTag constants', () => {
    it('exposes expected tag identifiers', () => {
      expect(ItemTag.COMBAT_USABLE).toBe('combat-usable');
      expect(ItemTag.CONSUMABLE).toBe('consumable');
      expect(ItemTag.THROWABLE).toBe('throwable');
      expect(ItemTag.ACTIVATE).toBe('activate');
      expect(ItemTag.EQUIPPABLE).toBe('equippable');
      expect(ItemTag.POTION).toBe('potion');
      expect(ItemTag.FOOD).toBe('food');
      expect(ItemTag.SCROLL).toBe('scroll');
      expect(ItemTag.WAND).toBe('wand');
    });
  });
});
