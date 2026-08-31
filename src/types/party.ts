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
}

export interface GroupPosition {
  mapId: MapId;
  tileId: TileId;
}
