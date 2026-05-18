import { describe, expect, it } from 'vitest';
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
  isGatheringAction,
  type GatheringAction
} from '../gatheringActions';
import type {
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringSession,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
  GatheringDailyEvents
} from '../../../types/campaign';
import type { ForageZoneProfile, ForageItem, ForagingConfig } from '../../../types/foraging';

const mockSpecies = (overrides?: Partial<GatheringSpecies>): GatheringSpecies =>
  ({ id: 'sp-1', name: 'Trout', ...overrides }) as GatheringSpecies;

const mockTool = (overrides?: Partial<GatheringTool>): GatheringTool =>
  ({ id: 'tool-1', name: 'Rod', ...overrides }) as GatheringTool;

const mockTable = (overrides?: Partial<GatheringTable>): GatheringTable =>
  ({ id: 'tbl-1', name: 'Riverbank', ...overrides }) as GatheringTable;

const mockEnvironment = (overrides?: Partial<GatheringEnvironment>): GatheringEnvironment =>
  ({ id: 'env-1', name: 'River', ...overrides }) as GatheringEnvironment;

const mockSession = (overrides?: Partial<GatheringSession>): GatheringSession =>
  ({ id: 'sess-1', ...overrides }) as GatheringSession;

const mockBait = (overrides?: Partial<GatheringBait>): GatheringBait =>
  ({ id: 'bait-1', name: 'Worms', ...overrides }) as GatheringBait;

const mockCategory = (overrides?: Partial<GatheringCategory>): GatheringCategory =>
  ({ id: 'cat-1', name: 'Fish', ...overrides }) as GatheringCategory;

const mockItem = (overrides?: Partial<GatheringItem>): GatheringItem =>
  ({ id: 'item-1', name: 'Bass', ...overrides }) as GatheringItem;

const mockDailyEvents = (): GatheringDailyEvents => ({}) as GatheringDailyEvents;

const mockZoneProfile = (overrides?: Partial<ForageZoneProfile>): ForageZoneProfile =>
  ({ id: 'zone-1', name: 'Forest Edge', ...overrides }) as ForageZoneProfile;

const mockForageItem = (overrides?: Partial<ForageItem>): ForageItem =>
  ({ id: 'forage-1', name: 'Mushroom', ...overrides }) as ForageItem;

const mockForagingConfig = (overrides?: Partial<ForagingConfig>): ForagingConfig =>
  ({ ...overrides }) as ForagingConfig;

