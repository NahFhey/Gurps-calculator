/**
 * Roll20-style image layer grid alignment: the GM drags a box over an
 * N×N block of the imported image's printed grid, and the layer is
 * rescaled so each image cell is exactly one map tile, with the box
 * corner snapped to the nearest tile intersection.
 */

import type { MapImageLayer } from '../types/map';

/** Axis-aligned box in world tile units (x = column, y = row), fractional. */
export interface AlignBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Boxes smaller than this per axis are treated as accidental clicks. */
export const MIN_ALIGN_BOX = 0.25;

/** Number of image grid cells the alignment box spans per axis. */
export const ALIGN_BOX_CELLS = 3;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Given a box drawn over `cells`×`cells` cells of the image's own grid,
 * return the layer geometry that makes each image cell one map tile and
 * lands the box's top-left corner on the nearest tile intersection.
 * Returns null when the box is degenerate (too small to be intentional).
 */
export function alignImageLayerToGrid(
  layer: Pick<MapImageLayer, 'x' | 'y' | 'width' | 'height'>,
  box: AlignBox,
  cells: number = ALIGN_BOX_CELLS
): Pick<MapImageLayer, 'x' | 'y' | 'width' | 'height'> | null {
  if (box.width < MIN_ALIGN_BOX || box.height < MIN_ALIGN_BOX) return null;
  if (layer.width <= 0 || layer.height <= 0) return null;

  // One image cell currently spans box/cells world units; target is 1.
  const width = layer.width * (cells / box.width);
  const height = layer.height * (cells / box.height);

  // Keep the drawn corner anchored to the same image content, then snap
  // that corner to the nearest tile intersection.
  const u = (box.x - layer.x) / layer.width;
  const v = (box.y - layer.y) / layer.height;
  const x = Math.round(box.x) - u * width;
  const y = Math.round(box.y) - v * height;

  return { x: round3(x), y: round3(y), width: round3(width), height: round3(height) };
}
