import React from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { ViewMode } from '../../utils/combatViewFilter';

/**
 * View Mode Toggle (Phase 5)
 *
 * Allows switching between GM View and Player View.
 * GM View requires GM Mode to be unlocked.
 * Forces Player View when GM Mode locks.
 */
export default function ViewModeToggle({ viewMode, setViewMode, gmMode, setGmMode }) {
  const isGMView = viewMode === ViewMode.GM;
  const isPlayerView = viewMode === ViewMode.PLAYER;

  const handleToggle = () => {
    if (isPlayerView) {
      // Switching to GM View - requires GM Mode
      if (!gmMode) {
        const confirmed = window.confirm(
          'Enable GM Mode to access GM View?\n\n' +
          'GM View shows all secret information (enemy HP, DR, defenses, etc.).\n' +
          'This should only be used by the Game Master.\n\n' +
          'Note: This is a casual lock for preventing accidental spoilers, not cryptographic security.'
        );
        if (confirmed) {
          setGmMode(true);
          setViewMode(ViewMode.GM);
        }
        return;
      }
      setViewMode(ViewMode.GM);
    } else {
      // Switching to Player View - always allowed
      setViewMode(ViewMode.PLAYER);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* View Mode Label */}
      <div className="text-sm font-medium text-gray-400">
        Combat View:
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${isGMView
            ? 'bg-red-900/30 text-red-400 border-2 border-red-500/50 hover:bg-red-900/40'
            : 'bg-blue-900/30 text-blue-400 border-2 border-blue-500/50 hover:bg-blue-900/40'
          }
        `}
        title={isGMView ? 'Switch to Player View' : 'Switch to GM View (requires GM Mode)'}
      >
        {isGMView ? (
          <>
            <Shield size={16} />
            <span>GM View</span>
            <span className="text-xs opacity-75">(Full Truth)</span>
          </>
        ) : (
          <>
            <Eye size={16} />
            <span>Player View</span>
            <span className="text-xs opacity-75">(Limited Info)</span>
          </>
        )}
      </button>

      {/* GM Lock Indicator */}
      {!gmMode && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Lock size={14} />
          <span>GM View locked</span>
        </div>
      )}

      {/* Security Reminder (Player View) */}
      {isPlayerView && (
        <div className="text-xs text-gray-500 italic ml-2">
          Enemy HP/DR/Defenses hidden by default
        </div>
      )}

      {/* Warning Banner (GM View) */}
      {isGMView && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-950/30 border border-red-500/30 rounded text-xs text-red-400">
          <EyeOff size={14} />
          <span>Showing all secrets - not safe for player viewing</span>
        </div>
      )}
    </div>
  );
}
