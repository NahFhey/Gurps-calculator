import { useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { DowntimeTile } from './DowntimeTile';
import { AlchemyTab } from '../AlchemyTab';
import { CookingTab } from '../CookingTab';
import { CraftingTab } from '../CraftingTab';
import { DayPlannerTab } from '../DayPlannerTab';
import { useAllWeatherModifiers } from '../../hooks/useWeatherModifiers';

/**
 * DowntimePanel - Simple 4-tile grid for launching downtime activity systems
 *
 * Part of the Downtime System
 *
 * Each tile opens the corresponding activity system (Alchemy, Cooking,
 * Crafting, Gathering) as a modal overlay.
 */

interface DowntimePanelProps {
  /** Optional: Show time and weather info at bottom */
  showTimeWeather?: boolean;
}

export function DowntimePanel({ showTimeWeather = true }: DowntimePanelProps) {
  const { state } = useCampaignStore();
  const { day, slot, slotLabels } = state.time;
  const slotLabel = slotLabels[slot] || `Slot ${slot + 1}`;

  // Get weather effects from the location system
  const { effects, hasAnyEffect } = useAllWeatherModifiers();

  // Format weather effects for display
  const weatherEffects = useMemo(() => {
    if (!hasAnyEffect) return 'No weather modifiers';

    const effectStrings: string[] = [];
    if (effects.gathering !== 0) {
      effectStrings.push(`Gathering ${effects.gathering > 0 ? '+' : ''}${effects.gathering}`);
    }
    if (effects.hunting !== 0) {
      effectStrings.push(`Hunting ${effects.hunting > 0 ? '+' : ''}${effects.hunting}`);
    }
    if (effects.crafting !== 0) {
      effectStrings.push(`Crafting ${effects.crafting > 0 ? '+' : ''}${effects.crafting}`);
    }
    if (effects.cooking !== 0) {
      effectStrings.push(`Cooking ${effects.cooking > 0 ? '+' : ''}${effects.cooking}`);
    }
    if (effects.alchemy !== 0) {
      effectStrings.push(`Alchemy ${effects.alchemy > 0 ? '+' : ''}${effects.alchemy}`);
    }

    return effectStrings.length > 0 ? effectStrings.join(', ') : 'No modifiers';
  }, [effects, hasAnyEffect]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <h2 className="text-lg font-semibold text-slate-100">Downtime</h2>
      </div>

      {/* Tiles Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          {/* Alchemy Tile */}
          <DowntimeTile
            title="Alchemy"
            description="Potions & Elixirs"
            icon="⚗️"
            activityComponent={<AlchemyTab />}
          />

          {/* Cooking Tile */}
          <DowntimeTile
            title="Cooking"
            description="Meals & Rations"
            icon="🍳"
            activityComponent={<CookingTab />}
          />

          {/* Crafting Tile */}
          <DowntimeTile
            title="Crafting"
            description="Equipment & Items"
            icon="🔨"
            activityComponent={<CraftingTab />}
          />

          {/* Gathering Tile */}
          <DowntimeTile
            title="Gathering"
            description="Foraging & Hunting"
            icon="🌿"
            activityComponent={<DayPlannerTab />}
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

export default DowntimePanel;
