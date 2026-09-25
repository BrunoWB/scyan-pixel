import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PixelGrid, PixelGrid as BwpxGrid, unpackCoord } from '../core/PixelGrid';
import {
  drawLine,
  floodFill,
  drawBrushDot,
  calculateShapeEndpoints,
  drawShape,
  isShapeTool,
} from '../core/algorithms';
import {
  renderBaseCanvas,
  renderOverlayCanvas,
  type GhostOverlay,
  type SelectionOverlay,
} from '../core/gridRenderer';
import { ImageImportModal } from './ImageImportModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import type { RecentPaletteHandle } from './RecentPalette';
import { getContrastColor } from '../core/colorUtils';
import { calculateCompactTableLayout } from '../core/gifDecoder';

import {
  type ToolType,
  type ThemePreset,
  type BwpxEditorProps,
  type PixelEditorProps,
  type SpriteSlice,
  type EditorViewport,
  type PixelEditorHandle,
  THEME_PRESETS,
  DEFAULT_PALETTE,
  ZOOM_STEPS,
  WHEEL_ZOOM_THRESHOLD,
  processWheelZoomDelta,
  calculateFitViewport,
  calculateZoomAtPoint,
} from './editor/types';
import { useEditorHistory, type HistoryEntry } from './editor/hooks/useEditorHistory';
import { useViewport } from './editor/hooks/useViewport';
import { useSelectionManager } from './editor/hooks/useSelectionManager';
import { EditorHeader } from './editor/ui/EditorHeader';
import { EditorToolbar } from './editor/ui/EditorToolbar';
import { EditorCanvas } from './editor/ui/EditorCanvas';
import { EditorStatusBar } from './editor/ui/EditorStatusBar';
import { ExportModal } from './editor/ui/ExportModal';
import {
  diffGridPixels,
  applyPixelDeltas,
  getBrushDotPixels,
  getLinePixels,
  PixelTimestampTracker,
  reconcileGridSnapshots,
  type CanvasMutationMessage,
  type CanvasSnapshotMessage,
} from '../core/canvasSync';
import type { RoomSnapshotData } from './editor/types';

// Re-export public API symbols for complete backwards compatibility
export type { ToolType, ThemePreset, BwpxEditorProps, PixelEditorProps, SpriteSlice, EditorViewport, HistoryEntry, PixelEditorHandle };
// oxlint-disable-next-line react/only-export-components
export { THEME_PRESETS, DEFAULT_PALETTE, ZOOM_STEPS, WHEEL_ZOOM_THRESHOLD, processWheelZoomDelta, calculateFitViewport, calculateZoomAtPoint, getContrastColor };

const EMPTY_SLICES: SpriteSlice[] = [];
const EMPTY_SLICE_IDS: string[] = [];

