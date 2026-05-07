import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  findItem,
  consumeItem,
  restoreItem,
  createInventoryDelta,
  applyInventoryDelta,
  reverseInventoryDelta,
  canUseItem,
  getItemQuantity,
  updateItemTags
} from '../combatInventoryBridge';

const makeItems = () => [
  { id: 'a', name: 'Potion', quantity: 3, tags: ['healing'] },
  { id: 'b', name: 'Bandage', quantity: 1, tags: [] },
  { id: 'c', name: 'Empty', quantity: 0, tags: ['junk'] }
];

describe('combatInventoryBridge', () => {
  describe('findItem', () => {
    it('returns the matching item', () => {
      const items = makeItems();
      expect(findItem(items, 'a')).toBe(items[0]);
    });

    it('returns null when item is missing', () => {
      expect(findItem(makeItems(), 'missing')).toBeNull();
    });

    it('returns null for empty inventory', () => {
      expect(findItem([], 'a')).toBeNull();
    });
  });

  describe('consumeItem', () => {
    it('decrements quantity by the requested amount', () => {
      const items = makeItems();
      const result = consumeItem(items, 'a', 2);
      expect(result.consumed).toBe(2);
      expect(result.inventory[0].quantity).toBe(1);
      expect(result.item.quantity).toBe(1);
      // original untouched
      expect(items[0].quantity).toBe(3);
    });

    it('defaults quantity to 1', () => {
      const result = consumeItem(makeItems(), 'a');
      expect(result.consumed).toBe(1);
      expect(result.inventory[0].quantity).toBe(2);
    });

    it('caps consumption at the available quantity', () => {
      const result = consumeItem(makeItems(), 'b', 5);
      expect(result.consumed).toBe(1);
      expect(result.inventory[1].quantity).toBe(0);
    });

    it('returns zero consumed when item is missing', () => {
      const items = makeItems();
      const result = consumeItem(items, 'missing', 1);
      expect(result.consumed).toBe(0);
      expect(result.item).toBeNull();
      expect(result.inventory).toBe(items);
    });

    it('handles items with no quantity field as zero', () => {
      const items = [{ id: 'x' }];
      const result = consumeItem(items, 'x', 1);
      expect(result.consumed).toBe(0);
      expect(result.inventory[0].quantity).toBe(0);
    });
  });

  describe('restoreItem', () => {
    it('increments quantity by the requested amount', () => {
      const result = restoreItem(makeItems(), 'a', 2);
      expect(result[0].quantity).toBe(5);
    });

    it('defaults restore quantity to 1', () => {
      const result = restoreItem(makeItems(), 'b');
      expect(result[1].quantity).toBe(2);
    });

    it('warns and returns the original array when item is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const items = makeItems();
      const result = restoreItem(items, 'missing', 1);
      expect(result).toBe(items);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('createInventoryDelta', () => {
    it('captures itemId, quantityChange, and a snapshot copy', () => {
      const snapshot = { id: 'a', quantity: 3 };
      const delta = createInventoryDelta('a', -1, snapshot);
      expect(delta).toEqual({
        itemId: 'a',
        quantityChange: -1,
        itemSnapshot: { id: 'a', quantity: 3 }
      });
      // Snapshot is a copy, not a reference
      expect(delta.itemSnapshot).not.toBe(snapshot);
    });
  });

  describe('applyInventoryDelta / reverseInventoryDelta', () => {
    it('apply with negative change consumes', () => {
      const items = makeItems();
      const delta = createInventoryDelta('a', -2, items[0]);
      const after = applyInventoryDelta(items, delta);
      expect(after[0].quantity).toBe(1);
    });

    it('apply with positive change restores', () => {
      const items = makeItems();
      const delta = createInventoryDelta('a', 2, items[0]);
      const after = applyInventoryDelta(items, delta);
      expect(after[0].quantity).toBe(5);
    });

    it('reverse undoes a consumption delta by restoring', () => {
      const items = makeItems();
      const delta = createInventoryDelta('a', -2, items[0]);
      const consumed = applyInventoryDelta(items, delta);
      const reversed = reverseInventoryDelta(consumed, delta);
      expect(reversed[0].quantity).toBe(3);
    });

    it('reverse undoes a restoration delta by consuming', () => {
      const items = makeItems();
      const delta = createInventoryDelta('a', 2, items[0]);
      const restored = applyInventoryDelta(items, delta);
      const reversed = reverseInventoryDelta(restored, delta);
      expect(reversed[0].quantity).toBe(3);
    });
  });

  describe('canUseItem', () => {
    it('returns true for an item with quantity > 0', () => {
      expect(canUseItem({ quantity: 1 })).toBe(true);
    });

    it('returns false for an item with quantity 0', () => {
      expect(canUseItem({ quantity: 0 })).toBe(false);
    });

    it('returns false for null', () => {
      expect(canUseItem(null)).toBeFalsy();
    });

    it('returns false when quantity is missing', () => {
      expect(canUseItem({})).toBe(false);
    });
  });

  describe('getItemQuantity', () => {
    it('returns the quantity for a present item', () => {
      expect(getItemQuantity(makeItems(), 'a')).toBe(3);
    });

    it('returns 0 for a missing item', () => {
      expect(getItemQuantity(makeItems(), 'missing')).toBe(0);
    });

    it('returns 0 when quantity field is absent', () => {
      expect(getItemQuantity([{ id: 'x' }], 'x')).toBe(0);
    });
  });

  describe('updateItemTags', () => {
    it('replaces tags on the matching item', () => {
      const items = makeItems();
      const result = updateItemTags(items, 'a', ['combat', 'consumable']);
      expect(result[0].tags).toEqual(['combat', 'consumable']);
      // original untouched
      expect(items[0].tags).toEqual(['healing']);
    });

    it('copies the tags array (not the same reference)', () => {
      const newTags = ['combat'];
      const result = updateItemTags(makeItems(), 'a', newTags);
      expect(result[0].tags).not.toBe(newTags);
      expect(result[0].tags).toEqual(['combat']);
    });

    it('leaves other items unchanged when id does not match', () => {
      const items = makeItems();
      const result = updateItemTags(items, 'missing', ['x']);
      expect(result).toEqual(items);
    });
  });
});
