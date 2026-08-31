import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAllWeatherModifiers, useWeatherModifiers } from '../useWeatherModifiers';
import { createCampaignState, type CampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { BASE_WEATHER_EFFECTS } from '../../utils/weatherSystem';
import type { ActivityType } from '../useWeatherModifiers';
import type { LocationModifiers, WeatherEffects } from '../../types/location';

interface MockCampaignStoreValue {
  state: CampaignState;
  actions: Record<string, never>;
}

const useCampaignStoreMock = vi.hoisted(() => vi.fn<() => MockCampaignStoreValue>());

vi.mock('../../state/campaignStore', () => ({ useCampaignStore: useCampaignStoreMock }));

type ActivityEffects = Pick<WeatherEffects, ActivityType>;

function makeStore(opts?: {
  weatherEffects?: Partial<ActivityEffects>;
  locationModifiers?: Partial<LocationModifiers>;
  description?: string;
  withWeather?: boolean;
}): MockCampaignStoreValue {
  const state = createCampaignState();
  const map = createNewMap({
    name: 'Test Region',
    climate: 'temperate',
    scaleMilesPerTile: 12,
    startTerrainId: 'terrain-plains',
  });
  const tileId = map.grid[4][4];
  map.currentWeather = opts?.withWeather === false ? null : {
    weather: {
      type: 'clear',
      intensity: 'moderate',
      temperature: 'mild',
      description: opts?.description ?? 'Fresh woodland breeze',
      effects: {
        ...BASE_WEATHER_EFFECTS.clear,
        gathering: 0,
        hunting: 0,
        travel: 0,
        crafting: 0,
        alchemy: 0,
        cooking: 0,
        combat: 0,
        ...opts?.weatherEffects,
      } as WeatherEffects,
    },
    startedAt: { day: 1, slot: 0 },
    duration: { type: 'slots', count: 2 },
  };
  state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map } };
  state.entities.travelGroups = {
    group: { id: 'group', name: 'Party', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId } },
  };
  state.ui.activeTravelGroupId = 'group';
  const locationId = state.locations.currentLocationId;
  if (locationId) {
    state.locations.locations[locationId].modifiers = {
      gathering: 0,
      hunting: 0,
      foraging: 0,
      travel: 0,
      ...opts?.locationModifiers,
    };
  }
  return { state, actions: {} };
}

describe('useWeatherModifiers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combines ambient weather and current location modifiers', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      weatherEffects: { gathering: 2 },
      locationModifiers: { gathering: 1 },
    }));
    const { result } = renderHook(() => useWeatherModifiers('gathering'));
    expect(result.current.skillBonus).toBe(3);
    expect(result.current.locationName).toBe('Test Region');
    expect(result.current.effectDescription).toContain('+2 to gathering');
  });

  it('returns the empty result when the active map has no weather', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({ withWeather: false }));
    const { result } = renderHook(() => useWeatherModifiers('gathering'));
    expect(result.current).toEqual({
      modifiers: null,
      weather: null,
      locationName: null,
      skillBonus: 0,
      effectDescription: 'No weather data',
      hasEffect: false,
    });
  });

  it('reports no effect when ambient and location modifiers cancel', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      weatherEffects: { gathering: 2 },
      locationModifiers: { gathering: -2 },
    }));
    const { result } = renderHook(() => useWeatherModifiers('gathering'));
    expect(result.current.skillBonus).toBe(0);
    expect(result.current.hasEffect).toBe(false);
  });
});

describe('useAllWeatherModifiers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all ambient effects and location contributions', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      weatherEffects: { gathering: 2, crafting: -1 },
      locationModifiers: { gathering: 1 },
    }));
    const { result } = renderHook(() => useAllWeatherModifiers());
    expect(result.current.locationName).toBe('Test Region');
    expect(result.current.effects.gathering).toBe(3);
    expect(result.current.effects.crafting).toBe(-1);
  });

  it('returns zero effects when ambient weather is missing', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({ withWeather: false }));
    const { result } = renderHook(() => useAllWeatherModifiers());
    expect(result.current.weather).toBeNull();
    expect(Object.values(result.current.effects).every((effect) => effect === 0)).toBe(true);
    expect(result.current.hasAnyEffect).toBe(false);
  });
});
