import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleAlchemyAction } from '../alchemyReducer';
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
  type AlchemyAction
} from '../alchemyActions';
import type { CampaignState } from '../../campaignReducer';
import type {
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  AlchemySettings
} from '../../../types/campaign';

const createReagent = (overrides?: Partial<AlchemyReagent>): AlchemyReagent => ({
  id: 'reagent-1',
  name: 'Moonpetal',
  quantity: 5,
  ...overrides
});

const createFormula = (overrides?: Partial<AlchemyFormula>): AlchemyFormula => ({
  id: 'formula-1',
  name: 'Healing Draught',
  ...overrides
});

const createBatch = (overrides?: Partial<AlchemyBatch>): AlchemyBatch => ({
  id: 'batch-1',
  formulaId: 'formula-1',
  status: 'brewing',
  worker: 'Alice',
  startDate: '2026-01-01',
  startDay: 1,
  ...overrides
});

const createLab = (overrides?: Partial<AlchemyLab>): AlchemyLab => ({
  id: 'lab-1',
  name: 'Basement Lab',
  rating: 2,
  description: 'A cramped basement workspace',
  ...overrides
});

const createSettings = (overrides?: Partial<AlchemySettings>): AlchemySettings => ({
  defaultLabRating: 0,
  workBlockMinutes: 60,
  ...overrides
});

const createMinimalCampaignState = (): CampaignState => (({
  entities: {
    alchemyReagents: {},
    alchemyFormulas: {},
    alchemyBatches: {},
    alchemyLabs: {},
    alchemySettings: createSettings()
  }
} as unknown)) as CampaignState;

function applyAction(state: CampaignState, action: AlchemyAction): CampaignState {
  return produce(state, draft => {
    handleAlchemyAction(draft, action);
  });
}

