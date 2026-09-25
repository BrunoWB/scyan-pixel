import { describe, it, expect } from 'vitest';
import { PixelGrid as BwpxGrid } from '../PixelGrid';
import type { SpriteSlice } from '../../components/editor/types';

/**
 * Pure selection move logic mirroring BwpxEditor.moveActiveSelection
 */
function simulateSelectionMove({
  grid,
  selection,
  slices = [],
  selectedSliceIds = [],
  selectedSliceId = '',
  dx,
  dy,
}: {
  grid: BwpxGrid;
  selection: { x: number; y: number; w: number; h: number; active: boolean };
  slices?: SpriteSlice[];
  selectedSliceIds?: string[];
  selectedSliceId?: string;
  dx: number;
  dy: number;
}) {
  const currentSel = selection;
  const currentGrid = grid;
  const activeIds = selectedSliceIds.length
    ? selectedSliceIds
    : selectedSliceId
    ? [selectedSliceId]
    : [];

  let sliceRects: { x: number; y: number; w: number; h: number }[] = [];
  let matchingSlice: SpriteSlice | undefined;

  if (activeIds.length > 0) {
    activeIds.forEach(id => {
      const s = slices.find(item => item.id === id);
      if (s) {
        sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
      }
    });
  } else {
    matchingSlice = slices.find(
      s =>
        s.x === currentSel.x &&
        s.y === currentSel.y &&
        s.width === currentSel.w &&
        s.height === currentSel.h
    );
    if (matchingSlice) {
      sliceRects.push({
        x: matchingSlice.x,
        y: matchingSlice.y,
        w: matchingSlice.width,
        h: matchingSlice.height,
      });
    }
  }

  const targetX = currentSel.x + dx;
  const targetY = currentSel.y + dy;
  const next = currentGrid.clone();

  let extracted: [number, number][] = [];
  const sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];

  if (sliceRects.length > 0) {
    // 1. Extract pixels from slice source rectangles (relative to currentSel)
    sliceRects.forEach(sr => {
      const spx = currentGrid.extractRect(sr);
      spx.forEach(([rx, ry]) => {
        extracted.push([sr.x + rx - currentSel.x, sr.y + ry - currentSel.y]);
      });
    });

    // 2. Clear source slice rectangles
    sliceRects.forEach(sr => next.clearRect(sr));

    // 3. Clear destination slice rectangles
    sliceRects.forEach(sr => {
      next.clearRect({
        x: sr.x + dx,
        y: sr.y + dy,
        w: sr.w,
        h: sr.h,
      });
    });

    // 4. Stamp active pixels at target
    extracted.forEach(([rx, ry]) => {
      next.set(targetX + rx, targetY + ry, 1);
    });

    // 5. Calculate slice updates
    if (activeIds.length > 0) {
      activeIds.forEach(id => {
        const s = slices.find(item => item.id === id);
        if (s) {
          sliceUpdates.push({
            id: s.id,
            prevX: s.x,
            prevY: s.y,
            newX: s.x + dx,
            newY: s.y + dy,
          });
        }
      });
    } else if (matchingSlice) {
      sliceUpdates.push({
        id: matchingSlice.id,
        prevX: matchingSlice.x,
        prevY: matchingSlice.y,
        newX: targetX,
        newY: targetY,
      });
    }
  } else {
    // Free marquee selection without slices
    const sourceRect = { x: currentSel.x, y: currentSel.y, w: currentSel.w, h: currentSel.h };
    extracted = currentGrid.extractRect(sourceRect);

    // Clear source
    next.clearRect(sourceRect);
    // Clear destination
    next.clearRect({ x: targetX, y: targetY, w: currentSel.w, h: currentSel.h });

    // Stamp pixels
    extracted.forEach(([rx, ry]) => {
      next.set(targetX + rx, targetY + ry, 1);
    });
  }

  const newSelection = {
    x: targetX,
    y: targetY,
    w: currentSel.w,
    h: currentSel.h,
    active: true,
  };

  const updatedSlices = slices.map(s => {
    const u = sliceUpdates.find(item => item.id === s.id);
    return u ? { ...s, x: u.newX, y: u.newY } : s;
  });

  return { next, newSelection, sliceUpdates, updatedSlices };
}

