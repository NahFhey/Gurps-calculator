import { describe, expect, it } from 'vitest';
import {
  ALCHEMY_REAGENT_ADD,
  ALCHEMY_REAGENT_UPDATE,
  ALCHEMY_REAGENT_REMOVE,
  ALCHEMY_REAGENTS_SET,
  ALCHEMY_FORMULA_ADD,
  ALCHEMY_FORMULA_UPDATE,
  ALCHEMY_FORMULA_REMOVE,
  ALCHEMY_FORMULAS_SET,
  ALCHEMY_BATCH_ADD,
  ALCHEMY_BATCH_UPDATE,
  ALCHEMY_BATCH_REMOVE,
  ALCHEMY_BATCHES_SET,
  ALCHEMY_LABS_SET,
  ALCHEMY_LAB_ADD,
  ALCHEMY_SETTINGS_UPDATE,
  isAlchemyAction,
  type AlchemyAction
} from '../alchemyActions';
import type {
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab
} from '../../../types/campaign';

const mockReagent = (overrides?: Partial<AlchemyReagent>): AlchemyReagent => ({
  id: 'reagent-1',
  name: 'Mandrake Root',
  quantity: 3,
  ...overrides
});

const mockFormula = (overrides?: Partial<AlchemyFormula>): AlchemyFormula =>
  ({
    id: 'formula-1',
    name: 'Healing Tonic',
    ...overrides
  }) as AlchemyFormula;

const mockBatch = (overrides?: Partial<AlchemyBatch>): AlchemyBatch =>
  ({
    id: 'batch-1',
    formulaId: 'formula-1',
    ...overrides
  }) as AlchemyBatch;

const mockLab = (overrides?: Partial<AlchemyLab>): AlchemyLab =>
  ({
    id: 'lab-1',
    name: 'Home Lab',
    ...overrides
  }) as AlchemyLab;

