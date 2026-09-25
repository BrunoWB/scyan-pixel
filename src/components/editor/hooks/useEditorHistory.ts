import { useState, useCallback, useRef, useEffect } from 'react';
import { BwpxGrid } from '../../../core/PixelGrid';

export const MAX_HISTORY_LENGTH = 50;

/**
 * Pure state machine managing undo/redo history stacks of BwpxGrid instances.
 */
export class EditorHistory {
  private history: BwpxGrid[];
  private index: number;
  readonly maxLen: number;

  constructor(initialGrid: BwpxGrid, maxLen = MAX_HISTORY_LENGTH) {
    this.history = [initialGrid.clone()];
    this.index = 0;
    this.maxLen = maxLen;
  }

  get current(): BwpxGrid {
    return this.history[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.history.length - 1;
  }

  get historyIndex(): number {
    return this.index;
  }

  get length(): number {
    return this.history.length;
  }

  commit(nextGrid: BwpxGrid): BwpxGrid {
    const nextCloned = nextGrid.clone();
    const trimmed = this.history.slice(0, this.index + 1);
    trimmed.push(nextCloned);

    if (trimmed.length > this.maxLen) {
      this.history = trimmed.slice(trimmed.length - this.maxLen);
      this.index = this.history.length - 1;
    } else {
      this.history = trimmed;
      this.index = this.history.length - 1;
    }
    return nextCloned;
  }

  undo(): BwpxGrid | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    return this.history[this.index].clone();
  }

  redo(): BwpxGrid | null {
    if (!this.canRedo) return null;
    this.index += 1;
    return this.history[this.index].clone();
  }

  reset(newGrid: BwpxGrid): void {
    this.history = [newGrid.clone()];
    this.index = 0;
  }
}

export interface HistoryEntry {
  grid: BwpxGrid;
  selection?: { x: number; y: number; w: number; h: number; active: boolean } | null;
  sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[];
}

export interface UseEditorHistoryOptions {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
  onSliceMoveRef?: React.MutableRefObject<((sliceId: string, newX: number, newY: number) => void) | undefined>;
  onSlicesMoveRef?: React.MutableRefObject<((updates: { id: string; dx: number; dy: number }[]) => void) | undefined>;
  selectionRef?: React.MutableRefObject<{ x: number; y: number; w: number; h: number; active: boolean } | null>;
  setSelectionRef?: React.MutableRefObject<((sel: { x: number; y: number; w: number; h: number; active: boolean } | null) => void) | undefined>;
  setSelection?: (sel: { x: number; y: number; w: number; h: number; active: boolean } | null) => void;
}

interface HistoryState {
  history: HistoryEntry[];
  index: number;
}

