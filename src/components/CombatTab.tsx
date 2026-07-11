import { useState, useCallback } from 'react';
import { Users, Swords, History, ScrollText, Settings, Map } from 'lucide-react';
import { useCampaignStore } from '../state/campaignStore';
import CharacterLibrary from './combat/CharacterLibrary';
import EncounterSetup from './combat/EncounterSetup';
import CombatTracker from './combat/CombatTracker';
import CombatHistory from './combat/CombatHistory';
import CombatRulesSettings from './combat/CombatRulesSettings';

// ============================================================================
// Types
// ============================================================================

type CombatView = 'library' | 'setup' | 'tracker' | 'history' | 'settings';

// ============================================================================
// CombatTab Component
// ============================================================================

/**
 * Main Combat Runner tab component
 * Manages character library, encounter setup, and active combat
 *
 * MIGRATED: Now uses useCampaignStore directly instead of bridge contexts.
 */
export function CombatTab() {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<CombatView>('library');

  // Derive combat state from campaign store
  const combatActive = state.combat.activeSession;
  const combatHasMap = !!combatActive?.mapId;
  const combatRulesPreset = state.combat.rulesPreset;

  // Save callback for rules preset
  const saveCombatRulesPreset = useCallback((preset: string) => {
    actions.setCombatRulesPreset(preset);
  }, [actions]);

  // If there's an active combat, automatically show tracker
  const currentView = combatActive ? 'tracker' : view;

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setView('library')}
          disabled={!!combatActive}
          className={`flex items-center gap-2 px-4 py-2 rounded ${
            currentView === 'library'
              ? 'bg-blue-600 text-white'
              : combatActive
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Users size={20} />
          Character Library
        </button>

        <button
          onClick={() => setView('setup')}
          disabled={!!combatActive}
          className={`flex items-center gap-2 px-4 py-2 rounded ${
            currentView === 'setup'
              ? 'bg-blue-600 text-white'
              : combatActive
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Swords size={20} />
          Encounter Setup
        </button>

        <button
          onClick={() => setView('history')}
          disabled={!!combatActive}
          className={`flex items-center gap-2 px-4 py-2 rounded ${
            currentView === 'history'
              ? 'bg-blue-600 text-white'
              : combatActive
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <ScrollText size={20} />
          History
        </button>

        <button
          onClick={() => setView('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded ${
            currentView === 'settings'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Settings size={20} />
          Rules Settings
        </button>

        {combatActive && (
          <button
            onClick={() => setView('tracker')}
            className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white"
          >
            <History size={20} />
            Active Combat
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {currentView === 'library' && <CharacterLibrary />}
        {currentView === 'setup' && <EncounterSetup />}
        {currentView === 'history' && <CombatHistory />}
        {currentView === 'settings' && (
          <CombatRulesSettings
            preset={combatRulesPreset || 'standard'}
            onPresetChange={saveCombatRulesPreset}
          />
        )}
        {currentView === 'tracker' && combatActive && (
          combatHasMap ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Map className="h-10 w-10 text-blue-400/60" />
              <p className="text-sm font-medium">Combat is displayed in the main view</p>
              <p className="text-xs text-gray-500">
                Participants, map, and maneuvers are shown in the shell layout.
              </p>
            </div>
          ) : (
            <CombatTracker />
          )
        )}
      </div>
    </div>
  );
}
