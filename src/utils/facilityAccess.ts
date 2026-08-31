import type { CampaignState } from '../state/campaignReducer';
import type { FacilityAttachment, Id } from '../types/campaign';
import type { TravelGroup } from '../types/party';
import { resolveGroupPosition, resolveVehiclePosition } from './partyPosition';

export function findGroupForCharacter(state: CampaignState, characterId: Id): TravelGroup | null {
  return Object.values(state.entities.travelGroups ?? {}).find(
    (group) => group.memberIds.includes(characterId)
  ) ?? null;
}

export function isAttachmentReachable(
  state: CampaignState,
  attachment: FacilityAttachment | undefined,
  characterId: Id
): boolean {
  if (!attachment || attachment.kind === 'party') return true;
  const group = findGroupForCharacter(state, characterId);
  if (!group) return false;

  if (attachment.kind === 'location') {
    const position = resolveGroupPosition(state, group);
    if (!position) return false;
    const map = state.maps.mapsById[position.mapId];
    return Boolean(map && Object.values(map.markersById).some(
      (marker) => marker.tileId === position.tileId && marker.locationId === attachment.locationId
    ));
  }

  const vehicles = state.entities.vehicles ?? {};
  const attachedVehicle = vehicles[attachment.vehicleId];
  if (!group.vehicleId || !attachedVehicle || !vehicles[group.vehicleId]) return false;
  if (!resolveVehiclePosition(vehicles, attachment.vehicleId)) return false;
  if (group.vehicleId === attachment.vehicleId) return true;

  const groupVehicle = vehicles[group.vehicleId];
  return groupVehicle.position?.kind === 'docked'
    ? groupVehicle.position.carrierId === attachment.vehicleId
    : attachedVehicle.position?.kind === 'docked'
      && attachedVehicle.position.carrierId === group.vehicleId;
}
