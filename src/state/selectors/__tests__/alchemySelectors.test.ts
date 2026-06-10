import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  AlchemyBatch,
  AlchemyFormula,
  AlchemyLab,
  AlchemyReagent,
} from '../../../types/campaign';
import {
  selectAlchemyReagentsRecord,
  selectAllAlchemyReagents,
  selectAlchemyReagentById,
  selectAlchemyReagentCount,
  selectAlchemyFormulasRecord,
  selectAllAlchemyFormulas,
  selectAlchemyFormulaById,
  selectAlchemyFormulaCount,
  selectAlchemyBatchesRecord,
  selectAllAlchemyBatches,
  selectAlchemyBatchById,
  selectActiveAlchemyBatchId,
  selectActiveAlchemyBatch,
  selectAlchemyBatchCount,
  selectAlchemyLabsRecord,
  selectAllAlchemyLabs,
  selectAlchemyLabById,
  selectDefaultAlchemyLab,
  selectAlchemySettings,
  selectDefaultLabRating,
  selectWorkBlockMinutes,
} from '../alchemySelectors';

const reagentA: AlchemyReagent = { id: 'r1', name: 'Sulfur', quantity: 5 };
const reagentB: AlchemyReagent = { id: 'r2', name: 'Mercury', quantity: 3 };
const formulaA: AlchemyFormula = {
  id: 'f1',
  name: 'Healing Draught',
} as AlchemyFormula;
const batchA: AlchemyBatch = {
  id: 'b1',
  formulaId: 'f1',
  status: 'brewing',
  worker: 'Alice',
  startDate: '2026-01-01',
  startDay: 1,
} as AlchemyBatch;
const customLab: AlchemyLab = {
  id: 'lab-2',
  name: 'Master Lab',
  rating: 3,
  description: 'High-end',
};

function buildState(overrides: Partial<CampaignState['entities']> = {}): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: {
      ...base.entities,
      alchemyReagents: { r1: reagentA, r2: reagentB },
      alchemyFormulas: { f1: formulaA },
      alchemyBatches: { b1: batchA },
      alchemyLabs: { ...base.entities.alchemyLabs, 'lab-2': customLab },
      alchemySettings: { defaultLabRating: 2, workBlockMinutes: 60 },
      ...overrides,
    },
    alchemy: { activeBatch: 'b1' },
  };
}

describe('alchemySelectors — reagents', () => {
  it('returns reagent record and array', () => {
    const state = buildState();
    expect(selectAlchemyReagentsRecord(state)).toEqual({ r1: reagentA, r2: reagentB });
    expect(selectAllAlchemyReagents(state)).toEqual([reagentA, reagentB]);
  });

  it('selects reagent by id and returns undefined for missing', () => {
    const state = buildState();
    expect(selectAlchemyReagentById(state, 'r1')).toEqual(reagentA);
    expect(selectAlchemyReagentById(state, 'missing')).toBeUndefined();
  });

  it('returns reagent count', () => {
    expect(selectAlchemyReagentCount(buildState())).toBe(2);
    expect(selectAlchemyReagentCount(initialCampaignState)).toBe(0);
  });
});

describe('alchemySelectors — formulas', () => {
  it('returns formula record and array', () => {
    const state = buildState();
    expect(selectAlchemyFormulasRecord(state)).toEqual({ f1: formulaA });
    expect(selectAllAlchemyFormulas(state)).toEqual([formulaA]);
  });

  it('selects formula by id', () => {
    const state = buildState();
    expect(selectAlchemyFormulaById(state, 'f1')).toEqual(formulaA);
    expect(selectAlchemyFormulaById(state, 'missing')).toBeUndefined();
  });

  it('returns formula count', () => {
    expect(selectAlchemyFormulaCount(buildState())).toBe(1);
    expect(selectAlchemyFormulaCount(initialCampaignState)).toBe(0);
  });
});

describe('alchemySelectors — batches', () => {
  it('returns batch record and array', () => {
    const state = buildState();
    expect(selectAlchemyBatchesRecord(state)).toEqual({ b1: batchA });
    expect(selectAllAlchemyBatches(state)).toEqual([batchA]);
  });

  it('selects batch by id', () => {
    const state = buildState();
    expect(selectAlchemyBatchById(state, 'b1')).toEqual(batchA);
    expect(selectAlchemyBatchById(state, 'missing')).toBeUndefined();
  });

  it('selects active batch id and active batch', () => {
    const state = buildState();
    expect(selectActiveAlchemyBatchId(state)).toBe('b1');
    expect(selectActiveAlchemyBatch(state)).toEqual(batchA);
  });

  it('returns undefined active batch when none set', () => {
    const state: CampaignState = { ...buildState(), alchemy: { activeBatch: null } };
    expect(selectActiveAlchemyBatchId(state)).toBeNull();
    expect(selectActiveAlchemyBatch(state)).toBeUndefined();
  });

  it('returns batch count', () => {
    expect(selectAlchemyBatchCount(buildState())).toBe(1);
    expect(selectAlchemyBatchCount(initialCampaignState)).toBe(0);
  });
});

describe('alchemySelectors — labs', () => {
  it('returns lab record and array including default seed', () => {
    const state = buildState();
    const record = selectAlchemyLabsRecord(state);
    expect(record['default']).toBeDefined();
    expect(record['lab-2']).toEqual(customLab);
    expect(selectAllAlchemyLabs(state)).toHaveLength(2);
  });

  it('selects lab by id', () => {
    const state = buildState();
    expect(selectAlchemyLabById(state, 'lab-2')).toEqual(customLab);
    expect(selectAlchemyLabById(state, 'missing')).toBeUndefined();
  });

  it('selects the default lab', () => {
    const lab = selectDefaultAlchemyLab(initialCampaignState);
    expect(lab).toBeDefined();
    expect(lab?.id).toBe('default');
  });
});

describe('alchemySelectors — settings', () => {
  it('returns settings object', () => {
    expect(selectAlchemySettings(buildState())).toEqual({
      defaultLabRating: 2,
      workBlockMinutes: 60,
    });
  });

  it('returns individual setting values', () => {
    const state = buildState();
    expect(selectDefaultLabRating(state)).toBe(2);
    expect(selectWorkBlockMinutes(state)).toBe(60);
  });

  it('returns initial setting values from empty state', () => {
    expect(selectDefaultLabRating(initialCampaignState)).toBe(0);
    expect(selectWorkBlockMinutes(initialCampaignState)).toBe(120);
  });
});
