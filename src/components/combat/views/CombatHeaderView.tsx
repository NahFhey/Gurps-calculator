import { memo } from 'react';
import { Download, Plus, Undo, Redo, Upload, X } from 'lucide-react';
import { canUndo, canRedo, getUndoCount, getRedoCount } from '../../../utils/combatHistory';
import { ViewMode } from '../../../utils/combatViewFilter';
import type { CombatHeaderViewProps } from '../../../types/combatTracker';

/**
 * CombatHeaderView - Combat header with controls
 *
 * Displays combat name and round, with action buttons for:
 * - Undo/Redo with counts
 * - Reinforcements (GM mode only)
 * - Export menu with multiple options
 * - Load combat
 * - End combat
 */
function CombatHeaderViewBase({
  combat,
  history,
  viewMode,
  gmMode,
  showExportMenu,
  onUndo,
  onRedo,
  onShowReinforcements,
  onToggleExportMenu,
  onExportPlayerView,
  onExportGMLocked,
  onSaveCombat,
  onExportLog,
  onLoadCombat,
  onEndCombat
}: CombatHeaderViewProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold">{combat.name}</h2>
        <p className="text-gray-400">Round {combat.currentRound}</p>
      </div>
      <div className="flex gap-2">
        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo(history)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Undo (${getUndoCount(history)})`}
          aria-label={`Undo (${getUndoCount(history)} available)`}
        >
          <Undo size={16} />
          Undo ({getUndoCount(history)})
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo(history)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Redo (${getRedoCount(history)})`}
          aria-label={`Redo (${getRedoCount(history)} available)`}
        >
          <Redo size={16} />
          Redo ({getRedoCount(history)})
        </button>

        {viewMode === ViewMode.GM && gmMode && (
          <button
            onClick={onShowReinforcements}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            aria-label="Add reinforcements"
          >
            <Plus size={16} />
            Reinforcements
          </button>
        )}

        {/* Export Menu */}
        <div className="relative">
          <button
            onClick={onToggleExportMenu}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            aria-label="Open export menu"
            aria-haspopup="menu"
            aria-expanded={showExportMenu}
          >
            <Download size={16} />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-64">
              <button
                onClick={() => { onExportPlayerView(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                aria-label="Export player view (filtered, safe to share with players)"
              >
                <div className="font-medium text-blue-400">Export Player View</div>
                <div className="text-xs text-gray-400">Filtered, safe to share with players</div>
              </button>
              <button
                onClick={() => { onExportGMLocked(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                aria-label="Export GM locked (password-encrypted full state)"
              >
                <div className="font-medium text-purple-400">Export GM Locked</div>
                <div className="text-xs text-gray-400">Password-encrypted full state</div>
              </button>
              <button
                onClick={() => { onSaveCombat(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                aria-label="Export full legacy (unencrypted, all data)"
              >
                <div className="font-medium text-green-400">Export Full (Legacy)</div>
                <div className="text-xs text-gray-400">Unencrypted, all data</div>
              </button>
              <button
                onClick={() => { onExportLog(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-700"
                aria-label="Export log only (text file of combat log)"
              >
                <div className="font-medium text-gray-300">Export Log Only</div>
                <div className="text-xs text-gray-400">Text file of combat log</div>
              </button>
            </div>
          )}
        </div>

        {/* Load */}
        <button
          onClick={onLoadCombat}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          aria-label="Load combat"
        >
          <Upload size={16} />
          Load
        </button>

        {/* End Combat */}
        <button
          onClick={onEndCombat}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          aria-label="End combat"
        >
          <X size={16} />
          End Combat
        </button>
      </div>
    </div>
  );
}

export const CombatHeaderView = memo(CombatHeaderViewBase);
