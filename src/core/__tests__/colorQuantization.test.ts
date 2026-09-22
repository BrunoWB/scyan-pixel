import { describe, it, expect } from 'vitest';
import { quantizePixelsToPalette } from '../colorQuantization';

describe('colorQuantization (Median Cut)', () => {
  it('returns empty palette when buffer is empty or all transparent', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 10]);
    const result = quantizePixelsToPalette(data, 16);
    expect(result.palette).toHaveLength(0);
    expect(result.hexPalette).toHaveLength(0);
  });

  it('keeps exact colors when unique colors <= maxColors', () => {
    // Red and Blue pixels, fully opaque
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,   // red
      0, 0, 255, 255,   // blue
      255, 0, 0, 255,   // red
    ]);
    const result = quantizePixelsToPalette(data, 4);
    expect(result.palette).toHaveLength(2);
    expect(result.hexPalette).toContain('#ff0000');
    expect(result.hexPalette).toContain('#0000ff');

    // Test map lookup
    const redKey = (255 << 16) | (0 << 8) | 0;
    const blueKey = (0 << 16) | (0 << 8) | 255;
    expect(result.colorMap.get(redKey)).toBe('#ff0000');
    expect(result.colorMap.get(blueKey)).toBe('#0000ff');
  });

  it('quantizes to maxColors when unique colors exceed maxColors', () => {
    // 5 distinct colors: Red, Green, Blue, Yellow, White
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,       // Red
      0, 255, 0, 255,       // Green
      0, 0, 255, 255,       // Blue
      255, 255, 0, 255,     // Yellow
      255, 255, 255, 255,   // White
    ]);

    // Request K=2
    const result = quantizePixelsToPalette(data, 2);
    expect(result.palette.length).toBeLessThanOrEqual(2);
    expect(result.palette.length).toBeGreaterThan(0);
    expect(result.hexPalette.length).toBe(result.palette.length);

    // Every unique color must have a valid mapped hex in colorMap
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const mapped = result.colorMap.get(key);
      expect(mapped).toBeDefined();
      expect(result.hexPalette).toContain(mapped);
    }
  });

  it('quantizes multiple frames together for unified palette', () => {
    const frame1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const frame2 = new Uint8ClampedArray([0, 255, 0, 255, 255, 255, 0, 255]);

    const result = quantizePixelsToPalette([frame1, frame2], 2);
    expect(result.palette.length).toBeLessThanOrEqual(2);
    expect(result.palette.length).toBeGreaterThan(0);
  });
});