describe('alchemyReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('reagents', () => {
    it('ALCHEMY_REAGENT_ADD adds a reagent', () => {
      const reagent = createReagent();
      const next = applyAction(state, { type: ALCHEMY_REAGENT_ADD, payload: reagent });
      expect(next.entities.alchemyReagents['reagent-1']).toEqual(reagent);
    });

    it('ALCHEMY_REAGENT_UPDATE merges changes into an existing reagent', () => {
      state = applyAction(state, { type: ALCHEMY_REAGENT_ADD, payload: createReagent() });
      const next = applyAction(state, {
        type: ALCHEMY_REAGENT_UPDATE,
        payload: { id: 'reagent-1', changes: { quantity: 12, potency: 3 } }
      });
      expect(next.entities.alchemyReagents['reagent-1'].quantity).toBe(12);
      expect(next.entities.alchemyReagents['reagent-1'].potency).toBe(3);
      expect(next.entities.alchemyReagents['reagent-1'].name).toBe('Moonpetal');
    });

    it('ALCHEMY_REAGENT_UPDATE is a no-op when the reagent does not exist', () => {
      const next = applyAction(state, {
        type: ALCHEMY_REAGENT_UPDATE,
        payload: { id: 'missing', changes: { quantity: 99 } }
      });
      expect(next.entities.alchemyReagents['missing']).toBeUndefined();
    });

    it('ALCHEMY_REAGENT_REMOVE deletes the reagent', () => {
      state = applyAction(state, { type: ALCHEMY_REAGENT_ADD, payload: createReagent() });
      const next = applyAction(state, { type: ALCHEMY_REAGENT_REMOVE, payload: 'reagent-1' });
      expect(next.entities.alchemyReagents['reagent-1']).toBeUndefined();
    });

    it('ALCHEMY_REAGENTS_SET replaces the entire reagent map', () => {
      state = applyAction(state, { type: ALCHEMY_REAGENT_ADD, payload: createReagent() });
      const replacement = { 'reagent-2': createReagent({ id: 'reagent-2', name: 'Sunbloom' }) };
      const next = applyAction(state, { type: ALCHEMY_REAGENTS_SET, payload: replacement });
      expect(next.entities.alchemyReagents).toEqual(replacement);
      expect(next.entities.alchemyReagents['reagent-1']).toBeUndefined();
    });
  });

  describe('formulas', () => {
    it('ALCHEMY_FORMULA_ADD adds a formula', () => {
      const formula = createFormula();
      const next = applyAction(state, { type: ALCHEMY_FORMULA_ADD, payload: formula });
      expect(next.entities.alchemyFormulas['formula-1']).toEqual(formula);
    });

    it('ALCHEMY_FORMULA_UPDATE merges changes into an existing formula', () => {
      state = applyAction(state, { type: ALCHEMY_FORMULA_ADD, payload: createFormula() });
      const next = applyAction(state, {
        type: ALCHEMY_FORMULA_UPDATE,
        payload: { id: 'formula-1', changes: { difficulty: 14, brewTime: 120 } }
      });
      expect(next.entities.alchemyFormulas['formula-1'].difficulty).toBe(14);
      expect(next.entities.alchemyFormulas['formula-1'].brewTime).toBe(120);
    });

    it('ALCHEMY_FORMULA_UPDATE is a no-op when the formula does not exist', () => {
      const next = applyAction(state, {
        type: ALCHEMY_FORMULA_UPDATE,
        payload: { id: 'missing', changes: { difficulty: 14 } }
      });
      expect(next.entities.alchemyFormulas['missing']).toBeUndefined();
    });

    it('ALCHEMY_FORMULA_REMOVE deletes the formula', () => {
      state = applyAction(state, { type: ALCHEMY_FORMULA_ADD, payload: createFormula() });
      const next = applyAction(state, { type: ALCHEMY_FORMULA_REMOVE, payload: 'formula-1' });
      expect(next.entities.alchemyFormulas['formula-1']).toBeUndefined();
    });

    it('ALCHEMY_FORMULAS_SET replaces the entire formula map', () => {
      const replacement = { 'formula-2': createFormula({ id: 'formula-2', name: 'Antidote' }) };
      const next = applyAction(state, { type: ALCHEMY_FORMULAS_SET, payload: replacement });
      expect(next.entities.alchemyFormulas).toEqual(replacement);
    });
  });

  describe('batches', () => {
    it('ALCHEMY_BATCH_ADD adds a batch', () => {
      const batch = createBatch();
      const next = applyAction(state, { type: ALCHEMY_BATCH_ADD, payload: batch });
      expect(next.entities.alchemyBatches['batch-1']).toEqual(batch);
    });

    it('ALCHEMY_BATCH_UPDATE merges changes into an existing batch', () => {
      state = applyAction(state, { type: ALCHEMY_BATCH_ADD, payload: createBatch() });
      const next = applyAction(state, {
        type: ALCHEMY_BATCH_UPDATE,
        payload: { id: 'batch-1', changes: { status: 'complete', resultingPotions: 3 } }
      });
      expect(next.entities.alchemyBatches['batch-1'].status).toBe('complete');
      expect(next.entities.alchemyBatches['batch-1'].resultingPotions).toBe(3);
      expect(next.entities.alchemyBatches['batch-1'].worker).toBe('Alice');
    });

    it('ALCHEMY_BATCH_UPDATE is a no-op when the batch does not exist', () => {
      const next = applyAction(state, {
        type: ALCHEMY_BATCH_UPDATE,
        payload: { id: 'missing', changes: { status: 'complete' } }
      });
      expect(next.entities.alchemyBatches['missing']).toBeUndefined();
    });

    it('ALCHEMY_BATCH_REMOVE deletes the batch', () => {
      state = applyAction(state, { type: ALCHEMY_BATCH_ADD, payload: createBatch() });
      const next = applyAction(state, { type: ALCHEMY_BATCH_REMOVE, payload: 'batch-1' });
      expect(next.entities.alchemyBatches['batch-1']).toBeUndefined();
    });

    it('ALCHEMY_BATCHES_SET replaces the entire batch map', () => {
      const replacement = { 'batch-2': createBatch({ id: 'batch-2' }) };
      const next = applyAction(state, { type: ALCHEMY_BATCHES_SET, payload: replacement });
      expect(next.entities.alchemyBatches).toEqual(replacement);
    });
  });

  describe('labs', () => {
    it('ALCHEMY_LAB_ADD adds a lab', () => {
      const lab = createLab();
      const next = applyAction(state, { type: ALCHEMY_LAB_ADD, payload: lab });
      expect(next.entities.alchemyLabs['lab-1']).toEqual(lab);
    });

    it('ALCHEMY_LABS_SET replaces the entire lab map', () => {
      state = applyAction(state, { type: ALCHEMY_LAB_ADD, payload: createLab() });
      const replacement = { 'lab-2': createLab({ id: 'lab-2', name: 'Tower Workshop' }) };
      const next = applyAction(state, { type: ALCHEMY_LABS_SET, payload: replacement });
      expect(next.entities.alchemyLabs).toEqual(replacement);
      expect(next.entities.alchemyLabs['lab-1']).toBeUndefined();
    });
  });

  describe('settings', () => {
    it('ALCHEMY_SETTINGS_UPDATE merges changes into existing settings', () => {
      const next = applyAction(state, {
        type: ALCHEMY_SETTINGS_UPDATE,
        payload: { defaultLabRating: 3, autoSaveRecipes: true }
      });
      expect(next.entities.alchemySettings.defaultLabRating).toBe(3);
      expect(next.entities.alchemySettings.autoSaveRecipes).toBe(true);
      expect(next.entities.alchemySettings.workBlockMinutes).toBe(60);
    });
  });

  describe('action handling', () => {
    it('returns true for handled alchemy actions', () => {
      const draft = createMinimalCampaignState();
      const handled = handleAlchemyAction(draft, {
        type: ALCHEMY_REAGENT_ADD,
        payload: createReagent()
      });
      expect(handled).toBe(true);
    });

    it('returns false for unknown action types', () => {
      const draft = createMinimalCampaignState();
      const handled = handleAlchemyAction(draft, { type: 'unknown' } as unknown as AlchemyAction);
      expect(handled).toBe(false);
    });
  });
});
