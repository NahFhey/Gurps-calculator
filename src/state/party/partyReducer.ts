import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import type { Id } from '../../types/campaign';
import type { TravelGroup } from '../../types/party';
import {
  areCoLocated,
  dockedVehicles,
  resolveGroupPosition,
  resolveVehiclePosition,
} from '../../utils/partyPosition';
import {
  type PartyAction,
  PARTY_BOARD_VEHICLE,
  PARTY_CREATE_GROUP,
  PARTY_DISEMBARK,
  PARTY_DOCK_VEHICLE,
  PARTY_MOVE_MEMBERS,
  PARTY_PLACE_GROUP,
  PARTY_PLACE_VEHICLE,
  PARTY_REMOVE_VEHICLE,
  PARTY_REMOVE_VEHICLE_TYPE,
  PARTY_RENAME_GROUP,
  PARTY_SET_ACTIVE_GROUP,
  PARTY_UNDOCK_VEHICLE,
  PARTY_UPSERT_VEHICLE,
  PARTY_UPSERT_VEHICLE_TYPE,
} from './partyActions';

function positionsEqual(
  a: { mapId: string; tileId: string } | null,
  b: { mapId: string; tileId: string } | null
): boolean {
  return Boolean(a && b && a.mapId === b.mapId && a.tileId === b.tileId);
}

function findMemberGroup(
  groups: Record<Id, Draft<TravelGroup>>,
  memberId: Id
): Draft<TravelGroup> | undefined {
  return Object.values(groups).find((group) => group.memberIds.includes(memberId));
}

