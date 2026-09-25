import React, { forwardRef, useEffect, useRef } from 'react';
import type { SpriteSlice } from './editor/types';
import { renderOverlayCanvas, type RenderOverlayOptions } from '../core/gridRenderer';

export interface BwpxOverlayCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  zoom?: number;
  pan?: { x: number; y: number };
  hoverPos?: { x: number; y: number } | null;
  brushSize?: number;
  showBrushIndicator?: boolean;
  frameBounds?: { x: number; y: number; w: number; h: number } | null;
  ghost?: {
    pixels: ([number, number] | [number, number, string])[];
    x: number;
    y: number;
    w: number;
    h: number;
    rects?: { x: number; y: number; w: number; h: number }[];
  } | null;
  selection?: { x: number; y: number; w: number; h: number; active: boolean } | null;
  slices?: SpriteSlice[];
  selectedSliceId?: string;
  renderOverlay?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}

export { renderOverlayCanvas, type RenderOverlayOptions };

export type PixelOverlayCanvasProps = BwpxOverlayCanvasProps;

export const PixelOverlayCanvas = forwardRef<HTMLCanvasElement, PixelOverlayCanvasProps>(
  (
    {
      className = 'bwpx-overlay-canvas',
      style,
      zoom,
      pan,
      hoverPos = null,
      brushSize = 1,
      showBrushIndicator = false,
      frameBounds = null,
      ghost = null,
      selection = null,
      renderOverlay,
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLCanvasElement | null>(null);

    const setRef = (el: HTMLCanvasElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
      }
    };

    useEffect(() => {
      const canvas = internalRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (renderOverlay) {
        renderOverlay(canvas, ctx);
        return;
      }

      if (zoom !== undefined && pan !== undefined) {
        renderOverlayCanvas(canvas, ctx, {
          zoom,
          pan,
          hoverPos,
          brushSize,
          showBrushIndicator,
          frameBounds,
          ghost,
          selection,
        });
      }
    }, [
      zoom,
      pan,
      hoverPos,
      brushSize,
      showBrushIndicator,
      frameBounds,
      ghost,
      selection,
      renderOverlay,
    ]);

    return (
      <canvas
        ref={setRef}
        className={className}
        style={style}
      />
    );
  }
);

PixelOverlayCanvas.displayName = 'PixelOverlayCanvas';

export const BwpxOverlayCanvas = PixelOverlayCanvas;
