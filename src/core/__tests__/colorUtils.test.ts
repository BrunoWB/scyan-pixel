import { describe, it, expect } from 'vitest';
import {
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToRgb,
  hexToHsv,
  hsvToHex,
  getContrastColor,
  coordsToHueAngle,
  coordsToSvSimplex,
  svToTriangleLocalCoords,
} from '../colorUtils';

describe('colorUtils', () => {
  describe('conversions', () => {
    it('converts RGB to HEX and back', () => {
      expect(rgbToHex(255, 0, 128)).toBe('#ff0080');
      expect(hexToRgb('#ff0080')).toEqual({ r: 255, g: 0, b: 128 });
      expect(hexToRgb('#f08')).toEqual({ r: 255, g: 0, b: 136 });
      expect(hexToRgb('invalid')).toBeNull();
      expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 });
    });

    it('converts HSV to RGB correctly', () => {
      expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 }); // Red
      expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 }); // Green
      expect(hsvToRgb(240, 100, 100)).toEqual({ r: 0, g: 0, b: 255 }); // Blue
      expect(hsvToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 }); // Black
      expect(hsvToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 }); // White
    });

    it('round trips HSV -> HEX -> HSV', () => {
      const hex = hsvToHex(180, 80, 90);
      const hsv = hexToHsv(hex);
      expect(Math.abs(hsv.h - 180)).toBeLessThanOrEqual(1);
      expect(Math.abs(hsv.s - 80)).toBeLessThanOrEqual(2);
      expect(Math.abs(hsv.v - 90)).toBeLessThanOrEqual(2);
    });

    it('computes high contrast text colors', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#ffffff')).toBe('#000000');
      expect(getContrastColor('#00e5a3')).toBe('#000000');
      expect(getContrastColor('#131722')).toBe('#ffffff');
    });
  });

  describe('geometric triangle & wheel math', () => {
    it('converts relative coordinates to hue angle correctly', () => {
      // (dx=0, dy=-10) is 12 o'clock -> 0 deg
      expect(coordsToHueAngle(0, -10)).toBe(0);
      // (dx=10, dy=0) is 3 o'clock -> 90 deg
      expect(coordsToHueAngle(10, 0)).toBe(90);
      // (dx=0, dy=10) is 6 o'clock -> 180 deg
      expect(coordsToHueAngle(0, 10)).toBe(180);
      // (dx=-10, dy=0) is 9 o'clock -> 270 deg
      expect(coordsToHueAngle(-10, 0)).toBe(270);
    });

    it('computes reticle position at triangle extremes', () => {
      // Pure Hue: S=100, V=100 -> top vertex A (0, 37)
      const pureHue = svToTriangleLocalCoords(100, 100);
      expect(Math.round(pureHue.x)).toBe(0);
      expect(Math.round(pureHue.y)).toBe(37);

      // Pure White: S=0, V=100 -> vertex B (-32, -18.5)
      const pureWhite = svToTriangleLocalCoords(0, 100);
      expect(pureWhite.x).toBeCloseTo(-32);
      expect(pureWhite.y).toBeCloseTo(-18.5);

      // Pure Black: S=0, V=0 -> vertex C (32, -18.5)
      const pureBlack = svToTriangleLocalCoords(0, 0);
      expect(pureBlack.x).toBeCloseTo(32);
      expect(pureBlack.y).toBeCloseTo(-18.5);
    });

    it('projects coordinates to simplex without exceeding bounds', () => {
      const scale = 64 / 37;
      // Far outside
      const res = coordsToSvSimplex(1000, 1000, 180, scale);
      expect(res.s).toBeGreaterThanOrEqual(0);
      expect(res.s).toBeLessThanOrEqual(100);
      expect(res.v).toBeGreaterThanOrEqual(0);
      expect(res.v).toBeLessThanOrEqual(100);
    });
  });
});
