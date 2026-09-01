import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import type { MapModel } from '../../types/map';
import { BASE_WEATHER_EFFECTS } from '../../utils/weatherSystem';
import type { WeatherEffects } from '../../types/location';

type TravelFixture = {
  state: CampaignState;
  map: MapModel;
  originTileId: string;
  destinationTileId: string;
  groupId: string;
};

const makeTravelFixture = (): TravelFixture => {
  const state = createCampaignState();
  const map = createNewMap({
    name: 'Travel Test Map',
    scaleMilesPerTile: 12,
    startTerrainId: 'terrain-plains',
  });
  const originTileId = map.grid[4][4];
  const destinationTileId = map.grid.flat().find((tileId) => tileId !== originTileId);
  if (!destinationTileId) throw new Error('Expected a destination tile');
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  const groupId = 'travel-group';
  state.entities = {
    ...state.entities,
    characters: {
      ...state.entities.characters,
      traveler: { id: 'traveler', name: 'Traveler', work: { skills: {} } },
    },
    travelGroups: { [groupId]: {
      id: groupId,
      name: 'The Party',
      memberIds: ['traveler'],
      vehicleId: null,
      position: { mapId: map.id, tileId: originTileId },
    } },
  };
  state.ui.activeTravelGroupId = groupId;
  return { state, map, originTileId, destinationTileId, groupId };
};

const armJourney = ({ state, map, originTileId, destinationTileId, groupId }: TravelFixture) =>
  campaignReducer(state, {
    type: 'party/armJourney',
    payload: {
      groupId,
      journey: {
        mapId: map.id, routeTileIds: [originTileId, destinationTileId], destinationTileId,
        mode: 'foot', navigatorId: null, gmNavigationSkill: 18,
        forcedMarch: true, gmOverride: false,
      },
    },
  });

const progressJourney = (fixture: TravelFixture) =>
  campaignReducer(armJourney(fixture), { type: 'advanceTime' });

const expireCurrentWeatherAt = (state: CampaignState, day: number, slot: number): void => {
  const mapId = state.maps.activeMapId;
  if (!mapId) throw new Error('Expected an active map');
  state.maps.mapsById[mapId].currentWeather = {
    weather: {
      type: 'clear',
      intensity: 'moderate',
      temperature: 'mild',
      description: 'Clear skies, mild',
      effects: { ...BASE_WEATHER_EFFECTS.clear } as WeatherEffects,
    },
    duration: { type: 'slots', count: 1 },
    startedAt: { day: 0, slot: 0 },
    expiresAt: { day, slot },
  };
};

describe('campaign travel time advancement', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0));
  afterEach(() => vi.restoreAllMocks());
  it('advances exactly one slot and increments the day at wraparound', () => {
    const fixture = makeTravelFixture();
    fixture.state.time.day = 4;
    fixture.state.time.slot = fixture.state.time.slotsPerDay - 1;

    const result = progressJourney(fixture);

    expect(result.time).toMatchObject({ day: 5, slot: 0 });
    expect(result.time.history).toHaveLength(1);
  });

  it('pushes one pre-travel checkpoint whose snapshot retains the origin tile', () => {
    const fixture = makeTravelFixture();

    const result = progressJourney(fixture);

    expect(result.checkpoints.entries).toHaveLength(1);
    expect(result.checkpoints.entries[0].label).toBe('Before time advance');
    expect(result.checkpoints.entries[0].snapshot.entities.travelGroups?.[fixture.groupId].position)
      .toEqual({ mapId: fixture.map.id, tileId: fixture.originTileId });
    expect(result.entities.travelGroups?.[fixture.groupId].position)
      .toEqual({ mapId: fixture.map.id, tileId: fixture.destinationTileId });
  });

  it('regenerates weather that expires at the post-travel time', () => {
    const fixture = makeTravelFixture();
    fixture.state.time.day = 2;
    fixture.state.time.slot = 0;
    expireCurrentWeatherAt(fixture.state, 2, 1);

    const result = progressJourney(fixture);
    expect(result.maps.mapsById[fixture.map.id].currentWeather?.startedAt).toEqual({ day: 2, slot: 1 });
  });

  it('blocks before movement, reveal, checkpoint, or time advance when an activity is paused', () => {
    const fixture = makeTravelFixture();
    fixture.state.activities.pausedSessionIds = ['paused-session'];
    const revealedBefore = new Set(fixture.map.revealedTileIds);

    const result = campaignReducer(armJourney(fixture), { type: 'advanceTime' });

    expect(result.entities.travelGroups?.[fixture.groupId].position)
      .toEqual({ mapId: fixture.map.id, tileId: fixture.originTileId });
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

    const advancingFixture = makeTravelFixture();
    expireCurrentWeatherAt(advancingFixture.state, 1, 1);
    const advanced = campaignReducer(advancingFixture.state, { type: 'advanceTime' });
    expect(advanced.time).toMatchObject({ day: 1, slot: 1 });
    expect(advanced.checkpoints.entries).toHaveLength(1);
    expect(advanced.checkpoints.entries[0].label).toBe('Before time advance');
    expect(advanced.maps.mapsById[advancingFixture.map.id].currentWeather?.startedAt)
      .toEqual({ day: 1, slot: 1 });
    expect(advanced.ui.blockingError).toBeNull();
  });
});
