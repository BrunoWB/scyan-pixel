import { GifReader } from 'omggif';
import { BwpxGrid } from './PixelGrid';
import { convertImageDataToGrid, type ImageConversionOptions } from './imageConversion';

export interface DecodedGifFrame {
  index: number;
  delayMs: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export interface DecodedGif {
  width: number;
  height: number;
  frames: DecodedGifFrame[];
  durationMs: number;
}

export interface ConvertedGifFrame {
  index: number;
  delayMs: number;
  grid: BwpxGrid;
}

/**
 * Checks if the buffer starts with GIF87a or GIF89a magic signature.
 */
export function isGifBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 6) return false;
  return (
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 or 9
    bytes[5] === 0x61 // a
  );
}

/**
 * Fast nearest-neighbor scaler for RGBA buffers preserving pixel boundaries.
 */
export function scaleRgbaNearestNeighbor(
  srcData: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  if (srcW === dstW && srcH === dstH) {
    return new Uint8ClampedArray(srcData);
  }

  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y * yRatio));
    const srcRowOffset = srcY * srcW * 4;
    const dstRowOffset = y * dstW * 4;

    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x * xRatio));
      const srcIdx = srcRowOffset + srcX * 4;
      const dstIdx = dstRowOffset + x * 4;

      dst[dstIdx] = srcData[srcIdx];
      dst[dstIdx + 1] = srcData[srcIdx + 1];
      dst[dstIdx + 2] = srcData[srcIdx + 2];
      dst[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return dst;
}

/**
 * Decodes an animated or static GIF buffer into an array of fully composited RGBA frames.
 */
export function decodeGif(buffer: ArrayBuffer | Uint8Array): DecodedGif {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const reader = new GifReader(bytes);

  const width = reader.width;
  const height = reader.height;
  const numFrames = reader.numFrames();
  const frames: DecodedGifFrame[] = [];

  const canvasRgba = new Uint8ClampedArray(width * height * 4);
  let previousCanvasCopy: Uint8ClampedArray | null = null;
  let totalDurationMs = 0;

  for (let i = 0; i < numFrames; i++) {
    const info = reader.frameInfo(i);

    if (info.disposal === 3) {
      previousCanvasCopy = new Uint8ClampedArray(canvasRgba);
    }

    reader.decodeAndBlitFrameRGBA(i, canvasRgba);

    const delayHundredths = info.delay !== null && info.delay !== undefined && info.delay > 1 ? info.delay : 10;
    const delayMs = Math.max(20, delayHundredths * 10);
    totalDurationMs += delayMs;

    frames.push({
      index: i,
      delayMs,
      width,
      height,
      rgba: new Uint8ClampedArray(canvasRgba),
    });

    if (info.disposal === 2) {
      const fx = Math.max(0, info.x);
      const fy = Math.max(0, info.y);
      const fw = Math.min(width - fx, info.width);
      const fh = Math.min(height - fy, info.height);

      for (let r = 0; r < fh; r++) {
        const rowStart = ((fy + r) * width + fx) * 4;
        canvasRgba.fill(0, rowStart, rowStart + fw * 4);
      }
    } else if (info.disposal === 3 && previousCanvasCopy) {
      canvasRgba.set(previousCanvasCopy);
    }
  }

  return {
    width,
    height,
    frames,
    durationMs: totalDurationMs,
  };
}

/**
 * Nearest-neighbor scaler with sub-rectangle cropping for RGBA buffers.
 */
export function cropAndScaleRgbaNearestNeighbor(
  srcData: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  const safeCropX = Math.max(0, Math.min(srcW - 1, Math.round(cropX)));
  const safeCropY = Math.max(0, Math.min(srcH - 1, Math.round(cropY)));
  const safeCropW = Math.max(1, Math.min(srcW - safeCropX, Math.round(cropW)));
  const safeCropH = Math.max(1, Math.min(srcH - safeCropY, Math.round(cropH)));

  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = safeCropW / dstW;
  const yRatio = safeCropH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = safeCropY + Math.min(safeCropH - 1, Math.floor(y * yRatio));
    const srcRowOffset = srcY * srcW * 4;
    const dstRowOffset = y * dstW * 4;

    for (let x = 0; x < dstW; x++) {
      const srcX = safeCropX + Math.min(safeCropW - 1, Math.floor(x * xRatio));
      const srcIdx = srcRowOffset + srcX * 4;
      const dstIdx = dstRowOffset + x * 4;

      dst[dstIdx] = srcData[srcIdx];
      dst[dstIdx + 1] = srcData[srcIdx + 1];
      dst[dstIdx + 2] = srcData[srcIdx + 2];
      dst[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return dst;
}

/**
 * Converts decoded GIF frames to 1bpp BwpxGrids with target scaling, thresholding, cropping, and inversion.
 */
export function convertGifFramesToGrids(
  decodedGif: DecodedGif,
  options: ImageConversionOptions
): ConvertedGifFrame[] {
  const crop = options.crop;
  const baseW = crop ? crop.width : decodedGif.width;
  const baseH = crop ? crop.height : decodedGif.height;

  const targetW = Math.max(1, Math.round(options.targetWidth || baseW));
  const targetH = Math.max(1, Math.round(options.targetHeight || baseH));

  return decodedGif.frames.map((frame) => {
    let scaledRgba: Uint8ClampedArray;
    if (crop) {
      scaledRgba = cropAndScaleRgbaNearestNeighbor(
        frame.rgba,
        frame.width,
        frame.height,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        targetW,
        targetH
      );
    } else if (targetW === frame.width && targetH === frame.height) {
      scaledRgba = frame.rgba;
    } else {
      scaledRgba = scaleRgbaNearestNeighbor(frame.rgba, frame.width, frame.height, targetW, targetH);
    }

    const imgData =
      typeof ImageData !== 'undefined'
        ? new ImageData(scaledRgba as any, targetW, targetH)
        : ({
            data: scaledRgba,
            width: targetW,
            height: targetH,
            colorSpace: 'srgb',
          } as ImageData);

    const grid = convertImageDataToGrid(imgData, {
      threshold: options.threshold,
      invert: options.invert,
      targetWidth: targetW,
      targetHeight: targetH,
      color: options.color,
    });

    return {
      index: frame.index,
      delayMs: frame.delayMs,
      grid,
    };
  });
}
