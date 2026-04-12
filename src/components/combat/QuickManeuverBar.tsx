/**
 * Phase 11b: Quick Maneuver Bar
 *
 * A row of tactile buttons for the most common GURPS combat maneuvers.
 * Selecting a button calls the same onSelect(maneuverId) as the dropdown,
 * so the existing ActionPanel workflow routing kicks in automatically.
 *
 * The dropdown in ManeuverSelector remains as a fallback for less common
 * maneuvers (Evaluate, Feint, Ready, Concentrate, Change Posture).
 */

// Maneuver IDs that get quick-action buttons, in display order.
// Chosen for tactical frequency — these cover ~90% of turns in play.
const QUICK_MANEUVERS: QuickManeuverDef[] = [
  {
    id: 'attack',
    shortLabel: 'Attack',
    color: 'red',
    icon: '⚔️',
  },
  {
    id: 'all_out_attack_determined',
    shortLabel: 'AoA (Det.)',
    color: 'red',
    icon: '💥',
    hint: '+4 to hit, no defense',
  },
  {
    id: 'all_out_attack_strong',
    shortLabel: 'AoA (Str.)',
    color: 'red',
    icon: '🔨',
    hint: '+2 damage, no defense',
  },
  {
    id: 'all_out_defense_increased',
    shortLabel: 'AoD (+2)',
    color: 'blue',
    icon: '🛡️',
    hint: '+2 to one defense',
  },
  {
    id: 'move',
    shortLabel: 'Move',
    color: 'green',
    icon: '🏃',
  },
  {
    id: 'aim',
    shortLabel: 'Aim',
    color: 'amber',
    icon: '🎯',
  },
  {
    id: 'wait',
    shortLabel: 'Wait',
    color: 'amber',
    icon: '⏳',
  },
  {
    id: 'do_nothing',
    shortLabel: 'Do Nothing',
    color: 'gray',
    icon: '⏸️',
  },
];

// ============================================================================
// Types
// ============================================================================

interface QuickManeuverDef {
  id: string;
  shortLabel: string;
  color: 'red' | 'blue' | 'green' | 'amber' | 'gray';
  icon: string;
  hint?: string;
}

interface FilteredManeuver {
  id: string;
  label: string;
  disabled?: boolean;
  notes?: string;
  warning?: string;
  reason?: string;
}

interface QuickManeuverBarProps {
  maneuvers: FilteredManeuver[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// ============================================================================
// Color mappings (Tailwind classes)
// ============================================================================

const COLOR_CLASSES: Record<
  QuickManeuverDef['color'],
  { base: string; selected: string; disabled: string }
> = {
  red: {
    base: 'bg-red-900/40 hover:bg-red-800/60 text-red-300 border-red-700/50',
    selected: 'bg-red-700 text-white border-red-500 ring-2 ring-red-400',
    disabled: 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed',
  },
  blue: {
    base: 'bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border-blue-700/50',
    selected: 'bg-blue-700 text-white border-blue-500 ring-2 ring-blue-400',
    disabled: 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed',
  },
  green: {
    base: 'bg-green-900/40 hover:bg-green-800/60 text-green-300 border-green-700/50',
    selected: 'bg-green-700 text-white border-green-500 ring-2 ring-green-400',
    disabled: 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed',
  },
  amber: {
    base: 'bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border-amber-700/50',
    selected: 'bg-amber-700 text-white border-amber-500 ring-2 ring-amber-400',
    disabled: 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed',
  },
  gray: {
    base: 'bg-gray-700/40 hover:bg-gray-600/60 text-gray-300 border-gray-600/50',
    selected: 'bg-gray-600 text-white border-gray-400 ring-2 ring-gray-400',
    disabled: 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed',
  },
};

// ============================================================================
// Component
// ============================================================================

export default function QuickManeuverBar({
  maneuvers,
  selectedId,
  onSelect,
}: QuickManeuverBarProps) {
  // Build a lookup from the filtered maneuvers list so we can check
  // disabled state and show warnings per-button.
  const maneuverMap = new Map(maneuvers.map((m) => [m.id, m]));

  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_MANEUVERS.map((qm) => {
        const filtered = maneuverMap.get(qm.id);
        // If the maneuver isn't in the filtered list at all, it's completely
        // unavailable (e.g. removed by rules preset). Don't render.
        if (!filtered) return null;

        const isSelected = selectedId === qm.id;
        const isDisabled = !!filtered.disabled;
        const colors = COLOR_CLASSES[qm.color];
        const className = isDisabled
          ? colors.disabled
          : isSelected
            ? colors.selected
            : colors.base;

        return (
          <button
            key={qm.id}
            type="button"
            disabled={isDisabled}
            onClick={() => {
              // Toggle: clicking the already-selected maneuver deselects it
              onSelect(isSelected ? null : qm.id);
            }}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg border
              text-sm font-medium transition-all duration-150
              ${className}
            `}
            title={
              isDisabled
                ? filtered.reason || 'Unavailable'
                : qm.hint || filtered.notes || qm.shortLabel
            }
          >
            <span className="text-base leading-none" aria-hidden="true">
              {qm.icon}
            </span>
            <span>{qm.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
