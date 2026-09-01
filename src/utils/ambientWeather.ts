import type { Draft } from 'immer';
import type { CampaignState } from '../state/campaignReducer';
import type { ClimateType, Weather, WeatherTable } from '../types/location';
import type { MapId } from '../types/map';
import type { CurrentSeason } from './timeSystem';
import { generateWeather, isWeatherExpired } from './weatherSystem';
import { groupsOnMap, resolveGroupPosition, vehiclesOnMap } from './partyPosition';

export function resolveWeatherContext(
  state: Pick<CampaignState, 'maps' | 'locations'>,
  mapId: MapId
): { climate: ClimateType; weatherTable?: WeatherTable } {
  const map = state.maps.mapsById[mapId];
  const weatherTable = map?.weatherTableId
    ? state.locations.weatherTables[map.weatherTableId]
    : undefined;
  return {
    climate: map?.climate ?? 'temperate',
    weatherTable,
  };
}

export function regenerateMapWeatherIfNeeded(
  draft: Draft<CampaignState>,
  mapId: MapId,
  time: { day: number; slot: number; slotsPerDay: number },
  season: CurrentSeason
): boolean {
  const map = draft.maps.mapsById[mapId];
  if (!map) return false;
  if (map.currentWeather && !isWeatherExpired(map.currentWeather, time, time.slotsPerDay)) {
    return false;
  }

  const { climate, weatherTable } = resolveWeatherContext(draft, mapId);
  map.currentWeather = generateWeather({
    climate,
    weatherTable,
    currentTime: { day: time.day, slot: time.slot },
    season: season.def,
    weatherEffectOverrides: draft.locations.weatherEffectOverrides,
    slotsPerDay: time.slotsPerDay,
  }).weather;
  return true;
}

export function mapsWithPresence(state: Pick<CampaignState, 'maps' | 'entities'>): Set<MapId> {
  const result = new Set<MapId>();
  for (const mapId of Object.keys(state.maps.mapsById)) {
    if (groupsOnMap(state, mapId).length > 0 || vehiclesOnMap(state, mapId).length > 0) {
      result.add(mapId);
    }
  }
  return result;
}

export function getActiveAmbientWeather(
  state: Pick<CampaignState, 'maps' | 'entities'> & { ui: Pick<CampaignState['ui'], 'activeTravelGroupId'> }
): { weather: Weather | null; mapId: MapId | null; mapName: string | null } {
  const activeGroup = state.ui.activeTravelGroupId
    ? state.entities.travelGroups?.[state.ui.activeTravelGroupId]
    : undefined;
  const groupMapId = activeGroup ? resolveGroupPosition(state, activeGroup)?.mapId : undefined;
  const mapId = groupMapId && state.maps.mapsById[groupMapId]
    ? groupMapId
    : state.maps.activeMapId;
  const map = mapId ? state.maps.mapsById[mapId] : undefined;
  return {
    weather: map?.currentWeather?.weather ?? null,
    mapId: map?.id ?? null,
    mapName: map?.name ?? null,
  };
}
