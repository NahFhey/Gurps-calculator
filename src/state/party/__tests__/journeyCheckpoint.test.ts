import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../../campaignReducer';
import type { CampaignState } from '../../campaignReducer';
import { hydrateCampaignState, serializeCampaignState } from '../../../persistence/campaignStorage';
import type { CampaignDTO } from '../../../persistence/campaignCodec';
import { isRoutableMap } from '../../../utils/mapScale';
import { createNewMap } from '../../../utils/mapUtils';
import { restoreCheckpoint } from '../../../test/restoreCheckpoint';

describe('journey checkpoints', () => {
  it('restores a valid scale from a checkpoint in a hydrated 1.6.3 campaign', () => {
    const state = createCampaignState();
    const map = createNewMap({ name: 'Legacy checkpoint', scale: '50mi', startTerrainId: 'terrain-plains' });
    const { scale: _scale, ...rest } = map;
    // Legacy keys are intentionally plain string literals for migration tests.
    const legacy = { ...state, maps: { ...state.maps, activeMapId: map.id, mapsById: {
      [map.id]: { ...rest, scaleMilesPerTile: 50 },
    } } } as unknown as CampaignState;
    const checkpointed = campaignReducer(legacy, { type: 'createCheckpoint', payload: 'Legacy' });
    const payload: CampaignDTO = JSON.parse(JSON.stringify({
      ...serializeCampaignState(checkpointed), schemaVersion: '1.6.3',
    }));
    const hydrated = hydrateCampaignState(payload);
    const restored = restoreCheckpoint(hydrated, hydrated.checkpoints.entries[0].id);
    expect(restored.maps.activeMapId).toBe(map.id);
    const restoredMap = restored.maps.mapsById[map.id];
    expect(restoredMap.scale).toBe('50mi');
    expect(restoredMap).not.toHaveProperty('scaleMilesPerTile');
    expect(() => isRoutableMap(restoredMap)).not.toThrow();
    expect(isRoutableMap(restoredMap)).toBe(true);
  });

  it('restores an active journey after aborting it', () => {
    const state = createCampaignState();
    const map = createNewMap({ name: 'Checkpoint', scale: '12mi', startTerrainId: 'terrain-plains' });
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
    const restored = restoreCheckpoint(aborted, checkpointId);
    expect(restored.entities.travelGroups?.g.journey).toMatchObject({ id: 'j', legProgressMiles: 3, milesTraveled: 6, status: 'active' });
  });
});
