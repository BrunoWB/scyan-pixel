import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelGrid, PixelGrid as BwpxGrid } from '../core/PixelGrid';
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
} from '../core/gridRenderer';
import { ImageImportModal } from './ImageImportModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import type { RecentPaletteHandle } from './RecentPalette';
import { getContrastColor } from '../core/colorUtils';

import {
  type ToolType,
  type ThemePreset,
  type BwpxEditorProps,
  type BwpxEditorProps as PixelEditorProps,
  THEME_PRESETS,
  DEFAULT_PALETTE,
  WHEEL_ZOOM_THRESHOLD,
  processWheelZoomDelta,
} from './editor/types';
import { useEditorHistory } from './editor/hooks/useEditorHistory';
import { useViewport } from './editor/hooks/useViewport';
import { useSelectionManager } from './editor/hooks/useSelectionManager';
import { EditorHeader } from './editor/ui/EditorHeader';
import { EditorToolbar } from './editor/ui/EditorToolbar';
import { EditorCanvas } from './editor/ui/EditorCanvas';
import { EditorStatusBar } from './editor/ui/EditorStatusBar';
import { ExportModal } from './editor/ui/ExportModal';

// Re-export public API symbols for complete backwards compatibility
export type { ToolType, ThemePreset, BwpxEditorProps, PixelEditorProps };
// oxlint-disable-next-line react/only-export-components
export { THEME_PRESETS, DEFAULT_PALETTE, WHEEL_ZOOM_THRESHOLD, processWheelZoomDelta, getContrastColor };

