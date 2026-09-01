import type { Character, Id } from '../types/campaign';
import type { DowntimeState } from '../types/downtime';
import type { EncumbranceLevel } from '../types/characterSheet';
import type { MapModel, TileId, TravelBlocker, TravelMode } from '../types/map';
import { TRAVEL_BLOCKER_CODES } from '../types/map';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../types/party';
import { getTravelModeDefinition, SCALE_TO_MODES } from '../constants/map';
import { selectAssignedCharacterIdsForSlot } from '../state/downtime/downtimeSelectors';
import { computeRouteMiles } from './mapRouter';
import { findTileGridPos } from './mapUtils';
import { isAbleBodied } from './partyPosition';
import { MOVE_MULTIPLIERS } from './encumbrance';
import { getNightSlotIndices } from './timeSystem';

export function computeSlotBudgetMiles(input: {
  mode: TravelMode;
  vehicleType: VehicleTypeDef | null;
  weatherTravelModifier: number;
  worstEncumbranceLevel: EncumbranceLevel | null;
}): number {
  const base = input.vehicleType?.speedMilesPerSlot
    ?? getTravelModeDefinition(input.mode).milesPerSlot;
  const weatherAdjusted = base + base * (input.weatherTravelModifier / 10);
  const encumbranceMultiplier = input.mode === 'foot' && input.worstEncumbranceLevel !== null
    ? MOVE_MULTIPLIERS[input.worstEncumbranceLevel]
    : 1;
  return Math.max(1, weatherAdjusted * encumbranceMultiplier);
}

export interface TravelValidationInput {
  map: MapModel;
  routeTileIds: TileId[];
  mode: TravelMode;
  group: TravelGroup;
  characters: Record<Id, Character>;
  vehicle: Vehicle | null;
  vehicleType: VehicleTypeDef | null;
  day: number;
  slot: number;
  downtimeState: DowntimeState;
  isGmMode: boolean;
  weatherTravelModifier?: number;
}

export function validateTravelRoute(input: TravelValidationInput): TravelBlocker[] {
  const {
    map,
    routeTileIds,
    mode,
    group,
    characters,
    vehicle,
    vehicleType,
    day,
    slot,
    downtimeState,
    isGmMode,
  } = input;
  const blockers: TravelBlocker[] = [];
  const allowedModes = SCALE_TO_MODES[map.scaleMilesPerTile];

  if (group.vehicleId) {
    if (!vehicleType || vehicleType.mode !== mode || !allowedModes.includes(vehicleType.mode)) {
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.VEHICLE_MODE_INCOMPATIBLE,
        message: vehicle && vehicleType
          ? `${vehicleType.name} cannot travel in ${mode} mode on this map scale.`
          : 'The group has no valid vehicle and vehicle type for travel.',
        details: [`Available modes: ${allowedModes.join(', ')}.`],
      });
    }
  } else if (mode !== 'foot' || !allowedModes.includes(mode)) {
    blockers.push({
      code: TRAVEL_BLOCKER_CODES.MODE_INCOMPATIBLE,
      message: `${mode} travel is not available on ${map.scaleMilesPerTile}-mile maps.`,
      details: [`Available modes: ${allowedModes.join(', ')}.`],
    });
  }

  const assignedIds = selectAssignedCharacterIdsForSlot(downtimeState, day, slot);
  const busyMembers = group.memberIds.filter((id) => assignedIds.has(id));
  if (busyMembers.length > 0) {
    blockers.push({
      code: TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME,
      message: `${busyMembers.length} group member(s) are assigned to downtime tasks this slot.`,
      details: busyMembers.map((id) => characters[id]?.name ?? id),
    });
  }

  const incapacitatedMembers = group.memberIds.filter((id) => {
    const character = characters[id];
    return character ? !isAbleBodied(character) : false;
  });
  const ableBodiedIds = group.memberIds.filter((id) => {
    const character = characters[id];
    return character ? isAbleBodied(character) : false;
  });
  if (!group.vehicleId && ableBodiedIds.length === 0) {
    const names = incapacitatedMembers.map((id) => characters[id]?.name ?? id);
    blockers.push({
      code: TRAVEL_BLOCKER_CODES.PARTY_INCAPACITATED,
      message: names.length > 0
        ? `No able-bodied members can travel: ${names.join(', ')}.`
        : 'No able-bodied members can travel.',
      details: names,
    });
  }

  if (vehicle && vehicleType) {
    const availableCrew = ableBodiedIds.filter((id) => !assignedIds.has(id));
    if (availableCrew.length < vehicleType.minCrew) {
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.INSUFFICIENT_CREW,
        message: `Insufficient crew to operate ${vehicle.name}.`,
        details: [
          `Required able-bodied crew: ${vehicleType.minCrew}`,
          `Available able-bodied crew: ${availableCrew.length}`,
        ],
      });
    }
  }

  if (!isGmMode && routeTileIds.length > 0) {
    const nullTerrainTiles: string[] = [];
    for (const tileId of routeTileIds) {
      const tile = map.tilesById[tileId];
      if (tile?.terrainId === null) {
        const pos = findTileGridPos(map, tileId);
        nullTerrainTiles.push(pos ? `(${pos.row}, ${pos.col})` : tileId);
      }
    }
    if (nullTerrainTiles.length > 0) {
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.NULL_TERRAIN_ON_ROUTE,
        message: `${nullTerrainTiles.length} tile(s) on the route have no terrain assigned.`,
        details: nullTerrainTiles,
      });
    }
  }

  if (routeTileIds.length > 0) {
    const impassableTiles: string[] = [];
    for (const tileId of routeTileIds) {
      const tile = map.tilesById[tileId];
      if (!tile?.terrainId) continue;
      const terrain = map.terrainById[tile.terrainId];
      if (!terrain) continue;
      const modeProps = terrain.perMode[mode];
      if (!modeProps?.passable) {
        const pos = findTileGridPos(map, tileId);
        impassableTiles.push(`${terrain.name} at ${pos ? `(${pos.row}, ${pos.col})` : tileId}`);
      }
    }
    if (impassableTiles.length > 0) {
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.IMPASSABLE_TERRAIN,
        message: `${impassableTiles.length} tile(s) on the route are impassable for ${mode} travel.`,
        details: impassableTiles,
      });
    }
  }

  return blockers;
}

