import type { Location } from '../../../types/location';
import { ClimateEditor, TerrainEditor } from '../ClimateTerrainEditor';

export interface ClimateViewProps {
  customClimates: Array<{ key: string; label: string }>;
  locations: Location[];
  onAddClimate: (key: string, label: string) => void;
  onRemoveClimate: (key: string) => void;
}

export function ClimateView(props: ClimateViewProps) {
  return <ClimateEditor {...props} />;
}

export interface TerrainViewProps {
  customTerrains: Array<{ key: string; label: string }>;
  locations: Location[];
  onAddTerrain: (key: string, label: string) => void;
  onRemoveTerrain: (key: string) => void;
}

export function TerrainView(props: TerrainViewProps) {
  return <TerrainEditor {...props} />;
}
