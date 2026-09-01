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
        <p className="text-fg-muted">Round {combat.currentRound}</p>
      </div>
      <div className="flex gap-2">
        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo(history)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Undo (${getUndoCount(history)})`}
          aria-label={`Undo (${getUndoCount(history)} available)`}
        >
          <Undo size={16} />
          Undo ({getUndoCount(history)})
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo(history)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Redo (${getRedoCount(history)})`}
          aria-label={`Redo (${getRedoCount(history)} available)`}
        >
          <Redo size={16} />
          Redo ({getRedoCount(history)})
        </button>

        {viewMode === ViewMode.GM && gmMode && (
          <button
            onClick={onShowReinforcements}
            className="flex items-center gap-2 px-3 py-2 bg-accent-600 hover:bg-accent-700 rounded"
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
            className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 rounded"
            aria-label="Open export menu"
            aria-haspopup="menu"
            aria-expanded={showExportMenu}
          >
            <Download size={16} />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1 bg-surface-1 border border-edge-strong rounded-lg shadow-xl z-50 min-w-64">
              <button
                onClick={() => { onExportPlayerView(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-surface-2 border-b border-edge"
                aria-label="Export player view (filtered, safe to share with players)"
              >
                <div className="font-medium text-accent-400">Export Player View</div>
                <div className="text-xs text-fg-muted">Filtered, safe to share with players</div>
              </button>
              <button
                onClick={() => { onExportGMLocked(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-surface-2 border-b border-edge"
                aria-label="Export GM locked (password-encrypted full state)"
              >
                <div className="font-medium text-purple-400">Export GM Locked</div>
                <div className="text-xs text-fg-muted">Password-encrypted full state</div>
              </button>
              <button
                onClick={() => { onSaveCombat(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-surface-2 border-b border-edge"
                aria-label="Export full legacy (unencrypted, all data)"
              >
                <div className="font-medium text-success-400">Export Full (Legacy)</div>
                <div className="text-xs text-fg-muted">Unencrypted, all data</div>
              </button>
              <button
                onClick={() => { onExportLog(); onToggleExportMenu(); }}
                className="w-full text-left px-4 py-3 hover:bg-surface-2"
                aria-label="Export log only (text file of combat log)"
              >
                <div className="font-medium text-fg-secondary">Export Log Only</div>
                <div className="text-xs text-fg-muted">Text file of combat log</div>
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
          className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-700 rounded"
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
