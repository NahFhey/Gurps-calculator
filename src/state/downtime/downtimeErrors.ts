/**
 * Downtime Validation Errors
 *
 * Custom error classes for downtime validation failures.
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Error codes for downtime validation failures.
 */
export const DOWNTIME_ERROR_CODES = {
  LEADER_ALREADY_ASSIGNED: 'LEADER_ALREADY_ASSIGNED',
  HELPER_ALREADY_ASSIGNED: 'HELPER_ALREADY_ASSIGNED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type DowntimeErrorCode = keyof typeof DOWNTIME_ERROR_CODES;

// ============================================================================
// VALIDATION ERROR CLASS
// ============================================================================

/**
 * Validation result structure for downtime operations.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error code for programmatic handling */
  code?: string;
  /** Human-readable error message */
  message?: string;
  /** Additional metadata about the validation failure */
  meta?: Record<string, unknown>;
}

/**
 * Error thrown when downtime task validation fails.
 * Contains structured information about the validation failure
 * for programmatic handling by UI components.
 */
export class DowntimeValidationError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;

  /** Additional metadata about the validation failure */
  readonly meta?: Record<string, unknown>;

  constructor(result: ValidationResult) {
    super(result.message ?? 'Downtime validation failed');
    this.name = 'DowntimeValidationError';
    this.code = result.code ?? DOWNTIME_ERROR_CODES.UNKNOWN_ERROR;
    this.meta = result.meta;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DowntimeValidationError);
    }
  }
}
