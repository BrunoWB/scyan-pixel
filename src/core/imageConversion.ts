import { BwpxGrid } from './PixelGrid';
import { rgbToHex } from './colorUtils';
import { quantizePixelsToPalette } from './colorQuantization';

export interface ContentBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageConversionOptions {
  threshold: number; // 0 - 255
  invert?: boolean;
  targetWidth?: number;
  targetHeight?: number;
  color?: string;
  colorMode?: boolean;
  maxColors?: number; // Adaptive palette max colors (e.g. 2 to 64, or 0/undefined for unlimited)
  colorMap?: Map<number, string>; // Precomputed color mapping (e.g. for multi-frame unified GIF palette)
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Converts ImageData to a BwpxGrid using perceptual luminance thresholding (ITU-R BT.601),
 * or retains RGB colors for non-transparent pixels when colorMode is true.
 */
export function convertImageDataToGrid(
  imageData: ImageData,
  options: ImageConversionOptions
): BwpxGrid {
  const { threshold, invert = false, color, colorMode = false, maxColors, colorMap } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const grid = new BwpxGrid(width, height, undefined, undefined, color || '#00e5a3');

  let activeColorMap = colorMap;
  if (colorMode && !activeColorMap && maxColors && maxColors > 0) {
    const quant = quantizePixelsToPalette(data, maxColors, 32);
    activeColorMap = quant.colorMap;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (colorMode) {
        if (a >= 32) {
          let hex: string;
          if (activeColorMap) {
            const key = (r << 16) | (g << 8) | b;
            hex = activeColorMap.get(key) || rgbToHex(r, g, b);
          } else {
            hex = rgbToHex(r, g, b);
          }
          grid.set(x, y, 1, hex);
        }
        continue;
      }

      // If pixel is transparent, consider off unless inverted
      if (a < 64) {
        if (invert) {
          grid.set(x, y, 1, color);
        }
        continue;
      }

      // Perceptual luminance calculation (ITU-R BT.601)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      let isLit = luminance >= threshold;

      if (invert) {
        isLit = !isLit;
      }

      if (isLit) {
        grid.set(x, y, 1, color);
      }
    }
  }

  return grid;
}

/**
 * Intelligent auto-snapping to content:
 * - Detects transparent pixels (alpha < 32) as background if transparency is present.
 * - For opaque images (JPEG, opaque GIF/PNG), samples corners/perimeter to detect near-white (> 235),
 *   near-black (< 25), or uniform solid background color.
 * - For multi-frame GIFs, evaluates all frames and computes the union bounding box [minX, minY, maxX, maxY].
 */
