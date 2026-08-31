export interface LocationManagerProps {
  onClose?: () => void;
}

export type ManagerView =
  | 'list'
  | 'create'
  | 'edit'
  | 'weatherTables'
  | 'editWeatherTable'
  | 'climates'
  | 'terrain'
  | 'terrainModifiers'
  | 'weatherModifiers';
