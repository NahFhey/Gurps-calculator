import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { ensureAmbientWeather } from '../dataMigration';
import { hydrateCampaignState } from '../campaignStorage';
import { migrateTo1_5_7 } from '../../utils/dataMigrations';
import { DEFAULT_CALENDAR } from '../../utils/timeSystem';
import type { ActiveWeather, Location, WeatherEffects } from '../../types/location';

const effects: WeatherEffects = {
  gathering: 0, hunting: 0, travel: 0, crafting: 0, alchemy: 0, cooking: 0, combat: 0,
  visibility: 0, hearing: 0, slipperyGround: false, reducedVisibility: false,
  difficultTerrain: false, coldExposure: false, heatExposure: false, fireRisk: 0, trackingMod: 0,
};
const weather: ActiveWeather = {
  weather: { type: 'rain', intensity: 'moderate', temperature: 'cool', description: 'Rain', effects },
  startedAt: { day: 2, slot: 1 },
  duration: { type: 'slots', count: 2 },
};

function legacyState() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Legacy Map', climate: 'temperate', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map } };
  const locationId = state.locations.currentLocationId;
  if (!locationId) throw new Error('Expected seeded location');
  const legacy = state.locations.locations[locationId] as Location & Record<string, unknown>;
  // Legacy keys are intentionally plain string literals for migration tests.
  legacy['currentWeather'] = weather;
  legacy['weatherTableId'] = 'legacy-table';
  delete state.time.calendar;
  return { state, map, locationId };
}

describe('ensureAmbientWeather', () => {
  it('moves active location weather to the active map and strips legacy keys', () => {
    const { state, map, locationId } = legacyState();
    const next = ensureAmbientWeather(state);
    expect(next.maps.mapsById[map.id].currentWeather).toEqual(weather);
    expect('currentWeather' in next.locations.locations[locationId]).toBe(false);
    expect('weatherTableId' in next.locations.locations[locationId]).toBe(false);
  });

  it('defaults the campaign calendar', () => {
    expect(ensureAmbientWeather(legacyState().state).time.calendar).toEqual(DEFAULT_CALENDAR);
  });

  it('is idempotent after cleanup', () => {
    const first = ensureAmbientWeather(legacyState().state);
    expect(ensureAmbientWeather(first)).toBe(first);
  });

  it('returns the same reference for an already clean state', () => {
    const state = createCampaignState();
    expect(ensureAmbientWeather(state)).toBe(state);
  });

  it('hydrateCampaignState safely defaults missing location and time slices', () => {
    const base = createCampaignState();
    const partial = { ...base, locations: undefined, time: undefined } as unknown as Parameters<typeof hydrateCampaignState>[0];
    const hydrated = hydrateCampaignState(partial);
    expect(hydrated.locations.locations).toBeDefined();
    expect(hydrated.time.calendar).toEqual(DEFAULT_CALENDAR);
  });
});

describe('migrateTo1_5_7', () => {
  it('performs the raw registry migration for export/import parity', () => {
    const { state, map, locationId } = legacyState();
    const migrated = migrateTo1_5_7(state as unknown as Record<string, unknown>);
    const maps = migrated.maps as { mapsById: Record<string, Record<string, unknown>> };
    const locations = migrated.locations as { locations: Record<string, Record<string, unknown>> };
    expect(maps.mapsById[map.id].currentWeather).toEqual(weather);
    expect(maps.mapsById[map.id].climate).toBe('temperate');
    expect(locations.locations[locationId]).not.toHaveProperty('currentWeather');
    expect(migrated.time).toEqual(expect.objectContaining({ calendar: DEFAULT_CALENDAR }));
  });

  it('keeps existing map weather instead of overwriting it', () => {
    const { state, map } = legacyState();
    const existing = { ...weather, startedAt: { day: 8, slot: 0 } };
    map.currentWeather = existing;
    const migrated = migrateTo1_5_7(state as unknown as Record<string, unknown>);
    const maps = migrated.maps as { mapsById: Record<string, Record<string, unknown>> };
    expect(maps.mapsById[map.id].currentWeather).toEqual(existing);
  });
});
