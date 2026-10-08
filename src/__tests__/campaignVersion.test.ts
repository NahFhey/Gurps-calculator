import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_SCHEMA_VERSION,
  MalformedSchemaVersionError,
  classifySchemaVersion,
  compareSchemaVersions,
  parseSchemaVersion,
} from '../../shared/campaignVersion';

describe('campaign schema-version contract', () => {
  it('is a strict semver string', () => {
    expect(CAMPAIGN_SCHEMA_VERSION).toBe('1.7.0');
    expect(parseSchemaVersion(CAMPAIGN_SCHEMA_VERSION)).toEqual({ major: 1, minor: 7, patch: 0 });
  });

  it.each([
    ['1.7.0', 'current'],
    ['1.6.5', 'older'],
    ['1.0.0', 'older'],
    ['0.0.0', 'older'],
    ['1.7.1', 'future'],
    ['1.8.0', 'future'],
    ['1.99.0', 'future'],
    ['2.0.0', 'future'],
    ['1.6.x', 'malformed'],
    ['1.7', 'malformed'],
    ['1', 'malformed'],
    ['1.7.0.0', 'malformed'],
    ['01.7.0', 'malformed'],
    ['1.07.0', 'malformed'],
    ['v1.7.0', 'malformed'],
    [' 1.7.0', 'malformed'],
    ['1.7.0-beta', 'malformed'],
    ['-1.7.0', 'malformed'],
    ['', 'malformed'],
    [7, 'malformed'],
    [null, 'malformed'],
    [undefined, 'malformed'],
    [{ major: 1 }, 'malformed'],
    // Non-strings that stringify to a valid version are still not versions.
    [['1.7.0'], 'malformed'],
    [{ toString: () => '1.7.0' }, 'malformed'],
  ] as const)('classifies %j as %s', (value, expected) => {
    expect(classifySchemaVersion(value)).toBe(expected);
  });

  it('compares numerically, not as strings', () => {
    expect(compareSchemaVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSchemaVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareSchemaVersions('1.6.10', '1.6.9')).toBeGreaterThan(0);
    expect(compareSchemaVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSchemaVersions('1.7.0', '1.7.0')).toBe(0);
    expect(classifySchemaVersion('1.10.0', '1.9.0')).toBe('future');
    expect(classifySchemaVersion('1.9.0', '1.10.0')).toBe('older');
  });

  it('throws on a malformed operand instead of treating it as 0', () => {
    expect(() => compareSchemaVersions('1.6.x', '1.6.0')).toThrow(MalformedSchemaVersionError);
    expect(() => compareSchemaVersions('1.6.0', 'garbage')).toThrow(MalformedSchemaVersionError);
  });

  it('rejects integers too large to compare exactly', () => {
    expect(parseSchemaVersion('1.99999999999999999999.0')).toBeNull();
  });
});
