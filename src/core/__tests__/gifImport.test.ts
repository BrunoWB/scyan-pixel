import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BwpxGrid } from '../PixelGrid';
import { decodeGif, convertGifFramesToGrids, isGifBuffer, calculateCompactTableLayout } from '../gifDecoder';
import { renderBwpxCanvas } from '../gridRenderer';

const DESKTOP_DIR = '/home/Scyan/Desktop';
const sampleGifPath = path.join(DESKTOP_DIR, 'dancing-duck-karlo.gif');
const hasDesktopGif = fs.existsSync(sampleGifPath);
const allDesktopGifs = [
  'dancing-duck-karlo.gif',
  'duck-pixel.gif',
  'qa1itlgvb9f11.gif',
  '6585923a2ae2ad2b36f0fdec921869be.gif',
].map((name) => path.join(DESKTOP_DIR, name)).filter((p) => fs.existsSync(p));

describe('GIF Decoding and Spritesheet Conversion', () => {

  it('correctly identifies and decodes all available desktop GIFs', () => {
    expect(allDesktopGifs.length).toBeGreaterThan(0);

    for (const gifPath of allDesktopGifs) {
      const buffer = fs.readFileSync(gifPath);
      expect(isGifBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + 6))).toBe(true);

      const decoded = decodeGif(buffer);
      expect(decoded.width).toBeGreaterThan(0);
      expect(decoded.height).toBeGreaterThan(0);
      expect(decoded.frames.length).toBeGreaterThanOrEqual(1);
      expect(decoded.durationMs).toBeGreaterThan(0);

      // Verify converting all frames to 1bpp monochrome grids works for each gif
      const frames = convertGifFramesToGrids(decoded, {
        threshold: 128,
        targetWidth: 32,
        targetHeight: 32,
      });
      expect(frames.length).toBe(decoded.frames.length);
      for (const frame of frames) {
        expect(frame.grid.width).toBe(32);
        expect(frame.grid.height).toBe(32);
      }
    }
  });

  it('converts GIF frames to 1bpp grids with threshold sensitivity', () => {
    if (!hasDesktopGif) return;

    const buffer = fs.readFileSync(sampleGifPath);
    const decoded = decodeGif(buffer);

    const targetW = 32;
    const targetH = 32;

    const lowThreshFrames = convertGifFramesToGrids(decoded, {
      threshold: 60,
      targetWidth: targetW,
      targetHeight: targetH,
    });

    const highThreshFrames = convertGifFramesToGrids(decoded, {
      threshold: 200,
      targetWidth: targetW,
      targetHeight: targetH,
    });

    expect(lowThreshFrames.length).toBe(decoded.frames.length);
    expect(highThreshFrames.length).toBe(decoded.frames.length);

    // Each frame should have target dimensions
    expect(lowThreshFrames[0].grid.width).toBe(targetW);
    expect(lowThreshFrames[0].grid.height).toBe(targetH);

    // Lower threshold means more pixels are lit (>= threshold)
    const lowCount = lowThreshFrames[0].grid.countOn();
    const highCount = highThreshFrames[0].grid.countOn();
    expect(lowCount).toBeGreaterThanOrEqual(highCount);
  });

  it('supports inverting monochrome output', () => {
    if (!hasDesktopGif) return;

    const buffer = fs.readFileSync(sampleGifPath);
    const decoded = decodeGif(buffer);

    const targetW = 16;
    const targetH = 16;

    const normal = convertGifFramesToGrids(decoded, {
      threshold: 128,
      invert: false,
      targetWidth: targetW,
      targetHeight: targetH,
    });

    const inverted = convertGifFramesToGrids(decoded, {
      threshold: 128,
      invert: true,
      targetWidth: targetW,
      targetHeight: targetH,
    });

    const normalCount = normal[0].grid.countOn();
    const invertedCount = inverted[0].grid.countOn();
    // Inverted count should be the complementary count
    expect(normalCount + invertedCount).toBe(targetW * targetH);
  });

  it('arranges multi-frame GIF frames horizontally as a spritesheet', () => {
    if (!hasDesktopGif) return;

    const buffer = fs.readFileSync(sampleGifPath);
    const decoded = decodeGif(buffer);

    const frameW = 20;
    const frameH = 20;
    const frames = convertGifFramesToGrids(decoded, {
      threshold: 128,
      targetWidth: frameW,
      targetHeight: frameH,
    });

    const frameCount = frames.length;
    const totalSpritesheetWidth = frameCount * frameW;

    const canvasGrid = new BwpxGrid(totalSpritesheetWidth + 40, frameH + 20);
    const startX = 10;
    const startY = 10;

    // Stamp each frame horizontally
    frames.forEach((frame, idx) => {
      canvasGrid.blit(frame.grid, startX + idx * frameW, startY, true);
    });

    // Check that each frame occupies its respective column slice
    frames.forEach((frame, idx) => {
      const slice = canvasGrid.getSubRect(startX + idx * frameW, startY, frameW, frameH);
      expect(slice.countOn()).toBe(frame.grid.countOn());
    });
  });

  describe('calculateCompactTableLayout', () => {
    it('returns 1x1 for single frame or empty', () => {
      expect(calculateCompactTableLayout(1, 16, 16)).toEqual({
        cols: 1,
        rows: 1,
        width: 16,
        height: 16,
      });
      expect(calculateCompactTableLayout(0, 16, 16)).toEqual({
        cols: 1,
        rows: 1,
        width: 16,
        height: 16,
      });
    });

    it('compacts 4 frames (16x16) into 2 cols x 2 rows instead of a single row', () => {
      const layout = calculateCompactTableLayout(4, 16, 16, 64, 64);
      expect(layout.cols).toBe(2);
      expect(layout.rows).toBe(2);
      expect(layout.width).toBe(32);
      expect(layout.height).toBe(32);
    });

    it('compacts 8 frames (32x32) into 4 cols x 2 rows to fit 128x64 display perfectly', () => {
      const layout = calculateCompactTableLayout(8, 32, 32, 128, 64);
      expect(layout.cols).toBe(4);
      expect(layout.rows).toBe(2);
      expect(layout.width).toBe(128);
      expect(layout.height).toBe(64);
    });

    it('compacts 16 frames (16x16) into 4 cols x 4 rows to fit 64x64 canvas', () => {
      const layout = calculateCompactTableLayout(16, 16, 16, 64, 64);
      expect(layout.cols).toBe(4);
      expect(layout.rows).toBe(4);
      expect(layout.width).toBe(64);
      expect(layout.height).toBe(64);
    });

    it('compacts 6 frames (16x16) into 3 cols x 2 rows on a 128x64 canvas', () => {
      const layout = calculateCompactTableLayout(6, 16, 16, 128, 64);
      expect(layout.cols).toBe(3);
      expect(layout.rows).toBe(2);
      expect(layout.width).toBe(48);
      expect(layout.height).toBe(32);
    });

    it('falls back to single row only when canvas height strictly allows only 1 row', () => {
      const layout = calculateCompactTableLayout(4, 16, 16, 128, 16);
      expect(layout.cols).toBe(4);
      expect(layout.rows).toBe(1);
      expect(layout.width).toBe(64);
      expect(layout.height).toBe(16);
    });

    it('arranges multi-frame GIF frames as a compact table onto canvas', () => {
      const multiFrameGifPath = allDesktopGifs.find((p) => !p.includes('dancing-duck-karlo')) || sampleGifPath;
      if (!fs.existsSync(multiFrameGifPath)) return;

      const buffer = fs.readFileSync(multiFrameGifPath);
      const decoded = decodeGif(buffer);

      const frameW = 16;
      const frameH = 16;
      const frames = convertGifFramesToGrids(decoded, {
        threshold: 128,
        targetWidth: frameW,
        targetHeight: frameH,
      });

      const frameCount = frames.length;
      const layout = calculateCompactTableLayout(frameCount, frameW, frameH, 128, 64);
      if (frameCount >= 3) {
        expect(layout.rows).toBeGreaterThan(1);
      }

      const canvasGrid = new BwpxGrid(layout.width + 10, layout.height + 10);
      const startX = 0;
      const startY = 0;

      // Stamp each frame in table order
      frames.forEach((frame, idx) => {
        const col = idx % layout.cols;
        const row = Math.floor(idx / layout.cols);
        canvasGrid.blit(frame.grid, startX + col * frameW, startY + row * frameH, true);
      });

      // Verify each frame slice at (col * w, row * h)
      frames.forEach((frame, idx) => {
        const col = idx % layout.cols;
        const row = Math.floor(idx / layout.cols);
        const slice = canvasGrid.getSubRect(startX + col * frameW, startY + row * frameH, frameW, frameH);
        expect(slice.countOn()).toBe(frame.grid.countOn());
      });
    });
  });


  it('renders pixels without renderBwpxCanvas clearing the drawn canvas', () => {
    const drawnOperations: string[] = [];

    const mockCtx: any = {
      fillStyle: '',
      fillRect: (x: number, y: number, w: number, h: number) => {
        drawnOperations.push(`fill:${x},${y},${w},${h}`);
      },
      clearRect: (x: number, y: number, w: number, h: number) => {
        drawnOperations.push(`clear:${x},${y},${w},${h}`);
      },
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      setLineDash: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
    };

    const mockCanvas: any = { width: 320, height: 220 };

    const grid = new BwpxGrid(16, 16);
    grid.set(2, 2, 1);
    grid.set(3, 3, 1);

    renderBwpxCanvas(mockCanvas, mockCtx, {
      grid,
      zoom: 4,
      pan: { x: 50, y: 50 },
      showAxes: false,
      showGridLines: false,
    });

    // Verify clearRect was NOT called to erase the rendered pixels
    const clearCalls = drawnOperations.filter((op) => op.startsWith('clear:'));
    expect(clearCalls).toEqual([]);

    // Verify pixels were painted
    const pixelFills = drawnOperations.filter((op) => !op.includes('0,0,320,220'));
    expect(pixelFills.length).toBe(2);
  });
});
