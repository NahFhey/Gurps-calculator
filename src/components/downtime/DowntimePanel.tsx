import { useState, useMemo } from 'react';
import { Moon, ArrowLeft } from 'lucide-react';
import { TileGrid } from './views/TileGrid';
import { FishingActivity } from './views/FishingActivity';
import { ForagingActivity } from './views/ForagingActivity';
import { MiningActivity } from './views/MiningActivity';
import { AlchemyActivity } from './views/AlchemyActivity';
import { CraftingActivity } from './views/CraftingActivity';
import { CookingTab } from '../CookingTab';
import { DowntimeProvider } from './DowntimeContext';
import { useCampaignCharacters } from '../../state/campaignStore';
import { characterHasAnySkill, ACTIVITY_SKILL_REQUIREMENTS } from '../../types/characterSheet';

type NavigableView = 'fishing' | 'foraging' | 'mining' | 'alchemy' | 'crafting' | 'cooking';
type DowntimeView = 'tiles' | NavigableView;

interface DowntimePanelProps {
  currentDayKey: number;
  currentSlot: number;
}

export function DowntimePanel({ currentDayKey, currentSlot }: DowntimePanelProps) {
  const [activeView, setActiveView] = useState<DowntimeView>('tiles');
  const characters = useCampaignCharacters();

  // Determine which activities have no characters with the required skills
  const disabledActivities = useMemo(() => {
    const disabled = new Set<NavigableView>();
    const activityIds: NavigableView[] = ['fishing', 'foraging', 'alchemy', 'crafting', 'cooking'];

    for (const activityId of activityIds) {
      const hasSkilled = characters.some((char) =>
        characterHasAnySkill(char, ACTIVITY_SKILL_REQUIREMENTS[activityId])
      );
      if (!hasSkilled) {
        disabled.add(activityId);
      }
    }

    return disabled;
  }, [characters]);

  const navigateTo = (view: DowntimeView) => setActiveView(view);
  const navigateBack = () => setActiveView('tiles');

  return (
    <DowntimeProvider currentDayKey={currentDayKey} currentSlot={currentSlot}>
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-2 p-4 border-b border-gray-200">
          {activeView !== 'tiles' && (
            <button
              onClick={navigateBack}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Back to activities"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold">Downtime</h2>
          <Moon className="w-5 h-5 text-gray-500" />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          {activeView === 'tiles' && <TileGrid onNavigate={navigateTo} disabledActivities={disabledActivities} />}
          {activeView === 'fishing' && (
            <FishingActivity
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
            />
          )}
          {activeView === 'foraging' && (
            <ForagingActivity
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
            />
          )}
          {activeView === 'mining' && (
            <MiningActivity
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
            />
          )}
          {activeView === 'alchemy' && (
            <AlchemyActivity
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
            />
          )}
          {activeView === 'crafting' && (
            <CraftingActivity
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
            />
          )}
          {activeView === 'cooking' && <CookingTab />}
        </main>
      </div>
    </DowntimeProvider>
  );
}
