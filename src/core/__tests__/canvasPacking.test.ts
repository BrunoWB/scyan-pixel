import { describe, it, expect } from 'vitest';
import { PixelGrid as BwpxGrid } from '../PixelGrid';
import type { SpriteSlice } from '../../components/editor/types';
import { findAvailableSpot } from '../canvasPacking';

describe('canvasPacking findAvailableSpot', () => {
  it('places at (0, 0) on an empty canvas', () => {
    const grid = new BwpxGrid(128, 34);
    const slices: SpriteSlice[] = [];

    const result = findAvailableSpot(grid, slices, 32, 24, 3, 128, 34);

    expect(result.bounds.x).toBe(0);
    expect(result.bounds.y).toBe(0);
    expect(result.bounds.w).toBe(32 * 3);
    expect(result.bounds.h).toBe(24);
    expect(result.frames.length).toBe(3);
    expect(result.frames[0]).toEqual({ index: 0, x: 0, y: 0, width: 32, height: 24 });
    expect(result.frames[1]).toEqual({ index: 1, x: 32, y: 0, width: 32, height: 24 });
    expect(result.frames[2]).toEqual({ index: 2, x: 64, y: 0, width: 32, height: 24 });
  });

  it('avoids existing slices and finds an open gap', () => {
    const grid = new BwpxGrid(128, 34);
    // Occupy top-left 32x24
    const slices: SpriteSlice[] = [
      {
        id: 'SLICE_1',
        groupId: 'SLICE_1',
        groupOrder: 1,
        x: 0,
        y: 0,
        width: 32,
        height: 24,
      },
    ];

    // Request 2 frames of 32x24
    const result = findAvailableSpot(grid, slices, 32, 24, 2, 128, 34);

    // Should place at x = 32, y = 0
    expect(result.bounds.x).toBe(32);
    expect(result.bounds.y).toBe(0);
    expect(result.frames[0].x).toBe(32);
    expect(result.frames[1].x).toBe(64);
  });

  it('avoids active pixels on the grid', () => {
    const grid = new BwpxGrid(128, 34);
    grid.set(10, 10, 1); // lit pixel at (10, 10)
    const slices: SpriteSlice[] = [];

    const result = findAvailableSpot(grid, slices, 32, 24, 1, 128, 34);

    // Cannot occupy rectangle [0..32) x [0..24) because (10, 10) is lit
    const inside = (px: number, py: number, b: typeof result.bounds) =>
      px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

    expect(inside(10, 10, result.bounds)).toBe(false);
  });

  it('wraps into rows when total width exceeds canvas width', () => {
    const grid = new BwpxGrid(128, 34);
    const slices: SpriteSlice[] = [];

    // 5 frames of 32px each = 160px > 128px
    // 128 / 32 = 4 cols. Row 0: 4 frames, Row 1: 1 frame.
    const result = findAvailableSpot(grid, slices, 32, 20, 5, 128, 34);

    expect(result.bounds.w).toBe(128); // 4 cols * 32
    expect(result.bounds.h).toBe(40); // 2 rows * 20
    expect(result.frames[0]).toEqual({ index: 0, x: 0, y: 0, width: 32, height: 20 });
    expect(result.frames[3]).toEqual({ index: 3, x: 96, y: 0, width: 32, height: 20 });
    expect(result.frames[4]).toEqual({ index: 4, x: 0, y: 20, width: 32, height: 20 });
  });

  it('falls back to placing below all existing content if no gap fits', () => {
    const grid = new BwpxGrid(128, 34);
    const slices: SpriteSlice[] = [
      {
        id: 'ROW_1',
        groupId: 'ROW_1',
        groupOrder: 1,
        x: 0,
        y: 0,
        width: 128,
        height: 34,
      },
    ];

    const result = findAvailableSpot(grid, slices, 32, 20, 2, 128, 34);

    // Entire 128x34 is blocked, so it should place at y >= 34
    expect(result.bounds.y).toBeGreaterThanOrEqual(34);
  });
});
