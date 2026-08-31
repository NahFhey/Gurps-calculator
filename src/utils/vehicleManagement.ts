import type { CampaignState } from '../state/campaignReducer';
import type { Id } from '../types/campaign';
import type { Vehicle } from '../types/party';
import { dockedVehicles, resolveVehiclePosition } from './partyPosition';

export function eligibleVehicleCarriers(state: CampaignState, vehicleId: Id): Vehicle[] {
  const vehicles = state.entities.vehicles ?? {};
  const vehicle = vehicles[vehicleId];
  if (!vehicle || vehicle.position?.kind === 'docked' || dockedVehicles(vehicles, vehicleId).length > 0) {
    return [];
  }
  const sourcePosition = resolveVehiclePosition(vehicles, vehicleId);
  if (!sourcePosition) return [];
  return Object.values(vehicles).filter((carrier) => {
    if (carrier.id === vehicleId || carrier.position?.kind !== 'tile') return false;
    const type = state.entities.vehicleTypes?.[carrier.typeId];
    if (!type || type.hangarSlots <= dockedVehicles(vehicles, carrier.id).length) return false;
    return carrier.position.mapId === sourcePosition.mapId
      && carrier.position.tileId === sourcePosition.tileId;
  });
}

export function vehiclePositionReadout(state: CampaignState, vehicle: Vehicle): string {
  if (!vehicle.position) return 'Unplaced';
  if (vehicle.position.kind === 'docked') {
    const carrier = state.entities.vehicles?.[vehicle.position.carrierId];
    return `Docked to ${carrier?.name ?? 'unknown vehicle'}`;
  }
  const map = state.maps.mapsById[vehicle.position.mapId];
  if (!map) return 'Unplaced';
  for (let row = 0; row < map.grid.length; row += 1) {
    const col = map.grid[row].indexOf(vehicle.position.tileId);
    if (col >= 0) return `${map.name} (${row},${col})`;
  }
  return `${map.name} (unknown tile)`;
}
