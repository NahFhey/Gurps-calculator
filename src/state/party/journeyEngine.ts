import type { Draft } from 'immer';
import type { CampaignState, LogEntry } from '../campaignReducer';
import type { Character } from '../../types/campaign';
import type { MapModel, TileId, TravelMode } from '../../types/map';
import type { TravelGroup } from '../../types/party';
import { TERRAIN_LABELS } from '../../types/location';
import {
  getFatiguePenalty,
  selectAssignedCharacterIdsForSlot,
  selectCharacterFatigueStatus,
} from '../downtime/downtimeSelectors';
import { getWeatherModifierForActivity, getTerrainModifiers } from '../../utils/weatherSystem';
import { isCriticalFailure, roll3d6 } from '../../utils/gathering';
import { evaluateDiceFormula } from '../../utils/gathering';
import { getNavigationSkill } from '../../utils/navigation';
import { isAbleBodied, resolveGroupPosition } from '../../utils/partyPosition';
import { computeRouteMiles, findRoute } from '../../utils/mapRouter';
import { expandMapIfNeeded, findTileGridPos, getTileIdAt, resolveLocationTerrain } from '../../utils/mapUtils';
import { computeVisibleTiles } from '../../utils/lineOfSight';
import { computeSlotBudgetMiles } from '../../utils/mapTravelValidation';
import { getWorstGroupEncumbranceLevel } from '../../utils/encumbrance';
import { isNightSlot } from '../../utils/timeSystem';
import { travelLog } from '../../utils/activityLogger';
import { resolveTravelEventTable, rollTravelEvent } from '../../utils/travelEvents';
import type { TravelEventEntry } from '../../types/travelEvents';
import { isTravelTask } from '../../types/downtime';

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function appendLog(draft: Draft<CampaignState>, entry: LogEntry): void {
  draft.logs.entries.unshift({
    ...entry,
    day: entry.day ?? draft.time.day,
    slot: entry.slot ?? draft.time.slot,
  });
  if (draft.logs.entries.length > 2000) draft.logs.entries.length = 2000;
}

export function handleLocationArrival(
  draft: Draft<CampaignState>,
  mapId: string,
  tileId: string,
  switchCurrentLocation: boolean
): void {
  const map = draft.maps.mapsById[mapId];
  if (!map) return;
  const locationMarkers = Object.values(map.markersById).filter(
    (marker) => marker.tileId === tileId
      && marker.locationId
      && draft.locations.locations[marker.locationId]
  );
  for (const marker of locationMarkers) {
    if (marker.visibility !== 'gm' || !marker.locationId) continue;
    marker.visibility = 'player';
    marker.discoveredAt = { day: draft.time.day, slot: draft.time.slot };
    const location = draft.locations.locations[marker.locationId];
    appendLog(draft, {
      ...travelLog.progress(`Discovered ${location.name}`),
      type: 'location.discovered',
      day: draft.time.day,
    });
  }
  if (!switchCurrentLocation) return;
  const pinnedLocationId = locationMarkers[0]?.locationId;
  if (pinnedLocationId) {
    const location = draft.locations.locations[pinnedLocationId];
    draft.locations.currentLocationId = pinnedLocationId;
    appendLog(draft, { ...travelLog.progress(`Party arrived at ${location.name}`), type: 'location.changed' });
    return;
  }
  followTerrainAtTile(draft, map, tileId);
}

/** Wilderness semantics: the current location record follows the party's tile terrain. */
function followTerrainAtTile(
  draft: Draft<CampaignState>,
  map: MapModel,
  tileId: string
): void {
  const currentLocId = draft.locations.currentLocationId;
  const location = currentLocId ? draft.locations.locations[currentLocId] : undefined;
  if (!location) return;
  const newTerrain = resolveLocationTerrain(map, tileId);
  if (newTerrain === location.terrain) return;
  const oldLabel = TERRAIN_LABELS[location.terrain] ?? location.terrain;
  const newLabel = TERRAIN_LABELS[newTerrain] ?? newTerrain;
  location.terrain = newTerrain;
  location.modifiers = getTerrainModifiers(newTerrain, draft.locations.terrainModifierOverrides);
  location.modifiedAt = Date.now();
  appendLog(draft, {
    ...travelLog.progress(`Terrain changed from ${oldLabel} to ${newLabel}`),
    type: 'terrain.changed',
  });
}

