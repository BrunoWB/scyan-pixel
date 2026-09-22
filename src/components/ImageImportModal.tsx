import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BwpxGrid } from '../core/PixelGrid';
import { convertImageElementToGrid } from '../core/imageConversion';
import { renderBaseCanvas } from '../core/gridRenderer';
import {
  isGifBuffer,
  decodeGif,
  convertGifFramesToGrids,
  type DecodedGif,
} from '../core/gifDecoder';
import {
  X,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  Link2,
  Unlink2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Film,
  Upload,
} from 'lucide-react';
import './ImageImportModal.css';

export interface ImageImportModalProps {
  isOpen: boolean;
  imageSource: File | Blob | string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  pixelColor?: string;
  bgColor?: string;
  onClose: () => void;
  onConfirm: (
    grid: BwpxGrid,
    width: number,
    height: number,
    gifData?: {
      frames: { grid: BwpxGrid; delayMs: number }[];
      name?: string;
    }
  ) => void;
  onSelectSource?: (source: File | Blob | string) => void;
}

type ScalePreset = 'original' | 'fit-canvas' | 'fit-16' | 'fit-32' | 'fit-64' | 'fit-128' | 'custom';

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  isOpen,
  imageSource,
  canvasWidth = 64,
  canvasHeight = 64,
  pixelColor = '#00e5a3',
  bgColor = '#0f1013',
  onClose,
  onConfirm,
  onSelectSource,
}) => {
  const [internalSource, setInternalSource] = useState<File | Blob | string | null>(imageSource);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSource = internalSource ?? imageSource;

  const handleSelectFile = useCallback(
    (file: File) => {
      setInternalSource(file);
      onSelectSource?.(file);
    },
    [onSelectSource]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setInternalSource(imageSource);
    }, 0);
    return () => clearTimeout(timer);
  }, [imageSource]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setInternalSource(null);
        setIsDragOver(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [threshold, setThreshold] = useState<number>(128);
  const [invert, setInvert] = useState<boolean>(false);
  const [scalePreset, setScalePreset] = useState<ScalePreset>('fit-canvas');
  const [customWidth, setCustomWidth] = useState<number>(canvasWidth);
  const [customHeight, setCustomHeight] = useState<number>(canvasHeight);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // GIF animation states
  const [decodedGif, setDecodedGif] = useState<DecodedGif | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [imageFileName, setImageFileName] = useState<string>('');

  // Crop rectangle state (in original image coordinates)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageSrcRef = useRef<string | null>(null);

  // Load image or GIF element from source
  useEffect(() => {
    if (!isOpen || !activeSource) {
      const timer = setTimeout(() => {
        setImgElement(null);
        setDecodedGif(null);
        setImageFileName('');
        setCropRect(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const loadSource = async () => {
      let fileName = 'Artwork';
      let buffer: ArrayBuffer | null = null;
      let src = '';

      if (activeSource instanceof File) {
        fileName = activeSource.name.replace(/\.[^/.]+$/, '');
        setImageFileName(fileName);
        try {
          const slice = await activeSource.slice(0, 6).arrayBuffer();
          if (isGifBuffer(slice)) {
            buffer = await activeSource.arrayBuffer();
          }
        } catch (e) {
          console.warn('Failed to inspect magic bytes for GIF, proceeding with standard image loader:', e);
        }
        src = URL.createObjectURL(activeSource);
        createdUrl = src;
      } else if (activeSource instanceof Blob) {
        setImageFileName('Animation');
        try {
          const slice = await activeSource.slice(0, 6).arrayBuffer();
          if (isGifBuffer(slice)) {
            buffer = await activeSource.arrayBuffer();
          }
        } catch (e) {
          console.warn('Error reading blob buffer:', e);
        }
        src = URL.createObjectURL(activeSource);
        createdUrl = src;
      } else if (typeof activeSource === 'string') {
        src = activeSource;
        setImageFileName('Imported Image');
        if (activeSource.startsWith('data:image/gif') || activeSource.toLowerCase().includes('.gif')) {
          try {
            const res = await fetch(activeSource);
            const ab = await res.arrayBuffer();
            if (isGifBuffer(ab)) {
              buffer = ab;
            }
          } catch (e) {
            console.warn('Error fetching gif url buffer:', e);
          }
        }
      }

      if (!isMounted) {
        if (createdUrl) URL.revokeObjectURL(createdUrl);
        return;
      }

      imageSrcRef.current = src;

      // Recognized as valid GIF
      if (buffer) {
        try {
          const decoded = decodeGif(buffer);
          if (decoded.frames.length > 0) {
            setDecodedGif(decoded);
            setImgElement(null);
            setOriginalDimensions({ w: decoded.width, h: decoded.height });
            setCropRect({ x: 0, y: 0, w: decoded.width, h: decoded.height });
            setCustomWidth(canvasWidth);
            setCustomHeight(canvasHeight);
            setScalePreset('fit-canvas');
            setCurrentFrameIndex(0);
            setIsPlaying(true);
            return;
          }
        } catch (e) {
          console.warn('Failed to decode GIF, falling back to standard image loader:', e);
        }
      }

      // Non-GIF image fallback
      setDecodedGif(null);
      const img = new Image();
      if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (!isMounted) return;
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        setOriginalDimensions({ w: origW, h: origH });
        setCropRect({ x: 0, y: 0, w: origW, h: origH });
        setCustomWidth(canvasWidth);
        setCustomHeight(canvasHeight);
        setScalePreset('fit-canvas');
        setImgElement(img);
      };
      img.onerror = (e) => {
        console.error('Failed to load image source:', e);
      };
      img.src = src;
    };

    loadSource();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, activeSource, canvasWidth, canvasHeight]);

  // Calculate target dimensions based on preset and custom values
  const computeTargetSize = useCallback(
    (origW: number, origH: number, preset: ScalePreset, cW: number, cH: number) => {
      if (origW === 0 || origH === 0) return { w: 0, h: 0 };

      if (preset === 'custom') {
        return {
          w: Math.max(1, Math.min(2048, Math.round(cW || origW))),
          h: Math.max(1, Math.min(2048, Math.round(cH || origH))),
        };
      }

      if (preset === 'fit-canvas') {
        const scale = Math.min(canvasWidth / origW, canvasHeight / origH);
        return {
          w: Math.max(1, Math.round(origW * scale)),
          h: Math.max(1, Math.round(origH * scale)),
        };
      }

      let targetMax = origH;
      if (preset === 'fit-16') targetMax = 16;
      else if (preset === 'fit-32') targetMax = 32;
      else if (preset === 'fit-64') targetMax = 64;
      else if (preset === 'fit-128') targetMax = 128;
      else if (preset === 'original') return { w: origW, h: origH };

      const scale = targetMax / Math.max(origW, origH);
      return {
        w: Math.max(1, Math.round(origW * scale)),
        h: Math.max(1, Math.round(origH * scale)),
      };
    },
    [canvasWidth, canvasHeight]
  );

  // Synchronously compute target dimensions
  const baseW = cropRect ? cropRect.w : originalDimensions.w;
  const baseH = cropRect ? cropRect.h : originalDimensions.h;
  const targetDimensions = useMemo(
    () => computeTargetSize(baseW, baseH, scalePreset, customWidth, customHeight),
    [baseW, baseH, scalePreset, customWidth, customHeight, computeTargetSize]
  );

  // Derive converted GIF frames
  const gifFrames = useMemo(() => {
    if (!isOpen || !decodedGif || decodedGif.frames.length === 0) return [];
    return convertGifFramesToGrids(decodedGif, {
      threshold,
      invert,
      targetWidth: targetDimensions.w,
      targetHeight: targetDimensions.h,
      color: pixelColor,
      crop: cropRect ? { x: cropRect.x, y: cropRect.y, width: cropRect.w, height: cropRect.h } : undefined,
    });
  }, [isOpen, decodedGif, threshold, invert, targetDimensions.w, targetDimensions.h, pixelColor, cropRect]);

  // Derive converted static image grid
  const convertedGrid = useMemo(() => {
    if (!isOpen || decodedGif || !imgElement || targetDimensions.w <= 0 || targetDimensions.h <= 0) {
      return null;
    }
    const { grid } = convertImageElementToGrid(imgElement, {
      threshold,
      invert,
      targetWidth: targetDimensions.w,
      targetHeight: targetDimensions.h,
      color: pixelColor,
      crop: cropRect ? { x: cropRect.x, y: cropRect.y, width: cropRect.w, height: cropRect.h } : undefined,
    });
    return grid;
  }, [isOpen, decodedGif, imgElement, threshold, invert, targetDimensions.w, targetDimensions.h, pixelColor, cropRect]);

  // Active grid to preview and confirm
  const currentGrid = useMemo(() => {
    if (decodedGif && gifFrames.length > 0) {
      const idx = Math.min(currentFrameIndex, gifFrames.length - 1);
      return gifFrames[idx]?.grid || null;
    }
    return convertedGrid;
  }, [decodedGif, gifFrames, currentFrameIndex, convertedGrid]);

  // GIF playback loop
  useEffect(() => {
    if (!decodedGif || !isPlaying || gifFrames.length <= 1) return;

    const currentFrame = decodedGif.frames[currentFrameIndex];
    const delay = currentFrame ? currentFrame.delayMs : 100;

    const timer = setTimeout(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % gifFrames.length);
    }, delay);

    return () => clearTimeout(timer);
  }, [decodedGif, isPlaying, gifFrames.length, currentFrameIndex]);

  // Render monochrome preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = previewContainerRef.current;
    const containerW = container?.clientWidth || 320;
    const containerH = container?.clientHeight || 220;
    canvas.width = containerW;
    canvas.height = containerH;

    if (!currentGrid) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, containerW, containerH);
      return;
    }

    const fitZoom = Math.max(
      1,
      Math.min(
        16,
        Math.floor(
          Math.min(
            (containerW - 32) / Math.max(1, currentGrid.width),
            (containerH - 32) / Math.max(1, currentGrid.height)
          )
        )
      )
    );
    const pan = {
      x: Math.round((containerW - currentGrid.width * fitZoom) / 2),
      y: Math.round((containerH - currentGrid.height * fitZoom) / 2),
    };

    renderBaseCanvas(canvas, ctx, {
      grid: currentGrid,
      zoom: fitZoom,
      pan,
      pixelColor,
      bgColor,
      monochrome: true,
      showGridLines: fitZoom >= 4,
      showAxes: false,
      frameBounds: { x: 0, y: 0, w: currentGrid.width, h: currentGrid.height },
    });
  }, [currentGrid, pixelColor, bgColor]);

  // Render reference canvas for animated GIF preview
  useEffect(() => {
    if (!decodedGif || decodedGif.frames.length === 0) return;
    const canvas = refCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = decodedGif.width;
    canvas.height = decodedGif.height;

    const frame = decodedGif.frames[currentFrameIndex];
    if (frame) {
      const imgData =
        typeof ImageData !== 'undefined'
          ? new ImageData(frame.rgba as any, frame.width, frame.height)
          : ({ data: frame.rgba, width: frame.width, height: frame.height } as ImageData);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [decodedGif, currentFrameIndex]);

  if (!isOpen) return null;

  return (
    <div className="image-import-backdrop" onClick={onClose}>
      <div className="image-import-card" onClick={(e) => e.stopPropagation()}>
        <div className="image-import-header">
          <h3 className="image-import-title">
            <Sparkles size={16} />
            <span>IMPORT IMAGE / GIF</span>
            {decodedGif && (
              <span className="image-import-gif-badge">
                <Film size={11} /> {decodedGif.frames.length} FRAMES
              </span>
            )}
          </h3>
          <button className="image-import-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="image-import-body">
          <div className="image-import-previews">
            {/* Left: Original / Source Image */}
            <div className="image-import-panel">
              <div className="image-import-panel-header">
                <span>Source Image</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(imgElement || decodedGif) && (
                    <button
                      type="button"
                      className="image-import-change-btn"
                      onClick={() => {
                        if (modalFileInputRef.current) {
                          modalFileInputRef.current.value = '';
                          modalFileInputRef.current.click();
                        }
                      }}
                    >
                      Change
                    </button>
                  )}
                  <strong>
                    {originalDimensions.w}×{originalDimensions.h}px
                  </strong>
                </div>
              </div>
              <div className="image-import-original-view">
                {decodedGif ? (
                  <canvas ref={refCanvasRef} className="image-import-original-canvas" />
                ) : imgElement ? (
                  <img src={imgElement.src} alt="Original source" className="image-import-original-img" />
                ) : (
                  <div
                    className={`image-import-dropzone ${isDragOver ? 'image-import-dropzone-dragover' : ''}`}
                    onClick={() => {
                      if (modalFileInputRef.current) {
                        modalFileInputRef.current.value = '';
                        modalFileInputRef.current.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && (file.type.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name))) {
                        handleSelectFile(file);
                      }
                    }}
                  >
                    <Upload size={22} style={{ color: '#94a3b8', marginBottom: '6px' }} />
                    <span className="text-xs text-slate-300 font-mono">Choose Image or GIF</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">or drag & drop here</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: 1bpp Monochrome Preview */}
            <div className="image-import-panel">
              <div className="image-import-panel-header">
                <span>1bpp Monochrome Result</span>
                <strong>
                  {targetDimensions.w}×{targetDimensions.h}px
                </strong>
              </div>
              <div className="image-import-grid-view" ref={previewContainerRef}>
                <canvas ref={canvasRef} className="image-import-grid-canvas" />
              </div>
            </div>
          </div>

          {/* GIF Playback Bar */}
          {decodedGif && decodedGif.frames.length > 1 && (
            <div className="image-import-playback-bar">
              <button
                className="image-import-play-btn"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                className="image-import-step-btn"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIndex((prev) => (prev > 0 ? prev - 1 : decodedGif.frames.length - 1));
                }}
                title="Previous Frame"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="image-import-step-btn"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIndex((prev) => (prev + 1) % decodedGif.frames.length);
                }}
                title="Next Frame"
              >
                <ChevronRight size={14} />
              </button>

              <div className="image-import-frame-counter">
                Frame <strong>{currentFrameIndex + 1}</strong> / {decodedGif.frames.length}
              </div>

              <div className="image-import-scrubber-container">
                <input
                  type="range"
                  min={0}
                  max={decodedGif.frames.length - 1}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentFrameIndex(parseInt(e.target.value, 10));
                  }}
                  className="image-import-scrubber"
                />
              </div>

              <div className="image-import-speed-badge">
                {decodedGif.frames[currentFrameIndex]?.delayMs || 100}ms
              </div>
            </div>
          )}

          {/* Controls Section */}
          <div className="image-import-controls">
            {/* Threshold Slider */}
            <div className="image-import-control-row">
              <div className="image-import-control-label">
                <SlidersHorizontal size={13} />
                <span>Threshold</span>
              </div>
              <div className="image-import-slider-container">
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="image-import-slider"
                />
                <span className="image-import-slider-val">{threshold}</span>
              </div>
            </div>

            {/* Options Row */}
            <div className="image-import-options-row">
              <button
                className={`image-import-toggle-btn ${invert ? 'active' : ''}`}
                onClick={() => setInvert(!invert)}
              >
                <RefreshCw size={13} />
                <span>Invert Lit/Dark</span>
              </button>

              <select
                value={scalePreset}
                onChange={(e) => setScalePreset(e.target.value as ScalePreset)}
                className="image-import-select"
              >
                <option value="fit-canvas">Fit Canvas ({canvasWidth}×{canvasHeight})</option>
                <option value="original">Original Size ({originalDimensions.w}×{originalDimensions.h})</option>
                <option value="fit-16">Fit 16×16 (Icon)</option>
                <option value="fit-32">Fit 32×32 (Badge)</option>
                <option value="fit-64">Fit 64×64 (Sprite)</option>
                <option value="fit-128">Fit 128×128 (Large)</option>
                <option value="custom">Custom Size...</option>
              </select>

              {scalePreset === 'custom' && (
                <div className="image-import-dimension-inputs">
                  <span className="image-import-dim-label">W:</span>
                  <input
                    type="number"
                    min="1"
                    max="1024"
                    value={customWidth}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setCustomWidth(val);
                      if (lockAspectRatio && originalDimensions.w > 0) {
                        setCustomHeight(Math.max(1, Math.round((val / originalDimensions.w) * originalDimensions.h)));
                      }
                    }}
                    className="image-import-num-input"
                  />
                  <span className="image-import-dim-label">H:</span>
                  <input
                    type="number"
                    min="1"
                    max="1024"
                    value={customHeight}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setCustomHeight(val);
                      if (lockAspectRatio && originalDimensions.h > 0) {
                        setCustomWidth(Math.max(1, Math.round((val / originalDimensions.h) * originalDimensions.w)));
                      }
                    }}
                    className="image-import-num-input"
                  />
                  <button
                    className={`image-import-aspect-btn ${lockAspectRatio ? 'active' : ''}`}
                    onClick={() => setLockAspectRatio(!lockAspectRatio)}
                    title={lockAspectRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
                  >
                    {lockAspectRatio ? <Link2 size={13} /> : <Unlink2 size={13} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="image-import-footer">
          <span className="image-import-hint">
            {decodedGif && gifFrames.length > 1
              ? `Click Confirm to import all ${gifFrames.length} frames as a spritesheet`
              : 'Threshold converts image brightness to 1bpp pixels'}
          </span>
          <div className="image-import-actions">
            <button className="image-import-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className={`image-import-btn-confirm ${!currentGrid ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={!currentGrid}
              onClick={() => {
                if (currentGrid) {
                  onConfirm(
                    currentGrid,
                    targetDimensions.w,
                    targetDimensions.h,
                    decodedGif && gifFrames.length > 0
                      ? {
                          frames: gifFrames.map((f) => ({ grid: f.grid, delayMs: f.delayMs })),
                          name: imageFileName,
                        }
                      : undefined
                  );
                  onClose();
                }
              }}
            >
              Confirm Import
            </button>
          </div>
        </div>

        {/* Hidden File Input for Image Selection inside modal */}
        <input
          ref={modalFileInputRef}
          type="file"
          accept=".png,.bmp,.jpg,.jpeg,.webp,.gif,image/png,image/bmp,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleSelectFile(file);
            }
          }}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
