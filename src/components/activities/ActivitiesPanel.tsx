import { useCampaignStore } from '../../state/campaignStore';
import { ActivityTile } from './ActivityTile';
import { AlchemyTab } from '../AlchemyTab';
import { CookingTab } from '../CookingTab';
import { CraftingTab } from '../CraftingTab';
import { GatheringManager } from '../GatheringManager';

/**
 * ActivitiesPanel - Simple 4-tile grid for launching activity systems
 *
 * Part of Phase 3: Activities Panel Simplification
 *
 * Replaces the complex PartyToolApp.jsx (1,065 lines) with a simple
 * tile-based launcher (~100 lines) that connects to existing systems.
 *
 * Each tile opens the corresponding activity system (Alchemy, Cooking,
 * Crafting, Gathering) as a modal overlay.
 */

interface ActivitiesPanelProps {
  /** Optional: Show time and weather info at bottom */
  showTimeWeather?: boolean;
}

export function ActivitiesPanel({ showTimeWeather = true }: ActivitiesPanelProps) {
  const { state } = useCampaignStore();
  const { day, slot, slotLabels } = state.time;
  const slotLabel = slotLabels[slot] || `Slot ${slot + 1}`;

  // Placeholder weather effects - will be replaced in Phase 5
  const weatherEffects = 'Gathering +1';

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <h2 className="text-lg font-semibold text-slate-100">Activities</h2>
      </div>

      {/* Tiles Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          {/* Alchemy Tile */}
          <ActivityTile
            title="Alchemy"
            description="Potions & Elixirs"
            icon="⚗️"
            activityComponent={<AlchemyTab />}
          />

          {/* Cooking Tile */}
          <ActivityTile
            title="Cooking"
            description="Meals & Rations"
            icon="🍳"
            activityComponent={<CookingTab />}
          />

          {/* Crafting Tile */}
          <ActivityTile
            title="Crafting"
            description="Equipment & Items"
            icon="🔨"
            activityComponent={<CraftingTab />}
          />

          {/* Gathering Tile */}
          <ActivityTile
            title="Gathering"
            description="Foraging & Hunting"
            icon="🌿"
            activityComponent={<GatheringManager />}
          />
        </div>
      </div>

      {/* Time & Weather Footer */}
      {showTimeWeather && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          <div className="text-sm text-slate-400">
            <div className="flex items-center justify-between">
              <span>Day {day}, {slotLabel}</span>
              <span className="text-slate-500">{weatherEffects}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivitiesPanel;
