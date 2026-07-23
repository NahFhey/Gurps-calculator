import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringSession,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
  GatheringDailyEvents,
} from '../../../types/campaign';
import type { ForageZoneProfile, ForageItem, ForagingConfig } from '../../../types/foraging';
import { DEFAULT_FORAGING_CONFIG } from '../../../constants/foraging';
import {
  selectGatheringSpeciesRecord,
  selectAllGatheringSpecies,
  selectGatheringSpeciesById,
  selectGatheringToolsRecord,
  selectAllGatheringTools,
  selectGatheringToolById,
  selectGatheringTablesRecord,
  selectAllGatheringTables,
  selectGatheringTableById,
  selectGatheringEnvironmentsRecord,
  selectAllGatheringEnvironments,
  selectGatheringEnvironmentById,
  selectGatheringSessionsRecord,
  selectAllGatheringSessions,
  selectGatheringSessionById,
  selectActiveGatheringSessionId,
  selectActiveGatheringSession,
  selectGatheringBaitRecord,
  selectAllGatheringBait,
  selectGatheringBaitById,
  selectGatheringCategoriesRecord,
  selectAllGatheringCategories,
  selectGatheringCategoryById,
  selectGatheringItemsRecord,
  selectAllGatheringItems,
  selectGatheringItemById,
  selectGatheringDailyEvents,
  selectForageZoneProfilesRecord,
  selectAllForageZoneProfiles,
  selectForageZoneProfilesForLocation,
  selectForageZoneProfileById,
  selectForageItemsRecord,
  selectAllForageItems,
  selectForageItemsByCategory,
  selectForageItemsByTierAndCategory,
  selectForageItemById,
  selectForagingConfig,
} from '../gatheringSelectors';

const species: GatheringSpecies = {
  id: 'sp1',
  name: 'Trout',
  type: 'fish',
  tags: ['river'],
  foodType: 'fish-meat',
  yieldMeatFormula: '1d',
  secondaryMaterialType: null,
  yieldSecondaryFormula: null,
  secondaryNameOverride: null,
  st: 8,
  specialRules: [],
};

const tool: GatheringTool = {
  id: 't1',
  name: 'Rod',
  toolType: 'rod',
  allowedModes: ['Fishing'],
  allowedMethods: ['angling'],
  bonuses: [{ type: 'skill_bonus', value: 1 }],
  durability: null,
  notes: '',
};

const table: GatheringTable = {
  id: 'tbl1',
  name: 'River Table',
  tableType: 'randomCatch',
  rollMethod: '1d6',
  entries: [
    { id: 'e1', rollValue: 1, resultType: 'species', speciesId: 'sp1', text: 'trout' },
  ],
};

const env1: GatheringEnvironment = {
  id: 'env1',
  name: 'River',
  supportedModes: ['Fishing'],
  defaultsByMode: {
    Fishing: { randomCatchTableId: 'tbl1', mildEventTableId: null, rareEventTableId: null },
  },
  skillMod: 0,
  locationId: 'loc1',
};

const env2: GatheringEnvironment = {
  id: 'env2',
  name: 'Forest',
  supportedModes: ['Foraging'],
  defaultsByMode: {},
  skillMod: 0,
  locationId: 'loc2',
};

const session: GatheringSession = {
  id: 'sess1',
  type: 'fishing',
  worker: 'Alice',
  day: 1,
  slot: 0,
  environmentId: 'env1',
  results: [],
  status: 'pending',
};

const bait: GatheringBait = {
  id: 'b1',
  name: 'Worms',
  consumableType: 'bait',
  baitTags: ['worm'],
  attractsSpeciesIds: ['sp1'],
  quantity: 10,
  rollBonus: 1,
};

const category: GatheringCategory = {
  id: 'cat1',
  name: 'Fish',
  yieldFormula: '1d',
  inventoryKind: 'food',
  typeId: 'fish-meat',
  description: '',
};

const item: GatheringItem = {
  id: 'i1',
  name: 'Trout',
  inventoryKind: 'food',
  typeId: 'fish-meat',
  yieldFormula: '1d',
  rarity: 'common',
  description: '',
};

const dailyEvents: GatheringDailyEvents = {
  '1': { '0': { rolled: true, resultType: 'normal', speciesId: 'sp1', quantity: 2 } },
};

const zoneA: ForageZoneProfile = {
  id: 'z1',
  name: 'Misty Basin',
  locationId: 'loc1',
  commonCategories: [],
  uncommonCategories: [],
  rareCategories: [],
  tags: ['MistyBasin'],
};

const zoneB: ForageZoneProfile = {
  id: 'z2',
  name: 'Old Growth',
  locationId: 'loc2',
  commonCategories: [],
  uncommonCategories: [],
  rareCategories: [],
  tags: [],
};

const apple: ForageItem = {
  id: 'fi1',
  name: 'Apple',
  categoryId: 'fruits',
  tier: 'common',
  yieldFormula: '3d',
  inventoryKind: 'food',
  typeId: 'fruit',
};

