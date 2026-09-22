import { rgbToHex, type RgbColor } from './colorUtils';

export interface QuantizedPaletteResult {
  palette: RgbColor[];
  hexPalette: string[];
  colorMap: Map<number, string>; // Maps packed RGB (r << 16 | g << 8 | b) to hex string
}

interface ColorEntry {
  r: number;
  g: number;
  b: number;
  count: number;
}

interface ColorBox {
  colors: ColorEntry[];
  rMin: number;
  rMax: number;
  gMin: number;
  gMax: number;
  bMin: number;
  bMax: number;
  totalCount: number;
  maxRange: number;
}

/**
 * Creates a ColorBox and calculates its dimensional boundaries and population.
 */
function createColorBox(colors: ColorEntry[]): ColorBox {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  let totalCount = 0;

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    if (c.r < rMin) rMin = c.r;
    if (c.r > rMax) rMax = c.r;
    if (c.g < gMin) gMin = c.g;
    if (c.g > gMax) gMax = c.g;
    if (c.b < bMin) bMin = c.b;
    if (c.b > bMax) bMax = c.b;
    totalCount += c.count;
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;
  const maxRange = Math.max(rRange, gRange, bRange);

  return {
    colors,
    rMin,
    rMax,
    gMin,
    gMax,
    bMin,
    bMax,
    totalCount,
    maxRange,
  };
}

/**
 * Splits a ColorBox along its axis of greatest range using weighted median cut.
 */
function splitColorBox(box: ColorBox): [ColorBox, ColorBox] | null {
  if (box.colors.length <= 1 || box.maxRange === 0) {
    return null;
  }

  const rRange = box.rMax - box.rMin;
  const gRange = box.gMax - box.gMin;
  const bRange = box.bMax - box.bMin;

  // Determine sort axis
  let sortFn: (a: ColorEntry, b: ColorEntry) => number;
  if (rRange >= gRange && rRange >= bRange) {
    sortFn = (a, b) => a.r - b.r;
  } else if (gRange >= rRange && gRange >= bRange) {
    sortFn = (a, b) => a.g - b.g;
  } else {
    sortFn = (a, b) => a.b - b.b;
  }

  box.colors.sort(sortFn);

  // Weighted median split
  const halfPopulation = box.totalCount / 2;
  let accumulated = 0;
  let splitIndex = 0;

  for (let i = 0; i < box.colors.length - 1; i++) {
    accumulated += box.colors[i].count;
    if (accumulated >= halfPopulation) {
      splitIndex = i + 1;
      break;
    }
  }

  if (splitIndex <= 0 || splitIndex >= box.colors.length) {
    splitIndex = Math.floor(box.colors.length / 2);
  }

  const leftColors = box.colors.slice(0, splitIndex);
  const rightColors = box.colors.slice(splitIndex);

  if (leftColors.length === 0 || rightColors.length === 0) {
    return null;
  }

  return [createColorBox(leftColors), createColorBox(rightColors)];
}

/**
 * Computes perceptual squared distance between two RGB colors (ITU-R BT.601 weights).
 */
function perceptualDistanceSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
}

/**
 * Quantizes an RGBA pixel buffer (or array of buffers) to an adaptive Top-K color palette using Median Cut.
 *
 * @param buffers - One or more RGBA pixel byte arrays (Uint8ClampedArray or Uint8Array)
 * @param maxColors - Maximum number of colors in output palette (2 to 256)
 * @param minAlpha - Alpha threshold below which pixels are treated as transparent (default: 32)
 */
export function quantizePixelsToPalette(
  buffers: (Uint8ClampedArray | Uint8Array)[] | (Uint8ClampedArray | Uint8Array),
  maxColors: number,
  minAlpha = 32
): QuantizedPaletteResult {
  const bufferList = Array.isArray(buffers) ? buffers : [buffers];
  const colorFrequency = new Map<number, ColorEntry>();

  // 1. Build color histogram
  for (let b = 0; b < bufferList.length; b++) {
    const data = bufferList[b];
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const a = data[i + 3];
      if (a < minAlpha) continue;

      const r = data[i];
      const g = data[i + 1];
      const bVal = data[i + 2];
      const key = (r << 16) | (g << 8) | bVal;

      const existing = colorFrequency.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorFrequency.set(key, { r, g, b: bVal, count: 1 });
      }
    }
  }

  const uniqueEntries = Array.from(colorFrequency.values());

  // If there are no non-transparent pixels, return empty
  if (uniqueEntries.length === 0) {
    return {
      palette: [],
      hexPalette: [],
      colorMap: new Map(),
    };
  }

  const targetK = Math.max(1, Math.min(maxColors, uniqueEntries.length));

  let palette: RgbColor[];

  // If unique colors already <= targetK, no need to quantize
  if (uniqueEntries.length <= targetK) {
    palette = uniqueEntries.map((e) => ({ r: e.r, g: e.g, b: e.b }));
  } else {
    // 2. Median Cut
    const boxes: ColorBox[] = [createColorBox(uniqueEntries)];

    while (boxes.length < targetK) {
      // Find the box with highest score to split: prioritize range * population
      let bestBoxIdx = -1;
      let highestScore = -1;

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.colors.length <= 1 || box.maxRange === 0) continue;
        const score = box.maxRange * Math.sqrt(box.totalCount);
        if (score > highestScore) {
          highestScore = score;
          bestBoxIdx = i;
        }
      }

      if (bestBoxIdx === -1) {
        // No more splittable boxes
        break;
      }

      const boxToSplit = boxes[bestBoxIdx];
      const splitRes = splitColorBox(boxToSplit);
      if (!splitRes) {
        break;
      }

      boxes.splice(bestBoxIdx, 1, splitRes[0], splitRes[1]);
    }

    // 3. Compute weighted average centroid for each box
    palette = boxes.map((box) => {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let totalW = 0;

      for (let i = 0; i < box.colors.length; i++) {
        const c = box.colors[i];
        sumR += c.r * c.count;
        sumG += c.g * c.count;
        sumB += c.b * c.count;
        totalW += c.count;
      }

      return {
        r: Math.round(sumR / (totalW || 1)),
        g: Math.round(sumG / (totalW || 1)),
        b: Math.round(sumB / (totalW || 1)),
      };
    });
  }

  // Generate hex strings
  const hexPalette = palette.map((p) => rgbToHex(p.r, p.g, p.b));

  // 4. Build fast lookup map for all unique colors to their nearest palette hex
  const colorMap = new Map<number, string>();

  for (let i = 0; i < uniqueEntries.length; i++) {
    const entry = uniqueEntries[i];
    const key = (entry.r << 16) | (entry.g << 8) | entry.b;

    let nearestHex = hexPalette[0] || '#000000';
    let minDistance = Infinity;

    for (let p = 0; p < palette.length; p++) {
      const palColor = palette[p];
      const dist = perceptualDistanceSq(entry.r, entry.g, entry.b, palColor.r, palColor.g, palColor.b);
      if (dist < minDistance) {
        minDistance = dist;
        nearestHex = hexPalette[p];
        if (dist === 0) break;
      }
    }

    colorMap.set(key, nearestHex);
  }

  return {
    palette,
    hexPalette,
    colorMap,
  };
}
