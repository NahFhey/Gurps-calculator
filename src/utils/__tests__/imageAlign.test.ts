import { describe, expect, it } from 'vitest';
import { alignImageLayerToGrid } from '../imageAlign';

describe('alignImageLayerToGrid', () => {
  it('scales the layer so each image cell becomes one tile', () => {
    // Image is 30 tiles wide but its printed grid is 20 cells wide: a 3×3
    // block of image cells currently spans 4.5×4.5 world tiles.
    const layer = { x: 0, y: 0, width: 30, height: 30 };
    const result = alignImageLayerToGrid(layer, { x: 3, y: 3, width: 4.5, height: 4.5 });
    expect(result).not.toBeNull();
    expect(result!.width).toBe(20);
    expect(result!.height).toBe(20);
  });

  it('keeps the box corner anchored to the same image content, snapped to a tile intersection', () => {
    const layer = { x: 0, y: 0, width: 30, height: 30 };
    // Box corner at (3.1, 2.9) → snaps to intersection (3, 3).
    const result = alignImageLayerToGrid(layer, { x: 3.1, y: 2.9, width: 4.5, height: 4.5 })!;
    // Content fraction left of the corner: 3.1/30 ≈ 0.10333 of a 20-wide image.
    expect(result.x).toBeCloseTo(3 - (3.1 / 30) * 20, 3);
    expect(result.y).toBeCloseTo(3 - (2.9 / 30) * 20, 3);
  });

  it('is a no-op (identity geometry) when the image is already aligned', () => {
    const layer = { x: 2, y: 1, width: 20, height: 15 };
    const result = alignImageLayerToGrid(layer, { x: 5, y: 4, width: 3, height: 3 })!;
    expect(result).toEqual({ x: 2, y: 1, width: 20, height: 15 });
  });

  it('handles a layer offset from the origin with non-square scaling', () => {
    // Image cells are 2 wide × 1.5 tall in world units.
    const layer = { x: 4, y: 6, width: 20, height: 15 };
    const result = alignImageLayerToGrid(layer, { x: 8, y: 9, width: 6, height: 4.5 })!;
    expect(result.width).toBeCloseTo(10, 3);
    expect(result.height).toBeCloseTo(10, 3);
    // Corner (8,9) is at content fraction (0.2, 0.2); snapped corner stays (8,9).
    expect(result.x).toBeCloseTo(8 - 0.2 * 10, 3);
    expect(result.y).toBeCloseTo(9 - 0.2 * 10, 3);
  });

  it('rejects degenerate boxes and layers', () => {
    const layer = { x: 0, y: 0, width: 30, height: 30 };
    expect(alignImageLayerToGrid(layer, { x: 3, y: 3, width: 0.1, height: 4 })).toBeNull();
    expect(alignImageLayerToGrid(layer, { x: 3, y: 3, width: 4, height: 0 })).toBeNull();
    expect(alignImageLayerToGrid({ x: 0, y: 0, width: 0, height: 10 }, { x: 1, y: 1, width: 3, height: 3 })).toBeNull();
  });

  it('supports a different cell count', () => {
    const layer = { x: 0, y: 0, width: 30, height: 30 };
    // 2×2 box spanning 3×3 world tiles → cells are 1.5 tiles → scale by 2/3.
    const result = alignImageLayerToGrid(layer, { x: 0, y: 0, width: 3, height: 3 }, 2)!;
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });
});