describe('alchemyActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(ALCHEMY_REAGENT_ADD).toBe('addAlchemyReagent');
      expect(ALCHEMY_REAGENT_UPDATE).toBe('updateAlchemyReagent');
      expect(ALCHEMY_REAGENT_REMOVE).toBe('removeAlchemyReagent');
      expect(ALCHEMY_REAGENTS_SET).toBe('setAlchemyReagents');
      expect(ALCHEMY_FORMULA_ADD).toBe('addAlchemyFormula');
      expect(ALCHEMY_FORMULA_UPDATE).toBe('updateAlchemyFormula');
      expect(ALCHEMY_FORMULA_REMOVE).toBe('removeAlchemyFormula');
      expect(ALCHEMY_FORMULAS_SET).toBe('setAlchemyFormulas');
      expect(ALCHEMY_BATCH_ADD).toBe('addAlchemyBatch');
      expect(ALCHEMY_BATCH_UPDATE).toBe('updateAlchemyBatch');
      expect(ALCHEMY_BATCH_REMOVE).toBe('removeAlchemyBatch');
      expect(ALCHEMY_BATCHES_SET).toBe('setAlchemyBatches');
      expect(ALCHEMY_LABS_SET).toBe('setAlchemyLabs');
      expect(ALCHEMY_LAB_ADD).toBe('addAlchemyLab');
      expect(ALCHEMY_SETTINGS_UPDATE).toBe('updateAlchemySettings');
    });

    it('constants are all unique', () => {
      const values = [
        ALCHEMY_REAGENT_ADD,
        ALCHEMY_REAGENT_UPDATE,
        ALCHEMY_REAGENT_REMOVE,
        ALCHEMY_REAGENTS_SET,
        ALCHEMY_FORMULA_ADD,
        ALCHEMY_FORMULA_UPDATE,
        ALCHEMY_FORMULA_REMOVE,
        ALCHEMY_FORMULAS_SET,
        ALCHEMY_BATCH_ADD,
        ALCHEMY_BATCH_UPDATE,
        ALCHEMY_BATCH_REMOVE,
        ALCHEMY_BATCHES_SET,
        ALCHEMY_LABS_SET,
        ALCHEMY_LAB_ADD,
        ALCHEMY_SETTINGS_UPDATE
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isAlchemyAction', () => {
    it('returns true for reagent actions', () => {
      const add: AlchemyAction = { type: ALCHEMY_REAGENT_ADD, payload: mockReagent() };
      const update: AlchemyAction = {
        type: ALCHEMY_REAGENT_UPDATE,
        payload: { id: 'reagent-1', changes: { quantity: 7 } }
      };
      const remove: AlchemyAction = { type: ALCHEMY_REAGENT_REMOVE, payload: 'reagent-1' };
      const set: AlchemyAction = {
        type: ALCHEMY_REAGENTS_SET,
        payload: { 'reagent-1': mockReagent() }
      };
      expect(isAlchemyAction(add)).toBe(true);
      expect(isAlchemyAction(update)).toBe(true);
      expect(isAlchemyAction(remove)).toBe(true);
      expect(isAlchemyAction(set)).toBe(true);
    });

    it('returns true for formula actions', () => {
      const add: AlchemyAction = { type: ALCHEMY_FORMULA_ADD, payload: mockFormula() };
      const update: AlchemyAction = {
        type: ALCHEMY_FORMULA_UPDATE,
        payload: { id: 'formula-1', changes: { name: 'Renamed' } }
      };
      const remove: AlchemyAction = { type: ALCHEMY_FORMULA_REMOVE, payload: 'formula-1' };
      const set: AlchemyAction = {
        type: ALCHEMY_FORMULAS_SET,
        payload: { 'formula-1': mockFormula() }
      };
      expect(isAlchemyAction(add)).toBe(true);
      expect(isAlchemyAction(update)).toBe(true);
      expect(isAlchemyAction(remove)).toBe(true);
      expect(isAlchemyAction(set)).toBe(true);
    });

    it('returns true for batch actions', () => {
      const add: AlchemyAction = { type: ALCHEMY_BATCH_ADD, payload: mockBatch() };
      const update: AlchemyAction = {
        type: ALCHEMY_BATCH_UPDATE,
        payload: { id: 'batch-1', changes: {} }
      };
      const remove: AlchemyAction = { type: ALCHEMY_BATCH_REMOVE, payload: 'batch-1' };
      const set: AlchemyAction = {
        type: ALCHEMY_BATCHES_SET,
        payload: { 'batch-1': mockBatch() }
      };
      expect(isAlchemyAction(add)).toBe(true);
      expect(isAlchemyAction(update)).toBe(true);
      expect(isAlchemyAction(remove)).toBe(true);
      expect(isAlchemyAction(set)).toBe(true);
    });

    it('returns true for lab actions', () => {
      const set: AlchemyAction = {
        type: ALCHEMY_LABS_SET,
        payload: { 'lab-1': mockLab() }
      };
      const add: AlchemyAction = { type: ALCHEMY_LAB_ADD, payload: mockLab() };
      expect(isAlchemyAction(set)).toBe(true);
      expect(isAlchemyAction(add)).toBe(true);
    });

    it('returns true for settings update action', () => {
      const action: AlchemyAction = {
        type: ALCHEMY_SETTINGS_UPDATE,
        payload: {}
      };
      expect(isAlchemyAction(action)).toBe(true);
    });

    it('returns false for unrelated action types', () => {
      expect(isAlchemyAction({ type: 'addCharacter' })).toBe(false);
      expect(isAlchemyAction({ type: 'startCombat' })).toBe(false);
      expect(isAlchemyAction({ type: 'addCraftingProject' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isAlchemyAction({ type: '' })).toBe(false);
    });

    it('returns false for substrings of alchemy action names', () => {
      expect(isAlchemyAction({ type: 'addAlchemy' })).toBe(false);
      expect(isAlchemyAction({ type: 'Alchemy' })).toBe(false);
      expect(isAlchemyAction({ type: 'reagent' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: ALCHEMY_REAGENT_ADD,
        payload: mockReagent()
      };
      if (isAlchemyAction(unknownAction)) {
        expect([
          ALCHEMY_REAGENT_ADD,
          ALCHEMY_REAGENT_UPDATE,
          ALCHEMY_REAGENT_REMOVE,
          ALCHEMY_REAGENTS_SET,
          ALCHEMY_FORMULA_ADD,
          ALCHEMY_FORMULA_UPDATE,
          ALCHEMY_FORMULA_REMOVE,
          ALCHEMY_FORMULAS_SET,
          ALCHEMY_BATCH_ADD,
          ALCHEMY_BATCH_UPDATE,
          ALCHEMY_BATCH_REMOVE,
          ALCHEMY_BATCHES_SET,
          ALCHEMY_LABS_SET,
          ALCHEMY_LAB_ADD,
          ALCHEMY_SETTINGS_UPDATE
        ]).toContain(unknownAction.type);
      } else {
        throw new Error('expected type guard to accept ALCHEMY_REAGENT_ADD');
      }
    });
  });
});
