/**
 * Core color conversion and math utilities for Scyan Pixel Editor
 */

export interface HsvColor {
  h: number; // 0 - 360
  s: number; // 0 - 100
  v: number; // 0 - 100
}

export interface RgbColor {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

/**
 * Convert HSV (H: 0-360, S: 0-100, V: 0-100) to RGB (0-255)
 */
export function hsvToRgb(h: number, s: number, v: number): RgbColor {
  const normH = ((h % 360) + 360) % 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normV = Math.max(0, Math.min(100, v)) / 100;

  const c = normV * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normV - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (normH >= 0 && normH < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (normH >= 60 && normH < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (normH >= 120 && normH < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (normH >= 180 && normH < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (normH >= 240 && normH < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Convert RGB (0-255) to HSV (H: 0-360, S: 0-100, V: 0-100)
 */
export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const normR = Math.max(0, Math.min(255, r)) / 255;
  const normG = Math.max(0, Math.min(255, g)) / 255;
  const normB = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0);
        break;
      case normG:
        h = (normB - normR) / d + 2;
        break;
      case normB:
        h = (normR - normG) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Convert RGB (0-255) to 6-character Hex string (e.g. #00e5a3)
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parse a Hex color (#RGB or #RRGGBB) to RGB
 */
export function hexToRgb(hex: string): RgbColor | null {
  if (!hex) return null;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Convert HSV directly to Hex
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert Hex directly to HSV
 */
export function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return { h: 0, s: 0, v: 100 };
  }
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

/**
 * Compute high-contrast text color (black or white) for a background hex
 */
export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  // YIQ luminance formula
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

/**
 * Converts pointer (dx, dy) relative to center into Hue angle (0-359).
 */
export function coordsToHueAngle(dx: number, dy: number): number {
  const angleRad = Math.atan2(dx, -dy);
  let deg = Math.round((angleRad * 180) / Math.PI);
  if (deg < 0) deg += 360;
  return deg % 360;
}

/**
 * Converts pointer (dx, dy) relative to center into (S, V) via local triangle space.
 * Uses barycentric projection to the color simplex.
 */
export function coordsToSvSimplex(
  dx: number,
  dy: number,
  hue: number,
  scale: number
): { s: number; v: number } {
  const rotDeg = hue - 180;
  const rotRad = (-rotDeg * Math.PI) / 180;

  // Unscale and unrotate to local triangle space
  const unscaledX = dx / scale;
  const unscaledY = dy / scale;

  const lx = unscaledX * Math.cos(rotRad) - unscaledY * Math.sin(rotRad);
  const ly = unscaledX * Math.sin(rotRad) + unscaledY * Math.cos(rotRad);

  // Fixed local triangle vertices: A=(0, 37) [Hue], B=(-32, -18.5) [White], C=(32, -18.5) [Black]
  const v0x = -32;
  const v0y = -55.5;
  const v1x = 32;
  const v1y = -55.5;
  const v2x = lx;
  const v2y = ly - 37;

  const d00 = v0x * v0x + v0y * v0y; // 4104.25
  const d01 = v0x * v1x + v0y * v1y; // 2056.25
  const d11 = v1x * v1x + v1y * v1y; // 4104.25
  const d20 = v2x * v0x + v2y * v0y;
  const d21 = v2x * v1x + v2y * v1y;

  const denom = d00 * d11 - d01 * d01;
  let ww = (d11 * d20 - d01 * d21) / denom;
  let wb = (d00 * d21 - d01 * d20) / denom;
  let wh = 1 - ww - wb;

  // Boundary projection to simplex
  const whClamp = Math.max(0, wh);
  const wwClamp = Math.max(0, ww);
  const wbClamp = Math.max(0, wb);
  const sum = whClamp + wwClamp + wbClamp;
  if (sum > 0) {
    wh = whClamp / sum;
    ww = wwClamp / sum;
    wb = wbClamp / sum;
  }

  const vNorm = Math.max(0, Math.min(1, 1 - wb));
  const sNorm = vNorm > 0.001 ? Math.max(0, Math.min(1, wh / vNorm)) : 0;

  return {
    s: Math.round(sNorm * 100),
    v: Math.round(vNorm * 100),
  };
}

/**
 * Calculates reticle local (x, y) coordinate inside the canonical SV triangle.
 */
export function svToTriangleLocalCoords(s: number, v: number): { x: number; y: number } {
  const S = Math.max(0, Math.min(100, s)) / 100;
  const V = Math.max(0, Math.min(100, v)) / 100;
  const wb = 1 - V;
  const wh = S * V;
  const ww = V * (1 - S);
  return {
    x: 32 * (wb - ww),
    y: 37 * wh - 18.5 * (1 - wh),
  };
}