export interface RouteStatsOptions {
  weatherTravelModifier?: number;
  vehicle?: Vehicle | null;
  vehicleType?: VehicleTypeDef | null;
  worstEncumbranceLevel?: EncumbranceLevel | null;
  slotsPerDay?: number;
  nightSlotIndices?: number[];
}

export function getRouteStats(
  map: MapModel,
  routeTileIds: TileId[],
  mode: TravelMode,
  options: RouteStatsOptions = {}
): {
  tileCount: number;
  totalMiles: number;
  budgetMilesPerSlot: number;
  estimatedMovingSlots: number;
  estimatedDays: number;
  terrainBreakdown: { name: string; count: number }[];
} {
  const budgetMilesPerSlot = computeSlotBudgetMiles({
    mode,
    vehicleType: options.vehicle ? options.vehicleType ?? null : null,
    weatherTravelModifier: options.weatherTravelModifier ?? 0,
    worstEncumbranceLevel: options.worstEncumbranceLevel ?? null,
  });
  const rawMiles = routeTileIds.length > 1 ? computeRouteMiles(map, routeTileIds, mode) : 0;
  const totalMiles = Number.isFinite(rawMiles) ? rawMiles : 0;
  const terrainCounts = new Map<string, number>();
  for (const tileId of routeTileIds) {
    const tile = map.tilesById[tileId];
    if (!tile) continue;
    const name = tile.terrainId
      ? map.terrainById[tile.terrainId]?.name ?? 'Unknown'
      : 'Unassigned';
    terrainCounts.set(name, (terrainCounts.get(name) ?? 0) + 1);
  }
  const terrainBreakdown = Array.from(terrainCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const estimatedMovingSlots = Math.max(1, Math.ceil(totalMiles / budgetMilesPerSlot));
  const slotsPerDay = Math.max(1, options.slotsPerDay ?? 3);
  const movingSlotsPerDay = Math.max(
    1,
    slotsPerDay - getNightSlotIndices(slotsPerDay, options.nightSlotIndices).length
  );
  return {
    tileCount: routeTileIds.length,
    totalMiles,
    budgetMilesPerSlot,
    estimatedMovingSlots,
    estimatedDays: Math.ceil(estimatedMovingSlots / movingSlotsPerDay),
    terrainBreakdown,
  };
}