export function handlePartyAction(
  draft: Draft<CampaignState>,
  action: PartyAction
): boolean {
  const groups = draft.entities.travelGroups ?? (draft.entities.travelGroups = {});
  const vehicles = draft.entities.vehicles ?? (draft.entities.vehicles = {});
  const vehicleTypes = draft.entities.vehicleTypes ?? (draft.entities.vehicleTypes = {});

  switch (action.type) {
    case PARTY_CREATE_GROUP: {
      const { name, memberIds, fromGroupId } = action.payload;
      const source = groups[fromGroupId];
      const uniqueMemberIds = [...new Set(memberIds)];
      if (!source || uniqueMemberIds.length === 0) return true;
      if (uniqueMemberIds.some(
        (id) => !draft.entities.characters[id] || !source.memberIds.includes(id)
      )) return true;

      const id = crypto.randomUUID();
      groups[id] = {
        id,
        name,
        memberIds: uniqueMemberIds,
        vehicleId: source.vehicleId,
        position: source.vehicleId ? null : source.position ? { ...source.position } : null,
      };
      source.memberIds = source.memberIds.filter((id) => !uniqueMemberIds.includes(id));
      if (source.memberIds.length === 0 && Object.keys(groups).length > 1) {
        delete groups[source.id];
        if (draft.ui.activeTravelGroupId === source.id) draft.ui.activeTravelGroupId = id;
      }
      return true;
    }

    case PARTY_MOVE_MEMBERS: {
      const target = groups[action.payload.toGroupId];
      if (!target) return true;
      const touchedSources = new Set<Id>();
      for (const memberId of new Set(action.payload.memberIds)) {
        if (!draft.entities.characters[memberId]) continue;
        const source = findMemberGroup(groups, memberId);
        if (!source || source.id === target.id || !areCoLocated(draft, source, target)) continue;
        source.memberIds = source.memberIds.filter((id) => id !== memberId);
        if (!target.memberIds.includes(memberId)) target.memberIds.push(memberId);
        touchedSources.add(source.id);
      }
      for (const sourceId of touchedSources) {
        const source = groups[sourceId];
        if (source?.memberIds.length === 0 && Object.keys(groups).length > 1) {
          delete groups[sourceId];
          if (draft.ui.activeTravelGroupId === sourceId) {
            draft.ui.activeTravelGroupId = target.id;
          }
        }
      }
      return true;
    }

    case PARTY_RENAME_GROUP: {
      const group = groups[action.payload.groupId];
      if (group) group.name = action.payload.name;
      return true;
    }

    case PARTY_SET_ACTIVE_GROUP:
      if (groups[action.payload.groupId]) draft.ui.activeTravelGroupId = action.payload.groupId;
      return true;

    case PARTY_BOARD_VEHICLE: {
      const group = groups[action.payload.groupId];
      const vehicle = vehicles[action.payload.vehicleId];
      if (!group || !vehicle) return true;
      const groupPosition = resolveGroupPosition(draft, group);
      const vehiclePosition = resolveVehiclePosition(vehicles, vehicle.id);
      if (!positionsEqual(groupPosition, vehiclePosition)) return true;
      group.vehicleId = vehicle.id;
      group.position = null;
      return true;
    }

    case PARTY_DISEMBARK: {
      const group = groups[action.payload.groupId];
      if (!group?.vehicleId) return true;
      const position = resolveVehiclePosition(vehicles, group.vehicleId);
      if (!position) return true;
      group.position = position;
      group.vehicleId = null;
      return true;
    }

    case PARTY_PLACE_GROUP: {
      const group = groups[action.payload.groupId];
      if (group && !group.vehicleId) {
        group.position = { mapId: action.payload.mapId, tileId: action.payload.tileId };
      }
      return true;
    }

    case PARTY_UPSERT_VEHICLE:
      vehicles[action.payload.vehicle.id] = action.payload.vehicle;
      return true;

    case PARTY_REMOVE_VEHICLE: {
      const vehicle = vehicles[action.payload.vehicleId];
      if (!vehicle) return true;
      const position = resolveVehiclePosition(vehicles, vehicle.id);
      for (const group of Object.values(groups)) {
        if (group.vehicleId === vehicle.id) {
          group.vehicleId = null;
          group.position = position;
        }
      }
      for (const docked of dockedVehicles(vehicles, vehicle.id)) {
        docked.position = position
          ? { kind: 'tile', mapId: position.mapId, tileId: position.tileId }
          : null;
      }
      delete vehicles[vehicle.id];
      return true;
    }

    case PARTY_PLACE_VEHICLE: {
      const vehicle = vehicles[action.payload.vehicleId];
      if (vehicle) {
        vehicle.position = {
          kind: 'tile',
          mapId: action.payload.mapId,
          tileId: action.payload.tileId,
        };
        vehicle.modifiedAt = Date.now();
      }
      return true;
    }

    case PARTY_DOCK_VEHICLE: {
      const { vehicleId, carrierId } = action.payload;
      if (vehicleId === carrierId) return true;
      const vehicle = vehicles[vehicleId];
      const carrier = vehicles[carrierId];
      if (!vehicle || !carrier || carrier.position?.kind !== 'tile') return true;
      if (dockedVehicles(vehicles, vehicleId).length > 0) return true;
      const carrierType = vehicleTypes[carrier.typeId];
      if (!carrierType || dockedVehicles(vehicles, carrierId).length >= carrierType.hangarSlots) {
        return true;
      }
      const vehiclePosition = resolveVehiclePosition(vehicles, vehicleId);
      const carrierPosition = { mapId: carrier.position.mapId, tileId: carrier.position.tileId };
      if (!positionsEqual(vehiclePosition, carrierPosition)) return true;
      vehicle.position = { kind: 'docked', carrierId };
      vehicle.modifiedAt = Date.now();
      return true;
    }

    case PARTY_UNDOCK_VEHICLE: {
      const vehicle = vehicles[action.payload.vehicleId];
      if (vehicle?.position?.kind !== 'docked') return true;
      const carrier = vehicles[vehicle.position.carrierId];
      if (carrier?.position?.kind !== 'tile') return true;
      vehicle.position = {
        kind: 'tile',
        mapId: carrier.position.mapId,
        tileId: carrier.position.tileId,
      };
      vehicle.modifiedAt = Date.now();
      return true;
    }

    case PARTY_UPSERT_VEHICLE_TYPE:
      vehicleTypes[action.payload.def.id] = action.payload.def;
      draft.entities.deletedBuiltinVehicleTypeIds = (
        draft.entities.deletedBuiltinVehicleTypeIds ?? []
      ).filter((id) => id !== action.payload.def.id);
      return true;

    case PARTY_REMOVE_VEHICLE_TYPE: {
      const typeId = action.payload.typeId;
      // A type referenced by a vehicle cannot be removed; reducers silently ignore invalid actions.
      if (Object.values(vehicles).some((vehicle) => vehicle.typeId === typeId)) return true;
      const def = vehicleTypes[typeId];
      if (def?.builtin) {
        const deleted = draft.entities.deletedBuiltinVehicleTypeIds ?? [];
        if (!deleted.includes(typeId)) deleted.push(typeId);
        draft.entities.deletedBuiltinVehicleTypeIds = deleted;
      }
      delete vehicleTypes[typeId];
      return true;
    }

    default:
      return false;
  }
}
