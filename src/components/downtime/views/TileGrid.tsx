import { Fish, Leaf, FlaskConical, Hammer } from 'lucide-react';

type NavigableView = 'fishing' | 'foraging' | 'alchemy' | 'crafting';

interface TileGridProps {
  onNavigate: (view: NavigableView) => void;
  // Future: pass task counts per activity for badges
}

interface TileConfig {
  id: NavigableView;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string; // Tailwind color class
}

const TILES: TileConfig[] = [
  {
    id: 'fishing',
    label: 'Fishing',
    description: 'Fish & Seafood',
    icon: Fish,
    color: 'bg-blue-100 hover:bg-blue-200',
  },
  {
    id: 'foraging',
    label: 'Foraging',
    description: 'Herbs & Materials',
    icon: Leaf,
    color: 'bg-green-100 hover:bg-green-200',
  },
  {
    id: 'alchemy',
    label: 'Alchemy',
    description: 'Potions & Reagents',
    icon: FlaskConical,
    color: 'bg-purple-100 hover:bg-purple-200',
  },
  {
    id: 'crafting',
    label: 'Crafting',
    description: 'Gear & Projects',
    icon: Hammer,
    color: 'bg-orange-100 hover:bg-orange-200',
  },
];

export function TileGrid({ onNavigate }: TileGridProps) {
  return (
    <div className="tile-grid grid grid-cols-2 gap-4">
      {TILES.map((tile) => (
        <ActivityTile
          key={tile.id}
          config={tile}
          onClick={() => onNavigate(tile.id)}
        />
      ))}
    </div>
  );
}

interface ActivityTileProps {
  config: TileConfig;
  onClick: () => void;
  taskCount?: number; // Future: badge for pending tasks
}

function ActivityTile({ config, onClick, taskCount }: ActivityTileProps) {
  const Icon = config.icon;

  return (
    <button
      className={`activity-tile p-4 rounded-lg ${config.color} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      onClick={onClick}
      aria-label={`Open ${config.label} activity`}
    >
      <Icon className="w-8 h-8 mb-2" />
      <h3 className="font-semibold">{config.label}</h3>
      <p className="text-sm text-gray-600">{config.description}</p>
      {taskCount !== undefined && taskCount > 0 && (
        <span className="task-badge absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
          {taskCount}
        </span>
      )}
    </button>
  );
}
