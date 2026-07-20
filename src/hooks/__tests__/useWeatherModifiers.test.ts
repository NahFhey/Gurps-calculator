import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAllWeatherModifiers, useWeatherModifiers } from '../useWeatherModifiers';
import { createInitialLocationState } from '../../utils/weatherSystem';
import type { ActivityType } from '../useWeatherModifiers';
import type { WeatherEffects, LocationModifiers } from '../../types/location';

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(),
}));

import { useCampaignStore } from '../../state/campaignStore';

const mockedUseCampaignStore = vi.mocked(useCampaignStore);

type ActivityEffects = Pick<WeatherEffects, ActivityType>;

function makeLocationsSlice(opts?: {
  weatherEffects?: Partial<ActivityEffects>;
  locationModifiers?: Partial<LocationModifiers>;
  description?: string;
}) {
  const slice = createInitialLocationState({ day: 1, slot: 0 });
  const locationId = slice.currentLocationId;

  if (!locationId) {
    throw new Error('Expected the initial location state to have a current location');
  }

  const location = slice.locations[locationId];
  location.name = 'Test Camp';
  location.currentWeather.weather.effects = {
    ...location.currentWeather.weather.effects,
    gathering: 0,
    hunting: 0,
    travel: 0,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: 0,
    ...opts?.weatherEffects,
  };
  location.modifiers = {
    gathering: 0,
    hunting: 0,
    foraging: 0,
    travel: 0,
    ...opts?.locationModifiers,
  };

  if (opts?.description !== undefined) {
    location.currentWeather.weather.description = opts.description;
  }

  return slice;
}

function makeEmptyLocationsSlice() {
  return {
    currentLocationId: null,
    locations: {},
    weatherTables: {},
    activeTravels: [],
  };
}

describe('useWeatherModifiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines the weather and location modifiers for a known activity', () => {
    const locations = makeLocationsSlice({
      weatherEffects: { gathering: 2 },
      locationModifiers: { gathering: 1 },
      description: 'Fresh woodland breeze',
    });

    mockedUseCampaignStore.mockReturnValue({
      state: { locations },
      actions: {},
    } as any);

    const { result } = renderHook(() => useWeatherModifiers('gathering'));

    expect(result.current.skillBonus).toBe(3);
    expect(result.current.modifiers).toEqual({
      skillBonus: 3,
      description: 'Fresh woodland breeze (+2 to gathering)',
    });
    expect(result.current.hasEffect).toBe(true);
    expect(result.current.locationName).toBe('Test Camp');
    expect(result.current.weather).not.toBeNull();
    expect(result.current.effectDescription).toBe('Fresh woodland breeze (+2 to gathering)');
  });

  it('returns the empty result when there is no current location', () => {
    mockedUseCampaignStore.mockReturnValue({
      state: { locations: makeEmptyLocationsSlice() },
      actions: {},
    } as any);

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

  it('reports no effect when weather and location modifiers cancel out', () => {
    const locations = makeLocationsSlice({
      weatherEffects: { gathering: 2 },
      locationModifiers: { gathering: -2 },
      description: 'Helpful weather in difficult terrain',
    });

    mockedUseCampaignStore.mockReturnValue({
      state: { locations },
      actions: {},
    } as any);

    const { result } = renderHook(() => useWeatherModifiers('gathering'));

    expect(result.current.skillBonus).toBe(0);
    expect(result.current.modifiers).toEqual({
      skillBonus: 0,
      description: 'Helpful weather in difficult terrain (+2 to gathering)',
    });
    expect(result.current.hasEffect).toBe(false);
    expect(result.current.weather).not.toBeNull();
  });
});

describe('useAllWeatherModifiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all weather effects and adds location modifiers where applicable', () => {
    const locations = makeLocationsSlice({
      weatherEffects: { gathering: 2, crafting: -1 },
      locationModifiers: { gathering: 1 },
      description: 'Mixed conditions',
    });

    mockedUseCampaignStore.mockReturnValue({
      state: { locations },
      actions: {},
    } as any);

    const { result } = renderHook(() => useAllWeatherModifiers());

    expect(result.current.weather).not.toBeNull();
    expect(result.current.locationName).toBe('Test Camp');
    expect(result.current.effects).toEqual({
      gathering: 3,
      hunting: 0,
      travel: 0,
      crafting: -1,
      alchemy: 0,
      cooking: 0,
      combat: 0,
    });
    expect(result.current.hasAnyEffect).toBe(true);
  });

  it('returns zero effects when there is no current location', () => {
    mockedUseCampaignStore.mockReturnValue({
      state: { locations: makeEmptyLocationsSlice() },
      actions: {},
    } as any);

    const { result } = renderHook(() => useAllWeatherModifiers());

    expect(result.current.weather).toBeNull();
    expect(result.current.locationName).toBeNull();
    expect(result.current.effects).toEqual({
      gathering: 0,
      hunting: 0,
      travel: 0,
      crafting: 0,
      alchemy: 0,
      cooking: 0,
      combat: 0,
    });
    expect(Object.values(result.current.effects).every(effect => effect === 0)).toBe(true);
    expect(result.current.hasAnyEffect).toBe(false);
  });
});
