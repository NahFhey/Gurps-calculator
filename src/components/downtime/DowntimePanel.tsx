import { useState } from 'react';
import { Moon, ArrowLeft } from 'lucide-react';
import { TileGrid } from './views/TileGrid';

type DowntimeView = 'tiles' | 'fishing' | 'foraging' | 'alchemy' | 'crafting';

interface DowntimePanelProps {
  currentDayKey: number;
  currentSlot: number;
}

export function DowntimePanel({ currentDayKey: _currentDayKey, currentSlot: _currentSlot }: DowntimePanelProps) {
  const [activeView, setActiveView] = useState<DowntimeView>('tiles');

  const navigateTo = (view: DowntimeView) => setActiveView(view);
  const navigateBack = () => setActiveView('tiles');

  return (
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
        {activeView === 'fishing' && <ActivityPlaceholder name="Fishing" />}
        {activeView === 'foraging' && <ActivityPlaceholder name="Foraging" />}
        {activeView === 'alchemy' && <ActivityPlaceholder name="Alchemy" />}
        {activeView === 'crafting' && <ActivityPlaceholder name="Crafting" />}
      </main>
    </div>
  );
}

// Temporary placeholder - will be replaced with actual activity views
function ActivityPlaceholder({ name }: { name: string }) {
  return <div className="text-gray-500">{name} activity coming soon...</div>;
}
