import type { SpriteSlice } from '../components/editor/types';
import { PixelGrid as BwpxGrid } from './PixelGrid';

export interface FramePlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasPackingResult {
  frames: FramePlacement[];
  bounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * Checks whether a candidate rectangle intersects any existing sprite slice.
 */
function collidesWithSlices(
  x: number,
  y: number,
  w: number,
  h: number,
  slices: SpriteSlice[]
): boolean {
  for (const s of slices) {
    if (
      s.x < x + w &&
      s.x + s.width > x &&
      s.y < y + h &&
      s.y + s.height > y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a candidate rectangle contains any active pixels in the grid.
 */
function collidesWithPixels(
  x: number,
  y: number,
  w: number,
  h: number,
  activePixels: [number, number][]
): boolean {
  for (let i = 0; i < activePixels.length; i++) {
    const px = activePixels[i][0];
    const py = activePixels[i][1];
    if (px >= x && px < x + w && py >= y && py < y + h) {
      return true;
    }
  }
  return false;
}

/**
 * Finds an available collision-free spot on the canvas to place a multi-frame animation.
 * Frames are arranged in a horizontal row if space permits, or wrapped into rows fitting within canvasWidth.
 * If no gap exists within the existing content area, it places the frames cleanly below the lowest element.
 */
export function findAvailableSpot(
  grid: BwpxGrid,
  slices: SpriteSlice[],
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  canvasWidth = 128,
  canvasHeight = 34
): CanvasPackingResult {
  if (frameCount <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return {
      frames: [],
      bounds: { x: 0, y: 0, w: 0, h: 0 },
    };
  }

  // Determine grid layout of frames (cols x rows)
  const maxCols = Math.max(1, Math.floor(canvasWidth / frameWidth));
  const cols = frameCount <= maxCols ? frameCount : maxCols;
  const rows = Math.ceil(frameCount / cols);

  const totalW = Math.min(frameCount, cols) * frameWidth;
  const totalH = rows * frameHeight;

  const activePixels = grid.getAllPixels();

  // Find maximum extent of existing content
  let maxYExtent = Math.max(canvasHeight, grid.height);
  for (const s of slices) {
    maxYExtent = Math.max(maxYExtent, s.y + s.height);
  }
  for (const p of activePixels) {
    maxYExtent = Math.max(maxYExtent, p[1] + 1);
  }

  const stepX = 2;
  const stepY = 2;
  const maxX = Math.max(0, canvasWidth - totalW);

  // 1. First attempt: search for a free gap within the existing bounds
  for (let candidateY = 0; candidateY <= maxYExtent - totalH; candidateY += stepY) {
    for (let candidateX = 0; candidateX <= maxX; candidateX += stepX) {
      let collides = false;

      for (let i = 0; i < frameCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const fx = candidateX + col * frameWidth;
        const fy = candidateY + row * frameHeight;

        if (
          collidesWithSlices(fx, fy, frameWidth, frameHeight, slices) ||
          collidesWithPixels(fx, fy, frameWidth, frameHeight, activePixels)
        ) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        return buildResult(candidateX, candidateY, frameWidth, frameHeight, frameCount, cols);
      }
    }
  }

  // 2. Second attempt: place immediately below lowest element, separated by a 2-pixel margin
  let placeY = 0;
  for (const s of slices) {
    placeY = Math.max(placeY, s.y + s.height);
  }
  for (const p of activePixels) {
    placeY = Math.max(placeY, p[1] + 1);
  }

  if (placeY > 0) {
    placeY += 2;
  }

  return buildResult(0, placeY, frameWidth, frameHeight, frameCount, cols);
}

function buildResult(
  startX: number,
  startY: number,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  cols: number
): CanvasPackingResult {
  const frames: FramePlacement[] = [];
  const rows = Math.ceil(frameCount / cols);

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    frames.push({
      index: i,
      x: startX + col * frameWidth,
      y: startY + row * frameHeight,
      width: frameWidth,
      height: frameHeight,
    });
  }

  const w = Math.min(frameCount, cols) * frameWidth;
  const h = rows * frameHeight;

  return {
    frames,
    bounds: { x: startX, y: startY, w, h },
  };
}
