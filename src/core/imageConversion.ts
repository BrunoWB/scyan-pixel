import { BwpxGrid } from './PixelGrid';

export interface ImageConversionOptions {
  threshold: number; // 0 - 255
  invert?: boolean;
  targetWidth?: number;
  targetHeight?: number;
  color?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Converts ImageData to a BwpxGrid using perceptual luminance thresholding (ITU-R BT.601).
 */
export function convertImageDataToGrid(
  imageData: ImageData,
  options: ImageConversionOptions
): BwpxGrid {
  const { threshold, invert = false, color } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const grid = new BwpxGrid(width, height, undefined, undefined, color || '#00e5a3');

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

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
 * Draws an HTMLImageElement to an offscreen canvas with target sizing and cropping,
 * then converts to BwpxGrid.
 */
export function convertImageElementToGrid(
  img: HTMLImageElement,
  options: ImageConversionOptions
): { grid: BwpxGrid; width: number; height: number; originalWidth: number; originalHeight: number } {
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
  const grid = convertImageDataToGrid(imgData, options);

  return {
    grid,
    width,
    height,
    originalWidth: cropW,
    originalHeight: cropH,
  };
}