/**
 * Re-derive locations.currentLocationId from the active group's position (Phase 15a).
 * Called when the active group CHANGES — explicit party/setActiveGroup or the implicit
 * reassignment when a drained group dissolves. Arrivals keep their own switch via
 * handleLocationArrival. Mirrors arrival semantics: a location pinned to the active
 * group's tile becomes current; in wilderness the current location record follows
 * the tile's terrain instead.
 */
export function syncCurrentLocationToActiveGroup(draft: Draft<CampaignState>): void {
  const groupId = draft.ui.activeTravelGroupId;
  const group = groupId ? draft.entities.travelGroups?.[groupId] : undefined;
  if (!group) return;
  const position = resolveGroupPosition(draft, group);
  if (!position) return;
  const map = draft.maps.mapsById[position.mapId];
  if (!map) return;
  const pinnedLocationId = Object.values(map.markersById).find(
    (marker) => marker.tileId === position.tileId
      && marker.locationId
      && draft.locations.locations[marker.locationId]
  )?.locationId;
  if (pinnedLocationId) {
    if (draft.locations.currentLocationId !== pinnedLocationId) {
      const location = draft.locations.locations[pinnedLocationId];
      draft.locations.currentLocationId = pinnedLocationId;
      appendLog(draft, {
        ...travelLog.progress(`Now tracking ${group.name} at ${location.name}`),
        type: 'location.changed',
      });
    }
    return;
  }
  followTerrainAtTile(draft, map, position.tileId);
}

function isPassable(map: MapModel, tileId: TileId, mode: TravelMode, gmOverride: boolean): boolean {
  const tile = map.tilesById[tileId];
  if (!tile) return false;
  if (tile.terrainId === null) return gmOverride;
  return Boolean(map.terrainById[tile.terrainId]?.perMode[mode]?.passable);
}

function stepCost(map: MapModel, fromId: TileId, toId: TileId, mode: TravelMode): number {
  const from = findTileGridPos(map, fromId);
  const to = findTileGridPos(map, toId);
  const diagonal = Boolean(from && to && Math.abs(from.row - to.row) === 1 && Math.abs(from.col - to.col) === 1);
  const tile = map.tilesById[toId];
  const speed = tile?.terrainId
    ? map.terrainById[tile.terrainId]?.perMode[mode]?.speedModifier ?? 1
    : 1;
  return (map.scaleMilesPerTile * (diagonal ? 1.414 : 1)) / Math.max(speed, Number.EPSILON);
}

function writePositionAndReveal(
  draft: Draft<CampaignState>,
  group: Draft<TravelGroup>,
  mapId: string,
  tileId: TileId
): void {
  if (group.vehicleId) {
    const vehicle = draft.entities.vehicles?.[group.vehicleId];
    if (!vehicle) return;
    vehicle.position = { kind: 'tile', mapId, tileId };
    vehicle.modifiedAt = Date.now();
  } else {
    group.position = { mapId, tileId };
  }
  const map = draft.maps.mapsById[mapId];
  if (!map) return;
  map.revealedTileIds.add(tileId);
  if (map.visionMode === 'lineOfSight') {
    for (const visibleTileId of computeVisibleTiles(map, [tileId])) {
      map.revealedTileIds.add(visibleTileId);
    }
  }
}

function finalizeEnteredTiles(
  draft: Draft<CampaignState>,
  mapId: string,
  enteredTileIds: TileId[],
  gmOverride: boolean
): void {
  const currentMap = draft.maps.mapsById[mapId];
  if (!currentMap) return;
  const expanded = expandMapIfNeeded(currentMap);
  if (expanded !== currentMap) draft.maps.mapsById[mapId] = expanded;
  // Expansion may replace the map object, so always re-read through the draft.
  const map = draft.maps.mapsById[mapId];
  if (!gmOverride || !map) return;
  const pending = draft.maps.pendingTerrainAssignment ?? (draft.maps.pendingTerrainAssignment = []);
  for (const tileId of enteredTileIds) {
    if (map.tilesById[tileId]?.terrainId === null && !pending.includes(tileId)) pending.push(tileId);
  }
}

function destinationLabel(map: MapModel, destinationTileId: TileId): string {
  return Object.values(map.markersById).find((marker) => marker.tileId === destinationTileId)?.label
    ?? destinationTileId;
}

