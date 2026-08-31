import type { CampaignState } from '../campaignReducer';
import type { Id } from '../../types/campaign';
import type {
  MapId,
  MarkerId,
  MarkerVisibility,
  TileId,
} from '../../types/map';

export interface LocationPin {
  locationId: Id;
  mapId: MapId;
  tileId: TileId;
  markerId: MarkerId;
  visibility: MarkerVisibility;
  discoveredAt?: { day: number; slot: number };
}

export function selectLocationPins(state: CampaignState): LocationPin[] {
  const pins: LocationPin[] = [];
  for (const [mapId, map] of Object.entries(state.maps.mapsById)) {
    for (const marker of Object.values(map.markersById)) {
      if (!marker.locationId) continue;
      pins.push({
        locationId: marker.locationId,
        mapId,
        tileId: marker.tileId,
        markerId: marker.id,
        visibility: marker.visibility,
        ...(marker.discoveredAt ? { discoveredAt: marker.discoveredAt } : {}),
      });
    }
  }
  return pins;
}

export function selectPinsForTile(
  state: CampaignState,
  mapId: MapId,
  tileId: TileId
): LocationPin[] {
  return selectLocationPins(state).filter((pin) => pin.mapId === mapId && pin.tileId === tileId);
}

export function selectPinForLocation(state: CampaignState, locationId: Id): LocationPin | undefined {
  return selectLocationPins(state).find((pin) => pin.locationId === locationId);
}
