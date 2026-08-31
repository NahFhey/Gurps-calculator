import { describe, expect, it } from 'vitest';
import {
  CAMERA_DEFAULT,
  cameraPosition,
  clampCamera,
  dragPan,
  frameTiles,
  orbit,
  pan,
  tokenOffsets,
  zoom,
  type CameraState,
} from '../mapSceneMath';

const state = (): CameraState => ({ ...CAMERA_DEFAULT, targetX: 5, targetZ: 4 });

describe('map scene camera math', () => {
  it('clamps elevation, distance, and expanded-grid targets', () => {
    const result = clampCamera({ azimuth: 0, elevation: 10, distance: 100, targetX: -9, targetZ: 99 }, 10, 8);
    expect(result.elevation).toBeCloseTo(85 * Math.PI / 180);
    expect(result.distance).toBe(20);
    expect(result.targetX).toBe(-2);
    expect(result.targetZ).toBe(10);
  });

  it('clamps the lower elevation and distance limits', () => {
    const result = clampCamera({ ...state(), elevation: -1, distance: 0 }, 10, 8);
    expect(result.elevation).toBeCloseTo(15 * Math.PI / 180);
    expect(result.distance).toBe(3);
  });

  it('allows azimuth to wrap freely through repeated orbits', () => {
    const result = orbit(state(), Math.PI * 5, 0, 10, 8);
    expect(result.azimuth).toBeCloseTo(Math.PI * 5);
  });

  it('applies zoom factors', () => {
    expect(zoom(state(), 0.5, 20, 20).distance).toBe(7);
  });

  it('pans and clamps without mutating the input', () => {
    const input = state();
    const result = pan(input, 2, -3, 10, 8);
    expect(result).toMatchObject({ targetX: 7, targetZ: 1 });
    expect(input).toEqual(state());
  });

  it('moves the camera target with the drag direction at azimuth zero', () => {
    const input = { ...state(), azimuth: 0, distance: 10 };
    const result = dragPan(input, 100, 50, 1000, 45, 30, 30);
    expect(result.targetX).toBeGreaterThan(input.targetX);
    expect(result.targetZ).toBeGreaterThan(input.targetZ);
    expect(result.targetX - input.targetX).toBeCloseTo(2 * (result.targetZ - input.targetZ), 5);
  });

  it('rotates drag-pan movement by azimuth', () => {
    const input = { ...state(), azimuth: Math.PI / 2, distance: 10 };
    const result = dragPan(input, 100, 0, 1000, 45, 30, 30);
    expect(result.targetZ).toBeGreaterThan(input.targetZ);
    expect(result.targetX).toBeCloseTo(input.targetX, 5);
  });

  it('frames the center of the requested tile', () => {
    const framed = frameTiles(3, 7, 20, 10);
    expect(framed.targetX).toBe(7.5);
    expect(framed.targetZ).toBe(3.5);
    expect(framed.distance).toBe(CAMERA_DEFAULT.distance);
  });

  it('converts spherical state to a position around the target', () => {
    const position = cameraPosition({ azimuth: 0, elevation: Math.PI / 2, distance: 6, targetX: 2, targetZ: 3 });
    expect(position[0]).toBeCloseTo(2);
    expect(position[1]).toBeCloseTo(6);
    expect(position[2]).toBeCloseTo(3);
  });

  it('returns new objects without mutating inputs', () => {
    const input = state();
    expect(clampCamera(input, 10, 8)).not.toBe(input);
    expect(orbit(input, 1, 0, 10, 8)).not.toBe(input);
    expect(zoom(input, 1, 10, 8)).not.toBe(input);
    expect(input).toEqual(state());
  });
});

describe('tokenOffsets', () => {
  it('centers a single token', () => {
    expect(tokenOffsets(1)).toEqual([{ dx: 0, dz: 0 }]);
  });

  it('returns distinct offsets for three tokens', () => {
    const offsets = tokenOffsets(3);
    expect(new Set(offsets.map(({ dx, dz }) => `${dx}:${dz}`)).size).toBe(3);
  });

  it('places multiple tokens on the requested radius', () => {
    for (const offset of tokenOffsets(3, 0.4)) {
      expect(Math.hypot(offset.dx, offset.dz)).toBeCloseTo(0.4);
    }
  });

  it('is deterministic and handles empty counts', () => {
    expect(tokenOffsets(3)).toEqual(tokenOffsets(3));
    expect(tokenOffsets(0)).toEqual([]);
  });
});