describe('gatheringActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(GATHERING_SPECIES_SET).toBe('setGatheringSpecies');
      expect(GATHERING_SPECIES_ADD).toBe('addGatheringSpecies');
      expect(GATHERING_TOOLS_SET).toBe('setGatheringTools');
      expect(GATHERING_TOOL_ADD).toBe('addGatheringTool');
      expect(GATHERING_TABLES_SET).toBe('setGatheringTables');
      expect(GATHERING_TABLE_ADD).toBe('addGatheringTable');
      expect(GATHERING_ENVIRONMENTS_SET).toBe('setGatheringEnvironments');
      expect(GATHERING_ENVIRONMENT_ADD).toBe('addGatheringEnvironment');
      expect(GATHERING_SESSION_ADD).toBe('addGatheringSession');
      expect(GATHERING_SESSION_UPDATE).toBe('updateGatheringSession');
      expect(GATHERING_SESSIONS_SET).toBe('setGatheringSessions');
      expect(GATHERING_DAILY_EVENTS_SET).toBe('setGatheringDailyEvents');
      expect(GATHERING_BAIT_SET).toBe('setGatheringBait');
      expect(GATHERING_BAIT_ADD).toBe('addGatheringBait');
      expect(GATHERING_CATEGORIES_SET).toBe('setGatheringCategories');
      expect(GATHERING_CATEGORY_ADD).toBe('addGatheringCategory');
      expect(GATHERING_ITEMS_SET).toBe('setGatheringItems');
      expect(GATHERING_ITEM_ADD).toBe('addGatheringItem');
      expect(FORAGE_ZONE_PROFILES_SET).toBe('setForageZoneProfiles');
      expect(FORAGE_ZONE_PROFILE_ADD).toBe('addForageZoneProfile');
      expect(FORAGE_ZONE_PROFILE_UPDATE).toBe('updateForageZoneProfile');
      expect(FORAGE_ZONE_PROFILE_REMOVE).toBe('removeForageZoneProfile');
      expect(FORAGE_ITEMS_SET).toBe('setForageItems');
      expect(FORAGE_ITEM_ADD).toBe('addForageItem');
      expect(FORAGE_ITEM_UPDATE).toBe('updateForageItem');
      expect(FORAGE_ITEM_REMOVE).toBe('removeForageItem');
      expect(FORAGING_CONFIG_SET).toBe('setForagingConfig');
      expect(FORAGING_CONFIG_UPDATE).toBe('updateForagingConfig');
    });

    it('constants are all unique', () => {
      const values = [
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
        FORAGING_CONFIG_UPDATE
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isGatheringAction', () => {
    it('returns true for species/tool/table/environment actions', () => {
      const actions: GatheringAction[] = [
        { type: GATHERING_SPECIES_SET, payload: { 'sp-1': mockSpecies() } },
        { type: GATHERING_SPECIES_ADD, payload: mockSpecies() },
        { type: GATHERING_TOOLS_SET, payload: { 'tool-1': mockTool() } },
        { type: GATHERING_TOOL_ADD, payload: mockTool() },
        { type: GATHERING_TABLES_SET, payload: { 'tbl-1': mockTable() } },
        { type: GATHERING_TABLE_ADD, payload: mockTable() },
        { type: GATHERING_ENVIRONMENTS_SET, payload: { 'env-1': mockEnvironment() } },
        { type: GATHERING_ENVIRONMENT_ADD, payload: mockEnvironment() }
      ];
      for (const action of actions) {
        expect(isGatheringAction(action)).toBe(true);
      }
    });

    it('returns true for session and daily events actions', () => {
      const add: GatheringAction = { type: GATHERING_SESSION_ADD, payload: mockSession() };
      const update: GatheringAction = {
        type: GATHERING_SESSION_UPDATE,
        payload: { id: 'sess-1', changes: {} }
      };
      const set: GatheringAction = {
        type: GATHERING_SESSIONS_SET,
        payload: { 'sess-1': mockSession() }
      };
      const daily: GatheringAction = {
        type: GATHERING_DAILY_EVENTS_SET,
        payload: mockDailyEvents()
      };
      expect(isGatheringAction(add)).toBe(true);
      expect(isGatheringAction(update)).toBe(true);
      expect(isGatheringAction(set)).toBe(true);
      expect(isGatheringAction(daily)).toBe(true);
    });

    it('returns true for bait/category/item actions', () => {
      const actions: GatheringAction[] = [
        { type: GATHERING_BAIT_SET, payload: { 'bait-1': mockBait() } },
        { type: GATHERING_BAIT_ADD, payload: mockBait() },
        { type: GATHERING_CATEGORIES_SET, payload: { 'cat-1': mockCategory() } },
        { type: GATHERING_CATEGORY_ADD, payload: mockCategory() },
        { type: GATHERING_ITEMS_SET, payload: { 'item-1': mockItem() } },
        { type: GATHERING_ITEM_ADD, payload: mockItem() }
      ];
      for (const action of actions) {
        expect(isGatheringAction(action)).toBe(true);
      }
    });

    it('returns true for forage zone profile actions', () => {
      const actions: GatheringAction[] = [
        { type: FORAGE_ZONE_PROFILES_SET, payload: { 'zone-1': mockZoneProfile() } },
        { type: FORAGE_ZONE_PROFILE_ADD, payload: mockZoneProfile() },
        {
          type: FORAGE_ZONE_PROFILE_UPDATE,
          payload: { id: 'zone-1', changes: { name: 'Renamed' } }
        },
        { type: FORAGE_ZONE_PROFILE_REMOVE, payload: 'zone-1' }
      ];
      for (const action of actions) {
        expect(isGatheringAction(action)).toBe(true);
      }
    });

    it('returns true for forage item actions', () => {
      const actions: GatheringAction[] = [
        { type: FORAGE_ITEMS_SET, payload: { 'forage-1': mockForageItem() } },
        { type: FORAGE_ITEM_ADD, payload: mockForageItem() },
        {
          type: FORAGE_ITEM_UPDATE,
          payload: { id: 'forage-1', changes: { name: 'Renamed' } }
        },
        { type: FORAGE_ITEM_REMOVE, payload: 'forage-1' }
      ];
      for (const action of actions) {
        expect(isGatheringAction(action)).toBe(true);
      }
    });

    it('returns true for foraging config actions', () => {
      const set: GatheringAction = { type: FORAGING_CONFIG_SET, payload: mockForagingConfig() };
      const update: GatheringAction = { type: FORAGING_CONFIG_UPDATE, payload: {} };
      expect(isGatheringAction(set)).toBe(true);
      expect(isGatheringAction(update)).toBe(true);
    });

    it('returns false for unrelated action types', () => {
      expect(isGatheringAction({ type: 'addCharacter' })).toBe(false);
      expect(isGatheringAction({ type: 'startCombat' })).toBe(false);
      expect(isGatheringAction({ type: 'addCraft' })).toBe(false);
      expect(isGatheringAction({ type: 'addAlchemyReagent' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isGatheringAction({ type: '' })).toBe(false);
    });

    it('returns false for substrings or near-misses', () => {
      expect(isGatheringAction({ type: 'gathering' })).toBe(false);
      expect(isGatheringAction({ type: 'Gathering' })).toBe(false);
      expect(isGatheringAction({ type: 'addGathering' })).toBe(false);
      expect(isGatheringAction({ type: 'setForage' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: GATHERING_SPECIES_ADD,
        payload: mockSpecies()
      };
      if (isGatheringAction(unknownAction)) {
        expect(unknownAction.type).toBe(GATHERING_SPECIES_ADD);
      } else {
        throw new Error('expected type guard to accept GATHERING_SPECIES_ADD');
      }
    });
  });
});
