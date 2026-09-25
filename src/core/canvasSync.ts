import { PixelGrid, packCoord } from './PixelGrid';

export type PixelDelta =
  | [x: number, y: number, color: string | null]
  | [x: number, y: number, color: string | null, timestamp: number];

export interface CanvasSnapshotMessage {
  type: 'snapshot';
  width: number;
  height: number;
  pixels: ([number, number, string] | [number, number, string, number])[];
  deletedPixels?: [number, number, number][]; // [x, y, timestamp] tombstones for offline deletions
  count?: number;
  timestamp?: number;
  roomUuid?: string;
  roomName?: string;
  clearTimestamp?: number;
}

export type CanvasMutationMessage =
  | {
      type: 'pixels';
      pixels: PixelDelta[];
    }
  | {
      type: 'clear';
      timestamp?: number;
    };

export interface CanvasRequestSnapshotMessage {
  fromPeer?: string;
}

/**
 * Per-pixel timestamp tracker for Last-Write-Wins (LWW) conflict-free resolution.
 */
export class PixelTimestampTracker {
  private timestamps = new Map<number, number>();
  private lastClearTime = 0;

  get(x: number, y: number): number {
    return this.timestamps.get(packCoord(x, y)) ?? this.lastClearTime;
  }

  getByKey(key: number): number {
    return this.timestamps.get(key) ?? this.lastClearTime;
  }

  set(x: number, y: number, ts: number): void {
    this.timestamps.set(packCoord(x, y), ts);
  }

  setByKey(key: number, ts: number): void {
    this.timestamps.set(key, ts);
  }

  clear(clearTime = Date.now()): void {
    this.timestamps.clear();
    this.lastClearTime = clearTime;
  }

  getClearTime(): number {
    return this.lastClearTime;
  }

  getMap(): Map<number, number> {
    return this.timestamps;
  }
}

/**
 * Computes the delta of pixel changes between two grids.
 * Returns a list of [x, y, color | null, timestamp?], where color: null means pixel was erased.
 */
export function diffGridPixels(
  prevGrid: PixelGrid,
  nextGrid: PixelGrid,
  timestamp?: number
): PixelDelta[] {
  const deltas: PixelDelta[] = [];

  // 1. Added or changed pixels in nextGrid
  nextGrid.forEachPixel((x, y, nextColor) => {
    const prevColor = prevGrid.getColor(x, y);
    if (!prevGrid.get(x, y) || prevColor !== nextColor) {
      if (timestamp !== undefined) {
        deltas.push([x, y, nextColor, timestamp]);
      } else {
        deltas.push([x, y, nextColor]);
      }
    }
  });

  // 2. Removed pixels (were in prevGrid, now off in nextGrid)
  prevGrid.forEachPixel((x, y) => {
    if (!nextGrid.get(x, y)) {
      if (timestamp !== undefined) {
        deltas.push([x, y, null, timestamp]);
      } else {
        deltas.push([x, y, null]);
      }
    }
  });

  return deltas;
}

/**
 * Applies a list of pixel deltas into a target PixelGrid in place,
 * using per-pixel timestamps and Last-Write-Wins (LWW) if a tracker is supplied.
 */
export function applyPixelDeltas(
  grid: PixelGrid,
  deltas: PixelDelta[],
  tracker?: PixelTimestampTracker
): void {
  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i];
    const x = delta[0];
    const y = delta[1];
    const color = delta[2];
    const ts = delta[3];

    if (tracker && typeof ts === 'number') {
      const currentTs = tracker.get(x, y);
      if (ts < currentTs) {
        // Discard older mutation to prevent clobbering newer edits (LWW)
        continue;
      }
      tracker.set(x, y, ts);
    }
    if (color === null || color === '' || color === 'none' || color === 'transparent') {
      grid.set(x, y, 0);
    } else {
      grid.set(x, y, 1, color);
    }
  }
}

/**
 * Reconciles an incoming remote snapshot with local canvas state using Last-Write-Wins (LWW).
 * Disconnected / offline edits merge without clobbering non-overlapping pixels.
 */
export interface ReconcileResult {
  appliedDeltas: PixelDelta[];
  mergedCount: number;
}

export function reconcileGridSnapshots(
  localGrid: PixelGrid,
  localTracker: PixelTimestampTracker,
  remoteSnapshot: CanvasSnapshotMessage
): ReconcileResult {
  const appliedDeltas: PixelDelta[] = [];
  const remoteTime = remoteSnapshot.timestamp ?? 0;
  const remoteClearTime = remoteSnapshot.clearTimestamp ?? 0;

  // 1. Handle remote clear if it happened after local clear
  if (remoteClearTime > localTracker.getClearTime()) {
    localGrid.forEachPixel((x, y) => {
      const localTs = localTracker.get(x, y);
      if (localTs < remoteClearTime) {
        localGrid.set(x, y, 0);
        localTracker.set(x, y, remoteClearTime);
        appliedDeltas.push([x, y, null, remoteClearTime]);
      }
    });
  }

  // 2. Merge remote pixels with LWW per coordinate
  for (const pixel of remoteSnapshot.pixels) {
    const rx = pixel[0];
    const ry = pixel[1];
    const rColor = pixel[2];
    const rTs = pixel[3] ?? remoteTime;
    const lTs = localTracker.get(rx, ry);

    if (rTs > lTs) {
      localGrid.set(rx, ry, 1, rColor);
      localTracker.set(rx, ry, rTs);
      appliedDeltas.push([rx, ry, rColor, rTs]);
    } else if (rTs === lTs && !localGrid.get(rx, ry)) {
      // Deterministic tie-breaker: fill if local was empty
      localGrid.set(rx, ry, 1, rColor);
      localTracker.set(rx, ry, rTs);
      appliedDeltas.push([rx, ry, rColor, rTs]);
    }
  }

  // 3. Handle offline deletions if remote snapshot includes tombstones
  if (remoteSnapshot.deletedPixels && Array.isArray(remoteSnapshot.deletedPixels)) {
    for (const [dx, dy, dTs] of remoteSnapshot.deletedPixels) {
      const lTs = localTracker.get(dx, dy);
      if (dTs > lTs) {
        if (localGrid.get(dx, dy)) {
          localGrid.set(dx, dy, 0);
          appliedDeltas.push([dx, dy, null, dTs]);
        }
        localTracker.set(dx, dy, dTs);
      }
    }
  }

  return {
    appliedDeltas,
    mergedCount: localGrid.countOn(),
  };
}

/**
 * Computes all pixels affected by a brush dot at (cx, cy).
 */
export function getBrushDotPixels(
  cx: number,
  cy: number,
  brushSize = 1,
  color: string | null = null,
  timestamp?: number
): PixelDelta[] {
  const pixels: PixelDelta[] = [];
  const half = Math.floor(brushSize / 2);
  for (let dy = 0; dy < brushSize; dy++) {
    for (let dx = 0; dx < brushSize; dx++) {
      const px = cx - half + dx;
      const py = cy - half + dy;
      if (timestamp !== undefined) {
        pixels.push([px, py, color, timestamp]);
      } else {
        pixels.push([px, py, color]);
      }
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
  color: string | null = null,
  timestamp?: number
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
          if (timestamp !== undefined) {
            pixels.push([px, py, color, timestamp]);
          } else {
            pixels.push([px, py, color]);
          }
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
