import React, { useState } from 'react';
import { Users, Swords, History, ScrollText, Settings } from 'lucide-react';
import { useCombat } from '../contexts/CombatContext';
import { useCampaignStore } from '../state/campaignStore';
import CharacterLibrary from './combat/CharacterLibrary';
import EncounterSetup from './combat/EncounterSetup';
import CombatTracker from './combat/CombatTracker';
import CombatHistory from './combat/CombatHistory';
import CombatRulesSettings from './combat/CombatRulesSettings';

/**
 * Main Combat Runner tab component
 * Manages character library, encounter setup, and active combat
 */
export function CombatTab() {
  const [view, setView] = useState('library'); // 'library', 'setup', 'tracker', 'history', 'settings'
  const { combatActive, combatRulesPreset, saveCombatRulesPreset } = useCombat();
  const { state: campaignState, actions: campaignActions } = useCampaignStore();

  // If there's an active combat, automatically show tracker
  const currentView = combatActive ? 'tracker' : view;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Unified Combat Session</h3>
          <p className="text-xs text-gray-400">
            {campaignState.combat.active ? 'Combat active in unified state.' : 'No active unified combat session.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => campaignActions.startCombat()}
          disabled={campaignState.combat.active}
          className={`rounded px-3 py-2 text-xs font-semibold ${
            campaignState.combat.active
              ? 'cursor-not-allowed bg-gray-700 text-gray-400'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          Start Combat
        </button>
      </div>
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

      {currentView === 'library' && <CharacterLibrary />}
      {currentView === 'setup' && <EncounterSetup />}
      {currentView === 'history' && <CombatHistory />}
      {currentView === 'settings' && (
        <CombatRulesSettings
          preset={combatRulesPreset || 'standard'}
          onPresetChange={saveCombatRulesPreset}
        />
      )}
      {currentView === 'tracker' && combatActive && <CombatTracker />}
    </div>
  );
}