describe('Arrow Key Move Selection in BwpxEditor', () => {
  it('moves a free marquee selection 1px to the right with ArrowRight', () => {
    const grid = new BwpxGrid(32, 32);
    // Draw a pixel at (5, 5)
    grid.set(5, 5, 1);

    const selection = { x: 4, y: 4, w: 4, h: 4, active: true };
    const { next, newSelection } = simulateSelectionMove({
      grid,
      selection,
      dx: 1,
      dy: 0,
    });

    expect(newSelection).toEqual({ x: 5, y: 4, w: 4, h: 4, active: true });
    // Original pixel moved from (5, 5) to (6, 5)
    expect(next.get(5, 5)).toBe(0);
    expect(next.get(6, 5)).toBe(1);
  });

  it('moves selection by 10px when Shift key step is applied', () => {
    const grid = new BwpxGrid(64, 64);
    grid.set(10, 10, 1);

    const selection = { x: 10, y: 10, w: 8, h: 8, active: true };
    const step = 10;
    const { next, newSelection } = simulateSelectionMove({
      grid,
      selection,
      dx: step,
      dy: -step,
    });

    expect(newSelection).toEqual({ x: 20, y: 0, w: 8, h: 8, active: true });
    expect(next.get(10, 10)).toBe(0);
    expect(next.get(20, 0)).toBe(1);
  });

  it('overrides destination pixels with zeros from the moving selection', () => {
    const grid = new BwpxGrid(32, 32);
    // Destination (6, 5) has a 1
    grid.set(6, 5, 1);
    // Source (4, 4..7, 7) has only a single 1 at (4, 4), and (5, 5) is 0
    grid.set(4, 4, 1);

    const selection = { x: 4, y: 4, w: 4, h: 4, active: true };
    // Move dx=1: source (5, 5) which is 0 moves onto (6, 5)
    const { next } = simulateSelectionMove({
      grid,
      selection,
      dx: 1,
      dy: 0,
    });

    // (5, 4) should be 1 (from 4, 4)
    expect(next.get(5, 4)).toBe(1);
    // (6, 5) should now be 0 because the empty area of the selection overrode it
    expect(next.get(6, 5)).toBe(0);
  });

  it('moves single slice and outputs sliceUpdates with new coordinates', () => {
    const grid = new BwpxGrid(32, 32);
    grid.set(10, 10, 1);
    const slices: SpriteSlice[] = [
      { id: 'SLICE_1', name: 'Test', groupId: 'GROUP_1', groupOrder: 1, x: 8, y: 8, width: 8, height: 8, color: '#00f0ff' },
    ];
    const selection = { x: 8, y: 8, w: 8, h: 8, active: true };

    const { next, newSelection, sliceUpdates, updatedSlices } = simulateSelectionMove({
      grid,
      selection,
      slices,
      selectedSliceId: 'SLICE_1',
      dx: 0,
      dy: 1,
    });

    expect(newSelection).toEqual({ x: 8, y: 9, w: 8, h: 8, active: true });
    expect(sliceUpdates).toEqual([
      { id: 'SLICE_1', prevX: 8, prevY: 8, newX: 8, newY: 9 },
    ]);
    expect(updatedSlices[0].y).toBe(9);
    expect(next.get(10, 10)).toBe(0);
    expect(next.get(10, 11)).toBe(1);
  });

  it('moves multiple disjoint slices without clearing unselected pixels between them', () => {
    const grid = new BwpxGrid(64, 32);
    // Slice A at (4, 4, 4, 4) with pixel at (5, 5)
    grid.set(5, 5, 1);
    // Slice B at (14, 4, 4, 4) with pixel at (15, 5)
    grid.set(15, 5, 1);
    // Unselected intermediate pixel between slices at (10, 5)
    grid.set(10, 5, 1);

    const slices: SpriteSlice[] = [
      { id: 'SLICE_A', name: 'A', groupId: 'GROUP_A', groupOrder: 1, x: 4, y: 4, width: 4, height: 4, color: '#00f0ff' },
      { id: 'SLICE_B', name: 'B', groupId: 'GROUP_B', groupOrder: 1, x: 14, y: 4, width: 4, height: 4, color: '#00f0ff' },
    ];
    // Combined selection bounding box: x: 4 to 18 (w: 14)
    const selection = { x: 4, y: 4, w: 14, h: 4, active: true };

    const { next, newSelection, sliceUpdates, updatedSlices } = simulateSelectionMove({
      grid,
      selection,
      slices,
      selectedSliceIds: ['SLICE_A', 'SLICE_B'],
      dx: 1,
      dy: 0,
    });

    expect(newSelection).toEqual({ x: 5, y: 4, w: 14, h: 4, active: true });
    expect(sliceUpdates).toHaveLength(2);
    expect(updatedSlices[0].x).toBe(5);
    expect(updatedSlices[1].x).toBe(15);

    // Slice A pixel moved
    expect(next.get(5, 5)).toBe(0);
    expect(next.get(6, 5)).toBe(1);

    // Slice B pixel moved
    expect(next.get(15, 5)).toBe(0);
    expect(next.get(16, 5)).toBe(1);

    // Unselected intermediate pixel at (10, 5) was NOT touched!
    expect(next.get(10, 5)).toBe(1);
  });
});