export const PixelEditor: React.FC<PixelEditorProps> = ({
  initialWidth = 64,
  initialHeight = 64,
  initialGrid,
  onGridChange,
  title = 'SCYAN PIXEL EDITOR',
  badgeText = 'PIXEL',
  showPresets: _showPresets = true,
  colorMode = 'palette',
  defaultPixelColor = '#00e5a3',
  defaultBgColor = '#0f1013',
  initialDrawColor,
  pixelColor: propPixelColor,
  bgColor: propBgColor,
  allowColorThemes = true,
}) => {
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

  // 2. Editor History Hook (Undo/Redo)
  const {
    grid,
    commitGrid,
    setGrid,
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
  });

  // 3. Canvas & Viewport Hooks
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRafRef = useRef<number | null>(null);

  const {
    zoom,
    pan,
    setPan,
    isSpaceHeld,
    setIsSpaceHeld,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    getGridCoords,
    handleWheel,
  } = useViewport({ containerRef });

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
    selectAll,
    invertSelection,
    nudgeSelection,
  } = useSelectionManager();

  // 5. Tool & Interaction State
  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
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
              commitGrid(newGrid);
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

  // Redraw Base Canvas when grid, zoom, pan, or colors change
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
    });
  }, [grid, zoom, pan, activePixelColor, activeBgColor, isStrictMonochrome]);

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

  const handleSaveJSONFileRef = useRef<() => void>(() => {});

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
        if (e.shiftKey) redo();
        else undo();
        setGhost(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        setGhost(null);
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
      else if (k === 'i') setActiveTool('eyedropper');
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

      // Save shortcut: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && k === 's') {
        e.preventDefault();
        handleSaveJSONFileRef.current?.();
        return;
      }

      // Clipboard shortcuts
      if ((e.ctrlKey || e.metaKey) && k === 'c') {
        e.preventDefault();
        copySelection(grid);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'x') {
        e.preventDefault();
        cutSelection(grid, commitGrid);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'v') {
        e.preventDefault();
        const container = containerRef.current;
        const vpW = container?.clientWidth || 400;
        const vpH = container?.clientHeight || 400;
        const fallbackPos = {
          x: Math.round((-pan.x + vpW / 2) / zoom - 16),
          y: Math.round((-pan.y + vpH / 2) / zoom - 16),
        };
        pasteSelection(grid, commitGrid, activeDrawColor, fallbackPos);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'a') {
        e.preventDefault();
        selectAll(grid);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection && selection.active) {
          e.preventDefault();
          deleteSelection(grid, commitGrid);
          return;
        }
      }

      // Arrow keys: nudge selection or canvas
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 8 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        if (selection && selection.active) {
          nudgeSelection(dx, dy, grid);
        } else {
          const next = new PixelGrid(grid.width, grid.height);
          grid.forEachPixel((x, y) => {
            const tx = x + dx;
            const ty = y + dy;
            if (tx >= 0 && tx < grid.width && ty >= 0 && ty < grid.height) {
              next.set(tx, ty, 1);
            }
          });
          commitGrid(next);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
        setIsPanning(false);
      }
      if (['Shift', 'Control', 'Meta'].includes(e.key)) {
        if (isDrawingRef.current && startPosRef.current && currentCoordsRef.current) {
          const shiftKey = e.key === 'Shift' ? false : e.shiftKey;
          const ctrlKey = e.key === 'Control' || e.key === 'Meta' ? false : e.ctrlKey || e.metaKey;
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
    undo,
    redo,
    isSpaceHeld,
    selection,
    grid,
    commitGrid,
    setIsSpaceHeld,
    setIsPanning,
    copySelection,
    cutSelection,
    pasteSelection,
    selectAll,
    deleteSelection,
    nudgeSelection,
    activeDrawColor,
    pan,
    zoom,
    setSelection,
  ]);

  // Transformations
  const handleInvert = () => invertSelection(grid, commitGrid);
  const handleFlipH = () => commitGrid(grid.flipH(selection?.active ? { minX: selection.x, minY: selection.y, width: selection.w, height: selection.h } : undefined));
  const handleFlipV = () => commitGrid(grid.flipV(selection?.active ? { minX: selection.x, minY: selection.y, width: selection.w, height: selection.h } : undefined));
  const handleRotate90 = () => commitGrid(grid.rotate90(selection?.active ? { minX: selection.x, minY: selection.y, width: selection.w, height: selection.h } : undefined));

  // Pointer Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ghostPlacementRef.current) {
      if (e.button === 0) {
        const gp = ghostPlacementRef.current;
        const targetX = gp.x;
        const targetY = gp.y;
        const next = grid.clone();
        if (gp.gifData && gp.gifData.frames.length > 0) {
          const frameW = Math.round(gp.width / gp.gifData.frames.length);
          gp.gifData.frames.forEach((frame, i) => {
            next.blit(frame.grid, targetX + i * frameW, targetY, true);
          });
          commitGrid(next);
          setSelection({
            x: targetX,
            y: targetY,
            w: gp.width,
            h: gp.height,
            active: true,
          });
        } else {
          next.blit(gp.grid, targetX, targetY, true);
          commitGrid(next);
          setSelection({
            x: targetX,
            y: targetY,
            w: gp.width,
            h: gp.height,
            active: true,
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
        commitGrid(next);
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

    // Floating selection move
    if (
      (activeTool === 'move' || activeTool === 'select') &&
      selection &&
      selection.active &&
      x >= selection.x &&
      x < selection.x + selection.w &&
      y >= selection.y &&
      y < selection.y + selection.h
    ) {
      const extracted = grid.extractColoredRect(selection);
      setFloatingPixels(extracted);
      setGhost({
        pixels: extracted,
        x: selection.x,
        y: selection.y,
        w: selection.w,
        h: selection.h,
        showOutline: true,
        showBackdrop: true,
      });
      setIsMovingSelection(true);
      setMoveStartPos({ x, y });
      return;
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
      const next = grid.clone();
      floodFill(next, x, y, 1, activeDrawColor);
      commitGrid(next);
      recentPaletteRef.current?.pushColor(activeDrawColor);
      return;
    }

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const next = grid.clone();
      const val = activeTool === 'eraser' ? 0 : 1;
      drawBrushDot(next, x, y, val, brushSize, activeDrawColor);
      setIsDrawing(true);
      isDrawingRef.current = true;
      strokeGridRef.current = next;
      commitGrid(next);
      if (val === 1) recentPaletteRef.current?.pushColor(activeDrawColor);
      return;
    }

    // Shape tools begin dragging preview
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
              x: coords.x - Math.floor(prev.width / 2),
              y: coords.y - Math.floor(prev.height / 2),
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
          startPosRef.current = coords;
          setStartPos(coords);
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

    if (isMovingSelection && ghost && selection) {
      const next = grid.clone();
      next.clearRect(selection);
      ghost.pixels.forEach((p) => {
        const rx = p[0];
        const ry = p[1];
        const color = p[2] || activeDrawColor;
        next.set(ghost.x + rx, ghost.y + ry, 1, color);
      });
      commitGrid(next);
      setSelection({
        x: ghost.x,
        y: ghost.y,
        w: ghost.w,
        h: ghost.h,
        active: true,
      });
      setGhost(null);
      setIsMovingSelection(false);
      setFloatingPixels(null);
      return;
    }

    if (!isDrawing || !startPos) {
      setIsDrawing(false);
      isDrawingRef.current = false;
      startPosRef.current = null;
      strokeGridRef.current = null;
      return;
    }

    const coords = getGridCoords(e.clientX, e.clientY);
    currentCoordsRef.current = coords;
    setIsDrawing(false);
    isDrawingRef.current = false;
    startPosRef.current = null;
    strokeGridRef.current = null;
    setGhost(null);

    if (activeTool === 'select') return;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
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
      commitGrid(next);
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

    const isMultiFrame = gifData && gifData.frames.length > 0;
    const frameCount = isMultiFrame ? gifData.frames.length : 1;
    const totalW = w * frameCount;

    const initialX = hoverPos
      ? hoverPos.x - Math.floor(totalW / 2)
      : Math.round((-pan.x + vpW / 2) / zoom - totalW / 2);
    const initialY = hoverPos
      ? hoverPos.y - Math.floor(h / 2)
      : Math.round((-pan.y + vpH / 2) / zoom - h / 2);

    let ghostPixels: ([number, number] | [number, number, string])[] = [];
    let rects: { x: number; y: number; w: number; h: number }[] | undefined = undefined;

    if (isMultiFrame) {
      rects = gifData.frames.map((_, i) => ({
        x: i * w,
        y: 0,
        w,
        h,
      }));
      gifData.frames.forEach((frame, i) => {
        const framePix = frame.grid.getAllColoredPixels();
        framePix.forEach(([rx, ry, col]) => {
          ghostPixels.push([rx + i * w, ry, col]);
        });
      });
    } else {
      ghostPixels = importedGrid.getAllColoredPixels();
    }

    setGhostPlacement({
      grid: importedGrid,
      width: totalW,
      height: h,
      pixels: ghostPixels,
      rects,
      x: initialX,
      y: initialY,
      gifData,
    });
  };

  // Export handlers
  const handleExportPNG = (type: 'colored' | 'monochrome' | 'transparent') => {
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
  };

  const handleExportCArray = () => {
    const cCode = grid.toCArray('CUSTOM_DISPLAY_BITMAP');
    setModalContent({ title: 'Export C 1bpp Array (Zephyr / SSD1306)', text: cCode });
  };

  const handleExportJSON = () => {
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
  };

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

  useEffect(() => {
    handleSaveJSONFileRef.current = handleSaveJSONFile;
  }, [handleSaveJSONFile]);

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
                  commitGrid(newGrid);
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
        onUndo={undo}
        onRedo={redo}
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
      />

      {/* 2. MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        <EditorToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
          activePixelColor={activePixelColor}
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
      </div>

      {/* 3. BOTTOM STATUS BAR */}
      <EditorStatusBar
        activeTool={activeTool}
        activeDrawColor={activeDrawColor}
        isStrictMonochrome={isStrictMonochrome}
        hoverPos={hoverPos}
        grid={grid}
        brushSize={brushSize}
        selection={selection}
        zoom={zoom}
      />

      {/* Image & GIF Import Modal */}
      <ImageImportModal
        isOpen={isImportModalOpen}
        imageSource={importSource}
        canvasWidth={64}
        canvasHeight={64}
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
          onCut={() => cutSelection(grid, commitGrid)}
          onCopy={() => copySelection(grid)}
          onPaste={() => {
            const container = containerRef.current;
            const vpW = container?.clientWidth || 400;
            const vpH = container?.clientHeight || 400;
            const fallbackPos = {
              x: Math.round((-pan.x + vpW / 2) / zoom - 16),
              y: Math.round((-pan.y + vpH / 2) / zoom - 16),
            };
            pasteSelection(grid, commitGrid, activeDrawColor, fallbackPos);
          }}
          onDelete={() => deleteSelection(grid, commitGrid)}
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
};

export const BwpxEditor = PixelEditor;
export const ScyanPixelEditor = PixelEditor;
