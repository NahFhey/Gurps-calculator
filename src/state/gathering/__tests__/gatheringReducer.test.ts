import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleGatheringAction } from '../gatheringReducer';

// TODO(types): handleGatheringAction's action parameter excludes the unknown-type action its runtime rejects by returning false.
const handleUnknownGatheringAction = handleGatheringAction as (
  state: Parameters<typeof handleGatheringAction>[0],
  action: { type: string }
) => ReturnType<typeof handleGatheringAction>;
import {
  GATHERING_SPECIES_SET,
  GATHERING_SPECIES_ADD,
  GATHERING_TOOLS_SET,
  GATHERING_TOOL_ADD,
  GATHERING_TABLES_SET,
  GATHERING_TABLE_ADD,
  GATHERING_ENVIRONMENTS_SET,
  GATHERING_ENVIRONMENT_ADD,
  GATHERING_SESSION_ADD,
  GATHERING_SESSION_UPDATE,
  GATHERING_SESSIONS_SET,
  GATHERING_DAILY_EVENTS_SET,
  GATHERING_BAIT_SET,
  GATHERING_BAIT_ADD,
  GATHERING_CATEGORIES_SET,
  GATHERING_CATEGORY_ADD,
  GATHERING_ITEMS_SET,
  GATHERING_ITEM_ADD,
  FORAGE_ZONE_PROFILES_SET,
  FORAGE_ZONE_PROFILE_ADD,
  FORAGE_ZONE_PROFILE_UPDATE,
  FORAGE_ZONE_PROFILE_REMOVE,
  FORAGE_ITEMS_SET,
  FORAGE_ITEM_ADD,
  FORAGE_ITEM_UPDATE,
  FORAGE_ITEM_REMOVE,
  FORAGING_CONFIG_SET,
  FORAGING_CONFIG_UPDATE,
  type GatheringAction,
} from '../gatheringActions';
import {
  createCampaignState,
  type CampaignState,
} from '../../campaignReducer';
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

const species = (id: string, overrides: Partial<GatheringSpecies> = {}): GatheringSpecies =>
  ({
    id,
    name: `species-${id}`,
    type: 'fish',
    tags: [],
    foodType: 'meat',
    yieldMeatFormula: '1d6',
    secondaryMaterialType: null,
    yieldSecondaryFormula: null,
    secondaryNameOverride: null,
    st: null,
    specialRules: [],
    ...overrides,
  });
const tool = (id: string): GatheringTool => ({
  id,
  name: `tool-${id}`,
  toolType: 'fishing',
  allowedModes: [],
  allowedMethods: [],
  bonuses: [],
  durability: null,
  notes: '',
});
const table = (id: string): GatheringTable => ({
  id,
  name: `table-${id}`,
  tableType: 'fishing',
  rollMethod: '1d6',
  entries: [],
});
const environment = (id: string): GatheringEnvironment => ({
  id,
  name: `env-${id}`,
  supportedModes: [],
  defaultsByMode: {},
  skillMod: 0,
});
const session = (id: string, overrides: Partial<GatheringSession> = {}): GatheringSession =>
  ({
    id,
    type: 'fishing',
    worker: 'worker-1',
    day: 1,
    slot: 0,
    environmentId: 'environment-1',
    results: [],
    status: 'pending',
    ...overrides,
  });
const bait = (id: string): GatheringBait => ({
  id,
  name: `bait-${id}`,
  consumableType: 'bait',
  baitTags: [],
  attractsSpeciesIds: [],
  quantity: 1,
  rollBonus: 0,
});
const category = (id: string): GatheringCategory => ({
  id,
  name: `cat-${id}`,
  yieldFormula: '1d6',
  inventoryKind: 'food',
  typeId: 'raw',
  description: '',
});
const item = (id: string): GatheringItem => ({
  id,
  name: `item-${id}`,
  inventoryKind: 'material',
  typeId: 'herb',
  yieldFormula: '1d6',
  rarity: 'common',
  description: '',
});
const zoneProfile = (id: string, overrides: Partial<ForageZoneProfile> = {}): ForageZoneProfile =>
  ({
    id,
    name: `zone-${id}`,
    commonCategories: [],
    uncommonCategories: [],
    rareCategories: [],
    tags: [],
    ...overrides,
  });
