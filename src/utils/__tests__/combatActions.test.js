import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPES,
  createTurnAdvanceAction,
  createSetResourceAction,
  createAddLogEntryAction,
  createRemoveLogEntryAction,
  createUpdateLogEntryAction,
  createReorderTurnOrderAction,
  createLoadCombatStateAction,
  createSetTurnDecisionAction,
  createAddReinforcementsAction,
  createAddConditionAction,
  createRemoveConditionAction,
  createUpdateConditionAction,
  createUseItemAction,
  createMoveParticipantAction
} from '../combatActions';

const expectMeta = (action, type) => {
  expect(action.id).toBeTruthy();
  expect(typeof action.id).toBe('string');
  expect(action.ts).toBeTruthy();
  expect(() => new Date(action.ts).toISOString()).not.toThrow();
  expect(action.type).toBe(type);
  expect(typeof action.label).toBe('string');
};

describe('combatActions', () => {
  describe('ACTION_TYPES', () => {
    it('exposes the expected action constants', () => {
      expect(ACTION_TYPES.TURN_ADVANCE).toBe('TURN_ADVANCE');
      expect(ACTION_TYPES.MOVE_PARTICIPANT).toBe('MOVE_PARTICIPANT');
      expect(ACTION_TYPES.USE_ITEM).toBe('USE_ITEM');
    });
  });

  describe('createTurnAdvanceAction', () => {
    it('builds an inverse-symmetric turn advance action', () => {
      const action = createTurnAdvanceAction(1, 0, 1, 1);
      expectMeta(action, ACTION_TYPES.TURN_ADVANCE);
      expect(action.payload).toEqual({ fromRound: 1, fromTurnIndex: 0, toRound: 1, toTurnIndex: 1 });
      expect(action.inverse).toEqual({ fromRound: 1, fromTurnIndex: 1, toRound: 1, toTurnIndex: 0 });
      expect(action.label).toContain('R1');
      expect(action.label).toContain('T2');
    });

    it('handles round transitions across boundaries', () => {
      const action = createTurnAdvanceAction(1, 4, 2, 0);
      expect(action.payload.toRound).toBe(2);
      expect(action.inverse.toRound).toBe(1);
      expect(action.inverse.toTurnIndex).toBe(4);
    });
  });

  describe('createSetResourceAction', () => {
    it('formats positive deltas with a + sign', () => {
      const action = createSetResourceAction('inst-1', 'HP', 5, 10);
      expectMeta(action, ACTION_TYPES.SET_RESOURCE);
      expect(action.label).toBe('HP +5');
      expect(action.payload).toEqual({ instanceId: 'inst-1', resource: 'HP', from: 5, to: 10 });
      expect(action.inverse).toEqual({ instanceId: 'inst-1', resource: 'HP', from: 10, to: 5 });
    });

    it('formats negative deltas without an extra sign', () => {
      const action = createSetResourceAction('inst-2', 'FP', 8, 3);
      expect(action.label).toBe('FP -5');
    });

    it('handles a zero delta', () => {
      const action = createSetResourceAction('inst-3', 'MP', 4, 4);
      expect(action.label).toBe('MP 0');
      expect(action.payload.from).toBe(action.payload.to);
    });
  });

  describe('createAddLogEntryAction / createRemoveLogEntryAction / createUpdateLogEntryAction', () => {
    it('add stores the entry and inverses by id', () => {
      const entry = { id: 'log-1', entryType: 'attack', text: 'hit' };
      const action = createAddLogEntryAction(entry);
      expectMeta(action, ACTION_TYPES.ADD_LOG_ENTRY);
      expect(action.payload.entry).toBe(entry);
      expect(action.inverse).toEqual({ entryId: 'log-1' });
      expect(action.label).toContain('attack');
    });

    it('remove stores backup and inverses with the original entry', () => {
      const backup = { id: 'log-2', entryType: 'note', text: 'gone' };
      const action = createRemoveLogEntryAction('log-2', backup);
      expectMeta(action, ACTION_TYPES.REMOVE_LOG_ENTRY);
      expect(action.payload).toEqual({ entryId: 'log-2', entryBackup: backup });
      expect(action.inverse).toEqual({ entry: backup });
    });

    it('update swaps fromText and toText in the inverse', () => {
      const action = createUpdateLogEntryAction('log-3', 'old', 'new');
      expectMeta(action, ACTION_TYPES.UPDATE_LOG_ENTRY);
      expect(action.payload).toEqual({ entryId: 'log-3', fromText: 'old', toText: 'new' });
      expect(action.inverse).toEqual({ entryId: 'log-3', fromText: 'new', toText: 'old' });
    });
  });

  describe('createReorderTurnOrderAction', () => {
    it('clones input arrays so caller mutations do not leak', () => {
      const from = ['a', 'b', 'c'];
      const to = ['c', 'b', 'a'];
      const action = createReorderTurnOrderAction(from, to);
      expectMeta(action, ACTION_TYPES.REORDER_TURN_ORDER);
      from.push('mutated');
      to.push('mutated');
      expect(action.payload.fromOrder).toEqual(['a', 'b', 'c']);
      expect(action.payload.toOrder).toEqual(['c', 'b', 'a']);
      expect(action.inverse.fromOrder).toEqual(['c', 'b', 'a']);
      expect(action.inverse.toOrder).toEqual(['a', 'b', 'c']);
    });

    it('handles empty arrays', () => {
      const action = createReorderTurnOrderAction([], []);
      expect(action.payload.fromOrder).toEqual([]);
      expect(action.payload.toOrder).toEqual([]);
    });
  });

  describe('createLoadCombatStateAction', () => {
    it('inverses snapshots', () => {
      const before = { round: 1 };
      const after = { round: 5 };
      const action = createLoadCombatStateAction(before, after);
      expectMeta(action, ACTION_TYPES.LOAD_COMBAT_STATE);
      expect(action.payload).toEqual({ fromSnapshot: before, toSnapshot: after });
      expect(action.inverse).toEqual({ fromSnapshot: after, toSnapshot: before });
    });

    it('accepts a null fromSnapshot', () => {
      const action = createLoadCombatStateAction(null, { round: 1 });
      expect(action.payload.fromSnapshot).toBeNull();
      expect(action.inverse.toSnapshot).toBeNull();
    });
  });

  describe('createSetTurnDecisionAction', () => {
    it('records previous and next decisions for undo', () => {
      const prev = { maneuver: 'wait' };
      const next = { maneuver: 'attack' };
      const action = createSetTurnDecisionAction('R1-T0-actor1', prev, next);
      expectMeta(action, ACTION_TYPES.SET_TURN_DECISION);
      expect(action.payload).toEqual({ decisionKey: 'R1-T0-actor1', decision: next });
      expect(action.inverse).toEqual({ decisionKey: 'R1-T0-actor1', decision: prev });
    });

    it('accepts null for previous decision', () => {
      const action = createSetTurnDecisionAction('K', null, { maneuver: 'move' });
      expect(action.inverse.decision).toBeNull();
    });
  });

  describe('createAddReinforcementsAction', () => {
    it('packs combatants, ids, and turn order with a usable inverse', () => {
      const params = {
        addedCombatants: [{ instanceId: 'a' }, { instanceId: 'b' }],
        addedInstanceIds: ['a', 'b'],
        turnOrderBefore: ['x'],
        turnOrderAfter: ['x', 'a', 'b'],
        logEntry: { id: 'log-99', entryType: 'reinforcements' },
        revealUpdate: { revealed: ['a'] }
      };
      const action = createAddReinforcementsAction(params);
      expectMeta(action, ACTION_TYPES.ADD_REINFORCEMENTS);
      expect(action.payload.addedCombatants).toBe(params.addedCombatants);
      expect(action.payload.turnOrderAfter).toEqual(['x', 'a', 'b']);
      expect(action.inverse).toEqual({
        removedInstanceIds: ['a', 'b'],
        turnOrderBefore: ['x'],
        logEntryId: 'log-99'
      });
      expect(action.revealUpdate).toEqual({ revealed: ['a'] });
    });

    it('falls back to null logEntryId when logEntry is missing', () => {
      const action = createAddReinforcementsAction({
        addedCombatants: [],
        addedInstanceIds: [],
        turnOrderBefore: [],
        turnOrderAfter: [],
        logEntry: null
      });
      expect(action.inverse.logEntryId).toBeNull();
    });
  });

  describe('condition actions', () => {
    const conditionInstance = { instanceId: 'cond-1', label: 'Stunned', durationTurns: 2 };

    it('add carries the condition and inverses with its instanceId', () => {
      const action = createAddConditionAction('p1', conditionInstance);
      expectMeta(action, ACTION_TYPES.ADD_CONDITION);
      expect(action.payload).toEqual({ instanceId: 'p1', conditionInstance });
      expect(action.inverse).toEqual({ instanceId: 'p1', conditionInstanceId: 'cond-1' });
      expect(action.label).toContain('Stunned');
    });

    it('remove backs up the condition for undo', () => {
      const action = createRemoveConditionAction('p1', conditionInstance);
      expectMeta(action, ACTION_TYPES.REMOVE_CONDITION);
      expect(action.payload).toEqual({
        instanceId: 'p1',
        conditionInstanceId: 'cond-1',
        conditionBackup: conditionInstance
      });
      expect(action.inverse).toEqual({ instanceId: 'p1', conditionInstance });
    });

    it('update swaps from/to in the inverse', () => {
      const fromCond = { ...conditionInstance, durationTurns: 2 };
      const toCond = { ...conditionInstance, durationTurns: 1 };
      const action = createUpdateConditionAction('p1', 'cond-1', fromCond, toCond);
      expectMeta(action, ACTION_TYPES.UPDATE_CONDITION);
      expect(action.payload).toEqual({
        instanceId: 'p1',
        conditionInstanceId: 'cond-1',
        fromCondition: fromCond,
        toCondition: toCond
      });
      expect(action.inverse).toEqual({
        instanceId: 'p1',
        conditionInstanceId: 'cond-1',
        fromCondition: toCond,
        toCondition: fromCond
      });
    });
  });

  describe('createUseItemAction', () => {
    const item = { id: 'potion-1', name: 'Healing Potion', quantity: 2 };
    const inventoryDelta = { itemId: 'potion-1', quantityChange: -1 };

    it('captures resource changes and condition swaps in inverse', () => {
      const action = createUseItemAction({
        actorInstanceId: 'a1',
        targetInstanceId: 't1',
        item,
        effect: { type: 'heal' },
        inventoryDelta,
        resourceChanges: [{ instanceId: 't1', resource: 'HP', from: 5, to: 10 }],
        conditionsAdded: [{ instanceId: 't1', conditionInstance: { instanceId: 'c-add' } }],
        conditionsRemoved: [{ instanceId: 't1', conditionInstance: { instanceId: 'c-rem' } }]
      });
      expectMeta(action, ACTION_TYPES.USE_ITEM);
      expect(action.label).toBe('Use Healing Potion');
      expect(action.payload.item).toEqual({
        id: 'potion-1',
        name: 'Healing Potion',
        quantityBefore: 3,
        quantityAfter: 2
      });
      expect(action.inverse.resourceChanges).toEqual([
        { instanceId: 't1', resource: 'HP', from: 10, to: 5 }
      ]);
      expect(action.inverse.conditionsAdded[0].conditionInstance.instanceId).toBe('c-rem');
      expect(action.inverse.conditionsRemoved[0].conditionInstance.instanceId).toBe('c-add');
    });

    it('defaults missing arrays to empty', () => {
      const action = createUseItemAction({
        actorInstanceId: 'a',
        targetInstanceId: 't',
        item,
        effect: null,
        inventoryDelta
      });
      expect(action.payload.resourceChanges).toEqual([]);
      expect(action.payload.conditionsAdded).toEqual([]);
      expect(action.inverse.conditionsAdded).toEqual([]);
      expect(action.inverse.conditionsRemoved).toEqual([]);
    });
  });

  describe('createMoveParticipantAction', () => {
    it('swaps positions and reverses path in inverse', () => {
      const path = ['t1', 't2', 't3'];
      const action = createMoveParticipantAction('p1', { r: 0, q: 0 }, { r: 1, q: 2 }, path, 3);
      expectMeta(action, ACTION_TYPES.MOVE_PARTICIPANT);
      expect(action.payload).toEqual({
        instanceId: 'p1',
        fromPosition: { r: 0, q: 0 },
        toPosition: { r: 1, q: 2 },
        path,
        cost: 3
      });
      expect(action.inverse.fromPosition).toEqual({ r: 1, q: 2 });
      expect(action.inverse.toPosition).toEqual({ r: 0, q: 0 });
      expect(action.inverse.path).toEqual(['t3', 't2', 't1']);
      expect(path).toEqual(['t1', 't2', 't3']);
    });

    it('handles missing position fields in label and defaults', () => {
      const action = createMoveParticipantAction('p1', null, undefined);
      expect(action.label).toBe('Move to (?,?)');
      expect(action.payload.path).toEqual([]);
      expect(action.payload.cost).toBe(0);
      expect(action.inverse.path).toEqual([]);
    });
  });

  describe('id and timestamp uniqueness', () => {
    it('generates unique ids for sequential actions', () => {
      const a = createTurnAdvanceAction(1, 0, 1, 1);
      const b = createTurnAdvanceAction(1, 0, 1, 1);
      expect(a.id).not.toBe(b.id);
    });
  });
});
