export interface LocationManagerProps {
  onClose?: () => void;
}

export type ManagerView =
  | 'list'
  | 'create'
  | 'edit'
  | 'travel'
  | 'weatherTables'
  | 'editWeatherTable'
  | 'climates'
  | 'terrain'
  | 'terrainModifiers'
  | 'weatherModifiers';
