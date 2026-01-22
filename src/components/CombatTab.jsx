import React, { useState } from 'react';
import { Users, Swords, History, ScrollText } from 'lucide-react';
import { useCombat } from '../contexts/CombatContext';
import CharacterLibrary from './combat/CharacterLibrary';
import EncounterSetup from './combat/EncounterSetup';
import CombatTracker from './combat/CombatTracker';
import CombatHistory from './combat/CombatHistory';

/**
 * Main Combat Runner tab component
 * Manages character library, encounter setup, and active combat
 */
export function CombatTab() {
  const [view, setView] = useState('library'); // 'library', 'setup', 'tracker', 'history'
  const { combatActive } = useCombat();

  // If there's an active combat, automatically show tracker
  const currentView = combatActive ? 'tracker' : view;

  return (
    <div className="space-y-4">
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
      {currentView === 'tracker' && combatActive && <CombatTracker />}
    </div>
  );
}
