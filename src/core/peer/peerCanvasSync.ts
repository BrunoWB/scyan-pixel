import { PixelGrid, packCoord } from '../PixelGrid';

export type PixelDelta = [x: number, y: number, color: string | null];

export interface CanvasSnapshotMessage {
  type: 'snapshot';
  width: number;
  height: number;
  pixels: [number, number, string][];
  count?: number;
}

export type CanvasMutationMessage =
  | {
      type: 'pixels';
      pixels: PixelDelta[];
    }
  | {
      type: 'clear';
    };

export interface CanvasRequestSnapshotMessage {
  fromPeer?: string;
}

/**
 * Computes the delta of pixel changes between two grids.
 * Returns a list of [x, y, color | null], where color: null means pixel was erased.
 */
export function diffGridPixels(prevGrid: PixelGrid, nextGrid: PixelGrid): PixelDelta[] {
  const deltas: PixelDelta[] = [];

  // 1. Added or changed pixels in nextGrid
  nextGrid.forEachPixel((x, y, nextColor) => {
    const prevColor = prevGrid.getColor(x, y);
    if (!prevGrid.get(x, y) || prevColor !== nextColor) {
      deltas.push([x, y, nextColor]);
    }
  });

  // 2. Removed pixels (were in prevGrid, now off in nextGrid)
  prevGrid.forEachPixel((x, y) => {
    if (!nextGrid.get(x, y)) {
      deltas.push([x, y, null]);
    }
  });

  return deltas;
}

/**
 * Applies a list of pixel deltas into a target PixelGrid in place.
 */
export function applyPixelDeltas(grid: PixelGrid, deltas: PixelDelta[]): void {
  for (let i = 0; i < deltas.length; i++) {
    const [x, y, color] = deltas[i];
    if (color === null || color === '' || color === 'none' || color === 'transparent') {
      grid.set(x, y, 0);
    } else {
      grid.set(x, y, 1, color);
    }
  }
}

/**
 * Computes all pixels affected by a brush dot at (cx, cy).
 */
export function getBrushDotPixels(
  cx: number,
  cy: number,
  brushSize = 1,
  color: string | null = null
): PixelDelta[] {
  const pixels: PixelDelta[] = [];
  const half = Math.floor(brushSize / 2);
  for (let dy = 0; dy < brushSize; dy++) {
    for (let dx = 0; dx < brushSize; dx++) {
      pixels.push([cx - half + dx, cy - half + dy, color]);
    }
  }
  return pixels;
}

/**
 * Computes all unique pixels along a line segment from (x0, y0) to (x1, y1) with brushSize.
 */
export function getLinePixels(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brushSize = 1,
  color: string | null = null
): PixelDelta[] {
  const pixels: PixelDelta[] = [];
  const seen = new Set<number>();
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let curX = x0;
  let curY = y0;

  const half = Math.floor(brushSize / 2);
  while (true) {
    for (let bdy = 0; bdy < brushSize; bdy++) {
      for (let bdx = 0; bdx < brushSize; bdx++) {
        const px = curX - half + bdx;
        const py = curY - half + bdy;
        const key = packCoord(px, py);
        if (!seen.has(key)) {
          seen.add(key);
          pixels.push([px, py, color]);
        }
      }
    }
    if (curX === x1 && curY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      curX += sx;
    }
    if (e2 < dx) {
      err += dx;
      curY += sy;
    }
  }
  return pixels;
}
