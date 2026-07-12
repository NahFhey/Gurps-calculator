import { MouseEvent } from 'react';
import { X } from 'lucide-react';
import { formatConditionDuration } from '../../utils/conditionsEngine';
import { getCondition, getConditionIcon } from '../../constants/conditions';
import { Tooltip } from '../ui';
import type { ConditionExpiry, ConditionInstance } from '../../types/combatTracker';

// ============================================================================
// Types
// ============================================================================

type ExpiresAt = ConditionExpiry;

/**
 * The badge accepts anything shaped like a ConditionInstance; only
 * conditionId and label are required (tests and player-view placeholders
 * pass partial shapes).
 */
type Condition = Partial<ConditionInstance> & Pick<ConditionInstance, 'conditionId' | 'label'>;

/**
 * Render mode (Phase 12a.6):
 * - 'full'        — icon + label + severity + countdown + quick-remove
 * - 'icon'        — icon only; everything else lives in the tooltip
 * - 'placeholder' — anonymous grey "Afflicted" badge for half-revealed
 *                   conditions in player view
 */
export type ConditionBadgeMode = 'full' | 'icon' | 'placeholder';

interface ConditionBadgeProps {
  condition: Condition;
  currentRound?: number;
  showDuration?: boolean;
  onClick?: ((condition: Condition) => void) | null;
  onRemove?: ((condition: Condition) => void) | null;
  compact?: boolean;
  mode?: ConditionBadgeMode;
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

/** Anonymous placeholder styling — deliberately free of urgency signals. */
const PLACEHOLDER_STYLES = {
  border: 'border-gray-600',
  bg: 'bg-gray-800/80',
  durationText: 'text-gray-500',
};

/** Display order for density-capped condition rows: most urgent first. */
const URGENCY_RANK: Record<Urgency, number> = {
  expiring: 0,
  low: 1,
  normal: 2,
  none: 3,
};

/**
 * Sort conditions most-urgent-first for the capped icon rows (Phase 12a.6
 * density cap). Placeholders carry no duration and sort as 'none'. Stable for
 * equal ranks (Array.prototype.sort is stable), so insertion order breaks ties.
 */
export function sortConditionsByUrgency<T extends Condition>(
  conditions: T[],
  currentRound: number,
): T[] {
  return [...conditions].sort(
    (a, b) =>
      URGENCY_RANK[getUrgency(getRemaining(a.expiresAt, currentRound))] -
      URGENCY_RANK[getUrgency(getRemaining(b.expiresAt, currentRound))],
  );
}

/** Human-friendly countdown label for low-urgency conditions. */
function urgencyLabel(remaining: number | null, expiresAt: ExpiresAt | null | undefined): string | null {
  if (remaining === null || !expiresAt) return null;
  const unit = expiresAt.type === 'turn' ? 'turn' : 'round';
  if (remaining <= 0) return 'expires now';
  if (remaining === 1) return `1 ${unit} left`;
  return `${remaining} ${unit}s left`;
}

// ============================================================================
// Tooltip content
// ============================================================================

const PLACEHOLDER_TOOLTIP = 'This character has an unknown effect.';

function ConditionTooltipContent({
  condition,
  currentRound,
}: {
  condition: Condition;
  currentRound: number;
}) {
  const definition = getCondition(condition.conditionId);
  return (
    <div className="space-y-1 text-left">
      <div className="font-semibold text-white">
        {getConditionIcon(condition.conditionId)} {condition.label}
        {condition.severity != null && (
          <span className="text-yellow-400"> ×{condition.severity}</span>
        )}
      </div>
      <div>Duration: {formatConditionDuration(condition, currentRound)}</div>
      {condition.source && <div>Source: {condition.source}</div>}
      {definition?.description && (
        <div className="text-gray-400">{definition.description}</div>
      )}
      {condition.notes && <div className="text-gray-400 italic">Notes: {condition.notes}</div>}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Condition Badge
 *
 * Phase 11b: color-coded urgency, countdown text, quick-remove X, pulse
 * animation for expiring conditions.
 *
 * Phase 12a.6: render modes (full / icon / placeholder) with a rich React
 * tooltip replacing the old title attribute. Placeholder rendering is forced
 * whenever the condition carries the player-view `placeholder` flag, so
 * filtered view data displays safely regardless of the call site's mode.
 */
export default function ConditionBadge({
  condition,
  currentRound = 0,
  showDuration = true,
  onClick = null,
  onRemove = null,
  compact = false,
  mode = 'icon',
}: ConditionBadgeProps) {
  const isPlaceholder = mode === 'placeholder' || condition.placeholder === true;
  // Placeholders keep the requested density; an explicit 'placeholder' mode
  // renders at full density.
  const layout: 'full' | 'icon' = mode === 'icon' ? 'icon' : 'full';

  const icon = isPlaceholder ? '❓' : getConditionIcon(condition.conditionId);
  const remaining = isPlaceholder ? null : getRemaining(condition.expiresAt, currentRound);
  const urgency = getUrgency(remaining);
  const styles = isPlaceholder ? PLACEHOLDER_STYLES : URGENCY_STYLES[urgency];
  const countdown = urgencyLabel(remaining, condition.expiresAt);

  // Fall back to the plain formatter for permanent/endOfCombat
  const durationDisplay = countdown || formatConditionDuration(condition, currentRound);

  const tooltip = isPlaceholder ? (
    PLACEHOLDER_TOOLTIP
  ) : (
    <ConditionTooltipContent condition={condition} currentRound={currentRound} />
  );

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
    <Tooltip content={tooltip}>
      <div
        className={`
          inline-flex items-center gap-1 rounded text-xs border transition-colors
          ${styles.bg} ${styles.border}
          ${!isPlaceholder && urgency === 'expiring' ? 'animate-pulse' : ''}
          ${onClick ? 'cursor-pointer hover:brightness-125' : ''}
          ${compact || layout === 'icon' ? 'px-1.5 py-0.5' : 'px-2 py-1'}
        `}
        aria-label={condition.label}
        onClick={handleClick}
      >
        {/* Icon */}
        <span className="flex-none">{icon}</span>

        {/* Label */}
        {layout === 'full' && (
          <span className={`font-medium truncate max-w-[8rem] ${isPlaceholder ? 'text-gray-400 italic' : ''}`}>
            {condition.label}
          </span>
        )}

        {/* Severity */}
        {layout === 'full' && !isPlaceholder && condition.severity != null && (
          <span className="text-yellow-400 font-bold flex-none">×{condition.severity}</span>
        )}

        {/* Duration countdown */}
        {layout === 'full' && !isPlaceholder && showDuration && condition.expiresAt && (
          <span className={`flex-none ${styles.durationText} ${compact ? 'text-[0.6rem]' : 'text-xs'}`}>
            {urgency === 'expiring' || urgency === 'low'
              ? durationDisplay
              : `(${durationDisplay})`
            }
          </span>
        )}

        {/* Quick-remove button */}
        {!isPlaceholder && onRemove && (
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
    </Tooltip>
  );
}
