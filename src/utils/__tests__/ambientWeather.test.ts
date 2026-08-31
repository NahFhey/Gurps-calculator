import { describe, expect, it, vi } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../mapUtils';
import {
  getActiveAmbientWeather,
  mapsWithPresence,
  regenerateMapWeatherIfNeeded,
  resolveWeatherContext,
} from '../ambientWeather';
import { getCurrentSeason, DEFAULT_CALENDAR } from '../timeSystem';
import { produce } from 'immer';

function fixture() {
  const state = createCampaignState();
  const first = createNewMap({ name: 'First', climate: 'oceanic', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const second = createNewMap({ name: 'Second', climate: 'arid', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  state.maps = { ...state.maps, activeMapId: second.id, mapsById: { [first.id]: first, [second.id]: second } };
  state.entities.travelGroups = {
    group: { id: 'group', name: 'Scouts', memberIds: [], vehicleId: null, position: { mapId: first.id, tileId: first.grid[4][4] } },
  };
  state.ui.activeTravelGroupId = 'group';
  return { state, first, second };
}

describe('ambient weather selectors', () => {
  it('resolves a map climate and custom table', () => {
    const { state, first } = fixture();
    state.locations.weatherTables.custom = { id: 'custom', name: 'Custom', entries: [] };
    first.weatherTableId = 'custom';
    expect(resolveWeatherContext(state, first.id)).toEqual({ climate: 'oceanic', weatherTable: state.locations.weatherTables.custom });
  });

  it('ignores a dangling custom table id', () => {
    const { state, first } = fixture();
    first.weatherTableId = 'missing';
    expect(resolveWeatherContext(state, first.id)).toEqual({ climate: 'oceanic', weatherTable: undefined });
  });

  it('finds maps with group presence', () => {
    const { state, first } = fixture();
    expect(mapsWithPresence(state)).toEqual(new Set([first.id]));
  });

  it('includes maps with parked vehicle presence', () => {
    const { state, first, second } = fixture();
    state.entities.vehicles = {
      vehicle: { id: 'vehicle', name: 'Ship', typeId: 'type', position: { kind: 'tile', mapId: second.id, tileId: second.grid[4][4] }, createdAt: 1, modifiedAt: 1 },
    };
    expect(mapsWithPresence(state)).toEqual(new Set([first.id, second.id]));
  });

  it('keys active ambient weather from the active group map', () => {
    const { state, first } = fixture();
    first.currentWeather = null;
    expect(getActiveAmbientWeather(state)).toEqual({ weather: null, mapId: first.id, mapName: 'First' });
  });

  it('falls back to the selected map when the active group is unplaced', () => {
    const { state, second } = fixture();
    const group = state.entities.travelGroups?.group;
    if (!group) throw new Error('Expected travel group');
    group.position = null;
    expect(getActiveAmbientWeather(state)).toMatchObject({ mapId: second.id, mapName: 'Second' });
  });

  it('regenerates missing weather', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, first } = fixture();
    const next = produce(state, (draft) => {
      expect(regenerateMapWeatherIfNeeded(draft, first.id, { day: 1, slot: 0, slotsPerDay: 3 }, getCurrentSeason(1, DEFAULT_CALENDAR))).toBe(true);
    });
    expect(next.maps.mapsById[first.id].currentWeather?.startedAt).toEqual({ day: 1, slot: 0 });
    vi.restoreAllMocks();
  });

  it('keeps unexpired weather unchanged', () => {
    const { state, first } = fixture();
    const weather = {
      weather: { type: 'clear' as const, intensity: 'light' as const, temperature: 'mild' as const, description: 'Clear', effects: { gathering: 0, hunting: 0, travel: 0, crafting: 0, alchemy: 0, cooking: 0, combat: 0, visibility: 0, hearing: 0, slipperyGround: false, reducedVisibility: false, difficultTerrain: false, coldExposure: false, heatExposure: false, fireRisk: 0, trackingMod: 0 } },
      startedAt: { day: 1, slot: 0 }, duration: { type: 'slots' as const, count: 2 }, expiresAt: { day: 1, slot: 2 },
    };
    first.currentWeather = weather;
    const next = produce(state, (draft) => {
      expect(regenerateMapWeatherIfNeeded(draft, first.id, { day: 1, slot: 1, slotsPerDay: 3 }, getCurrentSeason(1, DEFAULT_CALENDAR))).toBe(false);
    });
    expect(next.maps.mapsById[first.id].currentWeather).toBe(weather);
  });
});
