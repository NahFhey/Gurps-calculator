/**
 * CombatManeuverRail — replaces the Rail sidebar during map combat.
 *
 * Shows available maneuvers as vertical buttons, the current actor's name,
 * and an End Combat button at the bottom.
 */

import { useCombatContext } from './CombatContext';
import { XCircle } from 'lucide-react';

const GROUP_COLORS: Record<string, string> = {
  Core: 'border-accent-500/40',
  'All-Out Attack': 'border-danger-500/40',
  'All-Out Defense': 'border-success-500/40',
};

export function CombatManeuverRail() {
  const {
    currentActor,
    availableManeuvers,
    selectedManeuverId,
    handleSelectManeuver,
    handleEndCombat,
  } = useCombatContext();

  const selectedManeuver = availableManeuvers.find(
    (m) => m.id === selectedManeuverId,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Current actor header */}
      <div className="mb-2">
        <h2 className="text-[10px] uppercase tracking-wider text-fg-faint">
          Maneuver
        </h2>
        {currentActor && (
          <div className="text-xs font-medium text-accent-300 truncate mt-0.5">
            {currentActor.name}
          </div>
        )}
      </div>

      {/* Maneuver buttons */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {availableManeuvers.map((m) => {
          const isSelected = m.id === selectedManeuverId;
          const isDisabled = !!m.disabled;
          const groupColor = m.group && GROUP_COLORS[m.group] ? GROUP_COLORS[m.group] : 'border-edge-strong/40';

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (isDisabled) return;
                handleSelectManeuver(isSelected ? null : m.id);
              }}
              disabled={isDisabled}
              title={isDisabled ? m.reason || 'Unavailable' : m.notes}
              className={`
                w-full text-left px-2 py-1.5 rounded-md border-l-2 text-xs transition-all
                ${groupColor}
                ${
                  isSelected
                    ? 'bg-accent-600/30 text-accent-100 border-l-accent-400 font-medium'
                    : isDisabled
                      ? 'bg-surface-1/30 text-fg-disabled cursor-not-allowed opacity-50'
                      : 'bg-surface-1/50 text-fg-secondary hover:bg-surface-2/50 hover:text-fg-bright'
                }
              `}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Selected maneuver notes */}
      {selectedManeuver && selectedManeuver.notes && (
        <div className="mt-2 px-1 py-1.5 text-[10px] text-fg-muted bg-surface-1/50 rounded">
          {selectedManeuver.notes}
        </div>
      )}

      {/* End combat */}
      <div className="mt-3 pt-2 border-t border-edge">
        <button
          onClick={handleEndCombat}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded bg-danger-900/50 hover:bg-danger-800/50 text-danger-300 border border-danger-700/40 transition-colors"
        >
          <XCircle className="h-3 w-3" />
          End Combat
        </button>
      </div>
    </div>
  );
}
