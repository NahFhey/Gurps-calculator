import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../../state/campaignReducer';
import type {
  AlchemyBatch,
  AlchemyFormula,
  AlchemyLab,
  AlchemyReagent,
  AlchemySettings,
  Character,
} from '../../types/campaign';

interface MockWeatherResult {
  hasEffect: boolean;
  effectDescription: string;
  locationName: string | null;
}

interface MockAlchemyEntities {
  alchemyReagents: Record<string, AlchemyReagent>;
  alchemyFormulas: Record<string, AlchemyFormula>;
  alchemyBatches: Record<string, AlchemyBatch>;
  alchemyLabs: Record<string, AlchemyLab>;
  alchemySettings: AlchemySettings;
  characters: Record<string, Character>;
}

function createMockActions() {
  return {
    setAlchemyReagents:
      vi.fn<(value: Record<string, AlchemyReagent>) => void>(),
    setAlchemyFormulas:
      vi.fn<(value: Record<string, AlchemyFormula>) => void>(),
    setAlchemyBatches:
      vi.fn<(value: Record<string, AlchemyBatch>) => void>(),
    addLogEntry: vi.fn<(entry: LogEntry) => void>(),
  };
}

interface MockCampaignStoreValue {
  state: { entities: MockAlchemyEntities };
  actions: ReturnType<typeof createMockActions>;
}

const useCampaignStoreMock = vi.hoisted(
  () => vi.fn<() => MockCampaignStoreValue>(),
);
const useWeatherModifiersMock = vi.hoisted(
  () => vi.fn<(activity: string) => MockWeatherResult>(),
);

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: useCampaignStoreMock,
}));

vi.mock('../useWeatherModifiers', () => ({
  useWeatherModifiers: useWeatherModifiersMock,
}));

import { useAlchemyData } from '../useAlchemyData';

type LegacyAlchemyBatch = Omit<AlchemyBatch, 'status' | 'phase'> & {
  phase: 'brewing' | 'completed' | 'failed';
};

function makeReagent(
  overrides: Partial<AlchemyReagent> = {},
): AlchemyReagent {
  return {
    id: 'reagent-1',
    name: 'Mandrake',
    quantity: 3,
    ...overrides,
  };
}

function makeFormula(
  overrides: Partial<AlchemyFormula> = {},
): AlchemyFormula {
  return {
    id: 'formula-1',
    name: 'Healing Draught',
    ...overrides,
  };
}

function makeBatch(overrides: Partial<AlchemyBatch> = {}): AlchemyBatch {
  return {
    id: 'batch-1',
    formulaId: 'formula-1',
    formulaName: 'Healing Draught',
    status: 'brewing',
    worker: 'Alchemist',
    startDate: '2026-07-27',
    startDay: 1,
    ...overrides,
  };
}

function makeLegacyBatch(
  overrides: Partial<LegacyAlchemyBatch> = {},
): LegacyAlchemyBatch {
  return {
    id: 'batch-legacy',
    formulaId: 'formula-1',
    formulaName: 'Healing Draught',
    phase: 'brewing',
    worker: 'Alchemist',
    startDate: '2026-07-27',
    startDay: 1,
    ...overrides,
  };
}

function makeLab(overrides: Partial<AlchemyLab> = {}): AlchemyLab {
  return {
    id: 'lab-1',
    name: 'Tower Lab',
    rating: 2,
    description: 'Well equipped',
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Alchemist',
    work: { enabled: true, skills: { alchemy: 15 } },
    st: 9,
    ...overrides,
  };
}

function makeEntities(
  overrides: Partial<MockAlchemyEntities> = {},
): MockAlchemyEntities {
  return {
    alchemyReagents: {},
    alchemyFormulas: {},
    alchemyBatches: {},
    alchemyLabs: {},
    alchemySettings: { defaultLabRating: 0, workBlockMinutes: 120 },
    characters: {},
    ...overrides,
  };
}

const weather: MockWeatherResult = {
  hasEffect: true,
  effectDescription: 'Dry air (+1 to alchemy)',
  locationName: 'Tower',
};

