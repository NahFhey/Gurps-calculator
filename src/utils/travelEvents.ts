import type { CampaignState } from '../state/campaignReducer';
import type { MapId, TerrainId } from '../types/map';
import type { WeatherType } from '../types/location';
import type { TravelEventEntry, TravelEventTable, TravelEventTableSet } from '../types/travelEvents';
import { TRAVEL_EVENT_SET_SEED } from '../constants/travelEventSeeds';

export function resolveTravelEventTable(
  state: Pick<CampaignState, 'entities' | 'maps'>,
  mapId: MapId,
  terrainId: TerrainId | null
): TravelEventTable | null {
  const tables = state.entities.travelEventTables ?? {};
  const sets = state.entities.travelEventTableSets ?? {};
  const deleted = new Set(state.entities.deletedBuiltinTravelEventIds ?? []);
  const overrideId = state.maps.mapsById[mapId]?.travelEventTableSetId;
  let set: TravelEventTableSet | undefined = overrideId ? sets[overrideId] : undefined;
  if (!set && !deleted.has(TRAVEL_EVENT_SET_SEED.id)) {
    set = sets[TRAVEL_EVENT_SET_SEED.id] ?? TRAVEL_EVENT_SET_SEED;
  }
  if (!set) return null;
  const terrainTable = terrainId ? tables[set.byTerrain[terrainId] ?? ''] : undefined;
  if (terrainTable) return terrainTable;
  return set.fallbackTableId ? tables[set.fallbackTableId] ?? null : null;
}

export interface TravelEventContext {
  weatherType: WeatherType | null;
  isNightSlot: boolean;
  forcedMarch: boolean;
}

export function rollTravelEvent(
  table: TravelEventTable,
  ctx: TravelEventContext
): TravelEventEntry | null {
  const entries = table.entries.filter((candidate) => {
    if (candidate.weight <= 0) return false;
    const conditions = candidate.conditions;
    if (conditions?.weatherTypes && (!ctx.weatherType || !conditions.weatherTypes.includes(ctx.weatherType))) return false;
    if (conditions?.nightOnly && !ctx.isNightSlot) return false;
    if (conditions?.forcedMarchOnly && !ctx.forcedMarch) return false;
    return true;
  });
  const totalWeight = entries.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (totalWeight <= 0) return null;
  let roll = Math.random() * totalWeight;
  const selected = entries.find((candidate) => {
    roll -= candidate.weight;
    return roll < 0;
  }) ?? entries[entries.length - 1];
  return selected.kind === 'nothing' ? null : selected;
}
