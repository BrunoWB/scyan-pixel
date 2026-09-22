import { useState, useCallback } from 'react';
import { BwpxGrid } from '../../../core/PixelGrid';
import type { SelectionOverlay } from '../../../core/gridRenderer';

export function useSelectionManager() {
  const [selection, setSelection] = useState<SelectionOverlay | null>(null);
  const [floatingPixels, setFloatingPixels] = useState<[number, number, string][] | null>(null);
  const [isMovingSelection, setIsMovingSelection] = useState<boolean>(false);
  const [moveStartPos, setMoveStartPos] = useState<{ x: number; y: number } | null>(null);

  const copySelection = useCallback((grid: BwpxGrid) => {
    if (!selection || !selection.active) return;
    const sub = grid.getSubRect(selection.x, selection.y, selection.w, selection.h);
    const json = JSON.stringify({
      scyanPxClip: true,
      bwpxClip: true,
      width: sub.width,
      height: sub.height,
      coloredPixels: sub.getAllColoredPixels(),
      data: Array.from(sub.data),
    });
    navigator.clipboard.writeText(json).catch(() => {});
  }, [selection]);

  const cutSelection = useCallback(
    (grid: BwpxGrid, commitGrid: (g: BwpxGrid) => void) => {
      if (!selection || !selection.active) return;
      copySelection(grid);
      const next = grid.clone();
      next.clearRect(selection);
      commitGrid(next);
      setSelection(null);
    },
    [copySelection, selection]
  );

  const pasteSelection = useCallback(
    async (
      grid: BwpxGrid,
      commitGrid: (g: BwpxGrid) => void,
      activeDrawColor: string,
      fallbackPos: { x: number; y: number }
    ) => {
      try {
        const text = await navigator.clipboard.readText();
        if (text.includes('scyanPxClip') || text.includes('bwpxClip')) {
          const parsed = JSON.parse(text);
          if (parsed.width && parsed.height) {
            const pasteGrid = new BwpxGrid(
              parsed.width,
              parsed.height,
              parsed.coloredPixels || parsed.data,
              undefined,
              activeDrawColor
            );
            const next = grid.clone();
            const dstX = selection ? selection.x : fallbackPos.x;
            const dstY = selection ? selection.y : fallbackPos.y;
            next.blit(pasteGrid, dstX, dstY, true);
            commitGrid(next);
            setSelection({
              x: dstX,
              y: dstY,
              w: pasteGrid.width,
              h: pasteGrid.height,
              active: true,
            });
          }
        }
      } catch (e) {
        console.warn('Clipboard read failed:', e);
      }
    },
    [selection]
  );

  const deleteSelection = useCallback(
    (grid: BwpxGrid, commitGrid: (g: BwpxGrid) => void) => {
      if (!selection || !selection.active) return;
      const next = grid.clone();
      next.clearRect(selection);
      commitGrid(next);
      setSelection(null);
    },
    [selection]
  );

  const selectAll = useCallback((grid: BwpxGrid) => {
    setSelection({
      x: 0,
      y: 0,
      w: grid.width,
      h: grid.height,
      active: true,
    });
  }, []);

  const invertSelection = useCallback(
    (grid: BwpxGrid, commitGrid: (g: BwpxGrid) => void) => {
      const next = grid.invert(
        selection && selection.active
          ? { minX: selection.x, minY: selection.y, width: selection.w, height: selection.h }
          : undefined
      );
      commitGrid(next);
    },
    [selection]
  );

  const outlineSelection = useCallback(
    (grid: BwpxGrid, commitGrid: (g: BwpxGrid) => void, color: string) => {
      if (!selection || !selection.active) return;
      const next = grid.clone();
      for (let x = selection.x; x < selection.x + selection.w; x++) {
        next.set(x, selection.y, 1, color);
        next.set(x, selection.y + selection.h - 1, 1, color);
      }
      for (let y = selection.y; y < selection.y + selection.h; y++) {
        next.set(selection.x, y, 1, color);
        next.set(selection.x + selection.w - 1, y, 1, color);
      }
      commitGrid(next);
    },
    [selection]
  );

  const fillSelection = useCallback(
    (grid: BwpxGrid, commitGrid: (g: BwpxGrid) => void, color: string) => {
      if (!selection || !selection.active) return;
      const next = grid.clone();
      for (let y = selection.y; y < selection.y + selection.h; y++) {
        for (let x = selection.x; x < selection.x + selection.w; x++) {
          next.set(x, y, 1, color);
        }
      }
      commitGrid(next);
    },
    [selection]
  );

  const nudgeSelection = useCallback(
    (dx: number, dy: number, grid: BwpxGrid) => {
      if (!selection || !selection.active) return;
      const newX = Math.max(0, Math.min(grid.width - selection.w, selection.x + dx));
      const newY = Math.max(0, Math.min(grid.height - selection.h, selection.y + dy));
      setSelection({ ...selection, x: newX, y: newY });
    },
    [selection]
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    setFloatingPixels(null);
    setIsMovingSelection(false);
    setMoveStartPos(null);
  }, []);

  return {
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
    outlineSelection,
    fillSelection,
    nudgeSelection,
    clearSelection,
  };
}

