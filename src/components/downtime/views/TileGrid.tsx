import { Fish, Leaf, HardHat, FlaskConical, Hammer, ChefHat, Bed, Coins, GraduationCap } from 'lucide-react';
import type { DowntimeActivityId } from '../../../types/characterSheet';
export { ACTIVITY_SKILL_REQUIREMENTS } from '../../../types/characterSheet';

export type NavigableView = DowntimeActivityId | 'rest' | 'trading' | 'study';

interface TileGridProps {
  onNavigate: (view: NavigableView) => void;
  /** Set of activity IDs that should be darkened/disabled (no character has the skill) */
  disabledActivities?: Set<NavigableView>;
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
    id: 'mining',
    label: 'Mining',
    description: 'Ore & Minerals',
    icon: HardHat,
    color: 'bg-stone-900/50 hover:bg-stone-800/60 border-stone-700/50',
  },
  {
    id: 'rest',
    label: 'Rest',
    description: 'Sleep & Recovery',
    icon: Bed,
    color: 'bg-indigo-900/50 hover:bg-indigo-800/60 border-indigo-700/50',
  },
  {
    id: 'trading',
    label: 'Trading',
    description: 'Buy, Sell & Haggle',
    icon: Coins,
    color: 'bg-yellow-900/50 hover:bg-yellow-800/60 border-yellow-700/50',
  },
  {
    id: 'study',
    label: 'Study',
    description: 'Skills & Advancement',
    icon: GraduationCap,
    color: 'bg-cyan-900/50 hover:bg-cyan-800/60 border-cyan-700/50',
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

export function TileGrid({ onNavigate, disabledActivities }: TileGridProps) {
  return (
    <div className="tile-grid grid grid-cols-2 gap-4">
      {TILES.map((tile) => {
        const isDisabled = disabledActivities?.has(tile.id) ?? false;
        return (
          <ActivityTile
            key={tile.id}
            config={tile}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onNavigate(tile.id);
            }}
          />
        );
      })}
    </div>
  );
}

interface ActivityTileProps {
  config: TileConfig;
  onClick: () => void;
  disabled?: boolean;
  taskCount?: number; // Future: badge for pending tasks
}

function ActivityTile({ config, onClick, disabled, taskCount }: ActivityTileProps) {
  const Icon = config.icon;

  return (
    <button
      className={`activity-tile relative p-4 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
        disabled
          ? 'bg-gray-800/50 border-gray-700/50 opacity-40 cursor-not-allowed'
          : config.color
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Open ${config.label} activity`}
      title={disabled ? `No characters have ${config.label.toLowerCase()} skills` : undefined}
    >
      <Icon className={`w-8 h-8 mb-2 ${disabled ? 'text-gray-500' : 'text-gray-200'}`} />
      <h3 className={`font-semibold ${disabled ? 'text-gray-500' : 'text-gray-100'}`}>{config.label}</h3>
      <p className={`text-sm ${disabled ? 'text-gray-600' : 'text-gray-400'}`}>{config.description}</p>
      {taskCount !== undefined && taskCount > 0 && (
        <span className="task-badge absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
          {taskCount}
        </span>
      )}
    </button>
  );
}
