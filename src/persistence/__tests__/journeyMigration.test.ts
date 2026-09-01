import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { migrateTo1_5_9 } from '../../utils/dataMigrations';
import { ensureJourneyIntegrity } from '../dataMigration';

describe('migrateTo1_5_9', () => {
  it('drops journeys whose map is missing', () => {
    const migrated = migrateTo1_5_9({ maps: { mapsById: {} }, entities: { travelGroups: { g: { id: 'g', journey: { mapId: 'missing', routeTileIds: ['a'] } } } } });
    expect(migrated).toMatchObject({ entities: { travelGroups: { g: {} } } });
  });

  it('drops journeys with malformed routes', () => {
    const migrated = migrateTo1_5_9({ maps: { mapsById: { m: {} } }, entities: { travelGroups: { g: { id: 'g', journey: { mapId: 'm', routeTileIds: 'bad' } } } } });
    expect(JSON.stringify(migrated)).not.toContain('routeTileIds');
  });

  it('preserves valid journeys and is reference-idempotent', () => {
    const input = { maps: { mapsById: { m: {} } }, entities: { travelGroups: { g: { id: 'g', journey: { mapId: 'm', routeTileIds: ['a'] } } } } };
    expect(migrateTo1_5_9(input)).toBe(input);
  });
});

function validState() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'M', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const start = map.grid[4][4];
  const end = map.grid[4][5];
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = {
    ...state.entities,
    characters: { a: { id: 'a', name: 'A', work: { skills: {} } } },
    travelGroups: { g: {
      id: 'g', name: 'G', memberIds: ['a'], vehicleId: null, position: { mapId: map.id, tileId: start },
      journey: { id: 'j', mapId: map.id, routeTileIds: [start, end], destinationTileId: end, mode: 'foot', navigatorId: 'a', gmNavigationSkill: 10, forcedMarch: false, legProgressMiles: 0, milesTraveled: 0, status: 'active', gmOverride: false, startedAt: { day: 1, slot: 0 } },
    } },
  };
  return { state, map, start };
}

describe('ensureJourneyIntegrity', () => {
  it('returns the same reference when the journey is valid', () => {
    const { state } = validState();
    expect(ensureJourneyIntegrity(state)).toBe(state);
  });

  it('clears a journey with a missing map', () => {
    const { state } = validState();
    state.entities.travelGroups!.g.journey!.mapId = 'missing';
    expect(ensureJourneyIntegrity(state).entities.travelGroups?.g.journey).toBeNull();
  });

  it('clears a journey whose route start differs from position', () => {
    const { state, map } = validState();
    state.entities.travelGroups!.g.journey!.routeTileIds[0] = map.grid[0][0];
    expect(ensureJourneyIntegrity(state).entities.travelGroups?.g.journey).toBeNull();
  });

  it('keeps the journey but clears an invalid navigator', () => {
    const { state } = validState();
    state.entities.travelGroups!.g.journey!.navigatorId = 'outsider';
    const ensured = ensureJourneyIntegrity(state);
    expect(ensured.entities.travelGroups?.g.journey?.navigatorId).toBeNull();
    expect(ensured.entities.travelGroups?.g.journey?.status).toBe('active');
  });
});
