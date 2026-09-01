import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../../campaignReducer';
import { createNewMap } from '../../../utils/mapUtils';

describe('journey checkpoints', () => {
  it('restores an active journey after aborting it', () => {
    const state = createCampaignState();
    const map = createNewMap({ name: 'Checkpoint', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
    const start = map.grid[4][4];
    const end = map.grid[4][5];
    state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map } };
    state.entities = {
      ...state.entities,
      characters: { a: { id: 'a', name: 'A', work: { skills: {} } } },
      travelGroups: { g: {
        id: 'g', name: 'G', memberIds: ['a'], vehicleId: null, position: { mapId: map.id, tileId: start },
        journey: { id: 'j', mapId: map.id, routeTileIds: [start, end], destinationTileId: end, mode: 'foot', navigatorId: 'a', gmNavigationSkill: 10, forcedMarch: false, legProgressMiles: 3, milesTraveled: 6, status: 'active', gmOverride: false, startedAt: { day: 1, slot: 0 } },
      } },
    };
    const checkpointed = campaignReducer(state, { type: 'createCheckpoint', payload: 'Journey snapshot' });
    const checkpointId = checkpointed.checkpoints.entries[0].id;
    const aborted = campaignReducer(checkpointed, { type: 'party/abortJourney', payload: { groupId: 'g' } });
    expect(aborted.entities.travelGroups?.g.journey).toBeNull();
    const restored = campaignReducer(aborted, { type: 'restoreCheckpoint', payload: checkpointId });
    expect(restored.entities.travelGroups?.g.journey).toMatchObject({ id: 'j', legProgressMiles: 3, milesTraveled: 6, status: 'active' });
  });
});