export function useEditorHistory({
  initialWidth = 64,
  initialHeight = 64,
  initialGrid,
  onGridChange,
  onSliceMoveRef,
  onSlicesMoveRef,
  selectionRef,
  setSelectionRef,
  setSelection,
}: UseEditorHistoryOptions) {
  const [state, setState] = useState<HistoryState>(() => {
    const startGrid = initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight);
    return {
      history: [{ grid: startGrid, selection: null }],
      index: 0,
    };
  });

  const stateRef = useRef<HistoryState>(state);

  // Synchronize when initialGrid changes from outside (e.g. discard changes, repo sync, tab switch)
  const lastCommittedRef = useRef<BwpxGrid | null>(initialGrid ?? null);
  useEffect(() => {
    if (initialGrid && initialGrid !== lastCommittedRef.current) {
      lastCommittedRef.current = initialGrid;
      const nextState: HistoryState = {
        history: [{ grid: initialGrid.clone(), selection: null }],
        index: 0,
      };
      stateRef.current = nextState;
      setState(nextState);
    }
  }, [initialGrid]);

  const commitGrid = useCallback(
    (
      nextGrid: BwpxGrid,
      explicitSelection?: { x: number; y: number; w: number; h: number; active: boolean } | null,
      sliceUpdates?: { id: string; prevX: number; prevY: number; newX: number; newY: number }[]
    ) => {
      const nextCloned = nextGrid.clone();
      lastCommittedRef.current = nextCloned;
      const cur = stateRef.current;
      const trimmed = cur.history.slice(0, cur.index + 1);

      const finalSelection = explicitSelection !== undefined
        ? (explicitSelection ? { ...explicitSelection } : null)
        : (selectionRef?.current ? { ...selectionRef.current } : null);

      trimmed.push({
        grid: nextCloned,
        selection: finalSelection,
        sliceUpdates,
      });

      const history =
        trimmed.length > MAX_HISTORY_LENGTH
          ? trimmed.slice(trimmed.length - MAX_HISTORY_LENGTH)
          : trimmed;
      const nextState: HistoryState = {
        history,
        index: history.length - 1,
      };
      stateRef.current = nextState;
      setState(nextState);
      const applySel = setSelectionRef?.current ?? setSelection;
      if (explicitSelection !== undefined && applySel) {
        applySel(explicitSelection);
      }
      onGridChange?.(nextCloned);
    },
    [onGridChange, selectionRef, setSelectionRef, setSelection]
  );

  const setGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      lastCommittedRef.current = nextCloned;
      const cur = stateRef.current;
      const copy = [...cur.history];
      copy[cur.index] = {
        ...copy[cur.index],
        grid: nextCloned,
      };
      const nextState: HistoryState = {
        ...cur,
        history: copy,
      };
      stateRef.current = nextState;
      setState(nextState);
      onGridChange?.(nextCloned);
    },
    [onGridChange]
  );

  const resetGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      lastCommittedRef.current = nextCloned;
      const nextState: HistoryState = {
        history: [{ grid: nextCloned, selection: null }],
        index: 0,
      };
      stateRef.current = nextState;
      setState(nextState);
      onGridChange?.(nextCloned);
    },
    [onGridChange]
  );

  const undo = useCallback((): BwpxGrid | null => {
    const cur = stateRef.current;
    if (cur.index <= 0) return null;
    const currentEntry = cur.history[cur.index];
    const nextIndex = cur.index - 1;
    const targetEntry = cur.history[nextIndex];
    const targetGrid = targetEntry.grid.clone();
    lastCommittedRef.current = targetGrid;
    const nextState: HistoryState = {
      ...cur,
      index: nextIndex,
    };
    stateRef.current = nextState;
    setState(nextState);

    const applySel = setSelectionRef?.current ?? setSelection;
    if (applySel) {
      applySel(targetEntry.selection ? { ...targetEntry.selection } : null);
    }

    if (currentEntry.sliceUpdates && currentEntry.sliceUpdates.length > 0) {
      if (onSlicesMoveRef?.current) {
        onSlicesMoveRef.current(
          currentEntry.sliceUpdates.map((u) => ({
            id: u.id,
            dx: u.prevX - u.newX,
            dy: u.prevY - u.newY,
          }))
        );
      } else if (onSliceMoveRef?.current) {
        currentEntry.sliceUpdates.forEach((u) => {
          onSliceMoveRef.current?.(u.id, u.prevX, u.prevY);
        });
      }
    }

    onGridChange?.(targetGrid);
    return targetGrid;
  }, [onGridChange, onSliceMoveRef, onSlicesMoveRef, setSelectionRef, setSelection]);

  const redo = useCallback((): BwpxGrid | null => {
    const cur = stateRef.current;
    if (cur.index >= cur.history.length - 1) return null;
    const nextIndex = cur.index + 1;
    const targetEntry = cur.history[nextIndex];
    const targetGrid = targetEntry.grid.clone();
    lastCommittedRef.current = targetGrid;
    const nextState: HistoryState = {
      ...cur,
      index: nextIndex,
    };
    stateRef.current = nextState;
    setState(nextState);

    const applySel = setSelectionRef?.current ?? setSelection;
    if (applySel) {
      applySel(targetEntry.selection ? { ...targetEntry.selection } : null);
    }

    if (targetEntry.sliceUpdates && targetEntry.sliceUpdates.length > 0) {
      if (onSlicesMoveRef?.current) {
        onSlicesMoveRef.current(
          targetEntry.sliceUpdates.map((u) => ({
            id: u.id,
            dx: u.newX - u.prevX,
            dy: u.newY - u.prevY,
          }))
        );
      } else if (onSliceMoveRef?.current) {
        targetEntry.sliceUpdates.forEach((u) => {
          onSliceMoveRef.current?.(u.id, u.newX, u.newY);
        });
      }
    }

    onGridChange?.(targetGrid);
    return targetGrid;
  }, [onGridChange, onSliceMoveRef, onSlicesMoveRef, setSelectionRef, setSelection]);

  return {
    get grid() {
      return stateRef.current.history[stateRef.current.index]?.grid ?? stateRef.current.history[0]?.grid;
    },
    setGrid,
    commitGrid,
    resetGrid,
    undo,
    redo,
    get canUndo() {
      return stateRef.current.index > 0;
    },
    get canRedo() {
      return stateRef.current.index < stateRef.current.history.length - 1;
    },
    get historyIndex() {
      return stateRef.current.index;
    },
    get historyLength() {
      return stateRef.current.history.length;
    },
  };
}

