import type { Id } from '../../types/campaign';
import type { MapId, TileId } from '../../types/map';
import type { Journey, Vehicle, VehicleTypeDef } from '../../types/party';
import type { TravelEventTable, TravelEventTableSet } from '../../types/travelEvents';

export const PARTY_CREATE_GROUP = 'party/createGroup' as const;
export const PARTY_MOVE_MEMBERS = 'party/moveMembers' as const;
export const PARTY_RENAME_GROUP = 'party/renameGroup' as const;
export const PARTY_SET_ACTIVE_GROUP = 'party/setActiveGroup' as const;
export const PARTY_BOARD_VEHICLE = 'party/boardVehicle' as const;
export const PARTY_DISEMBARK = 'party/disembark' as const;
export const PARTY_PLACE_GROUP = 'party/placeGroup' as const;
export const PARTY_UPSERT_VEHICLE = 'party/upsertVehicle' as const;
export const PARTY_REMOVE_VEHICLE = 'party/removeVehicle' as const;
export const PARTY_PLACE_VEHICLE = 'party/placeVehicle' as const;
export const PARTY_DOCK_VEHICLE = 'party/dockVehicle' as const;
export const PARTY_UNDOCK_VEHICLE = 'party/undockVehicle' as const;
export const PARTY_UPSERT_VEHICLE_TYPE = 'party/upsertVehicleType' as const;
export const PARTY_REMOVE_VEHICLE_TYPE = 'party/removeVehicleType' as const;
export const PARTY_ARM_JOURNEY = 'party/armJourney' as const;
export const PARTY_PAUSE_JOURNEY = 'party/pauseJourney' as const;
export const PARTY_RESUME_JOURNEY = 'party/resumeJourney' as const;
export const PARTY_ABORT_JOURNEY = 'party/abortJourney' as const;
export const PARTY_REROUTE_JOURNEY = 'party/rerouteJourney' as const;
export const PARTY_UPSERT_TRAVEL_EVENT_TABLE = 'party/upsertTravelEventTable' as const;
export const PARTY_REMOVE_TRAVEL_EVENT_TABLE = 'party/removeTravelEventTable' as const;
export const PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET = 'party/upsertTravelEventTableSet' as const;
export const PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET = 'party/removeTravelEventTableSet' as const;
export const PARTY_RECORD_MEAL = 'party/recordMeal' as const;

export type ArmJourneyInput = Omit<
  Journey,
  'id' | 'legProgressMiles' | 'milesTraveled' | 'status' | 'startedAt'
>;

export type PartyAction =
  | { type: typeof PARTY_CREATE_GROUP; payload: { name: string; memberIds: Id[]; fromGroupId: Id } }
  | { type: typeof PARTY_MOVE_MEMBERS; payload: { memberIds: Id[]; toGroupId: Id } }
  | { type: typeof PARTY_RENAME_GROUP; payload: { groupId: Id; name: string } }
  | { type: typeof PARTY_SET_ACTIVE_GROUP; payload: { groupId: Id } }
  | { type: typeof PARTY_BOARD_VEHICLE; payload: { groupId: Id; vehicleId: Id } }
  | { type: typeof PARTY_DISEMBARK; payload: { groupId: Id } }
  | { type: typeof PARTY_PLACE_GROUP; payload: { groupId: Id; mapId: MapId; tileId: TileId } }
  | { type: typeof PARTY_UPSERT_VEHICLE; payload: { vehicle: Vehicle } }
  | { type: typeof PARTY_REMOVE_VEHICLE; payload: { vehicleId: Id } }
  | { type: typeof PARTY_PLACE_VEHICLE; payload: { vehicleId: Id; mapId: MapId; tileId: TileId } }
  | { type: typeof PARTY_DOCK_VEHICLE; payload: { vehicleId: Id; carrierId: Id } }
  | { type: typeof PARTY_UNDOCK_VEHICLE; payload: { vehicleId: Id } }
  | { type: typeof PARTY_UPSERT_VEHICLE_TYPE; payload: { def: VehicleTypeDef } }
  | { type: typeof PARTY_REMOVE_VEHICLE_TYPE; payload: { typeId: string } }
  | { type: typeof PARTY_ARM_JOURNEY; payload: { groupId: Id; journey: ArmJourneyInput } }
  | { type: typeof PARTY_PAUSE_JOURNEY; payload: { groupId: Id } }
  | { type: typeof PARTY_RESUME_JOURNEY; payload: { groupId: Id } }
  | { type: typeof PARTY_ABORT_JOURNEY; payload: { groupId: Id } }
  | { type: typeof PARTY_REROUTE_JOURNEY; payload: { groupId: Id; routeTileIds: TileId[] } }
  | { type: typeof PARTY_UPSERT_TRAVEL_EVENT_TABLE; payload: { table: TravelEventTable } }
  | { type: typeof PARTY_REMOVE_TRAVEL_EVENT_TABLE; payload: { tableId: Id } }
  | { type: typeof PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET; payload: { set: TravelEventTableSet } }
  | { type: typeof PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET; payload: { setId: Id } }
  | { type: typeof PARTY_RECORD_MEAL; payload: { groupId: Id; day: number } };

export const PARTY_ACTION_TYPES = new Set<string>([
  PARTY_CREATE_GROUP,
  PARTY_MOVE_MEMBERS,
  PARTY_RENAME_GROUP,
  PARTY_SET_ACTIVE_GROUP,
  PARTY_BOARD_VEHICLE,
  PARTY_DISEMBARK,
  PARTY_PLACE_GROUP,
  PARTY_UPSERT_VEHICLE,
  PARTY_REMOVE_VEHICLE,
  PARTY_PLACE_VEHICLE,
  PARTY_DOCK_VEHICLE,
  PARTY_UNDOCK_VEHICLE,
  PARTY_UPSERT_VEHICLE_TYPE,
  PARTY_REMOVE_VEHICLE_TYPE,
  PARTY_ARM_JOURNEY,
  PARTY_PAUSE_JOURNEY,
  PARTY_RESUME_JOURNEY,
  PARTY_ABORT_JOURNEY,
  PARTY_REROUTE_JOURNEY,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE,
  PARTY_REMOVE_TRAVEL_EVENT_TABLE,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET,
  PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET,
  PARTY_RECORD_MEAL,
]);

export function isPartyAction(action: { type: string }): action is PartyAction {
  return PARTY_ACTION_TYPES.has(action.type);
}
