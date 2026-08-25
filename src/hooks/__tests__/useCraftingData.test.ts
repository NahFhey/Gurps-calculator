import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../../state/campaignReducer';
import type {
  Character,
  Craft,
  CraftDesign,
  CustomTemplates,
  Material,
  MaterialType,
  Inventory,
} from '../../types/campaign';

interface MockWeatherResult {
  hasEffect: boolean;
  effectDescription: string;
  locationName: string | null;
  skillBonus: number;
}

interface MockCraftingEntities {
  inventories: Record<string, Inventory>;
  materialTypes?: MaterialType[];
  crafts: Record<string, Craft>;
  craftDesigns: Record<string, CraftDesign>;
  customTemplates?: CustomTemplates;
  characters: Record<string, Character>;
}

function createMockActions() {
  return {
    addMaterial: vi.fn<(value: Material) => void>(),
    updateMaterial: vi.fn<(id: string, value: Partial<Material>) => void>(),
    removeMaterial: vi.fn<(id: string) => void>(),
    setCrafts: vi.fn<(value: Record<string, Craft>) => void>(),
    setCraftDesigns: vi.fn<(value: Record<string, CraftDesign>) => void>(),
    addLogEntry: vi.fn<(entry: LogEntry) => void>(),
  };
}

interface MockCampaignStoreValue {
  state: { entities: MockCraftingEntities };
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

import { useCraftingData } from '../useCraftingData';

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'material-1',
    name: 'Iron',
    type: 'metal',
    quantity: 4,
    ...overrides,
  };
}

function makeCraft(overrides: Partial<Craft> = {}): Craft {
  return {
    id: 'craft-1',
    phase: 'craft',
    templateType: 'weapons',
    template: 'Broadsword',
    quality: 'good',
    currentQuality: 'good',
    mods: [],
    selectedMaterials: [],
    shifts: [],
    startDate: '2026-07-27',
    startDay: 1,
    ...overrides,
  };
}

function makeDesign(overrides: Partial<CraftDesign> = {}): CraftDesign {
  return {
    id: 'design-1',
    name: 'Balanced Blade',
    templateType: 'weapons',
    template: 'Broadsword',
    quality: 'fine',
    mods: [],
    selectedMaterials: [],
    savedDate: '2026-07-27',
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Artificer',
    work: { enabled: true, skills: { crafting: 14 } },
    st: 11,
    ...overrides,
  };
}

function makeEntities(
  overrides: Partial<MockCraftingEntities> = {},
): MockCraftingEntities {
  return {
    inventories: {
      party: {
        id: 'party', ownerType: 'party', ownerId: null, currency: {}, items: [], tools: [],
        materials: [], food: [],
      },
    },
    materialTypes: [],
    crafts: {},
    craftDesigns: {},
    customTemplates: {
      weapons: {},
      armor: {},
      ranged: {},
      explosives: {},
    },
    characters: {},
    ...overrides,
  };
}

const weather: MockWeatherResult = {
  hasEffect: true,
  effectDescription: 'Driving rain (-2 to crafting)',
  locationName: 'Forest Camp',
  skillBonus: -2,
};

describe('useCraftingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWeatherModifiersMock.mockReturnValue(weather);
  });

  it('denormalizes crafting data, derives qualified workers, counts projects, and exposes weather', () => {
    const material = makeMaterial();
    const materialType: MaterialType = {
      name: 'metal',
      difficulty: 0,
      effects: '',
      ht: 12,
      drShift: 0,
      weightMod: 0,
      hpMod: 0,
    };
    const activeCraft = makeCraft();
    const completedCraft = makeCraft({ id: 'craft-2', completed: true });
    const design = makeDesign();
    const worker = makeCharacter();
    const unqualified = makeCharacter({
      id: 'character-2',
      name: 'Observer',
      work: { enabled: true, skills: { cooking: 12 } },
    });
    const actions = createMockActions();

    useCampaignStoreMock.mockReturnValue({
      state: {
        entities: makeEntities({
          inventories: {
            party: {
              id: 'party', ownerType: 'party', ownerId: null, currency: {}, items: [], tools: [],
              materials: [material], food: [],
            },
          },
          materialTypes: [materialType],
          crafts: {
            [activeCraft.id]: activeCraft,
            [completedCraft.id]: completedCraft,
          },
          craftDesigns: { [design.id]: design },
          characters: {
            [worker.id]: worker,
            [unqualified.id]: unqualified,
          },
        }),
      },
      actions,
    });

    const { result } = renderHook(() => useCraftingData());

    expect(result.current.materials).toEqual([material]);
    expect(result.current.materialTypes).toEqual([materialType]);
    expect(result.current.crafts).toEqual([activeCraft, completedCraft]);
    expect(result.current.craftDesigns).toEqual([design]);
    expect(result.current.workers).toEqual([
      { id: worker.id, name: worker.name, skills: { crafting: 14 }, st: 11 },
    ]);
    expect(result.current.activeCraftCount).toBe(1);
    expect(result.current.designCount).toBe(1);
    expect(result.current.weather).toEqual(weather);
    expect(useWeatherModifiersMock).toHaveBeenCalledWith('crafting');
  });

  it('falls back to empty optional configuration and excludes zero-level workers', () => {
    const actions = createMockActions();
    const zeroSkillWorker = makeCharacter({
      work: { enabled: true, skills: { designing: 0 } },
    });

    useCampaignStoreMock.mockReturnValue({
      state: {
        entities: makeEntities({
          materialTypes: undefined,
          customTemplates: undefined,
          characters: { [zeroSkillWorker.id]: zeroSkillWorker },
        }),
      },
      actions,
    });

    const { result } = renderHook(() => useCraftingData());

    expect(result.current.materialTypes).toEqual([]);
    expect(result.current.customTemplates).toEqual({
      weapons: {},
      armor: {},
      ranged: {},
      explosives: {},
    });
    expect(result.current.workers).toEqual([]);
    expect(result.current.activeCraftCount).toBe(0);
    expect(result.current.designCount).toBe(0);
  });

  it('normalizes each saved collection and forwards log entries', () => {
    const actions = createMockActions();
    useCampaignStoreMock.mockReturnValue({
      state: { entities: makeEntities() },
      actions,
    });
    const { result } = renderHook(() => useCraftingData());
    const material = makeMaterial();
    const craft = makeCraft();
    const design = makeDesign();
    const logEntry: LogEntry = {
      id: 'log-1',
      timestamp: 1,
      type: 'crafting.work_applied',
      visibility: 'player',
      payload: { message: 'Work applied' },
    };

    act(() => {
      result.current.saveMaterials([material]);
      result.current.saveCrafts([craft]);
      result.current.saveCraftDesigns([design]);
      result.current.addLogEntry(logEntry);
    });

    expect(actions.addMaterial).toHaveBeenCalledWith(material);
    expect(actions.setCrafts).toHaveBeenCalledWith({ [craft.id]: craft });
    expect(actions.setCraftDesigns).toHaveBeenCalledWith({ [design.id]: design });
    expect(actions.addLogEntry).toHaveBeenCalledWith(logEntry);
  });
});
