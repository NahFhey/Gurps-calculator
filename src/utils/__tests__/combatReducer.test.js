import { describe, it, expect, beforeEach } from 'vitest';
import { applyAction, applyInverse } from '../combatReducer';
import { ACTION_TYPES } from '../combatActions';

describe('combatReducer', () => {
  let testState;

  beforeEach(() => {
    testState = {
      id: 'combat-1',
      version: 3,
      currentTurnIndex: 0,
      currentRound: 1,
      turnOrder: ['p1', 'p2', 'p3'],
      participants: [
        {
          instanceId: 'p1',
          name: 'Player 1',
          category: 'player',
          hp: { current: 10, max: 10, mode: 'current' },
          fp: { current: 10, max: 10, mode: 'current' }
        },
        {
          instanceId: 'p2',
          name: 'Enemy 1',
          category: 'enemy',
          hp: { current: 8, max: 8, mode: 'current' },
          fp: { current: 8, max: 8, mode: 'current' }
        }
      ],
      log: []
    };
  });

  describe('TURN_ADVANCE action', () => {
    it('should advance to next turn', () => {
      const action = {
        type: ACTION_TYPES.TURN_ADVANCE,
        payload: {}
      };

      const newState = applyAction(testState, action);

      expect(newState.currentTurnIndex).toBe(1);
      expect(newState).not.toBe(testState); // Immutable
    });

    it('should advance round when wrapping turn order', () => {
      testState.currentTurnIndex = 2;
      const action = {
        type: ACTION_TYPES.TURN_ADVANCE,
        payload: {}
      };

      const newState = applyAction(testState, action);

      expect(newState.currentRound).toBe(2);
      expect(newState.currentTurnIndex).toBe(0);
    });
  });

  describe('SET_RESOURCE action', () => {
    it('should update participant HP', () => {
      const action = {
        type: ACTION_TYPES.SET_RESOURCE,
        payload: {
          instanceId: 'p1',
          resource: 'hp',
          mode: 'current',
          value: 5
        }
      };

      const newState = applyAction(testState, action);

      expect(newState.participants[0].hp.current).toBe(5);
      expect(testState.participants[0].hp.current).toBe(10); // Original unchanged
    });

    it('should update participant FP', () => {
      const action = {
        type: ACTION_TYPES.SET_RESOURCE,
        payload: {
          instanceId: 'p2',
          resource: 'fp',
          mode: 'current',
          value: 3
        }
      };

      const newState = applyAction(testState, action);

      expect(newState.participants[1].fp.current).toBe(3);
    });

    it('should throw error if participant not found', () => {
      const action = {
        type: ACTION_TYPES.SET_RESOURCE,
        payload: {
          instanceId: 'nonexistent',
          resource: 'hp',
          mode: 'current',
          value: 5
        }
      };

      expect(() => applyAction(testState, action)).toThrow();
    });
  });

  describe('ADD_LOG_ENTRY action', () => {
    it('should add entry to log', () => {
      const entry = {
        timestamp: Date.now(),
        type: 'note',
        text: 'Test note'
      };

      const action = {
        type: ACTION_TYPES.ADD_LOG_ENTRY,
        payload: entry
      };

      const newState = applyAction(testState, action);

      expect(newState.log).toHaveLength(1);
      expect(newState.log[0].text).toBe('Test note');
    });

    it('should maintain log order', () => {
      const action1 = {
        type: ACTION_TYPES.ADD_LOG_ENTRY,
        payload: { timestamp: 1, type: 'note', text: 'First' }
      };

      const action2 = {
        type: ACTION_TYPES.ADD_LOG_ENTRY,
        payload: { timestamp: 2, type: 'note', text: 'Second' }
      };

      let newState = applyAction(testState, action1);
      newState = applyAction(newState, action2);

      expect(newState.log).toHaveLength(2);
      expect(newState.log[0].text).toBe('First');
      expect(newState.log[1].text).toBe('Second');
    });
  });

  describe('REMOVE_LOG_ENTRY action', () => {
    beforeEach(() => {
      testState.log = [
        { timestamp: 1, type: 'note', text: 'Entry 1' },
        { timestamp: 2, type: 'note', text: 'Entry 2' },
        { timestamp: 3, type: 'note', text: 'Entry 3' }
      ];
    });

    it('should remove entry by index', () => {
      const action = {
        type: ACTION_TYPES.REMOVE_LOG_ENTRY,
        payload: { index: 1 }
      };

      const newState = applyAction(testState, action);

      expect(newState.log).toHaveLength(2);
      expect(newState.log[1].text).toBe('Entry 3');
    });

    it('should not modify original log', () => {
      const originalLength = testState.log.length;
      const action = {
        type: ACTION_TYPES.REMOVE_LOG_ENTRY,
        payload: { index: 0 }
      };

      applyAction(testState, action);

      expect(testState.log).toHaveLength(originalLength);
    });
  });

  describe('UPDATE_LOG_ENTRY action', () => {
    beforeEach(() => {
      testState.log = [
        { timestamp: 1, type: 'note', text: 'Original' },
        { timestamp: 2, type: 'note', text: 'Entry 2' }
      ];
    });

    it('should update log entry by index', () => {
      const action = {
        type: ACTION_TYPES.UPDATE_LOG_ENTRY,
        payload: {
          index: 0,
          updates: { text: 'Modified' }
        }
      };

      const newState = applyAction(testState, action);

      expect(newState.log[0].text).toBe('Modified');
      expect(newState.log[0].timestamp).toBe(1); // Other props unchanged
    });
  });

  describe('applyInverse', () => {
    it('should undo SET_RESOURCE action', () => {
      const action = {
        type: ACTION_TYPES.SET_RESOURCE,
        payload: {
          instanceId: 'p1',
          resource: 'hp',
          mode: 'current',
          value: 5,
          previousValue: 10
        }
      };

      let newState = applyAction(testState, action);
      expect(newState.participants[0].hp.current).toBe(5);

      newState = applyInverse(newState, action);
      expect(newState.participants[0].hp.current).toBe(10);
    });

    it('should undo ADD_LOG_ENTRY action', () => {
      const entry = { timestamp: 1, type: 'note', text: 'Test' };
      const action = {
        type: ACTION_TYPES.ADD_LOG_ENTRY,
        payload: entry
      };

      let newState = applyAction(testState, action);
      expect(newState.log).toHaveLength(1);

      newState = applyInverse(newState, action);
      expect(newState.log).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid action', () => {
      const action = {
        type: 'INVALID_ACTION'
      };

      expect(() => applyAction(testState, action)).toThrow();
    });

    it('should throw error if state is null', () => {
      const action = {
        type: ACTION_TYPES.TURN_ADVANCE,
        payload: {}
      };

      expect(() => applyAction(null, action)).toThrow();
    });

    it('should throw error if action is null', () => {
      expect(() => applyAction(testState, null)).toThrow();
    });
  });
});
