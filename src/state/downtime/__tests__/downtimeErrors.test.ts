import { describe, expect, it } from 'vitest';
import {
  DOWNTIME_ERROR_CODES,
  DowntimeValidationError,
  type ValidationResult,
} from '../downtimeErrors';

function makeValidationResult(
  overrides: Partial<ValidationResult> = {},
): ValidationResult {
  return {
    valid: false,
    code: DOWNTIME_ERROR_CODES.LOCK_CONFLICT,
    message: 'The selected time slot is already locked',
    meta: {
      dayKey: 3,
      slot: 1,
    },
    ...overrides,
  };
}

describe('downtimeErrors', () => {
  describe('DOWNTIME_ERROR_CODES', () => {
    it('exposes stable, unique error code values', () => {
      expect(DOWNTIME_ERROR_CODES).toEqual({
        LEADER_ALREADY_ASSIGNED: 'LEADER_ALREADY_ASSIGNED',
        HELPER_ALREADY_ASSIGNED: 'HELPER_ALREADY_ASSIGNED',
        LOCK_CONFLICT: 'LOCK_CONFLICT',
        TOOL_CONFLICT: 'TOOL_CONFLICT',
        CHARACTER_INCAPACITATED: 'CHARACTER_INCAPACITATED',
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
      });
      expect(new Set(Object.values(DOWNTIME_ERROR_CODES)).size).toBe(6);
    });
  });

  describe('DowntimeValidationError', () => {
    it('constructs a structured Error from a validation result', () => {
      const result = makeValidationResult();
      const error = new DowntimeValidationError(result);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DowntimeValidationError);
      expect(error.name).toBe('DowntimeValidationError');
      expect(error.message).toBe(result.message);
      expect(error.code).toBe(result.code);
      expect(error.meta).toBe(result.meta);
      expect(error.stack).toContain('DowntimeValidationError');
    });

    it('uses documented defaults when optional error details are absent', () => {
      const error = new DowntimeValidationError({ valid: false });

      expect(error.message).toBe('Downtime validation failed');
      expect(error.code).toBe(DOWNTIME_ERROR_CODES.UNKNOWN_ERROR);
      expect(error.meta).toBeUndefined();
    });

    it('preserves an explicitly empty message and metadata', () => {
      const meta: Record<string, unknown> = {};
      const error = new DowntimeValidationError(
        makeValidationResult({
          message: '',
          meta,
        }),
      );

      expect(error.message).toBe('');
      expect(error.meta).toBe(meta);
    });
  });
});
