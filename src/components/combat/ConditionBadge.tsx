import { MouseEvent } from 'react';
import { X } from 'lucide-react';
import { formatConditionDuration, formatConditionTooltip } from '../../utils/conditionsEngine';
import { getConditionIcon } from '../../constants/conditions';

// ============================================================================
// Types
// ============================================================================

interface ExpiresAt {
  type: 'turn' | 'round' | 'endOfCombat';
  turnsRemaining?: number;
  round?: number;
}

interface Condition {
  conditionId: string;
  instanceId?: string;
  label: string;
  expiresAt?: ExpiresAt | null;
  severity?: number | null;
}

interface ConditionBadgeProps {
  condition: Condition;
  currentRound?: number;
  showDuration?: boolean;
  onClick?: ((condition: Condition) => void) | null;
  onRemove?: ((condition: Condition) => void) | null;
  compact?: boolean;
}

// ============================================================================
// Urgency helpers
// ============================================================================

/**
 * Get numeric "turns/rounds remaining" for urgency calculations.
 * Returns null for permanent or end-of-combat conditions (no urgency).
 */
function getRemaining(expiresAt: ExpiresAt | null | undefined, currentRound: number): number | null {
  if (!expiresAt) return null;
  switch (expiresAt.type) {
    case 'turn':
      return expiresAt.turnsRemaining ?? 0;
    case 'round':
      return Math.max(0, (expiresAt.round ?? 0) - currentRound);
    case 'endOfCombat':
      return null;
    default:
      return null;
  }
}

type Urgency = 'expiring' | 'low' | 'normal' | 'none';

/** Classify how urgent a condition's remaining duration is. */
function getUrgency(remaining: number | null): Urgency {
  if (remaining === null) return 'none';     // permanent / end-of-combat
  if (remaining <= 0) return 'expiring';     // about to expire this tick
  if (remaining <= 2) return 'low';          // 1-2 left
  return 'normal';                           // 3+ left
}

/** Badge border + background classes by urgency. */
const URGENCY_STYLES: Record<Urgency, { border: string; bg: string; durationText: string }> = {
  expiring: {
    border: 'border-red-500',
    bg: 'bg-red-900/60',
    durationText: 'text-red-300 font-semibold',
  },
  low: {
    border: 'border-orange-500/70',
    bg: 'bg-orange-900/40',
    durationText: 'text-orange-300',
  },
  normal: {
    border: 'border-purple-700',
    bg: 'bg-purple-900/50',
    durationText: 'text-gray-400',
  },
  none: {
    border: 'border-purple-700',
    bg: 'bg-purple-900/50',
    durationText: 'text-gray-400',
  },
};

/** Human-friendly countdown label for low-urgency conditions. */
function urgencyLabel(remaining: number | null, expiresAt: ExpiresAt | null | undefined): string | null {
  if (remaining === null || !expiresAt) return null;
  const unit = expiresAt.type === 'turn' ? 'turn' : 'round';
  if (remaining <= 0) return 'expires now';
  if (remaining === 1) return `1 ${unit} left`;
  return `${remaining} ${unit}s left`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Phase 11b: Enhanced Condition Badge
 *
 * Displays a condition with:
 * - Color-coded urgency (red for expiring, orange for 1-2 remaining)
 * - Countdown text ("2 turns left" instead of "(2 turns)")
 * - Quick-remove X button (always visible, not just on hover)
 * - Pulse animation for expiring conditions
 */
export default function ConditionBadge({
  condition,
  currentRound = 0,
  showDuration = true,
  onClick = null,
  onRemove = null,
  compact = false,
}: ConditionBadgeProps) {
  const icon = getConditionIcon(condition.conditionId);
  const tooltip = formatConditionTooltip(condition, currentRound);
  const remaining = getRemaining(condition.expiresAt, currentRound);
  const urgency = getUrgency(remaining);
  const styles = URGENCY_STYLES[urgency];
  const countdown = urgencyLabel(remaining, condition.expiresAt);

  // Fall back to the plain formatter for permanent/endOfCombat
  const durationDisplay = countdown || formatConditionDuration(condition, currentRound);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.stopPropagation();
      onClick(condition);
    }
  };

  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(condition);
    }
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded text-xs border transition-colors
        ${styles.bg} ${styles.border}
        ${urgency === 'expiring' ? 'animate-pulse' : ''}
        ${onClick ? 'cursor-pointer hover:brightness-125' : ''}
        ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
      `}
      title={tooltip}
      onClick={handleClick}
    >
      {/* Icon */}
      <span className="flex-none">{icon}</span>

      {/* Label */}
      <span className="font-medium truncate max-w-[8rem]">{condition.label}</span>

      {/* Severity */}
      {condition.severity != null && (
        <span className="text-yellow-400 font-bold flex-none">×{condition.severity}</span>
      )}

      {/* Duration countdown */}
      {showDuration && condition.expiresAt && (
        <span className={`flex-none ${styles.durationText} ${compact ? 'text-[0.6rem]' : 'text-xs'}`}>
          {urgency === 'expiring' || urgency === 'low'
            ? durationDisplay
            : `(${durationDisplay})`
          }
        </span>
      )}

      {/* Quick-remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex-none ml-0.5 p-0.5 rounded hover:bg-red-700/60 text-gray-400 hover:text-red-300 transition-colors"
          title={`Remove ${condition.label}`}
        >
          <X size={compact ? 10 : 12} />
        </button>
      )}
    </div>
  );
}
