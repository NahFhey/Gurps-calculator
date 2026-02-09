/**
 * Task Actions
 *
 * Standardized action buttons for task cards.
 * Provides resolve and cancel buttons with consistent styling.
 */

import { Check, X } from 'lucide-react';
import type { TaskStatus } from '../../../../types/downtime';

// ============================================================================
// TYPES
// ============================================================================

interface TaskActionsProps {
  /** Current status of the task */
  status: TaskStatus;
  /** Called when the resolve button is clicked */
  onResolve?: () => void;
  /** Called when the cancel button is clicked */
  onCancel?: () => void;
  /** Custom label for the resolve button */
  resolveLabel?: string;
  /** Custom label shown while resolving (in_progress) */
  resolvingLabel?: string;
  /** Primary color for the resolve button (Tailwind color name) */
  resolveColor?: 'green' | 'blue' | 'purple' | 'amber';
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// COLOR CONFIGURATION
// ============================================================================

type ColorConfig = {
  bg: string;
  hover: string;
};

const RESOLVE_COLORS: Record<string, ColorConfig> = {
  green: { bg: 'bg-green-600', hover: 'hover:bg-green-700' },
  blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700' },
  purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700' },
  amber: { bg: 'bg-amber-600', hover: 'hover:bg-amber-700' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskActions({
  status,
  onResolve,
  onCancel,
  resolveLabel = 'Resolve',
  resolvingLabel = 'Resolving...',
  resolveColor = 'green',
  className = '',
}: TaskActionsProps) {
  const isInProgress = status === 'in_progress';
  const colorConfig = RESOLVE_COLORS[resolveColor] ?? RESOLVE_COLORS.green;

  return (
    <div className={`task-actions mt-3 flex gap-2 ${className}`}>
      {/* Resolve Button */}
      <button
        type="button"
        onClick={onResolve}
        className={`flex items-center gap-1 px-3 py-1.5 ${colorConfig.bg} text-white text-sm rounded ${colorConfig.hover} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        disabled={isInProgress}
        data-testid="resolve-button"
      >
        <Check className="w-3 h-3" />
        {isInProgress ? resolvingLabel : resolveLabel}
      </button>

      {/* Cancel Button */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 px-3 py-1.5 border border-red-500/50 text-red-400 text-sm rounded hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isInProgress}
        data-testid="cancel-button"
      >
        <X className="w-3 h-3" />
        Cancel
      </button>
    </div>
  );
}

// ============================================================================
// SINGLE ACTION VARIANTS
// ============================================================================

interface SingleActionProps {
  /** Called when the button is clicked */
  onClick?: () => void;
  /** Button label text */
  label?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Standalone resolve/complete button.
 */
export function ResolveButton({
  onClick,
  label = 'Resolve',
  disabled = false,
  className = '',
}: SingleActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled}
      data-testid="resolve-button"
    >
      <Check className="w-3 h-3" />
      {label}
    </button>
  );
}

/**
 * Standalone cancel button.
 */
export function CancelButton({
  onClick,
  label = 'Cancel',
  disabled = false,
  className = '',
}: SingleActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled}
      data-testid="cancel-button"
    >
      <X className="w-3 h-3" />
      {label}
    </button>
  );
}
