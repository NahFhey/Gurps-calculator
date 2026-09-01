import { useEffect, useState, useMemo } from 'react';
import { Moon, ArrowLeft } from 'lucide-react';
import { TileGrid } from './views/TileGrid';
import { FishingActivity } from './views/FishingActivity';
import { ForagingActivity } from './views/ForagingActivity';
import { MiningActivity } from './views/MiningActivity';
import { AlchemyActivity } from './views/AlchemyActivity';
import { CraftingActivity } from './views/CraftingActivity';
import { RestActivity } from './views/RestActivity';
import { TradingActivity } from './views/TradingActivity';
import { StudyActivity } from './views/StudyActivity';
import { SocialActivity } from './views/SocialActivity';
import { CookingTab } from '../CookingTab';
import { DowntimeProvider } from './DowntimeContext';
import { useCampaignCharacters, useCampaignStore } from '../../state/campaignStore';
import { characterHasAnySkill, ACTIVITY_SKILL_REQUIREMENTS } from '../../types/characterSheet';

type NavigableView = 'fishing' | 'foraging' | 'mining' | 'alchemy' | 'crafting' | 'cooking' | 'rest' | 'trading' | 'study' | 'social';
type DowntimeView = 'tiles' | NavigableView;

interface DowntimePanelProps {
  currentDayKey: number;
  currentSlot: number;
}

export function DowntimePanel({ currentDayKey, currentSlot }: DowntimePanelProps) {
  const [activeView, setActiveView] = useState<DowntimeView>('tiles');
  const characters = useCampaignCharacters();
  const { state } = useCampaignStore();

  useEffect(() => {
    if (state.ui.pendingIntent?.kind === 'cook') {
      setActiveView('cooking');
    } else if (state.ui.pendingIntent?.kind === 'craft') {
      setActiveView('crafting');
    }
  }, [state.ui.pendingIntent]);

  // Determine which activities have no characters with the required skills
  const disabledActivities = useMemo(() => {
    const disabled = new Set<NavigableView>();
    const activityIds: Array<Exclude<NavigableView, 'rest' | 'trading' | 'study' | 'social'>> = ['fishing', 'foraging', 'alchemy', 'crafting', 'cooking'];

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
        <header className="flex items-center gap-2 p-4 border-b border-edge-subtle">
          {activeView !== 'tiles' && (
            <button
              onClick={navigateBack}
              className="p-1 hover:bg-surface-2 rounded"
              aria-label="Back to activities"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold">Downtime</h2>
          <Moon className="w-5 h-5 text-fg-faint" />
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
          {activeView === 'rest' && (
            <RestActivity currentDayKey={currentDayKey} currentSlot={currentSlot} />
          )}
          {activeView === 'trading' && (
            <TradingActivity currentDayKey={currentDayKey} currentSlot={currentSlot} />
          )}
          {activeView === 'study' && (
            <StudyActivity currentDayKey={currentDayKey} currentSlot={currentSlot} />
          )}
          {activeView === 'social' && (
            <SocialActivity currentDayKey={currentDayKey} currentSlot={currentSlot} />
          )}
        </main>
      </div>
    </DowntimeProvider>
  );
}
