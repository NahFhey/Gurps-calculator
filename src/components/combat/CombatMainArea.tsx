/**
 * CombatMainArea — the map + floating overlays for the center/module area during map combat.
 *
 * Renders CombatMapPanel at full height with a floating dice roller.
 */

import { useState } from 'react';
import { useCombatContext } from './CombatContext';
import { CombatMapPanel } from './CombatMapPanel';
import { Dices, X, ScrollText } from 'lucide-react';

export function CombatMainArea() {
  const ctx = useCombatContext();
  const [showDice, setShowDice] = useState(false);
  const [showLog, setShowLog] = useState(false);

  return (
    <div className="h-full w-full relative">
      {/* Map fills the entire area */}
      <CombatMapPanel
        combat={ctx.combat}
        participants={ctx.participants}
        currentActorInstanceId={ctx.currentActorInstanceId}
        selectedParticipantId={ctx.selectedParticipantId}
        onSelectParticipant={ctx.setSelectedParticipantId}
        movementBudgetYards={ctx.movementBudgetYards}
        hasMovedThisTurn={ctx.hasMovedThisTurn}
        isGmMode={ctx.gmMode}
        onMoveTo={ctx.handleMoveTo}
        onGmPlaceToken={ctx.handleGmPlaceToken}
        losTileIds={ctx.losOverlayTileIds}
      />

      {/* Floating toolbar — bottom-left */}
      <div className="absolute bottom-3 left-3 z-30 flex gap-1.5">
        <button
          onClick={() => setShowDice((v) => !v)}
          className={`p-2 rounded-lg shadow-lg transition-colors ${
            showDice
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700'
          }`}
          title="Dice Tools"
        >
          <Dices className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowLog((v) => !v)}
          className={`p-2 rounded-lg shadow-lg transition-colors ${
            showLog
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700'
          }`}
          title="Combat Log"
        >
          <ScrollText className="h-4 w-4" />
        </button>
      </div>

      {/* Floating dice panel */}
      {showDice && (
        <div className="absolute bottom-14 left-3 z-30 w-56 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Dice</span>
            <button
              onClick={() => setShowDice(false)}
              className="p-0.5 rounded hover:bg-gray-700 text-gray-500"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={ctx.diceExpression}
              onChange={(e) => ctx.setDiceExpression(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded"
              placeholder="3d6"
            />
            <input
              type="text"
              value={ctx.rollTarget}
              onChange={(e) => ctx.setRollTarget(e.target.value)}
              className="w-12 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded"
              placeholder="vs"
            />
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={ctx.handleRoll}
              className="flex-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Roll
            </button>
            <button
              onClick={() => {
                ctx.setDiceExpression('3d6');
                ctx.handleRoll();
              }}
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              3d6
            </button>
            <button
              onClick={() => {
                ctx.setDiceExpression('1d6');
                ctx.handleRoll();
              }}
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              1d6
            </button>
          </div>
        </div>
      )}

      {/* Floating combat log */}
      {showLog && (
        <div className="absolute bottom-14 right-3 z-30 w-72 max-h-64 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between p-2 border-b border-gray-700">
            <span className="text-xs font-medium text-gray-300">Combat Log</span>
            <button
              onClick={() => setShowLog(false)}
              className="p-0.5 rounded hover:bg-gray-700 text-gray-500"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {ctx.displayLog.length === 0 && (
              <div className="text-[10px] text-gray-600">No entries yet</div>
            )}
            {[...ctx.displayLog]
              .reverse()
              .slice(0, 50)
              .map((entry: any, i: number) => (
                <div key={entry.id || i} className="text-[10px] text-gray-400">
                  <span className="text-gray-600 tabular-nums">
                    [{new Date(entry.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  {entry.text}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
