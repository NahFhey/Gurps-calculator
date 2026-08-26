import { describe, it, expect } from 'vitest';
import {
  createActivityLogEntry,
  alchemyLog,
  cookingLog,
  craftingLog,
  gatheringLog,
  inventoryLog,
  combatLog
} from '../activityLogger';

describe('activityLogger', () => {
  describe('createActivityLogEntry', () => {
    it('builds a log entry with default player visibility and namespaced type', () => {
      const entry = createActivityLogEntry('crafting', 'project_started', {
        message: 'Started crafting "Sword"'
      });

      expect(entry.type).toBe('crafting.project_started');
      expect(entry.visibility).toBe('player');
      expect(entry.payload.message).toBe('Started crafting "Sword"');
      expect(entry.payload.title).toBe('Crafting: project_started');
      expect(entry.payload.maskedMessage).toBeUndefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.timestamp).toBe('number');
    });

    it('passes through maskedMessage and custom visibility', () => {
      const entry = createActivityLogEntry(
        'combat',
        'damage',
        { message: 'Bob took 5 damage', maskedMessage: 'A combatant was injured' },
        'mixed'
      );

      expect(entry.visibility).toBe('mixed');
      expect(entry.payload.maskedMessage).toBe('A combatant was injured');
      expect(entry.payload.title).toBe('Combat: damage');
    });

    it('produces unique ids on repeated calls', () => {
      const a = createActivityLogEntry('inventory', 'item_added', { message: 'x' });
      const b = createActivityLogEntry('inventory', 'item_added', { message: 'x' });
      expect(a.id).not.toBe(b.id);
    });

    it('folds singular names into metadata and preserves provided structured fields', () => {
      const entry = createActivityLogEntry('crafting', 'project_started', {
        message: 'Started crafting "Sword"',
        characterName: 'Alice',
        itemName: 'Sword',
        characterIds: ['character-1'],
        characterNames: ['Bob'],
        itemNames: ['Shield'],
        quantity: 2,
        taskId: 'task-1',
      });

      expect(entry.meta).toEqual({
        characterIds: ['character-1'],
        characterNames: ['Bob', 'Alice'],
        itemNames: ['Shield', 'Sword'],
        quantity: 2,
        taskId: 'task-1',
      });
    });

    it('omits metadata and absent metadata keys when no data is provided', () => {
      const empty = createActivityLogEntry('combat', 'started', { message: 'Combat started' });
      const itemOnly = createActivityLogEntry('inventory', 'item_added', {
        message: 'Added Rope',
        itemName: 'Rope',
      });

      expect(empty.meta).toBeUndefined();
      expect(itemOnly.meta).toEqual({ itemNames: ['Rope'] });
      expect(itemOnly.meta).not.toHaveProperty('quantity');
      expect(itemOnly.meta).not.toHaveProperty('characterIds');
    });
  });

  it('populates metadata from all activity creator families', () => {
    expect(alchemyLog.batchStarted('Potion', 'Alice').meta).toMatchObject({
      characterNames: ['Alice'],
      itemNames: ['Potion'],
    });
    expect(cookingLog.rationCreated(3, 'Bob').meta).toMatchObject({
      characterNames: ['Bob'],
      quantity: 3,
    });
    expect(craftingLog.workApplied('Shield', 4, 'Carol').meta).toMatchObject({
      characterNames: ['Carol'],
      itemNames: ['Shield'],
      quantity: 4,
    });
    expect(gatheringLog.itemGathered('Berries', 7, 'Dan').meta).toMatchObject({
      characterNames: ['Dan'],
      itemNames: ['Berries'],
      quantity: 7,
    });
    expect(inventoryLog.itemTransferred('Rope', 'A', 'B', 2).meta).toMatchObject({
      itemNames: ['Rope'],
      quantity: 2,
    });
    expect(combatLog.characterDamaged('Eve', 5, 7).meta).toMatchObject({
      characterNames: ['Eve'],
      quantity: 5,
    });
  });

  describe('alchemyLog', () => {
    it('formats batchStarted with and without a worker name', () => {
      expect(alchemyLog.batchStarted('Healing Potion', 'Alice').payload.message)
        .toBe('Alice started brewing "Healing Potion"');
      expect(alchemyLog.batchStarted('Healing Potion').payload.message)
        .toBe('Started brewing "Healing Potion"');
    });

    it('formats batchCompleted, batchFailed, reagentAnalyzed, reagentProcessed', () => {
      expect(alchemyLog.batchCompleted('Elixir', 'fine', 'Bob').payload.message)
        .toBe('Bob completed "Elixir" with fine quality');
      expect(alchemyLog.batchFailed('Elixir').payload.message)
        .toBe('Batch "Elixir" failed - Mishap occurred');
      expect(alchemyLog.reagentAnalyzed('Mandrake', 'Carol').payload.message)
        .toBe('Carol analyzed reagent "Mandrake"');
      expect(alchemyLog.reagentProcessed('Mandrake', 'dried', 'Carol').payload.message)
        .toBe('Carol dried reagent "Mandrake"');
    });
  });

  describe('cookingLog', () => {
    it('formats mealPrepared and rationCreated', () => {
      expect(cookingLog.mealPrepared('Stew', 'good', 'Dan').payload.message)
        .toBe('Dan prepared "Stew" (good)');
      expect(cookingLog.rationCreated(3).payload.message)
        .toBe('Created 3 ration(s)');
    });
  });

  describe('craftingLog', () => {
    it('formats projectStarted, projectCompleted, workApplied', () => {
      expect(craftingLog.projectStarted('Shield').payload.message)
        .toBe('Started crafting "Shield"');
      expect(craftingLog.projectCompleted('Shield', 'masterwork', 'Eve').payload.message)
        .toBe('Eve completed "Shield" (masterwork)');
      expect(craftingLog.workApplied('Shield', 4, 'Eve').payload.message)
        .toBe('Eve worked on "Shield" for 4 hour(s)');
    });
  });

  describe('gatheringLog', () => {
    it('formats sessionStarted, itemGathered, sessionCompleted', () => {
      expect(gatheringLog.sessionStarted('Forest', 'foraging', 'Finn').payload.message)
        .toBe('Finn began foraging at Forest');
      expect(gatheringLog.itemGathered('Berries', 7).payload.message)
        .toBe('Gathered 7x Berries');
      expect(gatheringLog.sessionCompleted(12, 'Finn').payload.message)
        .toBe('Finn finished gathering (12 items)');
    });
  });

  describe('inventoryLog', () => {
    it('formats item transfers with and without quantity', () => {
      expect(inventoryLog.itemTransferred('Rope', 'A', 'B', 2).payload.message)
        .toBe('Transferred 2x "Rope" from A to B');
      expect(inventoryLog.itemTransferred('Rope', 'A', 'B').payload.message)
        .toBe('Transferred "Rope" from A to B');
    });

    it('treats quantity 0 as falsy and omits the count (edge case in current impl)', () => {
      expect(inventoryLog.itemTransferred('Rope', 'A', 'B', 0).payload.message)
        .toBe('Transferred "Rope" from A to B');
      expect(inventoryLog.itemAdded('Rope', 'A', 0).payload.message)
        .toBe('Added "Rope" to A');
      expect(inventoryLog.itemRemoved('Rope', 'A', 0).payload.message)
        .toBe('Removed "Rope" from A');
    });

    it('formats currencyTransferred, itemAdded, itemRemoved', () => {
      expect(inventoryLog.currencyTransferred(50, 'gp', 'A', 'B').payload.message)
        .toBe('Transferred 50 gp from A to B');
      expect(inventoryLog.itemAdded('Apple', 'Pack', 5).payload.message)
        .toBe('Added 5x "Apple" to Pack');
      expect(inventoryLog.itemRemoved('Apple', 'Pack').payload.message)
        .toBe('Removed "Apple" from Pack');
    });
  });

  describe('combatLog', () => {
    it('formats combatStarted/combatEnded with and without arguments', () => {
      expect(combatLog.combatStarted('Goblin Ambush').payload.message)
        .toBe('Combat started: Goblin Ambush');
      expect(combatLog.combatStarted().payload.message).toBe('Combat started');
      expect(combatLog.combatEnded('Victory').payload.message).toBe('Combat ended: Victory');
      expect(combatLog.combatEnded().payload.message).toBe('Combat ended');
    });

    it('emits damage and defeated entries with mixed visibility and a masked message', () => {
      const dmg = combatLog.characterDamaged('Bob', 5, 7);
      expect(dmg.visibility).toBe('mixed');
      expect(dmg.payload.message).toBe('Bob took 5 damage (HP: 7)');
      expect(dmg.payload.maskedMessage).toBe('A combatant was injured');

      const def = combatLog.characterDefeated('Bob');
      expect(def.visibility).toBe('mixed');
      expect(def.payload.message).toBe('Bob was defeated');
      expect(def.payload.maskedMessage).toBe('A combatant was defeated');
    });
  });
});
