import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import type { BwpxGrid } from '../../../core/PixelGrid';
import { processWheelZoomDelta } from '../types';

export interface UseViewportOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
}

export function useViewport({
  containerRef,
  initialZoom = 10,
  initialPan = { x: 60, y: 60 },
}: UseViewportOptions) {
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [pan, setPan] = useState<{ x: number; y: number }>(initialPan);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const hasInitializedViewRef = useRef(false);
  const wheelDeltaRef = useRef<number>(0);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize viewport once on entry: 0,0 in center of top-left quadrant
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initView = () => {
      if (hasInitializedViewRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        setZoom(16);
        setPan({
          x: Math.round(w / 4),
          y: Math.round(h / 4),
        });
        hasInitializedViewRef.current = true;
      }
    };

    initView();

    const ro = new ResizeObserver(() => {
      if (!hasInitializedViewRef.current) {
        initView();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  // Cleanup wheel timeout on unmount
  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  // Fit viewport to artwork bounds or reset to top-left quadrant center
  const fitToView = useCallback(
    (grid: BwpxGrid) => {
      const container = containerRef.current;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      const bounds = grid.getBounds();
      if (bounds.width > 0 && bounds.height > 0) {
        const fitZoom = Math.max(
          2,
          Math.min(32, Math.floor(Math.min((w - 80) / bounds.width, (h - 80) / bounds.height)))
        );
        setZoom(fitZoom);
        const centerX = bounds.minX + bounds.width / 2;
        const centerY = bounds.minY + bounds.height / 2;
        setPan({
          x: Math.round(w / 2 - centerX * fitZoom),
          y: Math.round(h / 2 - centerY * fitZoom),
        });
      } else {
        setZoom(16);
        setPan({
          x: Math.round(w / 4),
          y: Math.round(h / 4),
        });
      }
    },
    [containerRef]
  );

  // Screen to Grid coordinate mapping
  const getGridCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      return {
        x: Math.floor((mouseX - pan.x) / zoom),
        y: Math.floor((mouseY - pan.y) / zoom),
      };
    },
    [containerRef, pan, zoom]
  );

  // Wheel Zoom handler with accumulator
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.deltaY === 0) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      wheelTimeoutRef.current = setTimeout(() => {
        wheelDeltaRef.current = 0;
        wheelTimeoutRef.current = null;
      }, 250);

      const { nextAccumulator, step } = processWheelZoomDelta(
        wheelDeltaRef.current,
        e.deltaY,
        e.deltaMode
      );
      wheelDeltaRef.current = nextAccumulator;

      if (step === 0) return;

      const newZoom = Math.max(1, Math.min(48, zoom + step * (zoom >= 16 ? 2 : 1)));

      if (newZoom !== zoom) {
        const scaleFactor = newZoom / zoom;
        setPan({
          x: Math.round(mouseX - (mouseX - pan.x) * scaleFactor),
          y: Math.round(mouseY - (mouseY - pan.y) * scaleFactor),
        });
        setZoom(newZoom);
      }
    },
    [containerRef, pan, zoom]
  );

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isSpaceHeld,
    setIsSpaceHeld,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    fitToView,
    getGridCoords,
    handleWheel,
  };
}

