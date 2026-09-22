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

export interface UseEditorHistoryOptions {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
}

interface HistoryState {
  history: BwpxGrid[];
  index: number;
}

export function useEditorHistory({
  initialWidth = 64,
  initialHeight = 64,
  initialGrid,
  onGridChange,
}: UseEditorHistoryOptions) {
  const [state, setState] = useState<HistoryState>(() => {
    const startGrid = initialGrid?.clone() ?? new BwpxGrid(initialWidth, initialHeight);
    return {
      history: [startGrid],
      index: 0,
    };
  });

  const stateRef = useRef<HistoryState>(state);

  // Synchronize when initialGrid changes externally
  const prevInitialGridRef = useRef<BwpxGrid | undefined>(initialGrid);
  useEffect(() => {
    if (initialGrid && initialGrid !== prevInitialGridRef.current) {
      prevInitialGridRef.current = initialGrid;
      const nextState: HistoryState = {
        history: [initialGrid.clone()],
        index: 0,
      };
      stateRef.current = nextState;
      setState(nextState);
    }
  }, [initialGrid]);

  const commitGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      const cur = stateRef.current;
      const trimmed = cur.history.slice(0, cur.index + 1);
      trimmed.push(nextCloned);
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
      onGridChange?.(nextCloned);
    },
    [onGridChange]
  );

  const setGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      const cur = stateRef.current;
      const copy = [...cur.history];
      copy[cur.index] = nextCloned;
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
      const nextState: HistoryState = {
        history: [nextCloned],
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
    const nextIndex = cur.index - 1;
    const targetGrid = cur.history[nextIndex];
    const nextState: HistoryState = {
      ...cur,
      index: nextIndex,
    };
    stateRef.current = nextState;
    setState(nextState);
    onGridChange?.(targetGrid);
    return targetGrid;
  }, [onGridChange]);

  const redo = useCallback((): BwpxGrid | null => {
    const cur = stateRef.current;
    if (cur.index >= cur.history.length - 1) return null;
    const nextIndex = cur.index + 1;
    const targetGrid = cur.history[nextIndex];
    const nextState: HistoryState = {
      ...cur,
      index: nextIndex,
    };
    stateRef.current = nextState;
    setState(nextState);
    onGridChange?.(targetGrid);
    return targetGrid;
  }, [onGridChange]);

  return {
    get grid() {
      return stateRef.current.history[stateRef.current.index] ?? stateRef.current.history[0];
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

