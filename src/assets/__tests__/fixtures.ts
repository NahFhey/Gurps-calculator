import { createCampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import type { CampaignState } from '../../state/campaignReducer';
import type { MapImageLayer } from '../../types/map';

export function imageLayer(overrides: Partial<MapImageLayer> = {}): MapImageLayer {
  return {
    id: 'image', name: 'Map image', src: 'data:image/jpeg;base64,AQID',
    placement: 'underlay', opacity: 1, visible: true, gmOnly: false,
    x: 0, y: 0, width: 4, height: 3, elevation: 1, ...overrides,
  };
}

export function imageState(layers: MapImageLayer[] = [imageLayer()]) {
  const base = createCampaignState();
  const state: CampaignState = { ...base, maps: { ...base.maps }, checkpoints: { ...base.checkpoints, entries: [] } };
  const map = createNewMap({ name: 'Map', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  map.imageLayers = layers;
  state.maps.mapsById = { [map.id]: map };
  state.maps.activeMapId = map.id;
  return { state, map };
}