export const PixelEditor = forwardRef<PixelEditorHandle, PixelEditorProps>(function PixelEditor(
  {
    initialWidth = 64,
    initialHeight = 64,
    initialGrid,
    onGridChange,
    title = 'SCYAN PIXEL EDITOR',
    badgeText = 'PIXEL',
    showPresets: _showPresets = true,
    colorMode = 'monochrome',
    defaultPixelColor = '#ffffff',
    defaultBgColor = '#000000',
    initialDrawColor,
    pixelColor: propPixelColor,
    bgColor: propBgColor,
    allowColorThemes = true,

    // Slices & Atlas integration
    slices = EMPTY_SLICES,
    selectedSliceId = '',
    selectedSliceIds = EMPTY_SLICE_IDS,
    pendingSelection = null,
    onSelectSlice,
    onSelectSlices,
    onNewSelection,
    onSliceMove,
    onSlicesMove,
    onAddSlices,
    onSlicesChange,
    externalTool,
    initialViewport,
    onViewportChange,

    // Optional collaboration adapter
    collaboration,
  },
  forwardedRef
) {
  // 1. Color & Theme State
  const isStrictMonochrome = Boolean(colorMode === 'monochrome' || (propPixelColor && !allowColorThemes));
  const customPixelColor = propPixelColor || (isStrictMonochrome ? '#ffffff' : defaultPixelColor);
  const [customBgColor, setCustomBgColor] = useState<string>(
    propBgColor || (isStrictMonochrome ? '#000000' : defaultBgColor)
  );

  const activePixelColor = propPixelColor || customPixelColor;
  const activeBgColor = propBgColor || customBgColor;

  const [activeDrawColor, setActiveDrawColor] = useState<string>(
    initialDrawColor || (isStrictMonochrome ? '#ffffff' : defaultPixelColor || '#00e5a3')
  );
  const recentPaletteRef = useRef<RecentPaletteHandle>(null);

  // Callback refs to keep handlers fresh across re-renders
  const slicesRef = useRef<SpriteSlice[]>(slices);
  slicesRef.current = slices;
  const selectedSliceIdRef = useRef<string>(selectedSliceId);
  selectedSliceIdRef.current = selectedSliceId;
  const selectedSliceIdsRef = useRef<string[]>(selectedSliceIds);
  selectedSliceIdsRef.current = selectedSliceIds;

  const onSelectSliceRef = useRef(onSelectSlice);
  onSelectSliceRef.current = onSelectSlice;
  const onSelectSlicesRef = useRef(onSelectSlices);
  onSelectSlicesRef.current = onSelectSlices;
  const onNewSelectionRef = useRef(onNewSelection);
  onNewSelectionRef.current = onNewSelection;
  const onSliceMoveRef = useRef(onSliceMove);
  onSliceMoveRef.current = onSliceMove;
  const onSlicesMoveRef = useRef(onSlicesMove);
  onSlicesMoveRef.current = onSlicesMove;
  const onAddSlicesRef = useRef(onAddSlices);
  onAddSlicesRef.current = onAddSlices;
  const onSlicesChangeRef = useRef(onSlicesChange);
  onSlicesChangeRef.current = onSlicesChange;

  const selectionRef = useRef<SelectionOverlay | null>(null);
  const setSelectionRef = useRef<((sel: SelectionOverlay | null) => void) | undefined>(undefined);

  // 2. Editor History Hook (Undo/Redo with slice updates)
  const {
    grid,
    commitGrid,
    setGrid,
    resetGrid,
    undo,
    redo,
    canUndo,
    canRedo,
    historyIndex,
    historyLength,
  } = useEditorHistory({
    initialWidth,
    initialHeight,
    initialGrid,
    onGridChange,
    onSliceMoveRef,
    onSlicesMoveRef,
    selectionRef,
    setSelectionRef,
  });

  const gridRef = useRef<BwpxGrid>(grid);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // 3. Canvas & Viewport Hooks
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRafRef = useRef<number | null>(null);

  const {
    zoom,
    zoomTo,
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
  } = useViewport({
    containerRef,
    initialViewport,
    onViewportChange,
  });

  const handleFitToScreen = useCallback(() => {
    fitToView(grid);
  }, [fitToView, grid]);

  // 4. Selection & Floating Pixels Hook
  const {
    selection,
    setSelection,
    floatingPixels,
    setFloatingPixels,
    isMovingSelection,
    setIsMovingSelection,
    moveStartPos,
    setMoveStartPos,
    copySelection,
    cutSelection,
    pasteSelection,
    deleteSelection,
  } = useSelectionManager();

  useEffect(() => {
    selectionRef.current = selection;
    setSelectionRef.current = setSelection;
  }, [selection, setSelection]);

  // Synchronize selection with slices from inspector or external props
  useEffect(() => {
    if (isMovingSelection) return;
    if (pendingSelection) {
      setSelection({
        x: pendingSelection.x,
        y: pendingSelection.y,
        w: pendingSelection.width,
        h: pendingSelection.height,
        active: true,
      });
      return;
    }
    if (selectedSliceIds && selectedSliceIds.length > 0 && slices && slices.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedSliceIds.forEach((id) => {
        const s = slices.find((item) => item.id === id);
        if (s) {
          minX = Math.min(minX, s.x);
          minY = Math.min(minY, s.y);
          maxX = Math.max(maxX, s.x + s.width);
          maxY = Math.max(maxY, s.y + s.height);
        }
      });
      if (minX !== Infinity) {
        setSelection({
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          active: true,
        });
        return;
      }
    }
    if (selectedSliceId && slices && slices.length > 0) {
      const slice = slices.find((s) => s.id === selectedSliceId);
      if (slice) {
        setSelection({
          x: slice.x,
          y: slice.y,
          w: slice.width,
          h: slice.height,
          active: true,
        });
        return;
      }
    }
    // Only clear selection if we are operating in slice mode (slices exist) and no slice is selected
    if (slices && slices.length > 0 && !pendingSelection && (!selectedSliceIds || selectedSliceIds.length === 0) && !selectedSliceId) {
      setSelection(null);
    }
  }, [selectedSliceId, selectedSliceIds, pendingSelection, slices, isMovingSelection, setSelection]);

  // 5. Tool & Interaction State
  const [activeTool, setActiveTool] = useState<ToolType>(externalTool || 'pencil');
  useEffect(() => {
    if (externalTool) {
      setActiveTool(externalTool);
    }
  }, [externalTool]);

  const [brushSize, setBrushSize] = useState<number>(1);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawButton, setDrawButton] = useState<number>(0);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<GhostOverlay | null>(null);
  const [ghostPlacement, setGhostPlacement] = useState<{
    grid: BwpxGrid;
    width: number;
    height: number;
    pixels: ([number, number] | [number, number, string])[];
    x: number;
    y: number;
    rects?: { x: number; y: number; w: number; h: number }[];
    gifData?: { frames: { grid: BwpxGrid; delayMs: number }[]; name?: string };
    gripX?: number;
    gripY?: number;
    cols?: number;
    rows?: number;
    frameWidth?: number;
    frameHeight?: number;
  } | null>(null);
  const ghostPlacementRef = useRef(ghostPlacement);
  useEffect(() => {
    ghostPlacementRef.current = ghostPlacement;
  }, [ghostPlacement]);

  const currentCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const strokeGridRef = useRef<BwpxGrid | null>(null);
  const activeToolRef = useRef<ToolType>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const updateShapePreview = useCallback(
    (
      sPos: { x: number; y: number },
      cPos: { x: number; y: number },
      options: { shiftKey?: boolean; ctrlKey?: boolean }
    ) => {
      const endpoints = calculateShapeEndpoints(activeTool, sPos, cPos, options);
      const previewGrid = new PixelGrid(grid.width, grid.height, undefined, undefined, activeDrawColor);
      drawShape(
        previewGrid,
        activeTool,
        endpoints.x0,
        endpoints.y0,
        endpoints.x1,
        endpoints.y1,
        1,
        brushSize,
        activeDrawColor
      );
      const ghostPix = previewGrid.getAllColoredPixels();
      setGhost({
        pixels: ghostPix,
        x: 0,
        y: 0,
        w: grid.width,
        h: grid.height,
        showOutline: false,
        showBackdrop: false,
      });
    },
    [activeTool, activeDrawColor, brushSize, grid.width, grid.height]
  );

  const updateShapePreviewRef = useRef(updateShapePreview);
  useEffect(() => {
    updateShapePreviewRef.current = updateShapePreview;
  }, [updateShapePreview]);

  // 6. UI Dialog & Header States
  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importSource, setImportSource] = useState<File | Blob | string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState<boolean>(false);

  // 7. Collaboration & Timestamps
  const pixelTimestampsRef = useRef<PixelTimestampTracker>(new PixelTimestampTracker());
  const discardLocalOnNextSnapshotRef = useRef<boolean>(false);

  const commitAndBroadcast = useCallback(
    (
      nextGrid: BwpxGrid,
      explicitSelection?: SelectionOverlay | null,
      sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[]
    ) => {
      collaboration?.ensureActiveRoom?.(nextGrid);
      const prev = gridRef.current;
      gridRef.current = nextGrid;
      commitGrid(nextGrid, explicitSelection, sliceUpdates);
      const now = Date.now();
      if (nextGrid.countOn() === 0 && prev.countOn() > 0) {
        pixelTimestampsRef.current.clear(now);
        collaboration?.broadcastClear?.();
        collaboration?.saveRoom?.(nextGrid, pixelTimestampsRef.current);
        return;
      }
      const diff = diffGridPixels(prev, nextGrid, now);
      if (diff.length > 0) {
        for (let i = 0; i < diff.length; i++) {
          pixelTimestampsRef.current.set(diff[i][0], diff[i][1], now);
        }
        collaboration?.broadcastPixels?.(diff);
      }
      collaboration?.saveRoom?.(nextGrid, pixelTimestampsRef.current);
    },
    [commitGrid, collaboration]
  );

  const handleUndo = useCallback(() => {
    collaboration?.ensureActiveRoom?.();
    const prev = gridRef.current;
    const next = undo();
    if (next) {
      gridRef.current = next;
      const now = Date.now();
      const diff = diffGridPixels(prev, next, now);
      if (diff.length > 0) {
        for (let i = 0; i < diff.length; i++) {
          pixelTimestampsRef.current.set(diff[i][0], diff[i][1], now);
        }
        collaboration?.broadcastPixels?.(diff);
      }
      collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
    }
    setGhost(null);
  }, [undo, collaboration]);

  const handleRedo = useCallback(() => {
    collaboration?.ensureActiveRoom?.();
    const prev = gridRef.current;
    const next = redo();
    if (next) {
      gridRef.current = next;
      const now = Date.now();
      const diff = diffGridPixels(prev, next, now);
      if (diff.length > 0) {
        for (let i = 0; i < diff.length; i++) {
          pixelTimestampsRef.current.set(diff[i][0], diff[i][1], now);
        }
        collaboration?.broadcastPixels?.(diff);
      }
      collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
    }
    setGhost(null);
  }, [redo, collaboration]);

  const handleNewCanvas = useCallback(() => {
    const blankGrid = new PixelGrid(
      gridRef.current.width,
      gridRef.current.height,
      undefined,
      undefined,
      activeDrawColor
    );
    gridRef.current = blankGrid;
    resetGrid(blankGrid);
    pixelTimestampsRef.current.clear(Date.now());
    setGhost(null);
    setSelection(null);
    setFloatingPixels(null);
    if (strokeGridRef.current) {
      strokeGridRef.current = null;
    }
    fitToView(blankGrid);
  }, [activeDrawColor, resetGrid, fitToView, setSelection, setFloatingPixels]);

  // File import ref and trigger
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenImportDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.json') || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (data && typeof data.width === 'number' && typeof data.height === 'number') {
              const newGrid = new PixelGrid(data.width, data.height, data.pixels, data.coloredPixels);
              commitAndBroadcast(newGrid);
            }
          } catch (err) {
            console.error('Failed to parse JSON project file:', err);
          }
        };
        reader.readAsText(file);
        return;
      }
      setImportSource(file);
      setIsImportModalOpen(true);
    }
  };

  // Redraw Base Canvas when grid, zoom, pan, colors, or slices change
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (container) {
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    }

    renderBaseCanvas(canvas, ctx, {
      grid,
      zoom,
      pan,
      pixelColor: activePixelColor,
      monochrome: isStrictMonochrome,
      bgColor: activeBgColor,
      showGridLines: zoom >= 4,
      showAxes: true,
      frameBounds: null,
      slices,
      selectedSliceId,
      selectedSliceIds,
    });
  }, [grid, zoom, pan, activePixelColor, activeBgColor, isStrictMonochrome, slices, selectedSliceId, selectedSliceIds]);

  // Redraw Overlay Canvas on ephemeral interaction changes via rAF
  const scheduleOverlayRender = useCallback(() => {
    if (overlayRafRef.current !== null) {
      cancelAnimationFrame(overlayRafRef.current);
    }
    overlayRafRef.current = requestAnimationFrame(() => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      if (container) {
        if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
      }

      renderOverlayCanvas(canvas, ctx, {
        zoom,
        pan,
        hoverPos,
        brushIndicatorColor: activeDrawColor,
        brushSize,
        showBrushIndicator: (activeTool === 'pencil' || activeTool === 'eraser') && !ghostPlacement,
        frameBounds: null,
        ghost: ghost || (ghostPlacement ? {
          pixels: ghostPlacement.pixels,
          x: ghostPlacement.x,
          y: ghostPlacement.y,
          w: ghostPlacement.width,
          h: ghostPlacement.height,
          rects: ghostPlacement.rects
            ? ghostPlacement.rects.map((r) => ({
                x: ghostPlacement.x + r.x,
                y: ghostPlacement.y + r.y,
                w: r.w,
                h: r.h,
              }))
            : undefined,
          showOutline: true,
          showBackdrop: false,
        } : null),
        selection,
        bgColor: activeBgColor,
      });
      overlayRafRef.current = null;
    });
  }, [zoom, pan, hoverPos, activeDrawColor, brushSize, activeTool, ghost, ghostPlacement, selection, activeBgColor]);

  useEffect(() => {
    scheduleOverlayRender();
  }, [scheduleOverlayRender]);

  // Arrow Key Move Active Selection and Slices
  const lastArrowTimeRef = useRef<number>(0);
  const moveActiveSelection = useCallback(
    (dx: number, dy: number, _isRepeat: boolean = false) => {
      const currentSel = selection;
      if (!currentSel || !currentSel.active) return;

      const curGrid = gridRef.current;
      const currentSlices = slicesRef.current || [];
      const currentSelectedSliceIds = selectedSliceIdsRef.current || [];
      const currentSelectedSliceId = selectedSliceIdRef.current;

      const activeIds = currentSelectedSliceIds.length > 0
        ? currentSelectedSliceIds
        : (currentSelectedSliceId ? [currentSelectedSliceId] : []);

      let sliceRects: { x: number; y: number; w: number; h: number }[] = [];
      let extracted: [number, number, string][] = [];
      const next = curGrid.clone();

      if (activeIds.length > 0) {
        activeIds.forEach((id) => {
          const s = currentSlices.find((item) => item.id === id);
          if (s) {
            sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
            const spx = curGrid.extractColoredRect(s);
            spx.forEach(([rx, ry, col]) => {
              extracted.push([s.x + rx - currentSel.x, s.y + ry - currentSel.y, col]);
            });
            next.clearRect(s);
          }
        });
      } else {
        sliceRects.push({ x: currentSel.x, y: currentSel.y, w: currentSel.w, h: currentSel.h });
        extracted = curGrid.extractColoredRect(currentSel);
        next.clearRect(currentSel);
      }

      const targetX = currentSel.x + dx;
      const targetY = currentSel.y + dy;

      if (sliceRects.length > 0) {
        sliceRects.forEach((sr) => {
          next.clearRect({
            x: sr.x + dx,
            y: sr.y + dy,
            w: sr.w,
            h: sr.h,
          });
        });
      } else {
        next.clearRect({
          x: targetX,
          y: targetY,
          w: currentSel.w,
          h: currentSel.h,
        });
      }

      extracted.forEach(([relX, relY, col]) => {
        next.set(targetX + relX, targetY + relY, 1, col);
      });

      const newSelection: SelectionOverlay = {
        x: targetX,
        y: targetY,
        w: currentSel.w,
        h: currentSel.h,
        active: true,
      };

      const sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];
      if (activeIds.length > 0) {
        activeIds.forEach((id) => {
          const s = currentSlices.find((item) => item.id === id);
          if (s) {
            sliceUpdates.push({
              id,
              prevX: s.x,
              prevY: s.y,
              newX: s.x + dx,
              newY: s.y + dy,
            });
          }
        });
      }

      commitAndBroadcast(next, newSelection, sliceUpdates.length > 0 ? sliceUpdates : undefined);
      setSelection(newSelection);

      if (sliceUpdates.length > 0) {
        if (onSlicesMoveRef.current) {
          onSlicesMoveRef.current(sliceUpdates.map((u) => ({ id: u.id, dx, dy })));
        } else if (onSliceMoveRef.current) {
          sliceUpdates.forEach((u) => onSliceMoveRef.current?.(u.id, u.newX, u.newY));
        }
      } else if (pendingSelection) {
        onNewSelectionRef.current?.({
          x: targetX,
          y: targetY,
          width: currentSel.w,
          height: currentSel.h,
        });
      }
    },
    [commitAndBroadcast, selection, pendingSelection, setSelection]
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalContent || isImportModalOpen) return;

      if (e.key === 'Escape') {
        if (ghostPlacementRef.current) {
          setGhostPlacement(null);
          return;
        }
        if (selection && selection.active) {
          setSelection(null);
          return;
        }
      }

      // Arrow Keys to Move Active Selection
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selection && selection.active && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          const step = e.shiftKey ? 8 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          const now = Date.now();
          const isRepeat = e.repeat || now - lastArrowTimeRef.current < 250;
          lastArrowTimeRef.current = now;
          moveActiveSelection(dx, dy, isRepeat);
          return;
        }
      }

      if (['Shift', 'Control', 'Meta'].includes(e.key)) {
        if (isDrawingRef.current && startPosRef.current && currentCoordsRef.current) {
          const shiftKey = e.shiftKey || e.key === 'Shift';
          const ctrlKey = e.ctrlKey || e.metaKey || e.key === 'Control' || e.key === 'Meta';
          const curTool = activeToolRef.current;
          if (curTool === 'select') {
            const endpoints = calculateShapeEndpoints('select', startPosRef.current, currentCoordsRef.current, {
              shiftKey,
              ctrlKey,
            });
            const minX = Math.min(endpoints.x0, endpoints.x1);
            const minY = Math.min(endpoints.y0, endpoints.y1);
            const maxX = Math.max(endpoints.x0, endpoints.x1);
            const maxY = Math.max(endpoints.y0, endpoints.y1);
            setSelection({
              x: minX,
              y: minY,
              w: maxX - minX + 1,
              h: maxY - minY + 1,
              active: true,
            });
          } else if (isShapeTool(curTool)) {
            updateShapePreviewRef.current(startPosRef.current, currentCoordsRef.current, {
              shiftKey,
              ctrlKey,
            });
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setIsSpaceHeld(true);
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || isDrawingRef.current) {
        return;
      }

      // Tool shortcuts
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'p') setActiveTool('pencil');
      else if (k === 'e') setActiveTool('eraser');
      else if (k === 'g') setActiveTool('bucket');
      else if (k === 'i' && !isStrictMonochrome) setActiveTool('eyedropper');
      else if (k === 'm') setActiveTool('select');
      else if (k === 'v') setActiveTool('move');
      else if (k === 'l') {
        setActiveTool((prev) => {
          if (prev === 'line') return 'arrow';
          if (prev === 'arrow') return 'filled-arrow';
          return 'line';
        });
      }

      // Brush size shortcuts: [ decrease, ] increase
      if (e.key === '[') {
        e.preventDefault();
        setBrushSize((prev) => Math.max(1, prev - 1));
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        setBrushSize((prev) => Math.min(64, prev + 1));
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    modalContent,
    isImportModalOpen,
    selection,
    handleUndo,
    handleRedo,
    setIsSpaceHeld,
    moveActiveSelection,
    setSelection,
    isStrictMonochrome,
  ]);

  // Context Menu operations
  const handleInvert = () => {
    const next = grid.invert(
      selection && selection.active ? selection : undefined,
      activeDrawColor
    );
    commitAndBroadcast(next);
  };

  const handleFlipH = () => {
    const next = grid.flipHorizontal(selection && selection.active ? selection : undefined);
    commitAndBroadcast(next);
  };

  const handleFlipV = () => {
    const next = grid.flipVertical(selection && selection.active ? selection : undefined);
    commitAndBroadcast(next);
  };

  const handleRotate90 = () => {
    const next = grid.rotate90(selection && selection.active ? selection : undefined);
    commitAndBroadcast(next);
  };

  // Pointer interactions on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ghostPlacementRef.current) {
      if (e.button === 0) {
        const gp = ghostPlacementRef.current;
        const targetX = gp.x;
        const targetY = gp.y;
        const next = grid.clone();
        if (gp.gifData && gp.gifData.frames.length > 0) {
          const cols = gp.cols || 1;
          const frameW = gp.frameWidth || Math.round(gp.width / cols);
          const frameH = gp.frameHeight || gp.height;
          gp.gifData.frames.forEach((frame, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            next.blit(frame.grid, targetX + col * frameW, targetY + row * frameH, true);
          });

          if (onAddSlicesRef.current || onSlicesChangeRef.current) {
            const rawName = gp.gifData.name || 'ANIM';
            const cleanId = rawName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            const newSlices: SpriteSlice[] = gp.gifData.frames.map((_, i) => ({
              id: i === 0 ? cleanId : `${cleanId}_SUB_${i}`,
              name: i === 0 ? rawName : undefined,
              groupId: cleanId,
              groupOrder: i + 1,
              x: targetX + (i % cols) * frameW,
              y: targetY + Math.floor(i / cols) * frameH,
              width: frameW,
              height: frameH,
              color: '#38bdf8',
            }));
            if (onAddSlicesRef.current) {
              onAddSlicesRef.current(newSlices);
            } else if (onSlicesChangeRef.current) {
              onSlicesChangeRef.current([...(slicesRef.current || []), ...newSlices]);
            }
            if (onSelectSlicesRef.current) {
              onSelectSlicesRef.current(newSlices.map((s) => s.id));
            } else if (onSelectSliceRef.current && newSlices[0]) {
              onSelectSliceRef.current(newSlices[0].id);
            }
          }

          commitAndBroadcast(next);
          setSelection({
            x: targetX,
            y: targetY,
            w: gp.width,
            h: gp.height,
            active: true,
          });
        } else {
          next.blit(gp.grid, targetX, targetY, true);
          commitAndBroadcast(next);
          setSelection({
            x: targetX,
            y: targetY,
            w: gp.width,
            h: gp.height,
            active: true,
          });
          onNewSelectionRef.current?.({
            x: targetX,
            y: targetY,
            width: gp.width,
            height: gp.height,
          });
        }
        setGhostPlacement(null);
      } else if (e.button === 2) {
        setGhostPlacement(null);
      }
      return;
    }

    if (e.button === 2) {
      if (activeTool === 'pencil') {
        collaboration?.ensureActiveRoom?.();
        const coords = getGridCoords(e.clientX, e.clientY);
        const { x, y } = coords;
        const next = grid.clone();
        drawBrushDot(next, x, y, 0, brushSize);
        setIsDrawing(true);
        isDrawingRef.current = true;
        setDrawButton(2);
        setStartPos(coords);
        startPosRef.current = coords;
        currentCoordsRef.current = coords;
        strokeGridRef.current = next;
        gridRef.current = next;
        commitGrid(next);
        const now = Date.now();
        pixelTimestampsRef.current.set(x, y, now);
        collaboration?.broadcastPixels?.(getBrushDotPixels(x, y, brushSize, null, now));
        collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
        return;
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 1 || isSpaceHeld) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    const coords = getGridCoords(e.clientX, e.clientY);
    const { x, y } = coords;
    setStartPos(coords);
    startPosRef.current = coords;
    currentCoordsRef.current = coords;
    setDrawButton(0);

    // Eyedropper tool or Alt+Click color sampling
    if (activeTool === 'eyedropper' || e.altKey) {
      const sampled = grid.getColor(x, y);
      if (sampled) {
        setActiveDrawColor(sampled);
      }
      return;
    }

    const clickedSlice = slicesRef.current?.find(
      (s) => x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height
    );

    // Floating selection or slice move
    const isInsideSel = Boolean(
      selection &&
      selection.active &&
      x >= selection.x &&
      x < selection.x + selection.w &&
      y >= selection.y &&
      y < selection.y + selection.h
    );

    if ((activeTool === 'move' || activeTool === 'select' || e.shiftKey) && (clickedSlice || isInsideSel)) {
      const initialIds = (selectedSliceIdsRef.current && selectedSliceIdsRef.current.length > 0)
        ? selectedSliceIdsRef.current
        : (selectedSliceIdRef.current ? [selectedSliceIdRef.current] : []);
      let currentIds = new Set<string>(initialIds);
      if (clickedSlice) {
        if (e.ctrlKey || e.metaKey) {
          if (currentIds.has(clickedSlice.id)) {
            currentIds.delete(clickedSlice.id);
          } else {
            currentIds.add(clickedSlice.id);
          }
        } else {
          currentIds = new Set([clickedSlice.id]);
        }
        const allIds = Array.from(currentIds);
        if (onSelectSlicesRef.current) {
          onSelectSlicesRef.current(allIds);
        }
        onSelectSliceRef.current?.(clickedSlice.id, Boolean(e.ctrlKey || e.metaKey));
      }

      const activeSlices = (slicesRef.current || []).filter((s) => currentIds.has(s.id));
      let selRect = selection;
      let sliceRects: { x: number; y: number; w: number; h: number }[] = [];

      if (activeSlices.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        activeSlices.forEach((s) => {
          minX = Math.min(minX, s.x);
          minY = Math.min(minY, s.y);
          maxX = Math.max(maxX, s.x + s.width);
          maxY = Math.max(maxY, s.y + s.height);
          sliceRects.push({ x: s.x, y: s.y, w: s.width, h: s.height });
        });
        selRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, active: true };
        setSelection(selRect);
      } else if (selRect) {
        sliceRects.push({ x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h });
      }

      if (selRect) {
        let extracted: [number, number, string][] = [];
        if (activeSlices.length > 0) {
          activeSlices.forEach((s) => {
            const spx = grid.extractColoredRect(s);
            spx.forEach(([rx, ry, col]) => {
              extracted.push([s.x + rx - selRect!.x, s.y + ry - selRect!.y, col]);
            });
          });
        } else {
          extracted = grid.extractColoredRect(selRect);
        }

        setFloatingPixels(extracted);
        setGhost({
          pixels: extracted,
          x: selRect.x,
          y: selRect.y,
          w: selRect.w,
          h: selRect.h,
          rects: sliceRects.length > 1 ? sliceRects.map((sr) => ({
            x: sr.x - selRect!.x,
            y: sr.y - selRect!.y,
            w: sr.w,
            h: sr.h,
          })) : undefined,
          showOutline: true,
          showBackdrop: true,
        });
        setIsMovingSelection(true);
        setMoveStartPos({ x, y });
        return;
      }
    }

    // Clear existing selection if starting to draw with non-selection tools
    if (selection && selection.active && activeTool !== 'select' && activeTool !== 'move') {
      setSelection(null);
    }

    if (activeTool === 'select') {
      setSelection({ x, y, w: 1, h: 1, active: true });
      setIsDrawing(true);
      isDrawingRef.current = true;
      return;
    }

    if (activeTool === 'bucket') {
      collaboration?.ensureActiveRoom?.();
      const next = grid.clone();
      floodFill(next, x, y, 1, activeDrawColor);
      commitAndBroadcast(next);
      recentPaletteRef.current?.pushColor(activeDrawColor);
      return;
    }

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      collaboration?.ensureActiveRoom?.();
      const next = grid.clone();
      const val = activeTool === 'eraser' ? 0 : 1;
      drawBrushDot(next, x, y, val, brushSize, activeDrawColor);
      setIsDrawing(true);
      isDrawingRef.current = true;
      strokeGridRef.current = next;
      gridRef.current = next;
      commitGrid(next);
      const now = Date.now();
      pixelTimestampsRef.current.set(x, y, now);
      collaboration?.broadcastPixels?.(
        getBrushDotPixels(x, y, brushSize, val === 0 ? null : activeDrawColor, now)
      );
      collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
      if (val === 1) recentPaletteRef.current?.pushColor(activeDrawColor);
      return;
    }

    // Shape tools begin dragging preview
    collaboration?.ensureActiveRoom?.();
    setIsDrawing(true);
    isDrawingRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    setHoverPos(coords);
    currentCoordsRef.current = coords;

    if (ghostPlacementRef.current) {
      setGhostPlacement((prev) =>
        prev
          ? {
              ...prev,
              x: coords.x - (prev.gripX ?? Math.floor(prev.width / 2)),
              y: coords.y - (prev.gripY ?? Math.floor(prev.height / 2)),
            }
          : null
      );
      return;
    }

    if (isMovingSelection && moveStartPos && ghost && floatingPixels) {
      const dx = coords.x - moveStartPos.x;
      const dy = coords.y - moveStartPos.y;
      setGhost({
        ...ghost,
        x: (selection?.x || 0) + dx,
        y: (selection?.y || 0) + dy,
      });
      return;
    }

    if (!isDrawing || !startPos) return;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const prevCoords = startPosRef.current;
      if (strokeGridRef.current && prevCoords) {
        const val = drawButton === 2 || activeTool === 'eraser' ? 0 : 1;
        if (prevCoords.x !== coords.x || prevCoords.y !== coords.y) {
          drawLine(
            strokeGridRef.current,
            prevCoords.x,
            prevCoords.y,
            coords.x,
            coords.y,
            val,
            brushSize,
            activeDrawColor
          );
          const now = Date.now();
          const linePixels = getLinePixels(
            prevCoords.x,
            prevCoords.y,
            coords.x,
            coords.y,
            brushSize,
            val === 0 ? null : activeDrawColor,
            now
          );
          for (const lp of linePixels) {
            pixelTimestampsRef.current.set(lp[0], lp[1], now);
          }
          collaboration?.broadcastPixels?.(linePixels);
          startPosRef.current = coords;
          setStartPos(coords);
          gridRef.current = strokeGridRef.current;
          setGrid(strokeGridRef.current);
        }
      }
      return;
    }

    if (activeTool === 'select') {
      const endpoints = calculateShapeEndpoints('select', startPos, coords, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      });
      const minX = Math.min(endpoints.x0, endpoints.x1);
      const minY = Math.min(endpoints.y0, endpoints.y1);
      const maxX = Math.max(endpoints.x0, endpoints.x1);
      const maxY = Math.max(endpoints.y0, endpoints.y1);
      setSelection({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        active: true,
      });
      return;
    }

    if (isShapeTool(activeTool)) {
      updateShapePreview(startPos, coords, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    currentCoordsRef.current = coords;

    if (isMovingSelection && ghost && selection) {
      const dx = ghost.x - selection.x;
      const dy = ghost.y - selection.y;
      const next = grid.clone();

      const activeIds = selectedSliceIdsRef.current && selectedSliceIdsRef.current.length > 0
        ? selectedSliceIdsRef.current
        : (selectedSliceIdRef.current ? [selectedSliceIdRef.current] : []);
      const currentSlices = slicesRef.current || [];
      const activeSlices = currentSlices.filter((s) => activeIds.includes(s.id));

      if (activeSlices.length > 0) {
        activeSlices.forEach((s) => {
          next.clearRect(s);
        });
        activeSlices.forEach((s) => {
          next.clearRect({ x: s.x + dx, y: s.y + dy, w: s.width, h: s.height });
        });
      } else {
        next.clearRect(selection);
        next.clearRect({ x: ghost.x, y: ghost.y, w: ghost.w, h: ghost.h });
      }

      ghost.pixels.forEach((p) => {
        const rx = p[0];
        const ry = p[1];
        const color = p[2] || activeDrawColor;
        next.set(ghost.x + rx, ghost.y + ry, 1, color);
      });

      const newSel: SelectionOverlay = {
        x: ghost.x,
        y: ghost.y,
        w: ghost.w,
        h: ghost.h,
        active: true,
      };

      const sliceUpdates: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = [];
      if (activeSlices.length > 0) {
        activeSlices.forEach((s) => {
          sliceUpdates.push({
            id: s.id,
            prevX: s.x,
            prevY: s.y,
            newX: s.x + dx,
            newY: s.y + dy,
          });
        });
      }

      commitAndBroadcast(next, newSel, sliceUpdates.length > 0 ? sliceUpdates : undefined);
      setSelection(newSel);

      if (sliceUpdates.length > 0) {
        if (onSlicesMoveRef.current) {
          onSlicesMoveRef.current(sliceUpdates.map((u) => ({ id: u.id, dx, dy })));
        } else if (onSliceMoveRef.current) {
          sliceUpdates.forEach((u) => onSliceMoveRef.current?.(u.id, u.newX, u.newY));
        }
      } else if (pendingSelection) {
        onNewSelectionRef.current?.({
          x: newSel.x,
          y: newSel.y,
          width: newSel.w,
          height: newSel.h,
        });
      }

      setGhost(null);
      setIsMovingSelection(false);
      setFloatingPixels(null);
      return;
    }

    if (activeTool === 'select' && startPos) {
      const hasDragged = Math.abs(coords.x - startPos.x) > 0 || Math.abs(coords.y - startPos.y) > 0;
      setIsDrawing(false);
      isDrawingRef.current = false;
      startPosRef.current = null;
      strokeGridRef.current = null;
      setGhost(null);

      if (!hasDragged) {
        const clickedSlice = slicesRef.current?.find(
          (s) => startPos.x >= s.x && startPos.x < s.x + s.width && startPos.y >= s.y && startPos.y < s.y + s.height
        );
        if (clickedSlice) {
          const isMulti = Boolean(e.ctrlKey || e.metaKey);
          onSelectSliceRef.current?.(clickedSlice.id, isMulti);
          if (onSelectSlicesRef.current) {
            onSelectSlicesRef.current([clickedSlice.id]);
          }
          setSelection({
            x: clickedSlice.x,
            y: clickedSlice.y,
            w: clickedSlice.width,
            h: clickedSlice.height,
            active: true,
          });
          onNewSelectionRef.current?.(null);
          return;
        } else {
          onSelectSliceRef.current?.('', false);
          onSelectSlicesRef.current?.([]);
          setSelection(null);
          onNewSelectionRef.current?.(null);
          return;
        }
      } else {
        const minX = Math.min(startPos.x, coords.x);
        const minY = Math.min(startPos.y, coords.y);
        const w = Math.abs(coords.x - startPos.x) + 1;
        const h = Math.abs(coords.y - startPos.y) + 1;

        const zoneSlices = (slicesRef.current || []).filter(
          (s) => s.x < minX + w && s.x + s.width > minX && s.y < minY + h && s.y + s.height > minY
        );

        if (zoneSlices.length > 0) {
          const zoneIds = zoneSlices.map((s) => s.id);
          if (onSelectSlicesRef.current) {
            onSelectSlicesRef.current(zoneIds);
          } else {
            zoneIds.forEach((id) => onSelectSliceRef.current?.(id, true));
          }
          let zMinX = Infinity, zMinY = Infinity, zMaxX = -Infinity, zMaxY = -Infinity;
          zoneSlices.forEach((s) => {
            zMinX = Math.min(zMinX, s.x);
            zMinY = Math.min(zMinY, s.y);
            zMaxX = Math.max(zMaxX, s.x + s.width);
            zMaxY = Math.max(zMaxY, s.y + s.height);
          });
          setSelection({
            x: zMinX,
            y: zMinY,
            w: zMaxX - zMinX,
            h: zMaxY - zMinY,
            active: true,
          });
          onNewSelectionRef.current?.(null);
        } else {
          setSelection({ x: minX, y: minY, w, h, active: true });
          onNewSelectionRef.current?.({ x: minX, y: minY, width: w, height: h });
        }
        return;
      }
    }

    if (!isDrawing || !startPos) {
      setIsDrawing(false);
      isDrawingRef.current = false;
      startPosRef.current = null;
      strokeGridRef.current = null;
      return;
    }

    setIsDrawing(false);
    isDrawingRef.current = false;
    startPosRef.current = null;
    strokeGridRef.current = null;
    setGhost(null);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      collaboration?.saveRoom?.(gridRef.current, pixelTimestampsRef.current);
      return;
    }

    // Finalize shape
    if (isShapeTool(activeTool)) {
      const endpoints = calculateShapeEndpoints(activeTool, startPos, coords, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      });
      const next = grid.clone();
      drawShape(
        next,
        activeTool,
        endpoints.x0,
        endpoints.y0,
        endpoints.x1,
        endpoints.y1,
        1,
        brushSize,
        activeDrawColor
      );
      commitAndBroadcast(next);
      recentPaletteRef.current?.pushColor(activeDrawColor);
    }
  };

  // Image Import Handler
  const handleImageImportConfirm = (
    importedGrid: BwpxGrid,
    w: number,
    h: number,
    gifData?: { frames: { grid: BwpxGrid; delayMs: number }[]; name?: string }
  ) => {
    const container = containerRef.current;
    const vpW = container?.clientWidth || 400;
    const vpH = container?.clientHeight || 400;

    const isMultiFrame = !!(gifData && gifData.frames.length > 0);
    const frameCount = isMultiFrame ? gifData.frames.length : 1;

    const layout = isMultiFrame
      ? calculateCompactTableLayout(frameCount, w, h, grid.width, grid.height)
      : { cols: 1, rows: 1, width: w, height: h };

    const totalW = layout.width;
    const totalH = layout.height;

    const gripX = isMultiFrame ? 0 : Math.floor(totalW / 2);
    const gripY = isMultiFrame ? 0 : Math.floor(totalH / 2);

    const initialX = hoverPos
      ? hoverPos.x - gripX
      : isMultiFrame
      ? 0
      : Math.round((-pan.x + vpW / 2) / zoom - gripX);
    const initialY = hoverPos
      ? hoverPos.y - gripY
      : isMultiFrame
      ? 0
      : Math.round((-pan.y + vpH / 2) / zoom - gripY);

    let ghostPixels: ([number, number] | [number, number, string])[] = [];
    let rects: { x: number; y: number; w: number; h: number }[] | undefined = undefined;

    if (isMultiFrame) {
      rects = gifData.frames.map((_, i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        return {
          x: col * w,
          y: row * h,
          w,
          h,
        };
      });

      gifData.frames.forEach((frame, i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const offsetX = col * w;
        const offsetY = row * h;
        const framePix = frame.grid.getAllColoredPixels();
        framePix.forEach(([rx, ry, colVal]) => {
          ghostPixels.push([rx + offsetX, ry + offsetY, colVal]);
        });
      });
    } else {
      ghostPixels = importedGrid.getAllColoredPixels();
    }

    setGhostPlacement({
      grid: importedGrid,
      width: totalW,
      height: totalH,
      pixels: ghostPixels,
      rects,
      x: initialX,
      y: initialY,
      gifData,
      gripX,
      gripY,
      cols: layout.cols,
      rows: layout.rows,
      frameWidth: w,
      frameHeight: h,
    });
  };

  // Export handlers
  const handleExportPNG = useCallback((type: 'colored' | 'monochrome' | 'transparent') => {
    const bounds =
      selection && selection.active
        ? { minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }
        : grid.getBounds();

    const w = bounds.width > 0 ? bounds.width : 32;
    const h = bounds.height > 0 ? bounds.height : 32;
    const origX = bounds.width > 0 ? bounds.minX : 0;
    const origY = bounds.height > 0 ? bounds.minY : 0;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    if (type === 'colored') {
      ctx.fillStyle = activeBgColor;
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (grid.get(origX + x, origY + y)) {
            ctx.fillStyle = grid.getColor(origX + x, origY + y) || activeDrawColor;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    } else if (type === 'transparent') {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (grid.get(origX + x, origY + y)) {
            ctx.fillStyle = grid.getColor(origX + x, origY + y) || activeDrawColor;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (grid.get(origX + x, origY + y)) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scyan_pixel_${w}x${h}_${type}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [grid, selection, activeBgColor, activeDrawColor]);

  const handleExportCArray = useCallback(() => {
    const cCode = grid.toCArray('CUSTOM_DISPLAY_BITMAP');
    setModalContent({ title: 'Export C 1bpp Array (Zephyr / SSD1306)', text: cCode });
  }, [grid]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(
      {
        width: grid.width,
        height: grid.height,
        pixels: grid.getAllPixels(),
        coloredPixels: grid.getAllColoredPixels(),
      },
      null,
      2
    );
    setModalContent({ title: 'Export JSON Project', text: json });
  }, [grid]);

  const handleSaveJSONFile = useCallback(() => {
    const json = JSON.stringify(
      {
        width: grid.width,
        height: grid.height,
        pixels: grid.getAllPixels(),
        coloredPixels: grid.getAllColoredPixels(),
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scyan_pixel_${grid.width}x${grid.height}_project.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [grid]);

  const handleDownloadCHeader = useCallback(() => {
    const bounds =
      selection && selection.active
        ? { width: selection.w, height: selection.h }
        : grid.getBounds();
    const w = bounds.width > 0 ? bounds.width : grid.width;
    const h = bounds.height > 0 ? bounds.height : grid.height;
    const cCode = grid.toCArray('CUSTOM_DISPLAY_BITMAP');
    const headerContent = `#ifndef SCYAN_CUSTOM_DISPLAY_BITMAP_H\n#define SCYAN_CUSTOM_DISPLAY_BITMAP_H\n\n#include <stdint.h>\n\n${cCode}\n\n#endif // SCYAN_CUSTOM_DISPLAY_BITMAP_H\n`;
    const blob = new Blob([headerContent], { type: 'text/x-c' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scyan_bitmap_${w}x${h}.h`;
    a.click();
    URL.revokeObjectURL(url);
  }, [grid, selection]);

  // Remote collaboration synchronization handlers
  const handleRemoteMutation = useCallback(
    (mutation: CanvasMutationMessage) => {
      if (mutation.type === 'clear') {
        const now = mutation.timestamp ?? Date.now();
        pixelTimestampsRef.current.clear(now);
        const next = gridRef.current.clone();
        next.clear();
        if (strokeGridRef.current) {
          strokeGridRef.current.clear();
        }
        gridRef.current = next;
        setGrid(next);
        collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
        return;
      }
      if (mutation.type === 'pixels') {
        const next = gridRef.current.clone();
        applyPixelDeltas(next, mutation.pixels, pixelTimestampsRef.current);
        if (strokeGridRef.current) {
          applyPixelDeltas(strokeGridRef.current, mutation.pixels, pixelTimestampsRef.current);
        }
        gridRef.current = next;
        setGrid(next);
        collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
      }
    },
    [setGrid, collaboration]
  );

  const handleRemoteSnapshot = useCallback(
    (snapshot: CanvasSnapshotMessage) => {
      if (!snapshot || !Array.isArray(snapshot.pixels)) return;
      const currentGrid = gridRef.current;
      const isDiscard = discardLocalOnNextSnapshotRef.current;
      discardLocalOnNextSnapshotRef.current = false;

      if (isDiscard || currentGrid.countOn() === 0) {
        const next = new PixelGrid(
          snapshot.width || currentGrid.width,
          snapshot.height || currentGrid.height,
          undefined,
          undefined,
          activeDrawColor
        );
        pixelTimestampsRef.current.clear(snapshot.clearTimestamp ?? snapshot.timestamp ?? Date.now());
        for (const p of snapshot.pixels) {
          next.set(p[0], p[1], 1, p[2]);
          const ts = p[3] ?? snapshot.timestamp ?? 0;
          pixelTimestampsRef.current.set(p[0], p[1], ts);
        }
        if (strokeGridRef.current) {
          strokeGridRef.current = next.clone();
        }
        gridRef.current = next;
        setGrid(next);
        collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
        return;
      }

      const next = currentGrid.clone();
      const result = reconcileGridSnapshots(next, pixelTimestampsRef.current, snapshot);
      if (result.appliedDeltas.length > 0) {
        if (strokeGridRef.current) {
          strokeGridRef.current = next.clone();
        }
        gridRef.current = next;
        setGrid(next);
        collaboration?.saveRoom?.(next, pixelTimestampsRef.current);
      }
    },
    [activeDrawColor, setGrid, collaboration]
  );

  const handleGetSnapshot = useCallback((): CanvasSnapshotMessage => {
    const pixelsWithTs: [number, number, string, number][] = [];
    gridRef.current.forEachPixel((x, y, color) => {
      const ts = pixelTimestampsRef.current.get(x, y);
      pixelsWithTs.push([x, y, color, ts]);
    });
    const deletedPixels: [number, number, number][] = [];
    const clearTs = pixelTimestampsRef.current.getClearTime();
    for (const [key, ts] of pixelTimestampsRef.current.getMap().entries()) {
      const [x, y] = unpackCoord(key);
      if (!gridRef.current.get(x, y) && ts > clearTs) {
        deletedPixels.push([x, y, ts]);
      }
    }
    return {
      type: 'snapshot',
      width: gridRef.current.width,
      height: gridRef.current.height,
      pixels: pixelsWithTs,
      deletedPixels: deletedPixels.length > 0 ? deletedPixels : undefined,
      count: gridRef.current.countOn(),
      timestamp: Date.now(),
      clearTimestamp: clearTs,
    };
  }, []);

  const handleRestoreSnapshot = useCallback(
    (snapshot: RoomSnapshotData) => {
      const next = new PixelGrid(
        snapshot.width,
        snapshot.height,
        undefined,
        undefined,
        activeDrawColor
      );
      pixelTimestampsRef.current.clear(snapshot.updatedAt || Date.now());
      for (const p of snapshot.pixels) {
        if (p && p[2] && p[2] !== 'transparent' && p[2] !== 'none') {
          next.set(p[0], p[1], 1, p[2]);
        }
        if (typeof p[3] === 'number') {
          pixelTimestampsRef.current.set(p[0], p[1], p[3]);
        }
      }
      gridRef.current = next;
      resetGrid(next);
      setGhost(null);
      setSelection(null);
      setFloatingPixels(null);
      if (strokeGridRef.current) {
        strokeGridRef.current = null;
      }
      fitToView(next);
    },
    [activeDrawColor, resetGrid, fitToView, setSelection, setFloatingPixels]
  );

  // Imperative handle for parent wrapper / ref consumers
  useImperativeHandle(
    forwardedRef,
    () => ({
      getGrid: () => gridRef.current,
      setGrid: (g: BwpxGrid) => {
        gridRef.current = g;
        setGrid(g);
      },
      resetGrid: (g: BwpxGrid) => {
        gridRef.current = g;
        resetGrid(g);
      },
      commitGrid: (g: BwpxGrid) => {
        commitAndBroadcast(g);
      },
      applyRemoteMutation: handleRemoteMutation,
      applyRemoteSnapshot: handleRemoteSnapshot,
      getSnapshot: handleGetSnapshot,
      restoreSnapshot: handleRestoreSnapshot,
      discardLocalConflict: () => {
        discardLocalOnNextSnapshotRef.current = true;
      },
      fitToScreen: handleFitToScreen,
      openImportModal: () => setIsImportModalOpen(true),
      exportPNG: handleExportPNG,
      exportCArray: handleExportCArray,
      exportJSON: handleExportJSON,
      saveJSONFile: handleSaveJSONFile,
      downloadCHeader: handleDownloadCHeader,
      getSelectionBounds: () => (selection && selection.active ? { width: selection.w, height: selection.h } : null),
    }),
    [
      handleRemoteMutation,
      handleRemoteSnapshot,
      handleGetSnapshot,
      handleRestoreSnapshot,
      handleFitToScreen,
      handleExportPNG,
      handleExportCArray,
      handleExportJSON,
      handleSaveJSONFile,
      handleDownloadCHeader,
      commitAndBroadcast,
      selection,
      setGrid,
      resetGrid,
    ]
  );

  return (
    <div
      className="flex flex-col h-screen w-screen font-mono-code select-none overflow-hidden"
      style={{ backgroundColor: activeBgColor, color: '#e2e8f0' }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (file) {
          if (file.name.endsWith('.json') || file.type === 'application/json') {
            e.preventDefault();
            e.stopPropagation();
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const data = JSON.parse(ev.target?.result as string);
                if (data && typeof data.width === 'number' && typeof data.height === 'number') {
                  const newGrid = new PixelGrid(data.width, data.height, data.pixels, data.coloredPixels);
                  commitAndBroadcast(newGrid);
                }
              } catch (err) {
                console.error('Failed to parse JSON project file:', err);
              }
            };
            reader.readAsText(file);
            return;
          }
          if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name)) {
            e.preventDefault();
            e.stopPropagation();
            setImportSource(file);
            setIsImportModalOpen(true);
          }
        }
      }}
    >
      {/* 1. TOP TOOLBAR */}
      <EditorHeader
        title={title}
        badgeText={badgeText}
        isHeaderHovered={isHeaderHovered}
        setIsHeaderHovered={setIsHeaderHovered}
        canUndo={canUndo}
        canRedo={canRedo}
        historyIndex={historyIndex}
        historyLength={historyLength}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onNewCanvas={collaboration?.onNewCanvas ?? handleNewCanvas}
        onOpenLoadModal={collaboration?.onOpenLoadModal ?? handleOpenImportDialog}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onRotate90={handleRotate90}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        isStrictMonochrome={isStrictMonochrome}
        allowColorThemes={allowColorThemes}
        activePixelColor={activePixelColor}
        activeDrawColor={activeDrawColor}
        setActiveDrawColor={setActiveDrawColor}
        recentPaletteRef={recentPaletteRef}
        activeBgColor={activeBgColor}
        onBgColorChange={setCustomBgColor}
        onOpenCanvasEyedropper={() => setActiveTool('eyedropper')}
        onOpenImportModal={handleOpenImportDialog}
        onExportPNG={handleExportPNG}
        onExportCArray={handleExportCArray}
        onExportJSON={handleExportJSON}
        onSaveJSONFile={handleSaveJSONFile}
        onDownloadCHeader={handleDownloadCHeader}
        selectionBounds={selection && selection.active ? { width: selection.w, height: selection.h } : null}
        canvasDimensions={{ width: grid.width, height: grid.height }}
        onOpenShareModal={collaboration?.onOpenShareModal}
        connectedPeers={collaboration?.connectedPeers}
        showCollaboration={Boolean(collaboration)}
      />

      {/* 2. MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        <EditorToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
          activePixelColor={activePixelColor}
          isStrictMonochrome={isStrictMonochrome}
        />

        <EditorCanvas
          containerRef={containerRef}
          baseCanvasRef={baseCanvasRef}
          overlayCanvasRef={overlayCanvasRef}
          activeBgColor={activeBgColor}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverPos(null);
            setIsDrawing(false);
            isDrawingRef.current = false;
            startPosRef.current = null;
            strokeGridRef.current = null;
            setIsPanning(false);
            setGhost(null);
          }}
          onWheel={handleWheel}
        />

        {/* Room Joining Gate Overlay (if provided by collaborative wrapper) */}
        {collaboration?.overlaySlot}
      </div>

      {/* 3. BOTTOM STATUS BAR */}
      <EditorStatusBar
        hoverPos={hoverPos}
        grid={grid}
        selection={selection}
        zoom={zoom}
        onZoomChange={zoomTo}
        onFitToScreen={handleFitToScreen}
        isRoomActive={collaboration?.isRoomActive}
        roomId={collaboration?.roomId}
        peerCount={collaboration?.connectedPeers?.length ?? 0}
        statusEvents={collaboration?.statusEvents}
        onClearStatusEvents={collaboration?.onClearStatusEvents}
        onOpenInvite={collaboration?.onOpenInvite}
      />

      {/* Image & GIF Import Modal */}
      <ImageImportModal
        isOpen={isImportModalOpen}
        imageSource={importSource}
        canvasWidth={grid.width}
        canvasHeight={grid.height}
        pixelColor={activePixelColor}
        bgColor={activeBgColor}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportSource(null);
        }}
        onConfirm={handleImageImportConfirm}
        onSelectSource={(source) => setImportSource(source)}
      />

      {/* Right Click Context Menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCut={() => cutSelection(grid, commitAndBroadcast)}
          onCopy={() => copySelection(grid)}
          onPaste={() => {
            const container = containerRef.current;
            const vpW = container?.clientWidth || 400;
            const vpH = container?.clientHeight || 400;
            const fallbackPos = {
              x: Math.round((-pan.x + vpW / 2) / zoom - 16),
              y: Math.round((-pan.y + vpH / 2) / zoom - 16),
            };
            pasteSelection(grid, commitAndBroadcast, activeDrawColor, fallbackPos);
          }}
          onDelete={() => deleteSelection(grid, commitAndBroadcast)}
          onImportFile={handleOpenImportDialog}
          onInvert={handleInvert}
          onFlipH={handleFlipH}
          onFlipV={handleFlipV}
          onRotate90={handleRotate90}
          onDeselect={() => setSelection(null)}
          hasSelection={Boolean(selection && selection.active)}
        />
      )}

      {/* Export / Text Modal */}
      <ExportModal
        isOpen={Boolean(modalContent)}
        title={modalContent?.title || 'Export'}
        content={modalContent?.text || ''}
        accentColor={activePixelColor}
        onClose={() => setModalContent(null)}
      />

      {/* Hidden File Input for Image Import Dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.bmp,.jpg,.jpeg,.webp,.gif,.json,image/png,image/bmp,image/jpeg,image/webp,image/gif,application/json"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
});

export const BwpxEditor = PixelEditor;
export const ScyanPixelEditor = PixelEditor;