function materializeTravelTask(
  draft: Draft<CampaignState>,
  group: Draft<TravelGroup>,
  crew: string[],
  journeyId: string,
  milesMoved: number,
  drifted: boolean
): void {
  if (crew.length === 0) return;
  const id = `task-travel-${journeyId}-${draft.time.day}-${draft.time.slot}`;
  if (draft.downtime.tasksById[id]) return;
  const now = Date.now();
  const map = group.journey ? draft.maps.mapsById[group.journey.mapId] : undefined;
  const label = group.journey && map
    ? destinationLabel(map, group.journey.destinationTileId)
    : 'destination';
  draft.downtime.tasksById[id] = {
    id,
    activityType: 'travel',
    dayKey: draft.time.day,
    slot: draft.time.slot,
    leaderId: crew[0],
    helperIds: crew.slice(1),
    status: 'resolved',
    activityData: {
      type: 'travel',
      journeyId,
      groupId: group.id,
      vehicleId: group.vehicleId,
      milesMoved,
      drifted,
    },
    results: {
      success: true,
      message: drifted ? 'Drifted off course' : `${milesMoved.toFixed(1)} mi toward ${label}`,
    },
    createdAt: now,
    updatedAt: now,
  };
  draft.downtime.taskOrder.push(id);
}

function pauseForCrew(draft: Draft<CampaignState>, group: Draft<TravelGroup>, message: string): void {
  if (!group.journey) return;
  group.journey.status = 'paused';
  group.journey.pauseReason = 'crewBelowMinimum';
  appendLog(draft, travelLog.paused(message));
}

function rollHazardLoss(formula: string | undefined): number {
  if (!formula) return 0;
  try {
    return Math.max(0, evaluateDiceFormula(formula).total);
  } catch {
    // Authored formulas may become malformed; reducer-side event processing stays a silent no-op.
    return 0;
  }
}

function applyTravelEvent(
  draft: Draft<CampaignState>,
  group: Draft<TravelGroup>,
  event: TravelEventEntry,
  night: boolean
): void {
  const journey = group.journey;
  if (!journey) return;
  if (event.kind === 'flavor') {
    appendLog(draft, travelLog.progress(`${event.name} — ${event.description}`));
    return;
  }
  if (event.kind === 'encounter') {
    journey.status = 'paused';
    journey.pauseReason = 'encounter';
    journey.pendingEncounterTemplateId = event.encounterTemplateId ?? null;
    draft.ui.pendingIntent = {
      kind: 'encounter',
      templateId: event.encounterTemplateId ?? null,
      groupId: group.id,
    };
    // Later groups may overwrite the intent; paused journeys remain visible and are resolved sequentially.
    appendLog(draft, travelLog.progress(`Encounter: ${event.name} — journey halted`));
    return;
  }
  if (event.kind !== 'hazard') return;
  const effects = event.hazard;
  const summaries: string[] = [];
  if (effects?.lostMiles && effects.lostMiles > 0) {
    journey.legProgressMiles = Math.max(0, journey.legProgressMiles - effects.lostMiles);
    summaries.push(`${effects.lostMiles} mi progress lost`);
  }
  for (const memberId of group.memberIds) {
    const character = draft.entities.characters[memberId];
    if (!character?.gcsData) continue;
    const fpLoss = rollHazardLoss(effects?.fpLossFormula);
    const hpLoss = rollHazardLoss(effects?.hpLossFormula);
    if (fpLoss > 0) {
      character.gcsData.pools.FP.current = Math.max(
        0,
        character.gcsData.pools.FP.current - fpLoss
      );
      summaries.push(`${character.name} takes ${fpLoss} FP`);
    }
    if (hpLoss > 0) {
      character.gcsData.pools.HP.current -= hpLoss;
      summaries.push(`${character.name} takes ${hpLoss} HP`);
    }
  }
  appendLog(
    draft,
    travelLog.progress(`${event.name} — ${summaries.join(', ') || event.description}${night ? ' (night)' : ''}`)
  );
}

function processTravelEvent(
  draft: Draft<CampaignState>,
  group: Draft<TravelGroup>,
  night: boolean
): void {
  const journey = group.journey;
  if (!journey || journey.routeTileIds.length <= 1) return;
  const map = draft.maps.mapsById[journey.mapId];
  const endingTile = map?.tilesById[journey.routeTileIds[0]];
  if (!map || !endingTile) return;
  const table = resolveTravelEventTable(draft, journey.mapId, endingTile.terrainId);
  if (!table) return;
  const event = rollTravelEvent(table, {
    weatherType: map.currentWeather?.weather.type ?? null,
    isNightSlot: night,
    forcedMarch: journey.forcedMarch,
  });
  if (event) applyTravelEvent(draft, group, event, night);
}

