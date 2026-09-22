import { describe, it, expect } from 'vitest';
import { PixelGrid } from '../../PixelGrid';
import {
  diffGridPixels,
  applyPixelDeltas,
  getBrushDotPixels,
  getLinePixels,
  type PixelDelta,
} from '../peerCanvasSync';

describe('peerCanvasSync algorithms', () => {
  describe('diffGridPixels', () => {
    it('returns empty array when two grids are identical', () => {
      const g1 = new PixelGrid(16, 16);
      g1.set(2, 3, 1, '#ff0000');
      g1.set(5, 5, 1, '#00ff00');

      const g2 = g1.clone();
      const diff = diffGridPixels(g1, g2);

      expect(diff).toEqual([]);
    });

    it('detects newly added pixels with their colors', () => {
      const g1 = new PixelGrid(16, 16);
      const g2 = g1.clone();
      g2.set(4, 7, 1, '#3b82f6');
      g2.set(8, 9, 1, '#ef4444');

      const diff = diffGridPixels(g1, g2);
      expect(diff).toHaveLength(2);
      expect(diff).toContainEqual([4, 7, '#3b82f6']);
      expect(diff).toContainEqual([8, 9, '#ef4444']);
    });

    it('detects changed pixel colors on existing pixels', () => {
      const g1 = new PixelGrid(16, 16);
      g1.set(3, 3, 1, '#10b981');

      const g2 = g1.clone();
      g2.set(3, 3, 1, '#f59e0b');

      const diff = diffGridPixels(g1, g2);
      expect(diff).toEqual([[3, 3, '#f59e0b']]);
    });

    it('detects removed / erased pixels as null color deltas', () => {
      const g1 = new PixelGrid(16, 16);
      g1.set(1, 1, 1, '#06b6d4');
      g1.set(2, 2, 1, '#ec4899');

      const g2 = g1.clone();
      g2.set(1, 1, 0); // erased

      const diff = diffGridPixels(g1, g2);
      expect(diff).toEqual([[1, 1, null]]);
    });

    it('handles mixed additions, modifications, and erasures in one diff', () => {
      const g1 = new PixelGrid(16, 16);
      g1.set(0, 0, 1, '#ffffff'); // will be erased
      g1.set(1, 1, 1, '#111111'); // will change color

      const g2 = new PixelGrid(16, 16);
      g2.set(1, 1, 1, '#222222'); // changed color
      g2.set(2, 2, 1, '#333333'); // newly added

      const diff = diffGridPixels(g1, g2);
      expect(diff).toContainEqual([1, 1, '#222222']);
      expect(diff).toContainEqual([2, 2, '#333333']);
      expect(diff).toContainEqual([0, 0, null]);
    });
  });

  describe('applyPixelDeltas', () => {
    it('applies pixel color additions into grid', () => {
      const grid = new PixelGrid(16, 16);
      const deltas: PixelDelta[] = [
        [3, 4, '#3b82f6'],
        [7, 8, '#ec4899'],
      ];

      applyPixelDeltas(grid, deltas);

      expect(grid.get(3, 4)).toBe(1);
      expect(grid.getColor(3, 4)).toBe('#3b82f6');
      expect(grid.get(7, 8)).toBe(1);
      expect(grid.getColor(7, 8)).toBe('#ec4899');
    });

    it('erases pixels when delta color is null or transparent', () => {
      const grid = new PixelGrid(16, 16);
      grid.set(5, 5, 1, '#ffffff');
      grid.set(6, 6, 1, '#ffffff');

      applyPixelDeltas(grid, [
        [5, 5, null],
        [6, 6, 'transparent'],
      ]);

      expect(grid.get(5, 5)).toBe(0);
      expect(grid.get(6, 6)).toBe(0);
    });
  });

  describe('getBrushDotPixels', () => {
    it('generates single pixel for size 1', () => {
      const pixels = getBrushDotPixels(5, 5, 1, '#00e5a3');
      expect(pixels).toEqual([[5, 5, '#00e5a3']]);
    });

    it('generates 4 pixels for size 2', () => {
      const pixels = getBrushDotPixels(10, 10, 2, '#ff0000');
      expect(pixels).toHaveLength(4);
      // half = 1, offsets: dx in [0, 1], dy in [0, 1] -> x in [9, 10], y in [9, 10]
      expect(pixels).toContainEqual([9, 9, '#ff0000']);
      expect(pixels).toContainEqual([10, 9, '#ff0000']);
      expect(pixels).toContainEqual([9, 10, '#ff0000']);
      expect(pixels).toContainEqual([10, 10, '#ff0000']);
    });

    it('supports null color for eraser brush dot', () => {
      const pixels = getBrushDotPixels(3, 3, 1, null);
      expect(pixels).toEqual([[3, 3, null]]);
    });
  });

  describe('getLinePixels', () => {
    it('computes Bresenham line segment points', () => {
      const pixels = getLinePixels(0, 0, 2, 2, 1, '#ffffff');
      expect(pixels).toContainEqual([0, 0, '#ffffff']);
      expect(pixels).toContainEqual([1, 1, '#ffffff']);
      expect(pixels).toContainEqual([2, 2, '#ffffff']);
    });

    it('computes horizontal and vertical lines', () => {
      const hLine = getLinePixels(2, 5, 5, 5, 1, '#ffffff');
      expect(hLine).toEqual([
        [2, 5, '#ffffff'],
        [3, 5, '#ffffff'],
        [4, 5, '#ffffff'],
        [5, 5, '#ffffff'],
      ]);

      const vLine = getLinePixels(4, 1, 4, 3, 1, '#ffffff');
      expect(vLine).toEqual([
        [4, 1, '#ffffff'],
        [4, 2, '#ffffff'],
        [4, 3, '#ffffff'],
      ]);
    });
  });
});
