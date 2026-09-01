export interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
  targetX: number;
  targetZ: number;
}

export const CAMERA_DEFAULT: Omit<CameraState, 'targetX' | 'targetZ'> = {
  azimuth: 0,
  elevation: 55 * Math.PI / 180,
  distance: 14,
};

const MIN_ELEVATION = 15 * Math.PI / 180;
const MAX_ELEVATION = 85 * Math.PI / 180;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function clampCamera(s: CameraState, cols: number, rows: number): CameraState {
  return {
    ...s,
    elevation: clamp(s.elevation, MIN_ELEVATION, MAX_ELEVATION),
    distance: clamp(s.distance, 3, Math.max(3, Math.max(cols, rows) * 2)),
    targetX: clamp(s.targetX, -2, cols + 2),
    targetZ: clamp(s.targetZ, -2, rows + 2),
  };
}

export function orbit(s: CameraState, dAz: number, dEl: number, cols: number, rows: number): CameraState {
  return clampCamera({ ...s, azimuth: s.azimuth + dAz, elevation: s.elevation + dEl }, cols, rows);
}

export function zoom(s: CameraState, factor: number, cols: number, rows: number): CameraState {
  return clampCamera({ ...s, distance: s.distance * factor }, cols, rows);
}

export function pan(s: CameraState, dx: number, dz: number, cols: number, rows: number): CameraState {
  return clampCamera({ ...s, targetX: s.targetX + dx, targetZ: s.targetZ + dz }, cols, rows);
}

export function dragPan(
  s: CameraState,
  dxPx: number,
  dyPx: number,
  viewportHeightPx: number,
  fovDeg: number,
  cols: number,
  rows: number
): CameraState {
  if (viewportHeightPx <= 0) return { ...s };
  const worldPerPx = 2 * s.distance * Math.tan((fovDeg * Math.PI / 180) / 2) / viewportHeightPx;
  const localX = dxPx * worldPerPx;
  const localZ = dyPx * worldPerPx;
  const cos = Math.cos(s.azimuth);
  const sin = Math.sin(s.azimuth);
  // Grab-pan: the world point under the cursor follows the cursor, so the
  // camera target moves opposite the drag (screen-right = camera right
  // (cos, -sin), screen-down = toward the camera (sin, cos)).
  return pan(s, -localX * cos - localZ * sin, localX * sin - localZ * cos, cols, rows);
}

export function cameraPosition(s: CameraState): [number, number, number] {
  const horizontal = s.distance * Math.cos(s.elevation);
  return [
    s.targetX + horizontal * Math.sin(s.azimuth),
    s.distance * Math.sin(s.elevation),
    s.targetZ + horizontal * Math.cos(s.azimuth),
  ];
}

export function frameTiles(row: number, col: number, cols: number, rows: number): CameraState {
  return clampCamera({ ...CAMERA_DEFAULT, targetX: col + 0.5, targetZ: row + 0.5 }, cols, rows);
}

/** Deterministic fan-out offsets for tokens sharing a tile. */
export function tokenOffsets(
  count: number,
  radius: number = 0.22
): Array<{ dx: number; dz: number }> {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return [{ dx: 0, dz: 0 }];
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / safeCount;
    return { dx: Math.cos(angle) * radius, dz: Math.sin(angle) * radius };
  });
}
