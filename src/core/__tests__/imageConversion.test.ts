import { describe, it, expect } from 'vitest';
import { convertImageDataToGrid, detectContentBoundingBox } from '../imageConversion';

describe('imageConversion detectContentBoundingBox', () => {
  it('detects transparent pixels (alpha < 32) as background and crops to content', () => {
    // 10x10 frame with content at (2, 3) to (6, 7)
    const w = 10;
    const h = 10;
    const rgba = new Uint8ClampedArray(w * h * 4);

    // Fill content pixels with alpha >= 32
    for (let y = 3; y <= 7; y++) {
      for (let x = 2; x <= 6; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 255;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 255;
      }
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 2,
      y: 3,
      w: 5,
      h: 5,
    });
  });

  it('detects near-white background (> 235) for opaque images', () => {
    const w = 8;
    const h = 8;
    const rgba = new Uint8ClampedArray(w * h * 4);

    // Fill entire image with white background (250, 250, 250, 255)
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 250;
      rgba[i + 1] = 250;
      rgba[i + 2] = 250;
      rgba[i + 3] = 255;
    }

    // Place dark content at (1, 2) to (4, 5)
    for (let y = 2; y <= 5; y++) {
      for (let x = 1; x <= 4; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 20;
        rgba[idx + 1] = 20;
        rgba[idx + 2] = 20;
        rgba[idx + 3] = 255;
      }
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 1,
      y: 2,
      w: 4,
      h: 4,
    });
  });

  it('detects near-black background (< 25) for opaque images', () => {
    const w = 8;
    const h = 8;
    const rgba = new Uint8ClampedArray(w * h * 4);

    // Fill entire image with near-black (10, 10, 10, 255)
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 10;
      rgba[i + 1] = 10;
      rgba[i + 2] = 10;
      rgba[i + 3] = 255;
    }

    // Place bright content at (3, 1) to (6, 4)
    for (let y = 1; y <= 4; y++) {
      for (let x = 3; x <= 6; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 200;
        rgba[idx + 1] = 200;
        rgba[idx + 2] = 200;
        rgba[idx + 3] = 255;
      }
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 3,
      y: 1,
      w: 4,
      h: 4,
    });
  });

  it('detects uniform solid background color for opaque images', () => {
    const w = 8;
    const h = 8;
    const rgba = new Uint8ClampedArray(w * h * 4);

    // Solid blue background (0, 0, 200, 255)
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 200;
      rgba[i + 3] = 255;
    }

    // Place yellow content at (2, 2) to (3, 3)
    for (let y = 2; y <= 3; y++) {
      for (let x = 2; x <= 3; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 255;
      }
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 2,
      y: 2,
      w: 2,
      h: 2,
    });
  });

  it('computes union bounding box [minX, minY, maxX, maxY] across all GIF frames', () => {
    const w = 10;
    const h = 10;

    // Frame 1 has content at (1, 2) to (3, 4)
    const frame1Rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 2; y <= 4; y++) {
      for (let x = 1; x <= 3; x++) {
        const idx = (y * w + x) * 4;
        frame1Rgba[idx] = 255;
        frame1Rgba[idx + 3] = 255;
      }
    }

    // Frame 2 has content at (5, 6) to (8, 9)
    const frame2Rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 6; y <= 9; y++) {
      for (let x = 5; x <= 8; x++) {
        const idx = (y * w + x) * 4;
        frame2Rgba[idx + 1] = 255;
        frame2Rgba[idx + 3] = 255;
      }
    }

    const box = detectContentBoundingBox([
      { width: w, height: h, rgba: frame1Rgba },
      { width: w, height: h, rgba: frame2Rgba },
    ]);

    // Union: x from 1 to 8 (w = 8), y from 2 to 9 (h = 8)
    expect(box).toEqual({
      x: 1,
      y: 2,
      w: 8,
      h: 8,
    });
  });

  it('falls back to full image bounds for empty / all-background images', () => {
    const w = 5;
    const h = 5;
    const rgba = new Uint8ClampedArray(w * h * 4); // all 0 alpha

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 0,
      y: 0,
      w: 5,
      h: 5,
    });
  });

  it('handles 1xN single-column images correctly', () => {
    const w = 1;
    const h = 6;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // white background
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }
    // dark content at y=2, y=3
    for (const y of [2, 3]) {
      const idx = y * 4;
      rgba[idx] = 10;
      rgba[idx + 1] = 10;
      rgba[idx + 2] = 10;
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 0,
      y: 2,
      w: 1,
      h: 2,
    });
  });

  it('handles Nx1 single-row images correctly', () => {
    const w = 6;
    const h = 1;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // black background
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 10;
      rgba[i + 1] = 10;
      rgba[i + 2] = 10;
      rgba[i + 3] = 255;
    }
    // bright content at x=1, x=2, x=3
    for (const x of [1, 2, 3]) {
      const idx = x * 4;
      rgba[idx] = 240;
      rgba[idx + 1] = 240;
      rgba[idx + 2] = 240;
    }

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    expect(box).toEqual({
      x: 1,
      y: 0,
      w: 3,
      h: 1,
    });
  });

  it('detects uniform background when corner 0 is occupied by content but other corners match perimeter', () => {
    const w = 10;
    const h = 10;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // Green solid background (30, 180, 50)
    for (let i = 0; i < w * h * 4; i += 4) {
      rgba[i] = 30;
      rgba[i + 1] = 180;
      rgba[i + 2] = 50;
      rgba[i + 3] = 255;
    }
    // Red content touching top-left corner (0,0) and (1,0)
    rgba[0] = 255; rgba[1] = 0; rgba[2] = 0;
    rgba[4] = 255; rgba[5] = 0; rgba[6] = 0;
    // Central red content at (4,4)
    const midIdx = (4 * w + 4) * 4;
    rgba[midIdx] = 255; rgba[midIdx + 1] = 0; rgba[midIdx + 2] = 0;

    const box = detectContentBoundingBox([{ width: w, height: h, rgba }]);
    // Should successfully recognize (30, 180, 50) as the background and crop around red pixels
    expect(box).toEqual({
      x: 0,
      y: 0,
      w: 5,
      h: 5,
    });
  });
});

describe('imageConversion colorMode', () => {
  it('retains RGB hex colors for non-transparent pixels in colorMode: true', () => {
    const width = 2;
    const height = 1;
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,     // Red (255, 0, 0)
      0, 255, 0, 10,      // Transparent green (alpha < 32)
    ]);

    const fakeImageData = { width, height, data } as ImageData;
    const grid = convertImageDataToGrid(fakeImageData, {
      threshold: 128,
      colorMode: true,
    });

    expect(grid.get(0, 0)).toBe(1);
    expect(grid.getColor(0, 0)).toBe('#ff0000');

    // Transparent pixel is off
    expect(grid.get(1, 0)).toBe(0);
  });
});
