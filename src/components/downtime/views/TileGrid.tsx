import { Fish, Leaf, FlaskConical, Hammer, ChefHat } from 'lucide-react';

type NavigableView = 'fishing' | 'foraging' | 'alchemy' | 'crafting' | 'cooking';

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
    color: 'bg-blue-900/50 hover:bg-blue-800/60 border-blue-700/50',
  },
  {
    id: 'foraging',
    label: 'Foraging',
    description: 'Herbs & Materials',
    icon: Leaf,
    color: 'bg-green-900/50 hover:bg-green-800/60 border-green-700/50',
  },
  {
    id: 'alchemy',
    label: 'Alchemy',
    description: 'Potions & Reagents',
    icon: FlaskConical,
    color: 'bg-purple-900/50 hover:bg-purple-800/60 border-purple-700/50',
  },
  {
    id: 'crafting',
    label: 'Crafting',
    description: 'Gear & Projects',
    icon: Hammer,
    color: 'bg-amber-900/50 hover:bg-amber-800/60 border-amber-700/50',
  },
  {
    id: 'cooking',
    label: 'Cooking',
    description: 'Recipes & Meals',
    icon: ChefHat,
    color: 'bg-orange-900/50 hover:bg-orange-800/60 border-orange-700/50',
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
      className={`activity-tile relative p-4 rounded-lg border ${config.color} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      onClick={onClick}
      aria-label={`Open ${config.label} activity`}
    >
      <Icon className="w-8 h-8 mb-2 text-gray-200" />
      <h3 className="font-semibold text-gray-100">{config.label}</h3>
      <p className="text-sm text-gray-400">{config.description}</p>
      {taskCount !== undefined && taskCount > 0 && (
        <span className="task-badge absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
          {taskCount}
        </span>
      )}
    </button>
  );
}