const rareApple: ForageItem = {
  id: 'fi2',
  name: 'Goldapple',
  categoryId: 'fruits',
  tier: 'rare',
  yieldFormula: '1d',
  inventoryKind: 'food',
  typeId: 'fruit',
};

const oakLog: ForageItem = {
  id: 'fi3',
  name: 'Wild Carrot',
  categoryId: 'vegetables',
  tier: 'common',
  yieldFormula: '2d',
  inventoryKind: 'food',
  typeId: 'vegetable',
};

const customForagingConfig: ForagingConfig = {
  ...DEFAULT_FORAGING_CONFIG,
};

function buildState(): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: {
      ...base.entities,
      gatheringSpecies: { sp1: species },
      gatheringTools: { t1: tool },
      gatheringTables: { tbl1: table },
      gatheringEnvironments: { env1, env2 },
      gatheringSessions: { sess1: session },
      gatheringDailyEvents: dailyEvents,
      gatheringBait: { b1: bait },
      gatheringCategories: { cat1: category },
      gatheringItems: { i1: item },
      forageZoneProfiles: { z1: zoneA, z2: zoneB },
      forageItems: { fi1: apple, fi2: rareApple, fi3: oakLog },
      foragingConfig: customForagingConfig,
    },
    gathering: { activeSession: 'sess1' },
  };
}

