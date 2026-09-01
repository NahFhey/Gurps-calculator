import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { migrateTo1_6_0 } from '../../utils/dataMigrations';
import { ensureTravelEventTables } from '../dataMigration';
import { TRAVEL_EVENT_SET_SEED, TRAVEL_EVENT_TABLE_SEEDS } from '../../constants/travelEventSeeds';

describe('migrateTo1_6_0', () => {
  it('drops a dangling custom map set override', () => {
    const result = migrateTo1_6_0({ maps: { mapsById: { m: { id: 'm', travelEventTableSetId: 'missing' } } }, entities: {} });
    expect(result).toMatchObject({ maps: { mapsById: { m: { id: 'm' } } } });
  });

  it('keeps the default seed override even when absent from saved entities', () => {
    const input = { maps: { mapsById: { m: { travelEventTableSetId: TRAVEL_EVENT_SET_SEED.id } } }, entities: {} };
    expect(migrateTo1_6_0(input)).toBe(input);
  });

  it('keeps a custom override that resolves', () => {
    const input = { maps: { mapsById: { m: { travelEventTableSetId: 'custom' } } }, entities: { travelEventTableSets: { custom: {} } } };
    expect(migrateTo1_6_0(input)).toBe(input);
  });

  it('drops dangling encounter template ids from entries', () => {
    const result = migrateTo1_6_0({ entities: { encounterTemplates: {}, travelEventTables: { t: { entries: [{ id: 'e', encounterTemplateId: 'missing' }] } } } });
    expect(JSON.stringify(result)).not.toContain('encounterTemplateId');
  });

  it('keeps encounter template ids that resolve and is reference-idempotent', () => {
    const input = { entities: { encounterTemplates: { valid: {} }, travelEventTables: { t: { entries: [{ encounterTemplateId: 'valid' }] } } } };
    expect(migrateTo1_6_0(input)).toBe(input);
  });
});

describe('ensureTravelEventTables', () => {
  it('seeds every builtin table, the default set, and empty ledgers', () => {
    const state = createCampaignState();
    state.entities.travelEventTables = undefined;
    state.entities.travelEventTableSets = undefined;
    state.entities.groupMeals = undefined;
    state.entities.starvationFpDebt = undefined;
    const ensured = ensureTravelEventTables(state);
    expect(Object.keys(ensured.entities.travelEventTables ?? {})).toHaveLength(TRAVEL_EVENT_TABLE_SEEDS.length);
    expect(ensured.entities.travelEventTableSets?.[TRAVEL_EVENT_SET_SEED.id]).toBeDefined();
    expect(ensured.entities.groupMeals).toEqual({});
    expect(ensured.entities.starvationFpDebt).toEqual({});
  });

  it('honors shared builtin tombstones', () => {
    const state = createCampaignState();
    state.entities.travelEventTables = {};
    state.entities.travelEventTableSets = {};
    state.entities.deletedBuiltinTravelEventIds = [TRAVEL_EVENT_SET_SEED.id, TRAVEL_EVENT_TABLE_SEEDS[0].id];
    const ensured = ensureTravelEventTables(state);
    expect(ensured.entities.travelEventTableSets?.[TRAVEL_EVENT_SET_SEED.id]).toBeUndefined();
    expect(ensured.entities.travelEventTables?.[TRAVEL_EVENT_TABLE_SEEDS[0].id]).toBeUndefined();
  });

  it('returns the same reference when no repair is needed', () => {
    let state = createCampaignState();
    state = ensureTravelEventTables(state);
    expect(ensureTravelEventTables(state)).toBe(state);
  });
});
