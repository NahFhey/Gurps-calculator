import { describe, expect, it } from 'vitest';
import { downtimeInitialState, DOWNTIME_SCHEMA_VERSION } from '../downtimeInitialState';

describe('downtimeInitialState', () => {
  it('has the expected shape', () => {
    expect(downtimeInitialState).toHaveProperty('tasksById');
    expect(downtimeInitialState).toHaveProperty('taskOrder');
    expect(downtimeInitialState).toHaveProperty('pendingDayLedger');
  });

  it('tasksById is an empty object', () => {
    expect(downtimeInitialState.tasksById).toEqual({});
    expect(Object.keys(downtimeInitialState.tasksById)).toHaveLength(0);
  });

  it('taskOrder is an empty array', () => {
    expect(downtimeInitialState.taskOrder).toEqual([]);
    expect(Array.isArray(downtimeInitialState.taskOrder)).toBe(true);
    expect(downtimeInitialState.taskOrder).toHaveLength(0);
  });

  it('pendingDayLedger is null', () => {
    expect(downtimeInitialState.pendingDayLedger).toBeNull();
  });
});

describe('DOWNTIME_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(typeof DOWNTIME_SCHEMA_VERSION).toBe('number');
    expect(Number.isInteger(DOWNTIME_SCHEMA_VERSION)).toBe(true);
    expect(DOWNTIME_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
