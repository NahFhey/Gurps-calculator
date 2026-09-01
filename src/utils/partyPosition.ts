import type { Character, Id } from '../types/campaign';
import type { MapId, TileId } from '../types/map';
import type { GroupPosition, TravelGroup, Vehicle } from '../types/party';
import type { CampaignState } from '../state/campaignReducer';
import { calculateHPStatus } from './combatHelpers';

export function resolveVehiclePosition(
  vehicles: Record<Id, Vehicle>,
  vehicleId: Id
): GroupPosition | null {
  const vehicle = vehicles[vehicleId];
  if (!vehicle?.position) return null;
  if (vehicle.position.kind === 'tile') {
    return { mapId: vehicle.position.mapId, tileId: vehicle.position.tileId };
  }
  const carrier = vehicles[vehicle.position.carrierId];
  return carrier?.position?.kind === 'tile'
    ? { mapId: carrier.position.mapId, tileId: carrier.position.tileId }
    : null;
}

export function resolveGroupPosition(
  state: Pick<CampaignState, 'entities'>,
  group: TravelGroup
): GroupPosition | null {
  if (group.vehicleId) {
    return resolveVehiclePosition(state.entities.vehicles ?? {}, group.vehicleId);
  }
  return group.position ? { ...group.position } : null;
}

export function areCoLocated(
  state: Pick<CampaignState, 'entities'>,
  a: TravelGroup,
  b: TravelGroup
): boolean {
  const aPosition = resolveGroupPosition(state, a);
  const bPosition = resolveGroupPosition(state, b);
  return Boolean(
    aPosition
    && bPosition
    && aPosition.mapId === bPosition.mapId
    && aPosition.tileId === bPosition.tileId
  );
}

export function groupsOnMap(
  state: Pick<CampaignState, 'entities'>,
  mapId: MapId
): Array<{ group: TravelGroup; tileId: TileId }> {
  const result: Array<{ group: TravelGroup; tileId: TileId }> = [];
  for (const group of Object.values(state.entities.travelGroups ?? {})) {
    const position = resolveGroupPosition(state, group);
    if (position?.mapId === mapId) result.push({ group, tileId: position.tileId });
  }
  return result;
}

export function vehiclesOnMap(
  state: Pick<CampaignState, 'entities'>,
  mapId: MapId
): Array<{ vehicle: Vehicle; tileId: TileId }> {
  const result: Array<{ vehicle: Vehicle; tileId: TileId }> = [];
  for (const vehicle of Object.values(state.entities.vehicles ?? {})) {
    if (vehicle.position?.kind === 'tile' && vehicle.position.mapId === mapId) {
      result.push({ vehicle, tileId: vehicle.position.tileId });
    }
  }
  return result;
}

export function dockedVehicles(
  vehicles: Record<Id, Vehicle>,
  carrierId: Id
): Vehicle[] {
  return Object.values(vehicles).filter(
    (vehicle) => vehicle.position?.kind === 'docked' && vehicle.position.carrierId === carrierId
  );
}

export function isAbleBodied(character: Character): boolean {
  const hp = character.gcsData?.pools.HP;
  if (!hp) return true;
  const status = calculateHPStatus(hp.current, hp.max);
  return status !== 'critical' && status !== 'dead';
}

export function findGroupOfCharacter(
  state: Pick<CampaignState, 'entities'>,
  characterId: Id
): TravelGroup | null {
  return Object.values(state.entities.travelGroups ?? {})
    .find((group) => group.memberIds.includes(characterId)) ?? null;
}
