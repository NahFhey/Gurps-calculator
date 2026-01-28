import { useState } from 'react';
import { Moon, ArrowLeft } from 'lucide-react';
import { TileGrid } from './views/TileGrid';
import { FishingActivity } from './views/FishingActivity';
import { ForagingActivity } from './views/ForagingActivity';
import { AlchemyActivity } from './views/AlchemyActivity';
import { CraftingActivity } from './views/CraftingActivity';
import { DowntimeProvider } from './DowntimeContext';

type DowntimeView = 'tiles' | 'fishing' | 'foraging' | 'alchemy' | 'crafting';

interface DowntimePanelProps {
  currentDayKey: number;
  currentSlot: number;
}

export function DowntimePanel({ currentDayKey, currentSlot }: DowntimePanelProps) {
  const [activeView, setActiveView] = useState<DowntimeView>('tiles');

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
          {activeView === 'tiles' && <TileGrid onNavigate={navigateTo} />}
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
        </main>
      </div>
    </DowntimeProvider>
  );
}
