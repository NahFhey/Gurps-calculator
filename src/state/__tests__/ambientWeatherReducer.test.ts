import { describe, expect, it, vi } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import type { ActiveWeather, WeatherEffects } from '../../types/location';

const effects: WeatherEffects = {
  gathering: 0, hunting: 0, travel: 0, crafting: 0, alchemy: 0, cooking: 0, combat: 0,
  visibility: 0, hearing: 0, slipperyGround: false, reducedVisibility: false,
  difficultTerrain: false, coldExposure: false, heatExposure: false, fireRisk: 0, trackingMod: 0,
};

function activeWeather(expiresAt = { day: 1, slot: 1 }): ActiveWeather {
  return {
    weather: { type: 'clear', intensity: 'light', temperature: 'mild', description: 'Clear', effects },
    startedAt: { day: 0, slot: 0 },
    duration: { type: 'slots', count: 1 },
    expiresAt,
  };
}

function fixture(): CampaignState {
  const state = createCampaignState();
  const active = createNewMap({ name: 'Active', climate: 'temperate', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const parked = createNewMap({ name: 'Parked', climate: 'arid', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const empty = createNewMap({ name: 'Empty', climate: 'arctic', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  active.currentWeather = activeWeather();
  parked.currentWeather = activeWeather();
  empty.currentWeather = activeWeather();
  state.maps = { ...state.maps, activeMapId: empty.id, mapsById: { [active.id]: active, [parked.id]: parked, [empty.id]: empty } };
  state.entities.travelGroups = {
    group: { id: 'group', name: 'Party', memberIds: [], vehicleId: null, position: { mapId: active.id, tileId: active.grid[4][4] } },
  };
  state.entities.vehicles = {
    parked: { id: 'parked', name: 'Ship', typeId: 'type', position: { kind: 'tile', mapId: parked.id, tileId: parked.grid[4][4] }, createdAt: 1, modifiedAt: 1 },
  };
  state.ui.activeTravelGroupId = 'group';
  return state;
}

describe('map ambient weather reducer integration', () => {
  it('regenerates expired weather only on maps with presence', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = fixture();
    const [activeId, parkedId, emptyId] = Object.keys(state.maps.mapsById);
    const next = campaignReducer(state, { type: 'advanceTime' });
    expect(next.maps.mapsById[activeId].currentWeather?.startedAt).toEqual({ day: 1, slot: 1 });
    expect(next.maps.mapsById[parkedId].currentWeather?.startedAt).toEqual({ day: 1, slot: 1 });
    expect(next.maps.mapsById[emptyId].currentWeather?.startedAt).toEqual({ day: 0, slot: 0 });
    vi.restoreAllMocks();
  });

  it('logs weather changes only for the active group map', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const next = campaignReducer(fixture(), { type: 'advanceTime' });
    const weatherLogs = next.logs.entries.filter((entry) => entry.type === 'weather.changed');
    expect(weatherLogs).toHaveLength(1);
    expect(weatherLogs[0].payload.message).toContain('Active');
    vi.restoreAllMocks();
  });

  it('generates weather on group placement without advancing time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = fixture();
    const destination = Object.values(state.maps.mapsById)[2];
    destination.currentWeather = null;
    const group = state.entities.travelGroups?.group;
    if (!group) throw new Error('Expected travel group');
    group.position = null;
    const next = campaignReducer(state, {
      type: 'party/placeGroup',
      payload: { groupId: 'group', mapId: destination.id, tileId: destination.grid[4][4] },
    });
    expect(next.time).toMatchObject({ day: 1, slot: 0 });
    expect(next.maps.mapsById[destination.id].currentWeather?.startedAt).toEqual({ day: 1, slot: 0 });
    vi.restoreAllMocks();
  });

  it('rollNewWeather rerolls the requested map', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = fixture();
    const mapId = Object.keys(state.maps.mapsById)[2];
    const next = campaignReducer(state, { type: 'rollNewWeather', payload: { mapId } });
    expect(next.maps.mapsById[mapId].currentWeather?.startedAt).toEqual({ day: 1, slot: 0 });
    expect(next.logs.entries.some((entry) => entry.type === 'weather.changed')).toBe(true);
    vi.restoreAllMocks();
  });

  it('setMapWeather replaces weather on the requested map', () => {
    const state = fixture();
    const mapId = Object.keys(state.maps.mapsById)[0];
    const weather = activeWeather({ day: 9, slot: 2 });
    const next = campaignReducer(state, { type: 'setMapWeather', payload: { mapId, weather } });
    expect(next.maps.mapsById[mapId].currentWeather).toEqual(weather);
  });

  it('setCalendarConfig replaces the calendar as a whole', () => {
    const state = fixture();
    const calendar = { seasons: [{ name: 'Monsoon', days: 20, temperatureShift: 0, precipitationMultiplier: 2 }], startSeasonIndex: 0 };
    const next = campaignReducer(state, { type: 'setCalendarConfig', payload: calendar });
    expect(next.time.calendar).toEqual(calendar);
  });
});