function progressGroup(draft: Draft<CampaignState>, group: Draft<TravelGroup>): void {
  const journey = group.journey;
  if (!journey || journey.status !== 'active') return;
  const map = draft.maps.mapsById[journey.mapId];
  if (!map) return;
  const night = isNightSlot(draft.time.slot, draft.time.slotsPerDay, draft.time.nightSlotIndices);
  if (night && !journey.forcedMarch) {
    appendLog(draft, travelLog.camp(`${group.name} makes camp`));
    return;
  }

  const assigned = selectAssignedCharacterIdsForSlot(
    draft.downtime,
    draft.time.day,
    draft.time.slot
  );
  const members = group.memberIds
    .map((id) => draft.entities.characters[id])
    .filter((character): character is Draft<Character> => Boolean(character));
  const ableIds = group.memberIds.filter((id) => {
    const character = draft.entities.characters[id];
    return Boolean(character && isAbleBodied(character));
  });
  let crew: string[];
  let vehicleType = null;
  if (group.vehicleId) {
    const vehicle = draft.entities.vehicles?.[group.vehicleId];
    vehicleType = vehicle ? draft.entities.vehicleTypes?.[vehicle.typeId] ?? null : null;
    const available = ableIds.filter((id) => !assigned.has(id));
    const minimum = vehicleType?.minCrew ?? 0;
    if (!vehicleType || available.length < minimum) {
      pauseForCrew(
        draft,
        group,
        `${group.name} paused: ${available.length} available crew, ${minimum || 'valid crew'} required`
      );
      return;
    }
    crew = available.slice(0, minimum);
  } else {
    if (ableIds.length === 0) {
      pauseForCrew(draft, group, `${group.name} paused: no able-bodied travelers`);
      return;
    }
    crew = group.memberIds.filter((id) => !assigned.has(id));
  }

  let effectiveSkill = journey.gmNavigationSkill;
  if (journey.navigatorId) {
    const navigator = draft.entities.characters[journey.navigatorId];
    if (navigator) {
      effectiveSkill = getNavigationSkill(navigator, journey.mode).level
        + getFatiguePenalty(selectCharacterFatigueStatus(
          draft.downtime,
          journey.navigatorId,
          draft.time.day,
          draft.time.slot
        ));
    }
  }
  effectiveSkill += getWeatherModifierForActivity(map.currentWeather?.weather, 'travel');
  if (night && journey.forcedMarch) effectiveSkill -= 5;
  const { total } = roll3d6();
  const margin = effectiveSkill - total;
  const critFailure = isCriticalFailure(total, effectiveSkill);
  const failed = margin < 0 || critFailure;
  const enteredTileIds: TileId[] = [];
  let milesMoved = 0;

  if (failed) {
    const requestedDrift = Math.min(3, Math.ceil(Math.max(0, -margin) / 2)) + (critFailure ? 1 : 0);
    let previousTileId: TileId | null = null;
    let currentTileId = journey.routeTileIds[0];
    for (let step = 0; step < requestedDrift; step += 1) {
      const currentMap = draft.maps.mapsById[journey.mapId];
      if (!currentMap) break;
      const position = findTileGridPos(currentMap, currentTileId);
      if (!position) break;
      const candidates = DIRECTIONS
        .map(([dr, dc]) => getTileIdAt(currentMap, position.row + dr, position.col + dc))
        .filter((tileId): tileId is TileId => Boolean(
          tileId
          && tileId !== previousTileId
          && tileId !== journey.routeTileIds[1]
          && isPassable(currentMap, tileId, journey.mode, journey.gmOverride)
        ));
      if (candidates.length === 0) break;
      const nextTileId = candidates[Math.floor(Math.random() * candidates.length)];
      previousTileId = currentTileId;
      currentTileId = nextTileId;
      enteredTileIds.push(nextTileId);
      writePositionAndReveal(draft, group, journey.mapId, nextTileId);
    }
    journey.legProgressMiles = 0;
    const rerouteMap = draft.maps.mapsById[journey.mapId];
    const reroute = rerouteMap
      ? findRoute(rerouteMap, currentTileId, journey.destinationTileId, journey.mode, journey.gmOverride)
      : { path: [], totalCost: Infinity, valid: false };
    if (reroute.valid) {
      journey.routeTileIds = reroute.path;
      appendLog(
        draft,
        travelLog.drifted(`${group.name} drifted ${enteredTileIds.length} tile(s); route recalculated`)
      );
    } else {
      journey.status = 'paused';
      journey.pauseReason = 'noRoute';
      appendLog(draft, travelLog.paused(`${group.name} paused: no route after drifting`));
    }
  } else {
    const weatherModifier = getWeatherModifierForActivity(map.currentWeather?.weather, 'travel');
    const worstEncumbrance = group.vehicleId ? null : getWorstGroupEncumbranceLevel(members).level;
    const slotBudget = computeSlotBudgetMiles({
      mode: journey.mode,
      vehicleType,
      weatherTravelModifier: weatherModifier,
      worstEncumbranceLevel: worstEncumbrance,
    });
    const remainingBefore = Math.max(
      0,
      computeRouteMiles(map, journey.routeTileIds, journey.mode) - journey.legProgressMiles
    );
    let availableMiles = journey.legProgressMiles + slotBudget;
    while (journey.routeTileIds.length > 1) {
      const fromId = journey.routeTileIds[0];
      const toId = journey.routeTileIds[1];
      const cost = stepCost(map, fromId, toId, journey.mode);
      if (availableMiles + 1e-9 < cost) break;
      availableMiles -= cost;
      journey.routeTileIds.shift();
      enteredTileIds.push(toId);
      writePositionAndReveal(draft, group, journey.mapId, toId);
    }
    journey.legProgressMiles = journey.routeTileIds.length > 1
      ? Math.min(availableMiles, stepCost(map, journey.routeTileIds[0], journey.routeTileIds[1], journey.mode))
      : 0;
    milesMoved = Math.min(slotBudget, remainingBefore);
    journey.milesTraveled += milesMoved;
    appendLog(draft, travelLog.progress(`${group.name} traveled ${milesMoved.toFixed(1)} mi`));
  }

  finalizeEnteredTiles(draft, journey.mapId, enteredTileIds, journey.gmOverride);
  materializeTravelTask(draft, group, crew, journey.id, milesMoved, failed);

  // Arrival ambushes are a possible followup; completed journeys do not roll here.
  processTravelEvent(draft, group, night);

  if (journey.routeTileIds.length === 1) {
    const mapId = journey.mapId;
    const destinationTileId = journey.destinationTileId;
    const totalMiles = journey.milesTraveled;
    group.journey = null;
    appendLog(draft, travelLog.arrived(`${group.name} arrives after ${totalMiles.toFixed(1)} mi`));
    handleLocationArrival(
      draft,
      mapId,
      destinationTileId,
      group.id === draft.ui.activeTravelGroupId
    );
  }
}

