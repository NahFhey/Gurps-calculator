import type { ManagerView } from '../managerTypes';

export interface ManagerNavigationProps {
  view: ManagerView;
  onChangeView: (view: ManagerView) => void;
}

export function ManagerNavigation({ view, onChangeView }: ManagerNavigationProps) {
  const tabViews: ManagerView[] = ['list', 'weatherTables', 'climates', 'terrain', 'terrainModifiers', 'weatherModifiers'];
  if (!tabViews.includes(view)) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-600 pb-2">
      <button
        onClick={() => onChangeView('list')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'list'
            ? 'bg-gray-700 text-blue-400 border-b-2 border-blue-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Locations
      </button>
      <button
        onClick={() => onChangeView('weatherTables')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'weatherTables'
            ? 'bg-gray-700 text-cyan-400 border-b-2 border-cyan-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Weather
      </button>
      <button
        onClick={() => onChangeView('climates')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'climates'
            ? 'bg-gray-700 text-green-400 border-b-2 border-green-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Climates
      </button>
      <button
        onClick={() => onChangeView('terrain')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'terrain'
            ? 'bg-gray-700 text-emerald-400 border-b-2 border-emerald-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Terrain
      </button>
      <button
        onClick={() => onChangeView('terrainModifiers')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'terrainModifiers'
            ? 'bg-gray-700 text-amber-400 border-b-2 border-amber-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Terrain Mods
      </button>
      <button
        onClick={() => onChangeView('weatherModifiers')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'weatherModifiers'
            ? 'bg-gray-700 text-orange-400 border-b-2 border-orange-400'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Weather Mods
      </button>
    </div>
  );
}