describe('useAlchemyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWeatherModifiersMock.mockReturnValue(weather);
  });

  it('denormalizes data, maps batch phases, derives workers, and exposes weather', () => {
    const reagent = makeReagent();
    const formula = makeFormula();
    const brewing = makeBatch();
    const completed = makeBatch({
      id: 'batch-2',
      status: 'complete',
      completedDate: '2026-07-28',
    });
    const lab = makeLab();
    const worker = makeCharacter();
    const unqualified = makeCharacter({
      id: 'character-2',
      name: 'Cook',
      work: { enabled: true, skills: { cooking: 13 } },
    });
    const settings: AlchemySettings = {
      defaultLabRating: 2,
      workBlockMinutes: 60,
    };
    const actions = createMockActions();

    useCampaignStoreMock.mockReturnValue({
      state: {
        entities: makeEntities({
          alchemyReagents: { [reagent.id]: reagent },
          alchemyFormulas: { [formula.id]: formula },
          alchemyBatches: {
            [brewing.id]: brewing,
            [completed.id]: completed,
          },
          alchemyLabs: { [lab.id]: lab },
          alchemySettings: settings,
          characters: {
            [worker.id]: worker,
            [unqualified.id]: unqualified,
          },
        }),
      },
      actions,
    });

    const { result } = renderHook(() => useAlchemyData());

    expect(result.current.reagents).toEqual([reagent]);
    expect(result.current.formulas).toEqual([formula]);
    expect(result.current.batches.map((batch) => batch.phase)).toEqual([
      'brewing',
      'completed',
    ]);
    expect(result.current.labs).toEqual([lab]);
    expect(result.current.workers).toEqual([
      { id: worker.id, name: worker.name, skills: { alchemy: 15 }, st: 9 },
    ]);
    expect(result.current.alchemySettings).toBe(settings);
    expect(result.current.activeCount).toBe(1);
    expect(result.current.weather).toEqual(weather);
    expect(useWeatherModifiersMock).toHaveBeenCalledWith('alchemy');
  });

  it('normalizes saved reagents and formulas, including an empty edge case', () => {
    const actions = createMockActions();
    useCampaignStoreMock.mockReturnValue({
      state: { entities: makeEntities() },
      actions,
    });
    const { result } = renderHook(() => useAlchemyData());
    const reagent = makeReagent();
    const formula = makeFormula();

    act(() => {
      result.current.saveReagents([reagent]);
      result.current.saveFormulas([formula]);
      result.current.saveReagents([]);
    });

    expect(actions.setAlchemyReagents).toHaveBeenNthCalledWith(1, {
      [reagent.id]: reagent,
    });
    expect(actions.setAlchemyFormulas).toHaveBeenCalledWith({
      [formula.id]: formula,
    });
    expect(actions.setAlchemyReagents).toHaveBeenNthCalledWith(2, {});
  });

  it('logs a new brewing batch and maps its legacy phase back to status', () => {
    const actions = createMockActions();
    useCampaignStoreMock.mockReturnValue({
      state: { entities: makeEntities() },
      actions,
    });
    const { result } = renderHook(() => useAlchemyData());
    const batch = makeLegacyBatch();

    act(() => {
      result.current.saveBatches([batch]);
    });

    expect(actions.addLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'alchemy.batch_started' }),
    );
    expect(actions.setAlchemyBatches).toHaveBeenCalledWith({
      [batch.id]: {
        id: batch.id,
        formulaId: batch.formulaId,
        formulaName: batch.formulaName,
        status: 'brewing',
        worker: batch.worker,
        startDate: batch.startDate,
        startDay: batch.startDay,
      },
    });
  });

  it('logs completed and failed transitions with fallback labels and saves canonical statuses', () => {
    const completedSource = makeBatch({
      id: 'batch-complete',
      formulaName: undefined,
    });
    const failedSource = makeBatch({
      id: 'batch-failed',
      formulaName: 'Volatile Tonic',
    });
    const actions = createMockActions();
    useCampaignStoreMock.mockReturnValue({
      state: {
        entities: makeEntities({
          alchemyBatches: {
            [completedSource.id]: completedSource,
            [failedSource.id]: failedSource,
          },
          characters: {
            novice: makeCharacter({
              id: 'novice',
              work: { enabled: true, skills: { alchemy: 0 } },
            }),
          },
        }),
      },
      actions,
    });
    const { result } = renderHook(() => useAlchemyData());
    const completed = makeLegacyBatch({
      id: completedSource.id,
      formulaName: undefined,
      phase: 'completed',
    });
    const failed = makeLegacyBatch({
      id: failedSource.id,
      formulaName: failedSource.formulaName,
      phase: 'failed',
    });

    act(() => {
      result.current.saveBatches([completed, failed]);
    });

    expect(result.current.workers).toEqual([]);
    expect(actions.addLogEntry).toHaveBeenCalledTimes(2);
    expect(actions.addLogEntry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'alchemy.batch_completed',
        payload: expect.objectContaining({
          message: 'Completed "Unknown" with Unknown quality',
        }),
      }),
    );
    expect(actions.addLogEntry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'alchemy.batch_failed' }),
    );
    expect(actions.setAlchemyBatches).toHaveBeenCalledWith({
      [completed.id]: expect.objectContaining({ status: 'complete' }),
      [failed.id]: expect.objectContaining({ status: 'failed' }),
    });
  });
});
