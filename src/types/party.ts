import type { Id } from './campaign';
import type { MapId, TileId, TravelMode } from './map';

export interface VehicleTypeDef {
  id: string;
  name: string;
  mode: TravelMode;
  speedMilesPerSlot?: number;
  minCrew: number;
  hangarSlots: number;
  passengerCapacity?: string;
  icon?: string;
  builtin?: boolean;
}

export type VehiclePosition =
  | { kind: 'tile'; mapId: MapId; tileId: TileId }
  | { kind: 'docked'; carrierId: Id };

export interface Vehicle {
  id: Id;
  name: string;
  typeId: string;
  position: VehiclePosition | null;
  notes?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface TravelGroup {
  id: Id;
  name: string;
  memberIds: Id[];
  vehicleId: Id | null;
  position: { mapId: MapId; tileId: TileId } | null;
  journey?: Journey | null;
}

export interface GroupPosition {
  mapId: MapId;
  tileId: TileId;
}

export type JourneyPauseReason =
  | 'crewBelowMinimum'
  | 'noRoute'
  | 'encounter'
  | 'manual';

export interface JourneyNavigationLog {
  day: number;
  slot: number;
  roll: number;
  effectiveSkill: number;
  margin: number;
  driftedTiles: number;
  critFailure: boolean;
}

export interface Journey {
  id: Id;
  mapId: MapId;
  /** Remaining planned route. [0] is always the group's current tile. */
  routeTileIds: TileId[];
  destinationTileId: TileId;
  mode: TravelMode;
  navigatorId: Id | null;
  gmNavigationSkill: number;
  forcedMarch: boolean;
  legProgressMiles: number;
  milesTraveled: number;
  status: 'active' | 'paused';
  pauseReason?: JourneyPauseReason;
  /** Persists the encounter hand-off after the same-session intent is consumed. */
  pendingEncounterTemplateId?: Id | null;
  gmOverride: boolean;
  startedAt: { day: number; slot: number };
}