const forageItem = (id: string, overrides: Partial<ForageItem> = {}): ForageItem =>
  ({
    id,
    name: `forage-${id}`,
    categoryId: 'fruits',
    tier: 'common',
    yieldFormula: '1d6',
    inventoryKind: 'food',
    typeId: 'raw',
    ...overrides,
  });

const createMinimalCampaignState = (): CampaignState => {
  const state = createCampaignState();
  Reflect.deleteProperty(state.entities, 'foragingConfig');
  return state;
};

function applyAction(state: CampaignState, action: GatheringAction): CampaignState {
  return produce(state, draft => {
    handleGatheringAction(draft, action);
  });
}

describe('gatheringReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('species', () => {
    it('GATHERING_SPECIES_SET replaces the species map', () => {
      const payload = { s1: species('s1'), s2: species('s2') };
      const next = applyAction(state, { type: GATHERING_SPECIES_SET, payload });
      expect(next.entities.gatheringSpecies).toEqual(payload);
    });

    it('GATHERING_SPECIES_ADD adds a species by id', () => {
      const s = species('s1');
      const next = applyAction(state, { type: GATHERING_SPECIES_ADD, payload: s });
      expect(next.entities.gatheringSpecies['s1']).toEqual(s);
    });
  });

  describe('tools', () => {
    it('GATHERING_TOOLS_SET replaces the tool map', () => {
      const payload = { t1: tool('t1') };
      const next = applyAction(state, { type: GATHERING_TOOLS_SET, payload });
      expect(next.entities.gatheringTools).toEqual(payload);
    });

    it('GATHERING_TOOL_ADD adds a tool by id', () => {
      const t = tool('t1');
      const next = applyAction(state, { type: GATHERING_TOOL_ADD, payload: t });
      expect(next.entities.gatheringTools['t1']).toEqual(t);
    });
  });

  describe('tables', () => {
    it('GATHERING_TABLES_SET replaces the table map', () => {
      const payload = { tb1: table('tb1') };
      const next = applyAction(state, { type: GATHERING_TABLES_SET, payload });
      expect(next.entities.gatheringTables).toEqual(payload);
    });

    it('GATHERING_TABLE_ADD adds a table by id', () => {
      const tb = table('tb1');
      const next = applyAction(state, { type: GATHERING_TABLE_ADD, payload: tb });
      expect(next.entities.gatheringTables['tb1']).toEqual(tb);
    });
  });

  describe('environments', () => {
    it('GATHERING_ENVIRONMENTS_SET replaces the environment map', () => {
      const payload = { e1: environment('e1') };
      const next = applyAction(state, { type: GATHERING_ENVIRONMENTS_SET, payload });
      expect(next.entities.gatheringEnvironments).toEqual(payload);
    });

    it('GATHERING_ENVIRONMENT_ADD adds an environment by id', () => {
      const e = environment('e1');
      const next = applyAction(state, { type: GATHERING_ENVIRONMENT_ADD, payload: e });
      expect(next.entities.gatheringEnvironments['e1']).toEqual(e);
    });
  });

  describe('sessions', () => {
    it('GATHERING_SESSION_ADD adds a session', () => {
      const s = session('sess-1');
      const next = applyAction(state, { type: GATHERING_SESSION_ADD, payload: s });
      expect(next.entities.gatheringSessions['sess-1']).toEqual(s);
    });

    it('GATHERING_SESSION_UPDATE merges changes into an existing session', () => {
      const s = session('sess-1', { status: 'pending' });
      state = applyAction(state, { type: GATHERING_SESSION_ADD, payload: s });
      const next = applyAction(state, {
        type: GATHERING_SESSION_UPDATE,
        payload: { id: 'sess-1', changes: { status: 'complete' } },
      });
      expect(next.entities.gatheringSessions['sess-1'].status).toBe('complete');
    });

    it('GATHERING_SESSION_UPDATE is a no-op for unknown ids', () => {
      const next = applyAction(state, {
        type: GATHERING_SESSION_UPDATE,
        payload: { id: 'missing', changes: { status: 'complete' } },
      });
      expect(next.entities.gatheringSessions['missing']).toBeUndefined();
    });

    it('GATHERING_SESSIONS_SET replaces the session map', () => {
      const payload = { 'sess-1': session('sess-1'), 'sess-2': session('sess-2') };
      const next = applyAction(state, { type: GATHERING_SESSIONS_SET, payload });
      expect(next.entities.gatheringSessions).toEqual(payload);
    });
  });

  describe('daily events', () => {
    it('GATHERING_DAILY_EVENTS_SET replaces daily events', () => {
      const payload: GatheringDailyEvents = { '2026-01-01': {} };
      const next = applyAction(state, { type: GATHERING_DAILY_EVENTS_SET, payload });
      expect(next.entities.gatheringDailyEvents).toEqual(payload);
    });
  });

  describe('bait', () => {
    it('GATHERING_BAIT_SET replaces the bait map', () => {
      const payload = { b1: bait('b1') };
      const next = applyAction(state, { type: GATHERING_BAIT_SET, payload });
      expect(next.entities.gatheringBait).toEqual(payload);
    });

    it('GATHERING_BAIT_ADD adds bait by id', () => {
      const b = bait('b1');
      const next = applyAction(state, { type: GATHERING_BAIT_ADD, payload: b });
      expect(next.entities.gatheringBait['b1']).toEqual(b);
    });
  });

  describe('categories', () => {
    it('GATHERING_CATEGORIES_SET replaces the category map', () => {
      const payload = { c1: category('c1') };
      const next = applyAction(state, { type: GATHERING_CATEGORIES_SET, payload });
      expect(next.entities.gatheringCategories).toEqual(payload);
    });

    it('GATHERING_CATEGORY_ADD adds a category by id', () => {
      const c = category('c1');
      const next = applyAction(state, { type: GATHERING_CATEGORY_ADD, payload: c });
      expect(next.entities.gatheringCategories['c1']).toEqual(c);
    });
  });

  describe('items', () => {
    it('GATHERING_ITEMS_SET replaces the item map', () => {
      const payload = { i1: item('i1') };
      const next = applyAction(state, { type: GATHERING_ITEMS_SET, payload });
      expect(next.entities.gatheringItems).toEqual(payload);
    });

    it('GATHERING_ITEM_ADD adds an item by id', () => {
      const i = item('i1');
      const next = applyAction(state, { type: GATHERING_ITEM_ADD, payload: i });
      expect(next.entities.gatheringItems['i1']).toEqual(i);
    });
  });

  describe('forage zone profiles', () => {
    it('FORAGE_ZONE_PROFILES_SET replaces the zone profile map', () => {
      const payload = { z1: zoneProfile('z1') };
      const next = applyAction(state, { type: FORAGE_ZONE_PROFILES_SET, payload });
      expect(next.entities.forageZoneProfiles).toEqual(payload);
    });

    it('FORAGE_ZONE_PROFILE_ADD adds a zone profile by id', () => {
      const z = zoneProfile('z1');
      const next = applyAction(state, { type: FORAGE_ZONE_PROFILE_ADD, payload: z });
      expect(next.entities.forageZoneProfiles['z1']).toEqual(z);
    });

    it('FORAGE_ZONE_PROFILE_UPDATE merges changes into existing profile', () => {
      const z = zoneProfile('z1', { name: 'original' });
      state = applyAction(state, { type: FORAGE_ZONE_PROFILE_ADD, payload: z });
      const next = applyAction(state, {
        type: FORAGE_ZONE_PROFILE_UPDATE,
        payload: { id: 'z1', changes: { name: 'updated' } },
      });
      expect(next.entities.forageZoneProfiles['z1'].name).toBe('updated');
    });

    it('FORAGE_ZONE_PROFILE_UPDATE is a no-op for unknown ids', () => {
      const next = applyAction(state, {
        type: FORAGE_ZONE_PROFILE_UPDATE,
        payload: { id: 'missing', changes: { name: 'x' } },
      });
      expect(next.entities.forageZoneProfiles['missing']).toBeUndefined();
    });

    it('FORAGE_ZONE_PROFILE_REMOVE deletes a zone profile by id', () => {
      state = applyAction(state, { type: FORAGE_ZONE_PROFILE_ADD, payload: zoneProfile('z1') });
      const next = applyAction(state, { type: FORAGE_ZONE_PROFILE_REMOVE, payload: 'z1' });
      expect(next.entities.forageZoneProfiles['z1']).toBeUndefined();
    });
  });

  describe('forage items', () => {
    it('FORAGE_ITEMS_SET replaces the forage item map', () => {
      const payload = { f1: forageItem('f1') };
      const next = applyAction(state, { type: FORAGE_ITEMS_SET, payload });
      expect(next.entities.forageItems).toEqual(payload);
    });

    it('FORAGE_ITEM_ADD adds a forage item by id', () => {
      const f = forageItem('f1');
      const next = applyAction(state, { type: FORAGE_ITEM_ADD, payload: f });
      expect(next.entities.forageItems['f1']).toEqual(f);
    });

    it('FORAGE_ITEM_UPDATE merges changes into existing item', () => {
      const f = forageItem('f1', { name: 'original' });
      state = applyAction(state, { type: FORAGE_ITEM_ADD, payload: f });
      const next = applyAction(state, {
        type: FORAGE_ITEM_UPDATE,
        payload: { id: 'f1', changes: { name: 'updated' } },
      });
      expect(next.entities.forageItems['f1'].name).toBe('updated');
    });

    it('FORAGE_ITEM_UPDATE is a no-op for unknown ids', () => {
      const next = applyAction(state, {
        type: FORAGE_ITEM_UPDATE,
        payload: { id: 'missing', changes: { name: 'x' } },
      });
      expect(next.entities.forageItems['missing']).toBeUndefined();
    });

    it('FORAGE_ITEM_REMOVE deletes a forage item by id', () => {
      state = applyAction(state, { type: FORAGE_ITEM_ADD, payload: forageItem('f1') });
      const next = applyAction(state, { type: FORAGE_ITEM_REMOVE, payload: 'f1' });
      expect(next.entities.forageItems['f1']).toBeUndefined();
    });
  });

  describe('foraging config', () => {
    it('FORAGING_CONFIG_SET replaces the foraging config', () => {
      const payload: ForagingConfig = { ...DEFAULT_FORAGING_CONFIG, eventsEnabled: false };
      const next = applyAction(state, { type: FORAGING_CONFIG_SET, payload });
      expect(next.entities.foragingConfig).toEqual(payload);
    });

    it('FORAGING_CONFIG_UPDATE merges partial changes into existing config', () => {
      state = applyAction(state, {
        type: FORAGING_CONFIG_SET,
        payload: { ...DEFAULT_FORAGING_CONFIG },
      });
      const next = applyAction(state, {
        type: FORAGING_CONFIG_UPDATE,
        payload: { eventsEnabled: false },
      });
      expect(next.entities.foragingConfig?.eventsEnabled).toBe(false);
      expect(next.entities.foragingConfig?.useSeasonSystem).toBe(
        DEFAULT_FORAGING_CONFIG.useSeasonSystem
      );
    });

    it('FORAGING_CONFIG_UPDATE seeds from DEFAULT_FORAGING_CONFIG when config is missing', () => {
      const next = applyAction(state, {
        type: FORAGING_CONFIG_UPDATE,
        payload: { eventsEnabled: false },
      });
      expect(next.entities.foragingConfig).toEqual({
        ...DEFAULT_FORAGING_CONFIG,
        eventsEnabled: false,
      });
    });
  });

  describe('unhandled actions', () => {
    it('returns false for unknown action types without mutating state', () => {
      const before = JSON.stringify(state);
      const handled = handleUnknownGatheringAction(state, {
        type: 'unknown/action',
      });
      expect(handled).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    });
  });
});