describe('gatheringSelectors — entity records and arrays', () => {
  it('selects species record, array, and by id (missing → undefined)', () => {
    const state = buildState();
    expect(selectGatheringSpeciesRecord(state)).toEqual({ sp1: species });
    expect(selectAllGatheringSpecies(state)).toEqual([species]);
    expect(selectGatheringSpeciesById(state, 'sp1')).toEqual(species);
    expect(selectGatheringSpeciesById(state, 'missing')).toBeUndefined();
  });

  it('selects tools record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringToolsRecord(state)).toEqual({ t1: tool });
    expect(selectAllGatheringTools(state)).toEqual([tool]);
    expect(selectGatheringToolById(state, 't1')).toEqual(tool);
    expect(selectGatheringToolById(state, 'missing')).toBeUndefined();
  });

  it('selects tables record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringTablesRecord(state)).toEqual({ tbl1: table });
    expect(selectAllGatheringTables(state)).toEqual([table]);
    expect(selectGatheringTableById(state, 'tbl1')).toEqual(table);
    expect(selectGatheringTableById(state, 'missing')).toBeUndefined();
  });

  it('selects environments record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringEnvironmentsRecord(state)).toEqual({ env1, env2 });
    expect(selectAllGatheringEnvironments(state)).toHaveLength(2);
    expect(selectGatheringEnvironmentById(state, 'env1')).toEqual(env1);
    expect(selectGatheringEnvironmentById(state, 'missing')).toBeUndefined();
  });

  it('selects bait record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringBaitRecord(state)).toEqual({ b1: bait });
    expect(selectAllGatheringBait(state)).toEqual([bait]);
    expect(selectGatheringBaitById(state, 'b1')).toEqual(bait);
    expect(selectGatheringBaitById(state, 'missing')).toBeUndefined();
  });

  it('selects categories record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringCategoriesRecord(state)).toEqual({ cat1: category });
    expect(selectAllGatheringCategories(state)).toEqual([category]);
    expect(selectGatheringCategoryById(state, 'cat1')).toEqual(category);
    expect(selectGatheringCategoryById(state, 'missing')).toBeUndefined();
  });

  it('selects items record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringItemsRecord(state)).toEqual({ i1: item });
    expect(selectAllGatheringItems(state)).toEqual([item]);
    expect(selectGatheringItemById(state, 'i1')).toEqual(item);
    expect(selectGatheringItemById(state, 'missing')).toBeUndefined();
  });

  it('returns empty arrays on initial state', () => {
    expect(selectAllGatheringSpecies(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringTools(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringTables(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringEnvironments(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringBait(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringCategories(initialCampaignState)).toEqual([]);
    expect(selectAllGatheringItems(initialCampaignState)).toEqual([]);
  });
});

describe('gatheringSelectors — sessions and UI state', () => {
  it('selects sessions record, array, and by id', () => {
    const state = buildState();
    expect(selectGatheringSessionsRecord(state)).toEqual({ sess1: session });
    expect(selectAllGatheringSessions(state)).toEqual([session]);
    expect(selectGatheringSessionById(state, 'sess1')).toEqual(session);
    expect(selectGatheringSessionById(state, 'missing')).toBeUndefined();
  });

  it('returns active session id and resolved session', () => {
    const state = buildState();
    expect(selectActiveGatheringSessionId(state)).toBe('sess1');
    expect(selectActiveGatheringSession(state)).toEqual(session);
  });

  it('returns undefined active session when none set', () => {
    const state: CampaignState = { ...buildState(), gathering: { activeSession: null } };
    expect(selectActiveGatheringSessionId(state)).toBeNull();
    expect(selectActiveGatheringSession(state)).toBeUndefined();
  });

  it('returns undefined when active session id points to missing session', () => {
    const state: CampaignState = { ...buildState(), gathering: { activeSession: 'missing' } };
    expect(selectActiveGatheringSession(state)).toBeUndefined();
  });
});

describe('gatheringSelectors — daily events', () => {
  it('returns the daily events map', () => {
    expect(selectGatheringDailyEvents(buildState())).toEqual(dailyEvents);
  });

  it('returns empty object on initial state', () => {
    expect(selectGatheringDailyEvents(initialCampaignState)).toEqual({});
  });
});

describe('gatheringSelectors — forage zone profiles', () => {
  it('returns zone record and array', () => {
    const state = buildState();
    expect(selectForageZoneProfilesRecord(state)).toEqual({ z1: zoneA, z2: zoneB });
    expect(selectAllForageZoneProfiles(state)).toHaveLength(2);
  });

  it('filters zones by locationId', () => {
    const state = buildState();
    expect(selectForageZoneProfilesForLocation(state, 'loc1')).toEqual([zoneA]);
    expect(selectForageZoneProfilesForLocation(state, 'loc2')).toEqual([zoneB]);
    expect(selectForageZoneProfilesForLocation(state, 'missing')).toEqual([]);
  });

  it('selects a zone by id and undefined for missing', () => {
    const state = buildState();
    expect(selectForageZoneProfileById(state, 'z1')).toEqual(zoneA);
    expect(selectForageZoneProfileById(state, 'missing')).toBeUndefined();
  });

  it('falls back to empty object when forageZoneProfiles is undefined', () => {
    const state: CampaignState = {
      ...buildState(),
      entities: { ...buildState().entities, forageZoneProfiles: undefined as unknown as Record<string, ForageZoneProfile> },
    };
    expect(selectForageZoneProfilesRecord(state)).toEqual({});
    expect(selectAllForageZoneProfiles(state)).toEqual([]);
    expect(selectForageZoneProfilesForLocation(state, 'loc1')).toEqual([]);
    expect(selectForageZoneProfileById(state, 'z1')).toBeUndefined();
  });
});

describe('gatheringSelectors — forage items', () => {
  it('returns forage item record and array', () => {
    const state = buildState();
    expect(selectForageItemsRecord(state)).toEqual({ fi1: apple, fi2: rareApple, fi3: oakLog });
    expect(selectAllForageItems(state)).toHaveLength(3);
  });

  it('filters items by category', () => {
    const state = buildState();
    expect(selectForageItemsByCategory(state, 'fruits')).toEqual([apple, rareApple]);
    expect(selectForageItemsByCategory(state, 'vegetables')).toEqual([oakLog]);
    expect(selectForageItemsByCategory(state, 'mushrooms')).toEqual([]);
  });

  it('filters items by tier and category', () => {
    const state = buildState();
    expect(selectForageItemsByTierAndCategory(state, 'common', 'fruits')).toEqual([apple]);
    expect(selectForageItemsByTierAndCategory(state, 'rare', 'fruits')).toEqual([rareApple]);
    expect(selectForageItemsByTierAndCategory(state, 'common', 'vegetables')).toEqual([oakLog]);
    expect(selectForageItemsByTierAndCategory(state, 'legendary', 'fruits')).toEqual([]);
  });

  it('selects a forage item by id and undefined for missing', () => {
    const state = buildState();
    expect(selectForageItemById(state, 'fi1')).toEqual(apple);
    expect(selectForageItemById(state, 'missing')).toBeUndefined();
  });

  it('falls back to empty object when forageItems is undefined', () => {
    const state: CampaignState = {
      ...buildState(),
      entities: { ...buildState().entities, forageItems: undefined as unknown as Record<string, ForageItem> },
    };
    expect(selectForageItemsRecord(state)).toEqual({});
    expect(selectAllForageItems(state)).toEqual([]);
    expect(selectForageItemsByCategory(state, 'fruits')).toEqual([]);
    expect(selectForageItemsByTierAndCategory(state, 'common', 'fruits')).toEqual([]);
    expect(selectForageItemById(state, 'fi1')).toBeUndefined();
  });
});

describe('gatheringSelectors — foraging config', () => {
  it('returns the configured foraging config', () => {
    expect(selectForagingConfig(buildState())).toEqual(customForagingConfig);
  });

  it('falls back to DEFAULT_FORAGING_CONFIG when missing', () => {
    const state: CampaignState = {
      ...buildState(),
      entities: { ...buildState().entities, foragingConfig: undefined as unknown as ForagingConfig },
    };
    expect(selectForagingConfig(state)).toEqual(DEFAULT_FORAGING_CONFIG);
  });
});
