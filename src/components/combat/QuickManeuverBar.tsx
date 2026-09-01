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
    base: 'bg-danger-900/40 hover:bg-danger-800/60 text-danger-300 border-danger-700/50',
    selected: 'bg-danger-700 text-white border-danger-500 ring-2 ring-danger-400',
    disabled: 'bg-surface-1/40 text-fg-disabled border-edge/30 cursor-not-allowed',
  },
  blue: {
    base: 'bg-accent-900/40 hover:bg-accent-800/60 text-accent-300 border-accent-700/50',
    selected: 'bg-accent-700 text-white border-accent-500 ring-2 ring-accent-400',
    disabled: 'bg-surface-1/40 text-fg-disabled border-edge/30 cursor-not-allowed',
  },
  green: {
    base: 'bg-success-900/40 hover:bg-success-800/60 text-success-300 border-success-700/50',
    selected: 'bg-success-700 text-white border-success-500 ring-2 ring-success-400',
    disabled: 'bg-surface-1/40 text-fg-disabled border-edge/30 cursor-not-allowed',
  },
  amber: {
    base: 'bg-warning-900/40 hover:bg-warning-800/60 text-warning-300 border-warning-700/50',
    selected: 'bg-warning-700 text-white border-warning-500 ring-2 ring-warning-400',
    disabled: 'bg-surface-1/40 text-fg-disabled border-edge/30 cursor-not-allowed',
  },
  gray: {
    base: 'bg-surface-2/40 hover:bg-surface-3/60 text-fg-secondary border-edge-strong/50',
    selected: 'bg-surface-3 text-fg-bright border-edge-bright ring-2 ring-edge-bright',
    disabled: 'bg-surface-1/40 text-fg-disabled border-edge/30 cursor-not-allowed',
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
