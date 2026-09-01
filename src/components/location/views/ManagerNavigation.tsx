import type { ManagerView } from '../managerTypes';

export interface ManagerNavigationProps {
  view: ManagerView;
  onChangeView: (view: ManagerView) => void;
}

export function ManagerNavigation({ view, onChangeView }: ManagerNavigationProps) {
  const tabViews: ManagerView[] = ['list', 'weatherTables', 'climates', 'terrain', 'terrainModifiers', 'weatherModifiers'];
  if (!tabViews.includes(view)) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-edge-strong pb-2">
      <button
        onClick={() => onChangeView('list')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'list'
            ? 'bg-surface-2 text-accent-400 border-b-2 border-accent-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Locations
      </button>
      <button
        onClick={() => onChangeView('weatherTables')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'weatherTables'
            ? 'bg-surface-2 text-cyan-400 border-b-2 border-cyan-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Weather
      </button>
      <button
        onClick={() => onChangeView('climates')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'climates'
            ? 'bg-surface-2 text-success-400 border-b-2 border-success-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Climates
      </button>
      <button
        onClick={() => onChangeView('terrain')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'terrain'
            ? 'bg-surface-2 text-emerald-400 border-b-2 border-emerald-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Terrain
      </button>
      <button
        onClick={() => onChangeView('terrainModifiers')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'terrainModifiers'
            ? 'bg-surface-2 text-warning-400 border-b-2 border-warning-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Terrain Mods
      </button>
      <button
        onClick={() => onChangeView('weatherModifiers')}
        className={`px-3 py-1.5 text-sm rounded-t ${
          view === 'weatherModifiers'
            ? 'bg-surface-2 text-orange-400 border-b-2 border-orange-400'
            : 'text-fg-muted hover:text-fg-primary'
        }`}
      >
        Weather Mods
      </button>
    </div>
  );
}
