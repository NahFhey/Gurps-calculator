/**
 * Validation Error Display
 *
 * Displays validation errors from downtime operations.
 * Provides consistent error messaging with actionable information.
 */

import React from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { DOWNTIME_ERROR_CODES } from '../../../../state/downtime/downtimeErrors';

// ============================================================================
// TYPES
// ============================================================================

interface ValidationErrorProps {
  /** Error code from DowntimeValidationError */
  code: string;
  /** Error message to display */
  message: string;
  /** Additional metadata about the error */
  meta?: Record<string, unknown>;
  /** Called when the dismiss button is clicked */
  onDismiss?: () => void;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// ERROR CONFIGURATION
// ============================================================================

interface ErrorConfig {
  icon: React.ElementType;
  title: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const ERROR_CONFIG: Record<string, ErrorConfig> = {
  [DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED]: {
    icon: AlertCircle,
    title: 'Character Already Assigned',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-700/50',
    textColor: 'text-yellow-300',
  },
  [DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED]: {
    icon: AlertCircle,
    title: 'Helper Already Assigned',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-700/50',
    textColor: 'text-yellow-300',
  },
  [DOWNTIME_ERROR_CODES.LOCK_CONFLICT]: {
    icon: AlertTriangle,
    title: 'Cannot Retry This Task',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-700/50',
    textColor: 'text-orange-300',
  },
  [DOWNTIME_ERROR_CODES.TOOL_CONFLICT]: {
    icon: AlertCircle,
    title: 'Tool Already In Use',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-700/50',
    textColor: 'text-red-300',
  },
  [DOWNTIME_ERROR_CODES.UNKNOWN_ERROR]: {
    icon: AlertCircle,
    title: 'Error',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-700/50',
    textColor: 'text-red-300',
  },
};

const DEFAULT_CONFIG: ErrorConfig = {
  icon: AlertCircle,
  title: 'Validation Error',
  bgColor: 'bg-red-900/30',
  borderColor: 'border-red-700/50',
  textColor: 'text-red-300',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ValidationError({
  code,
  message,
  meta,
  onDismiss,
  className = '',
}: ValidationErrorProps) {
  const config = ERROR_CONFIG[code] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div
      className={`validation-error rounded-lg border p-3 ${config.bgColor} ${config.borderColor} ${className}`}
      role="alert"
      data-testid="validation-error"
      data-error-code={code}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.textColor}`} />
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${config.textColor}`}>{config.title}</h4>
          <p className={`text-sm mt-1 ${config.textColor}`}>{message}</p>
          {meta && <ErrorMetadata code={code} meta={meta} />}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`flex-shrink-0 ${config.textColor} hover:opacity-70 transition-opacity`}
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// METADATA DISPLAY
// ============================================================================

interface ErrorMetadataProps {
  code: string;
  meta: Record<string, unknown>;
}

function ErrorMetadata({ code, meta }: ErrorMetadataProps) {
  // Format metadata based on error type
  const formatValue = (value: unknown): React.ReactNode => {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };

  switch (code) {
    case DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED:
    case DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED: {
      return (
        <div className="text-xs mt-2 space-y-0.5 text-gray-400">
          {meta.existingRole ? (
            <p>Currently assigned as: {formatValue(meta.existingRole)}</p>
          ) : null}
          {meta.characterId ? (
            <p>Character: {formatValue(meta.characterId)}</p>
          ) : null}
        </div>
      );
    }

    case DOWNTIME_ERROR_CODES.LOCK_CONFLICT:
      return (
        <div className="text-xs mt-2 space-y-0.5 text-gray-400">
          <p>You cannot retry the same activity target in this slot.</p>
          <p>Try a different target or wait for the next time slot.</p>
        </div>
      );

    case DOWNTIME_ERROR_CODES.TOOL_CONFLICT:
      if (Array.isArray(meta.conflictingToolIds)) {
        return (
          <div className="text-xs mt-2 text-gray-400">
            <p>Conflicting tools: {(meta.conflictingToolIds as string[]).join(', ')}</p>
          </div>
        );
      }
      return null;

    default:
      return null;
  }
}

// ============================================================================
// INLINE ERROR VARIANT
// ============================================================================

interface InlineErrorProps {
  /** Error message to display */
  message: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Compact inline error message for form fields.
 */
export function InlineError({ message, className = '' }: InlineErrorProps) {
  return (
    <p
      className={`text-sm text-red-400 flex items-center gap-1 ${className}`}
      role="alert"
      data-testid="inline-error"
    >
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}
