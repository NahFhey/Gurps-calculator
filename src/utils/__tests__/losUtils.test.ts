import { describe, expect, it } from 'vitest';
import { getLineOfSight } from '../losUtils';
import type { MapModel } from '../../types/map';

const emptyMap = {} as MapModel;

describe('getLineOfSight (stub)', () => {
  it('returns blocked: false for any pair of tiles', () => {
    const result = getLineOfSight(emptyMap, 'r0c0', 'r5c5');
    expect(result.blocked).toBe(false);
  });

  it('returns a path containing exactly the actor and target tile ids', () => {
    const result = getLineOfSight(emptyMap, 'r0c0', 'r5c5');
    expect(result.path).toEqual(['r0c0', 'r5c5']);
  });

  it('preserves identical actor and target tile ids in the path', () => {
    const result = getLineOfSight(emptyMap, 'r2c2', 'r2c2');
    expect(result.blocked).toBe(false);
    expect(result.path).toEqual(['r2c2', 'r2c2']);
  });

  it('does not read or mutate the map argument', () => {
    const map = Object.freeze({}) as MapModel;
    expect(() => getLineOfSight(map, 'r0c0', 'r1c1')).not.toThrow();
  });

  it('returns a fresh path array each call', () => {
    const a = getLineOfSight(emptyMap, 'r0c0', 'r1c1');
    const b = getLineOfSight(emptyMap, 'r0c0', 'r1c1');
    expect(a.path).not.toBe(b.path);
    expect(a.path).toEqual(b.path);
  });
});
