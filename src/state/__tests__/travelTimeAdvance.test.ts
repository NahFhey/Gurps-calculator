import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import type { MapModel } from '../../types/map';

type TravelFixture = {
  state: CampaignState;
  map: MapModel;
  originTileId: string;
  destinationTileId: string;
};

const makeTravelFixture = (): TravelFixture => {
  const state = createCampaignState();
  const map = createNewMap({
    name: 'Travel Test Map',
    scaleMilesPerTile: 12,
    startTerrainId: 'terrain-plains',
  });
  const originTileId = map.partyTileId;
  if (!originTileId) throw new Error('Expected a starting party tile');
  const destinationTileId = map.grid.flat().find((tileId) => tileId !== originTileId);
  if (!destinationTileId) throw new Error('Expected a destination tile');
  state.maps.mapsById = { [map.id]: map };
  state.maps.activeMapId = map.id;
  return { state, map, originTileId, destinationTileId };
};

const executeTravel = ({ state, map, originTileId, destinationTileId }: TravelFixture) =>
  campaignReducer(state, {
    type: 'map/executeTravel',
    payload: {
      mapId: map.id,
      routeTileIds: [originTileId, destinationTileId],
      destinationTileId,
      mode: 'foot',
      gmOverride: false,
    },
  });

const expireCurrentWeatherAt = (state: CampaignState, day: number, slot: number): void => {
  const locationId = state.locations.currentLocationId;
  if (!locationId) throw new Error('Expected a current location');
  const location = state.locations.locations[locationId];
  location.currentWeather = {
    ...location.currentWeather,
    startedAt: { day: 0, slot: 0 },
    expiresAt: { day, slot },
  };
};

describe('campaign travel time advancement', () => {
  it('advances exactly one slot and increments the day at wraparound', () => {
    const fixture = makeTravelFixture();
    fixture.state.time.day = 4;
    fixture.state.time.slot = fixture.state.time.slotsPerDay - 1;

    const result = executeTravel(fixture);

    expect(result.time).toMatchObject({ day: 5, slot: 0 });
    expect(result.time.history).toHaveLength(1);
  });

  it('pushes one pre-travel checkpoint whose snapshot retains the origin tile', () => {
    const fixture = makeTravelFixture();

    const result = executeTravel(fixture);

    expect(result.checkpoints.entries).toHaveLength(1);
    expect(result.checkpoints.entries[0].label).toBe('Before travel');
    expect(result.checkpoints.entries[0].snapshot.maps.mapsById[fixture.map.id].partyTileId)
      .toBe(fixture.originTileId);
    expect(result.maps.mapsById[fixture.map.id].partyTileId).toBe(fixture.destinationTileId);
  });

  it('regenerates weather that expires at the post-travel time', () => {
    const fixture = makeTravelFixture();
    fixture.state.time.day = 2;
    fixture.state.time.slot = 0;
    expireCurrentWeatherAt(fixture.state, 2, 1);

    const result = executeTravel(fixture);
    const locationId = result.locations.currentLocationId;
    if (!locationId) throw new Error('Expected a current location');

    expect(result.locations.locations[locationId].currentWeather.startedAt).toEqual({ day: 2, slot: 1 });
  });

  it('blocks before movement, reveal, checkpoint, or time advance when an activity is paused', () => {
    const fixture = makeTravelFixture();
    fixture.state.activities.pausedSessionIds = ['paused-session'];
    const revealedBefore = new Set(fixture.map.revealedTileIds);

    const result = executeTravel(fixture);

    expect(result.maps.mapsById[fixture.map.id].partyTileId).toBe(fixture.originTileId);
    expect(result.maps.mapsById[fixture.map.id].revealedTileIds).toEqual(revealedBefore);
    expect(result.time).toMatchObject({ day: 1, slot: 0 });
    expect(result.checkpoints.entries).toHaveLength(0);
    expect(result.ui.blockingError).toMatchObject({
      type: 'pausedActivities',
      system: 'time',
    });
  });

  it('keeps plain time advance guard, checkpoint, slot, and weather behavior in parity', () => {
    const blockedState = createCampaignState();
    blockedState.activities.pausedSessionIds = ['paused-session'];
    const blocked = campaignReducer(blockedState, { type: 'advanceTime' });
    expect(blocked.time).toMatchObject({ day: 1, slot: 0 });
    expect(blocked.checkpoints.entries).toHaveLength(0);
    expect(blocked.ui.blockingError?.type).toBe('pausedActivities');

    const advancingState = createCampaignState();
    expireCurrentWeatherAt(advancingState, 1, 1);
    const advanced = campaignReducer(advancingState, { type: 'advanceTime' });
    const locationId = advanced.locations.currentLocationId;
    if (!locationId) throw new Error('Expected a current location');
    expect(advanced.time).toMatchObject({ day: 1, slot: 1 });
    expect(advanced.checkpoints.entries).toHaveLength(1);
    expect(advanced.checkpoints.entries[0].label).toBe('Before time advance');
    expect(advanced.locations.locations[locationId].currentWeather.startedAt)
      .toEqual({ day: 1, slot: 1 });
    expect(advanced.ui.blockingError).toBeNull();
  });
});
