import type { Id } from '../types/campaign';
import type { TravelGroup } from '../types/party';
import type { PartyAction } from '../state/party/partyActions';
import type { CampaignState } from '../state/campaignReducer';
import type { Vehicle } from '../types/party';
import { areCoLocated, resolveGroupPosition, resolveVehiclePosition } from './partyPosition';

export interface StagedComposition {
  travelingMemberIds: Id[];
  vehicleId: Id | null;
}

export function getCompositionGroups(state: CampaignState, activeGroup: TravelGroup): TravelGroup[] {
  return [
    activeGroup,
    ...Object.values(state.entities.travelGroups ?? {}).filter(
      (group) => group.id !== activeGroup.id && areCoLocated(state, activeGroup, group)
    ),
  ];
}

export function getCoLocatedVehicles(state: CampaignState, activeGroup: TravelGroup): Vehicle[] {
  const activePosition = resolveGroupPosition(state, activeGroup);
  if (!activePosition) return [];
  return Object.values(state.entities.vehicles ?? {}).filter((vehicle) => {
    const position = resolveVehiclePosition(state.entities.vehicles ?? {}, vehicle.id);
    return position?.mapId === activePosition.mapId && position.tileId === activePosition.tileId;
  });
}

export function mapSourceGroupsByMember(groups: TravelGroup[]): Record<Id, Id> {
  const result: Record<Id, Id> = {};
  for (const group of groups) {
    for (const memberId of group.memberIds) result[memberId] = group.id;
  }
  return result;
}

export function buildStagedGroup(
  activeGroup: TravelGroup,
  composition: StagedComposition
): TravelGroup {
  return {
    ...activeGroup,
    memberIds: [...composition.travelingMemberIds],
    vehicleId: composition.vehicleId,
    position: composition.vehicleId ? null : activeGroup.position,
  };
}

export function buildCompositionActions(
  activeGroup: TravelGroup,
  composition: StagedComposition,
  sourceGroupIdByMember: Record<Id, Id>
): PartyAction[] {
  const traveling = new Set(composition.travelingMemberIds);
  const pulledIn = composition.travelingMemberIds.filter(
    (memberId) => sourceGroupIdByMember[memberId] !== activeGroup.id
  );
  const staying = activeGroup.memberIds.filter((memberId) => !traveling.has(memberId));
  const actions: PartyAction[] = [];

  if (pulledIn.length > 0) {
    actions.push({
      type: 'party/moveMembers',
      payload: { memberIds: pulledIn, toGroupId: activeGroup.id },
    });
  }
  if (staying.length > 0) {
    actions.push({
      type: 'party/createGroup',
      payload: { name: 'Staying behind', memberIds: staying, fromGroupId: activeGroup.id },
    });
  }
  if (activeGroup.vehicleId && activeGroup.vehicleId !== composition.vehicleId) {
    actions.push({ type: 'party/disembark', payload: { groupId: activeGroup.id } });
  }
  if (composition.vehicleId && composition.vehicleId !== activeGroup.vehicleId) {
    actions.push({
      type: 'party/boardVehicle',
      payload: { groupId: activeGroup.id, vehicleId: composition.vehicleId },
    });
  }
  return actions;
}

export interface CompositionActionHandlers {
  partyMoveMembers(params: { memberIds: Id[]; toGroupId: Id }): void;
  partyCreateGroup(params: { name: string; memberIds: Id[]; fromGroupId: Id }): void;
  partyDisembark(groupId: Id): void;
  partyBoardVehicle(groupId: Id, vehicleId: Id): void;
}

export function applyCompositionActions(
  actions: PartyAction[],
  handlers: CompositionActionHandlers
): void {
  for (const action of actions) {
    switch (action.type) {
      case 'party/moveMembers':
        handlers.partyMoveMembers(action.payload);
        break;
      case 'party/createGroup':
        handlers.partyCreateGroup(action.payload);
        break;
      case 'party/disembark':
        handlers.partyDisembark(action.payload.groupId);
        break;
      case 'party/boardVehicle':
        handlers.partyBoardVehicle(action.payload.groupId, action.payload.vehicleId);
        break;
      default:
        break;
    }
  }
}