export function detectContentBoundingBox(
  frames: { width: number; height: number; rgba: Uint8ClampedArray | Uint8Array }[]
): ContentBoundingBox | null {
  if (!frames || frames.length === 0) return null;
  const w = frames[0].width;
  const h = frames[0].height;
  if (w <= 0 || h <= 0) return null;

  // 1. Check if transparency is present in any frame
  let hasTransparency = false;
  for (const frame of frames) {
    const data = frame.rgba;
    const len = frame.width * frame.height * 4;
    for (let i = 3; i < len; i += 4) {
      if (data[i] < 32) {
        hasTransparency = true;
        break;
      }
    }
    if (hasTransparency) break;
  }

  let isContent: (r: number, g: number, b: number, a: number) => boolean;

  if (hasTransparency) {
    isContent = (_r, _g, _b, a) => a >= 32;
  } else {
    // 2. Opaque images: sample corners and perimeter
    const frame0 = frames[0];
    const data0 = frame0.rgba;
    const f0W = frame0.width;
    const f0H = frame0.height;

    const cornerCoords = [
      [0, 0],
      [f0W - 1, 0],
      [0, f0H - 1],
      [f0W - 1, f0H - 1],
    ];

    const uniqueCorners = cornerCoords.filter(
      ([cx, cy], idx, arr) => arr.findIndex(([x, y]) => x === cx && y === cy) === idx
    );

    const cornerColors = uniqueCorners.map(([cx, cy]) => {
      const idx = (cy * f0W + cx) * 4;
      return {
        r: data0[idx],
        g: data0[idx + 1],
        b: data0[idx + 2],
      };
    });

    const isNearWhite = (r: number, g: number, b: number) =>
      (r > 235 && g > 235 && b > 235) || 0.299 * r + 0.587 * g + 0.114 * b > 235;

    const isNearBlack = (r: number, g: number, b: number) =>
      (r < 25 && g < 25 && b < 25) || 0.299 * r + 0.587 * g + 0.114 * b < 25;

    const nearWhiteCorners = cornerColors.filter((c) => isNearWhite(c.r, c.g, c.b)).length;
    const nearBlackCorners = cornerColors.filter((c) => isNearBlack(c.r, c.g, c.b)).length;
    const majorityThreshold = Math.ceil(cornerColors.length * 0.75);

    let perimeterNearWhite = 0;
    let perimeterNearBlack = 0;
    let perimeterTotal = 0;
    const perimeterSamples: { r: number; g: number; b: number }[] = [];

    const stepX = Math.max(1, Math.floor(f0W / 100));
    const stepY = Math.max(1, Math.floor(f0H / 100));

    for (let x = 0; x < f0W; x += stepX) {
      const yCoords = f0H > 1 ? [0, f0H - 1] : [0];
      for (const y of yCoords) {
        const idx = (y * f0W + x) * 4;
        const r = data0[idx];
        const g = data0[idx + 1];
        const b = data0[idx + 2];
        if (isNearWhite(r, g, b)) perimeterNearWhite++;
        if (isNearBlack(r, g, b)) perimeterNearBlack++;
        perimeterTotal++;
        perimeterSamples.push({ r, g, b });
      }
    }
    if (f0H > 2) {
      for (let y = stepY; y < f0H - 1; y += stepY) {
        const xCoords = f0W > 1 ? [0, f0W - 1] : [0];
        for (const x of xCoords) {
          const idx = (y * f0W + x) * 4;
          const r = data0[idx];
          const g = data0[idx + 1];
          const b = data0[idx + 2];
          if (isNearWhite(r, g, b)) perimeterNearWhite++;
          if (isNearBlack(r, g, b)) perimeterNearBlack++;
          perimeterTotal++;
          perimeterSamples.push({ r, g, b });
        }
      }
    }

    if (nearWhiteCorners >= majorityThreshold || (perimeterTotal > 0 && perimeterNearWhite / perimeterTotal >= 0.75)) {
      isContent = (r, g, b) => !isNearWhite(r, g, b);
    } else if (nearBlackCorners >= majorityThreshold || (perimeterTotal > 0 && perimeterNearBlack / perimeterTotal >= 0.75)) {
      isContent = (r, g, b) => !isNearBlack(r, g, b);
    } else {
      let matchedCornerColor: { r: number; g: number; b: number } | null = null;
      for (const ref of cornerColors) {
        const matching = cornerColors.filter(
          (c) => Math.abs(c.r - ref.r) + Math.abs(c.g - ref.g) + Math.abs(c.b - ref.b) <= 24
        ).length;
        if (matching >= majorityThreshold) {
          matchedCornerColor = ref;
          break;
        }
      }

      if (!matchedCornerColor && perimeterSamples.length > 0) {
        for (const ref of cornerColors) {
          const matchCount = perimeterSamples.filter(
            (c) => Math.abs(c.r - ref.r) + Math.abs(c.g - ref.g) + Math.abs(c.b - ref.b) <= 24
          ).length;
          if (matchCount / perimeterSamples.length >= 0.7) {
            matchedCornerColor = ref;
            break;
          }
        }
      }

      if (matchedCornerColor) {
        const bgR = matchedCornerColor.r;
        const bgG = matchedCornerColor.g;
        const bgB = matchedCornerColor.b;
        isContent = (r, g, b) => Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) > 24;
      } else {
        return { x: 0, y: 0, w, h };
      }
    }
  }

  // 3. Union bounding box across all frames
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (const frame of frames) {
    const data = frame.rgba;
    const fw = frame.width;
    const fh = frame.height;
    for (let y = 0; y < fh; y++) {
      const rowOffset = y * fw * 4;
      for (let x = 0; x < fw; x++) {
        const idx = rowOffset + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (isContent(r, g, b, a)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, w, h };
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * Draws an HTMLImageElement to an offscreen canvas with target sizing and cropping,
 * then converts to BwpxGrid.
 */
export function convertImageElementToGrid(
  img: HTMLImageElement,
  options: ImageConversionOptions
): {
  grid: BwpxGrid;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  hexPalette?: string[];
} {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  const crop = options.crop;
  const cropX = crop ? Math.max(0, Math.min(naturalW - 1, Math.round(crop.x))) : 0;
  const cropY = crop ? Math.max(0, Math.min(naturalH - 1, Math.round(crop.y))) : 0;
  const cropW = crop ? Math.max(1, Math.min(naturalW - cropX, Math.round(crop.width))) : naturalW;
  const cropH = crop ? Math.max(1, Math.min(naturalH - cropY, Math.round(crop.height))) : naturalH;

  let width = options.targetWidth || cropW;
  let height = options.targetHeight || cropH;

  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    return {
      grid: new BwpxGrid(width, height),
      width,
      height,
      originalWidth: cropW,
      originalHeight: cropH,
    };
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);

  let hexPalette: string[] | undefined;
  let activeOptions = options;
  if (options.colorMode && options.maxColors && options.maxColors > 0) {
    const quant = quantizePixelsToPalette(imgData.data, options.maxColors, 32);
    hexPalette = quant.hexPalette;
    activeOptions = {
      ...options,
      colorMap: quant.colorMap,
    };
  }

  const grid = convertImageDataToGrid(imgData, activeOptions);

  return {
    grid,
    width,
    height,
    originalWidth: cropW,
    originalHeight: cropH,
    hexPalette,
  };
}