export function progressJourneys(draft: Draft<CampaignState>): void {
  const groups = draft.entities.travelGroups ?? {};
  for (const groupId of Object.keys(groups).sort()) {
    const group = groups[groupId];
    if (group?.journey?.status === 'active') progressGroup(draft, group);
  }
}

export function handleJourneyDayBoundary(draft: Draft<CampaignState>): void {
  const completedDay = draft.time.day - 1;
  const meals = draft.entities.groupMeals ?? {};
  const debt = draft.entities.starvationFpDebt ?? (draft.entities.starvationFpDebt = {});
  for (const group of Object.values(draft.entities.travelGroups ?? {})) {
    const traveled = Object.values(draft.downtime.tasksById).some((task) =>
      task.dayKey === completedDay
      && isTravelTask(task)
      && task.activityData.groupId === group.id
    );
    if (!traveled || meals[group.id] === completedDay) continue;
    for (const memberId of group.memberIds) {
      const fp = draft.entities.characters[memberId]?.gcsData?.pools.FP;
      if (!fp) continue;
      fp.current = Math.max(0, fp.current - 1);
      debt[memberId] = (debt[memberId] ?? 0) + 1;
    }
    appendLog(
      draft,
      travelLog.progress(
        `${group.name} went without a cooked meal — 1 FP lost (won't recover until fed)`
      )
    );
  }
}
