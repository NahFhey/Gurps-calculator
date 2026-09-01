import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import type { Id } from '../../types/campaign';
import type { TravelGroup } from '../../types/party';
import { travelLog } from '../../utils/activityLogger';
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
} from './partyActions';

const hasJourney = (group: Draft<TravelGroup> | undefined): boolean => Boolean(group?.journey);

function appendTravelLog(draft: Draft<CampaignState>, entry: ReturnType<typeof travelLog.camp>): void {
  draft.logs.entries.unshift({ ...entry, day: draft.time.day, slot: draft.time.slot });
  if (draft.logs.entries.length > 2000) draft.logs.entries.length = 2000;
}

function abortJourney(draft: Draft<CampaignState>, group: Draft<TravelGroup>): void {
  if (!group.journey) return;
  group.journey = null;
  appendTravelLog(draft, travelLog.aborted(`${group.name}'s journey was aborted`));
}

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
      // Interim safety: journey composition is immutable until the journey is aborted.
      if (!source || hasJourney(source) || uniqueMemberIds.length === 0) return true;
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
      const sourceGroups = [...new Set(action.payload.memberIds
        .map((memberId) => findMemberGroup(groups, memberId)?.id)
        .filter((id): id is Id => Boolean(id)))];
      // Interim safety: do not mutate either end of a journeying composition.
      if (!target || hasJourney(target) || sourceGroups.some((id) => hasJourney(groups[id]))) return true;
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
      // Interim safety: boarding changes the authoritative journey position.
      if (!group || !vehicle || hasJourney(group)
        || Object.values(groups).some((candidate) => candidate.vehicleId === vehicle.id && hasJourney(candidate))) return true;
      const groupPosition = resolveGroupPosition(draft, group);
      const vehiclePosition = resolveVehiclePosition(vehicles, vehicle.id);
      if (!positionsEqual(groupPosition, vehiclePosition)) return true;
      group.vehicleId = vehicle.id;
      group.position = null;
      return true;
    }

    case PARTY_DISEMBARK: {
      const group = groups[action.payload.groupId];
      // Interim safety: disembark only after aborting a journey.
      if (!group?.vehicleId || hasJourney(group)) return true;
      const position = resolveVehiclePosition(vehicles, group.vehicleId);
      if (!position) return true;
      group.position = position;
      group.vehicleId = null;
      return true;
    }

    case PARTY_PLACE_GROUP: {
      const group = groups[action.payload.groupId];
      if (group && !group.vehicleId) {
        // A GM teleport explicitly overrides the journey.
        abortJourney(draft, group);
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
        // A GM vehicle teleport explicitly overrides every aboard journey.
        for (const group of Object.values(groups)) {
          if (group.vehicleId === vehicle.id) abortJourney(draft, group);
        }
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
      // Docking a journey's authoritative vehicle is a GM override.
      for (const group of Object.values(groups)) {
        if (group.vehicleId === vehicleId) abortJourney(draft, group);
      }
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

    case PARTY_ARM_JOURNEY: {
      const group = groups[action.payload.groupId];
      const journey = action.payload.journey;
      const position = group ? resolveGroupPosition(draft, group) : null;
      if (!group || group.journey || journey.routeTileIds.length < 2
        || position?.mapId !== journey.mapId
        || journey.routeTileIds[0] !== position.tileId
        || (journey.navigatorId !== null && !group.memberIds.includes(journey.navigatorId))) return true;
      group.journey = {
        ...journey,
        routeTileIds: [...journey.routeTileIds],
        id: crypto.randomUUID(),
        legProgressMiles: 0,
        milesTraveled: 0,
        status: 'active',
        startedAt: { day: draft.time.day, slot: draft.time.slot },
      };
      appendTravelLog(draft, travelLog.departed(`${group.name} begins its journey`));
      return true;
    }

    case PARTY_PAUSE_JOURNEY: {
      const group = groups[action.payload.groupId];
      if (group?.journey?.status === 'active') {
        group.journey.status = 'paused';
        group.journey.pauseReason = 'manual';
        appendTravelLog(draft, travelLog.paused(`${group.name}'s journey was paused`));
      }
      return true;
    }

    case PARTY_RESUME_JOURNEY: {
      const group = groups[action.payload.groupId];
      if (group?.journey?.status === 'paused'
        && (group.journey.pauseReason !== 'encounter' || !draft.combat.activeSession)) {
        group.journey.status = 'active';
        delete group.journey.pauseReason;
        delete group.journey.pendingEncounterTemplateId;
        appendTravelLog(draft, travelLog.resumed(`${group.name}'s journey resumed`));
      }
      return true;
    }

    case PARTY_UPSERT_TRAVEL_EVENT_TABLE: {
      const tables = draft.entities.travelEventTables ?? (draft.entities.travelEventTables = {});
      tables[action.payload.table.id] = action.payload.table;
      draft.entities.deletedBuiltinTravelEventIds = (
        draft.entities.deletedBuiltinTravelEventIds ?? []
      ).filter((id) => id !== action.payload.table.id);
      return true;
    }

    case PARTY_REMOVE_TRAVEL_EVENT_TABLE: {
      const tables = draft.entities.travelEventTables ?? (draft.entities.travelEventTables = {});
      const table = tables[action.payload.tableId];
      if (table?.builtin) {
        const deleted = draft.entities.deletedBuiltinTravelEventIds ?? [];
        if (!deleted.includes(table.id)) deleted.push(table.id);
        draft.entities.deletedBuiltinTravelEventIds = deleted;
      }
      delete tables[action.payload.tableId];
      return true;
    }

    case PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET: {
      const sets = draft.entities.travelEventTableSets ?? (draft.entities.travelEventTableSets = {});
      sets[action.payload.set.id] = action.payload.set;
      draft.entities.deletedBuiltinTravelEventIds = (
        draft.entities.deletedBuiltinTravelEventIds ?? []
      ).filter((id) => id !== action.payload.set.id);
      return true;
    }

    case PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET: {
      const sets = draft.entities.travelEventTableSets ?? (draft.entities.travelEventTableSets = {});
      const set = sets[action.payload.setId];
      if (set?.builtin) {
        const deleted = draft.entities.deletedBuiltinTravelEventIds ?? [];
        if (!deleted.includes(set.id)) deleted.push(set.id);
        draft.entities.deletedBuiltinTravelEventIds = deleted;
      }
      delete sets[action.payload.setId];
      return true;
    }

    case PARTY_RECORD_MEAL: {
      const group = groups[action.payload.groupId];
      if (!group || !Number.isFinite(action.payload.day)) return true;
      const meals = draft.entities.groupMeals ?? (draft.entities.groupMeals = {});
      const debt = draft.entities.starvationFpDebt ?? (draft.entities.starvationFpDebt = {});
      meals[group.id] = action.payload.day;
      for (const memberId of group.memberIds) debt[memberId] = 0;
      return true;
    }

    case PARTY_ABORT_JOURNEY: {
      const group = groups[action.payload.groupId];
      if (group) abortJourney(draft, group);
      return true;
    }

    case PARTY_REROUTE_JOURNEY: {
      const group = groups[action.payload.groupId];
      const position = group ? resolveGroupPosition(draft, group) : null;
      const route = action.payload.routeTileIds;
      if (!group?.journey || !position || route.length < 2 || route[0] !== position.tileId) return true;
      group.journey.routeTileIds = [...route];
      group.journey.destinationTileId = route[route.length - 1];
      group.journey.legProgressMiles = 0;
      group.journey.status = 'active';
      delete group.journey.pauseReason;
      delete group.journey.pendingEncounterTemplateId;
      return true;
    }

    default:
      return false;
  }
}
