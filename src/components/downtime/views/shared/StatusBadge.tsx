/**
 * Status Badge
 *
 * Displays a task status with appropriate icon and color styling.
 * Used across all task card components for consistent status display.
 */

import { Clock, Loader, Check, Ban } from 'lucide-react';
import type { TaskStatus } from '../../../../types/downtime';

// ============================================================================
// TYPES
// ============================================================================

interface StatusBadgeProps {
  /** The task status to display */
  status: TaskStatus;
  /** Optional custom label text */
  label?: string;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface StatusConfig {
  bg: string;
  text: string;
  icon: React.ElementType;
  label: string;
}

const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  pending: {
    bg: 'bg-yellow-900/50',
    text: 'text-yellow-300',
    icon: Clock,
    label: 'Pending',
  },
  in_progress: {
    bg: 'bg-blue-900/50',
    text: 'text-blue-300',
    icon: Loader,
    label: 'In Progress',
  },
  resolved: {
    bg: 'bg-green-900/50',
    text: 'text-green-300',
    icon: Check,
    label: 'Resolved',
  },
  cancelled: {
    bg: 'bg-gray-800',
    text: 'text-gray-400',
    icon: Ban,
    label: 'Cancelled',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
      data-testid="status-badge"
      data-status={status}
    >
      <Icon className="w-3 h-3" />
      {displayLabel}
    </span>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Returns the border color class for a given task status.
 * Useful for card components that need status-based border styling.
 */
export function getStatusBorderColor(status: TaskStatus): string {
  const borders: Record<TaskStatus, string> = {
    pending: 'border-yellow-700/50',
    in_progress: 'border-blue-700/50',
    resolved: 'border-green-700/50',
    cancelled: 'border-gray-700',
  };
  return borders[status];
}

/**
 * Returns the background color class for a given task status.
 */
export function getStatusBackgroundColor(status: TaskStatus): string {
  return STATUS_CONFIG[status].bg;
}
