import type { MapToken } from '../components/map/three/MapScene';
import type { CampaignState } from '../state/campaignReducer';
import type { MapId } from '../types/map';
import { groupsOnMap, vehiclesOnMap } from './partyPosition';

export const GROUP_TOKEN_PALETTE = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#fbbf24',
  '#22d3ee',
] as const;

export function stableColorForId(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return GROUP_TOKEN_PALETTE[(hash >>> 0) % GROUP_TOKEN_PALETTE.length];
}

export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

/** Build the stable, memoizable token payload consumed by MapScene. */
export function buildMapTokens(
  state: CampaignState,
  mapId: MapId,
  activeGroupId: string | null
): MapToken[] {
  const groups = groupsOnMap(state, mapId).map(({ group, tileId }): MapToken => {
    const firstMember = group.memberIds.length > 0
      ? state.entities.characters[group.memberIds[0]]
      : undefined;
    return {
      id: group.id,
      tileId,
      color: stableColorForId(group.id),
      kind: 'group',
      image: firstMember?.images?.token,
      label: firstMember?.images?.token ? undefined : nameInitials(group.name),
      isCurrent: group.id === activeGroupId,
    };
  });

  const occupiedVehicleIds = new Set(
    Object.values(state.entities.travelGroups ?? {})
      .map((group) => group.vehicleId)
      .filter((id): id is string => id !== null)
  );
  const vehicles = vehiclesOnMap(state, mapId).map(({ vehicle, tileId }): MapToken => {
    const type = state.entities.vehicleTypes?.[vehicle.typeId];
    return {
      id: vehicle.id,
      tileId,
      color: '#f59e0b',
      kind: 'vehicle',
      label: type?.icon ?? nameInitials(type?.name ?? vehicle.name),
      dimmed: !occupiedVehicleIds.has(vehicle.id),
    };
  });

  return [...groups, ...vehicles];
}
