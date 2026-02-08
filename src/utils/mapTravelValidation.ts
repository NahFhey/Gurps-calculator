/**
 * mapTravelValidation — Route validation for map travel.
 *
 * Distance is measured in MILES. Each mode has a milesPerSlot budget
 * (foot=12, boat=50, airship=457). The budget check compares
 * route miles against mode.milesPerSlot.
 *
 * Checks all 7 blocking conditions before travel can be confirmed:
 * 1. Mode compatible with map scale
 * 2. Party members available (none in downtime tasks this slot)
 * 3. No party members incapacitated
 * 4. Personnel requirements met for mode
 * 5. All route tiles have terrain assigned (player enforcement)
 * 6. All route tiles passable for mode
 * 7. Route within mile budget for the mode
 */

import type { MapModel, TileId, TravelMode, TravelBlocker } from '../types/map';
import type { DowntimeState } from '../types/downtime';
import { TRAVEL_BLOCKER_CODES } from '../types/map';
import { SCALE_TO_MODES } from '../constants/map';
import { getTravelModeDefinition } from '../constants/map';
import { findTileGridPos } from './mapUtils';
import { computeRouteMiles } from './mapRouter';
import { selectAssignedCharacterIdsForSlot } from '../state/downtime/downtimeSelectors';

/**
 * Validate a travel route and return all blocking reasons.
 * Returns an empty array if travel is valid.
 */
export function validateTravelRoute(
  map: MapModel,
  routeTileIds: TileId[],
  mode: TravelMode,
  partyCharacterIds: string[],
  day: number,
  slot: number,
  downtimeState: DowntimeState,
  isGmMode: boolean
): TravelBlocker[] {
  const blockers: TravelBlocker[] = [];
  const modeDef = getTravelModeDefinition(mode);

  // 1. Mode compatible with map scale
  const allowedModes = SCALE_TO_MODES[map.scaleMilesPerTile];
  if (!allowedModes.includes(mode)) {
    blockers.push({
      code: TRAVEL_BLOCKER_CODES.MODE_INCOMPATIBLE,
      message: `${mode} travel is not available on ${map.scaleMilesPerTile}-mile maps.`,
      details: [`Available modes: ${allowedModes.join(', ')}.`],
    });
  }

  // 2. Party members available (none in downtime tasks this slot)
  const assignedIds = selectAssignedCharacterIdsForSlot(downtimeState, day, slot);
  const busyMembers = partyCharacterIds.filter((id) => assignedIds.has(id));
  if (busyMembers.length > 0) {
    blockers.push({
      code: TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME,
      message: `${busyMembers.length} party member(s) are assigned to downtime tasks this slot.`,
      details: busyMembers,
    });
  }

  // 3. No party members incapacitated
  // Note: In the current system, incapacitation is tracked via combat session status.
  // For now, we skip this check since it requires combat state which is separate.
  // This can be extended later when combat/health tracking is integrated.

  // 4. Personnel requirements met for mode
  if (modeDef.personnel.length > 0) {
    const availableCount = partyCharacterIds.length - busyMembers.length;
    const totalRequired = modeDef.personnel.reduce((sum, p) => sum + p.count, 0);
    if (availableCount < totalRequired) {
      const requirementsList = modeDef.personnel.map(
        (p) => `${p.count} ${p.role}(s)`
      );
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.INSUFFICIENT_PERSONNEL,
        message: `Insufficient personnel for ${mode} travel.`,
        details: [
          `Required: ${requirementsList.join(', ')}`,
          `Available party members: ${availableCount}`,
        ],
      });
    }
  }

  // 5. All route tiles have terrain assigned (player enforcement, GM can override)
  if (!isGmMode && routeTileIds.length > 0) {
    const nullTerrainTiles: string[] = [];
    for (const tileId of routeTileIds) {
      const tile = map.tilesById[tileId];
      if (tile && tile.terrainId === null) {
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

  // 6. All route tiles passable for mode
  if (routeTileIds.length > 0) {
    const impassableTiles: string[] = [];
    for (const tileId of routeTileIds) {
      const tile = map.tilesById[tileId];
      if (!tile) continue;
      if (tile.terrainId === null) continue; // Handled by check 5
      const terrain = map.terrainById[tile.terrainId];
      if (!terrain) continue;
      const modeProps = terrain.perMode[mode];
      if (!modeProps || !modeProps.passable) {
        const pos = findTileGridPos(map, tileId);
        impassableTiles.push(
          `${terrain.name} at ${pos ? `(${pos.row}, ${pos.col})` : tileId}`
        );
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

  // 7. Route within distance budget (miles per slot)
  if (routeTileIds.length > 1) {
    const totalMiles = computeRouteMiles(map, routeTileIds, mode);
    const budget = modeDef.milesPerSlot;
    if (totalMiles > budget) {
      blockers.push({
        code: TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET,
        message: `Route is ${totalMiles.toFixed(0)} mi, exceeding the ${budget} mi/${mode} range.`,
        details: [`${mode} can travel ${budget} miles per slot. Terrain modifiers affect effective range.`],
      });
    }
  }

  return blockers;
}

/**
 * Get a summary of route statistics for display.
 */
export function getRouteStats(
  map: MapModel,
  routeTileIds: TileId[],
  mode: TravelMode
): {
  tileCount: number;
  totalMiles: number;
  budgetMiles: number;
  withinBudget: boolean;
  terrainBreakdown: { name: string; count: number }[];
} {
  const modeDef = getTravelModeDefinition(mode);
  const budgetMiles = modeDef.milesPerSlot;
  const totalMiles =
    routeTileIds.length > 1
      ? computeRouteMiles(map, routeTileIds, mode)
      : 0;

  // Build terrain breakdown
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

  return {
    tileCount: routeTileIds.length,
    totalMiles,
    budgetMiles,
    withinBudget: totalMiles <= budgetMiles,
    terrainBreakdown,
  };
}
