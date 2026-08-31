import { describe, expect, it } from 'vitest';
import { VEHICLE_TYPE_SEEDS } from '../../constants/vehicleSeeds';
import { createCampaignState } from '../../state/campaignReducer';
import { migrateTo1_5_6 } from '../../utils/dataMigrations';
import { ensureTravelGroups } from '../dataMigration';

describe('schema 1.5.6 travel migration', () => {
  it('strips legacy map positions and seeds the main group at the active map position', () => {
    const legacyPositionKey = ['party', 'TileId'].join('');
    const migrated = migrateTo1_5_6({
      maps: {
        activeMapId: 'active',
        mapsById: {
          other: { id: 'other', [legacyPositionKey]: 'other-tile' },
          active: { id: 'active', [legacyPositionKey]: 'active-tile' },
        },
      },
      entities: { characters: { c1: { id: 'c1' } } },
      ui: {},
    });
    expect(migrated).toMatchObject({
      entities: {
        travelGroups: {
          'travel-group-main': {
            memberIds: ['c1'],
            position: { mapId: 'active', tileId: 'active-tile' },
          },
        },
      },
      ui: { activeTravelGroupId: 'travel-group-main' },
    });
    expect(JSON.stringify(migrated)).not.toContain(legacyPositionKey);
  });

  it('is content-idempotent on partial data and does not replace existing groups', () => {
    const input = {
      maps: { activeMapId: null, mapsById: { m: { id: 'm' } } },
      entities: {
        characters: {},
        travelGroups: {
          existing: { id: 'existing', name: 'Existing', memberIds: [], vehicleId: null, position: null },
        },
      },
    };
    const once = migrateTo1_5_6(input);
    const twice = migrateTo1_5_6(once);
    expect(twice).toEqual(once);
    expect(twice).toMatchObject({ entities: { travelGroups: { existing: { name: 'Existing' } } } });
  });
});

describe('ensureTravelGroups', () => {
  it('adopts stray characters into the first group and deduplicates first-group-wins', () => {
    const state = createCampaignState();
    state.entities.characters = {
      a: { id: 'a', name: 'A', work: { skills: {} } },
      b: { id: 'b', name: 'B', work: { skills: {} } },
      stray: { id: 'stray', name: 'Stray', work: { skills: {} } },
    };
    state.entities.travelGroups = {
      first: { id: 'first', name: 'First', memberIds: ['a', 'b'], vehicleId: null, position: null },
      second: { id: 'second', name: 'Second', memberIds: ['b', 'missing'], vehicleId: null, position: null },
    };
    const ensured = ensureTravelGroups(state);
    expect(ensured.entities.travelGroups?.first.memberIds).toEqual(['a', 'b', 'stray']);
    expect(ensured.entities.travelGroups?.second.memberIds).toEqual([]);
  });

  it('creates all missing structures and repairs the active group id', () => {
    const state = createCampaignState();
    state.entities.travelGroups = undefined;
    state.entities.vehicles = undefined;
    state.entities.vehicleTypes = undefined;
    state.ui.activeTravelGroupId = 'missing';
    const ensured = ensureTravelGroups(state);
    const first = Object.values(ensured.entities.travelGroups ?? {})[0];
    expect(first.name).toBe('The Party');
    expect(ensured.entities.vehicles).toEqual({});
    expect(ensured.ui.activeTravelGroupId).toBe(first.id);
  });

  it('seeds every builtin vehicle type', () => {
    const state = createCampaignState();
    state.entities.vehicleTypes = {};
    const ensured = ensureTravelGroups(state);
    expect(Object.keys(ensured.entities.vehicleTypes ?? {}).sort())
      .toEqual(VEHICLE_TYPE_SEEDS.map((seed) => seed.id).sort());
  });

  it('respects deleted builtin tombstones', () => {
    const state = createCampaignState();
    state.entities.vehicleTypes = {};
    state.entities.deletedBuiltinVehicleTypeIds = ['vt-lancer'];
    const ensured = ensureTravelGroups(state);
    expect(ensured.entities.vehicleTypes?.['vt-lancer']).toBeUndefined();
    expect(ensured.entities.vehicleTypes?.['vt-skyship']).toBeDefined();
  });

  it('returns the same state reference when every invariant is already satisfied', () => {
    const once = ensureTravelGroups(createCampaignState());
    const twice = ensureTravelGroups(once);
    expect(twice).toBe(once);
  });
});
