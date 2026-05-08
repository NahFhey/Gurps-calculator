import { describe, it, expect } from 'vitest';
import {
  validateCombatState,
  validateCombatExport,
  validateCombatImport,
} from '../combatValidation';

const mkPhase2Combat = (overrides = {}) => ({
  id: 'combat-1',
  name: 'Test Combat',
  version: 2,
  participants: [
    { instanceId: 'p-1', id: 'p-1', name: 'Alice' },
    { instanceId: 'p-2', id: 'p-2', name: 'Bob' },
  ],
  turnOrder: ['p-1', 'p-2'],
  log: [{ id: 'log-1', entryType: 'note', text: 'Combat started' }],
  currentRound: 1,
  currentTurnIndex: 0,
  ...overrides,
});

describe('validateCombatState', () => {
  describe('happy path', () => {
    it('validates a well-formed Phase 2 combat state', () => {
      const result = validateCombatState(mkPhase2Combat());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.combat).toBeDefined();
      expect(result.combat.version).toBe(2);
    });

    it('preserves participant instanceIds for valid Phase 2 input', () => {
      const result = validateCombatState(mkPhase2Combat());
      expect(result.combat.participants[0].instanceId).toBe('p-1');
      expect(result.combat.participants[1].instanceId).toBe('p-2');
    });

    it('migrates Phase 1 combat (no version) to Phase 2', () => {
      const phase1 = {
        id: 'c-1',
        name: 'Old Combat',
        participants: [{ id: 'old-1', name: 'Alice' }],
        turnOrder: ['old-1'],
        log: [{ type: 'combat_start', timestamp: 100 }],
      };
      const result = validateCombatState(phase1);
      expect(result.valid).toBe(true);
      expect(result.combat.version).toBe(2);
      expect(result.combat.participants[0].instanceId).toBe('old-1');
      expect(result.combat.turnOrder).toEqual(['old-1']);
      expect(result.combat.log[0].id).toBeDefined();
      expect(result.combat.log[0].entryType).toBe('note');
      expect(result.combat.log[0].text).toBe('Combat started');
    });

    it('generates instanceIds for participants missing them after migration', () => {
      const phase1 = {
        id: 'c-1',
        name: 'C',
        version: 1,
        participants: [{ name: 'NoId' }],
        turnOrder: [],
        log: [],
      };
      const result = validateCombatState(phase1);
      expect(result.valid).toBe(true);
      expect(result.combat.participants[0].instanceId).toBeDefined();
      expect(result.combat.participants[0].instanceId).toBe(
        result.combat.participants[0].id
      );
    });

    it('migrates hp_change entries with computed delta', () => {
      const phase1 = {
        id: 'c-1',
        name: 'C',
        participants: [{ id: 'p-1', name: 'A' }],
        turnOrder: ['p-1'],
        log: [{ type: 'hp_change', oldValue: 10, newValue: 7, actorId: 'p-1' }],
      };
      const result = validateCombatState(phase1);
      expect(result.valid).toBe(true);
      expect(result.combat.log[0].entryType).toBe('resource');
      expect(result.combat.log[0].hpDelta).toBe(-3);
    });

    it('ensures stable IDs for Phase 2 participants missing instanceId', () => {
      const combat = mkPhase2Combat({
        participants: [{ id: 'p-1', name: 'Alice' }],
        turnOrder: ['p-1'],
      });
      const result = validateCombatState(combat);
      expect(result.valid).toBe(true);
      expect(result.combat.participants[0].instanceId).toBe('p-1');
    });
  });

  describe('error / edge paths', () => {
    it('rejects null input', () => {
      const result = validateCombatState(null);
      expect(result.valid).toBe(false);
      expect(result.combat).toBeNull();
      expect(result.errors).toContain('Invalid data format');
    });

    it('rejects non-object input', () => {
      const result = validateCombatState('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid data format');
    });

    it('reports all missing required fields', () => {
      const result = validateCombatState({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing combat id');
      expect(result.errors).toContain('Missing combat name');
      expect(result.errors).toContain('Missing or invalid participants array');
      expect(result.errors).toContain('Missing or invalid turnOrder array');
      expect(result.errors).toContain('Missing or invalid log array');
    });

    it('rejects when participants is not an array', () => {
      const result = validateCombatState({
        id: 'c',
        name: 'n',
        participants: 'nope',
        turnOrder: [],
        log: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid participants array');
    });

    it('reports turnOrder referencing unknown instanceId', () => {
      const combat = mkPhase2Combat({
        turnOrder: ['p-1', 'ghost-id'],
      });
      const result = validateCombatState(combat);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.includes('turnOrder') && e.includes('ghost-id'))
      ).toBe(true);
    });
  });
});

describe('validateCombatExport', () => {
  it('returns export bundle for valid inputs', () => {
    const combat = mkPhase2Combat();
    const history = { entries: [] };
    const result = validateCombatExport(combat, history);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      version: 1,
      combatState: expect.any(Object),
      history,
    });
    expect(result.data.combatState.participants[0].instanceId).toBe('p-1');
  });

  it('rejects when combat state is missing', () => {
    const result = validateCombatExport(null, { entries: [] });
    expect(result.valid).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors).toContain('No combat state to export');
  });

  it('rejects when history is missing', () => {
    const result = validateCombatExport(mkPhase2Combat(), null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('No history state to export');
  });
});

describe('validateCombatImport', () => {
  it('returns combat and history for valid import', () => {
    const data = {
      combatState: mkPhase2Combat(),
      history: { entries: [{ id: 'h-1' }] },
    };
    const result = validateCombatImport(data);
    expect(result.valid).toBe(true);
    expect(result.combatState).toBeDefined();
    expect(result.combatState.version).toBe(2);
    expect(result.historyState).toEqual(data.history);
    expect(result.errors).toEqual([]);
  });

  it('rejects null data', () => {
    const result = validateCombatImport(null);
    expect(result.valid).toBe(false);
    expect(result.combatState).toBeNull();
    expect(result.historyState).toBeNull();
    expect(result.errors).toContain('Invalid data format');
  });

  it('rejects when combatState is missing', () => {
    const result = validateCombatImport({ history: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing combatState in import');
  });

  it('rejects when history is missing', () => {
    const result = validateCombatImport({ combatState: mkPhase2Combat() });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing history in import');
  });

  it('propagates inner combat-state validation errors', () => {
    const result = validateCombatImport({
      combatState: { id: 'x' },
      history: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing combat name');
  });
});
