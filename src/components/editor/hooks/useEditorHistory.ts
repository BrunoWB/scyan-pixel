import { useState, useCallback } from 'react';
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

  // Synchronize when initialGrid changes externally
  const [prevInitialGrid, setPrevInitialGrid] = useState<BwpxGrid | undefined>(initialGrid);
  if (initialGrid !== prevInitialGrid) {
    setPrevInitialGrid(initialGrid);
    if (initialGrid) {
      setState({
        history: [initialGrid.clone()],
        index: 0,
      });
    }
  }

  const grid = state.history[state.index] ?? state.history[0];

  const commitGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      setState((prev) => {
        const trimmed = prev.history.slice(0, prev.index + 1);
        trimmed.push(nextCloned);
        if (trimmed.length > MAX_HISTORY_LENGTH) {
          const sliced = trimmed.slice(trimmed.length - MAX_HISTORY_LENGTH);
          return {
            history: sliced,
            index: sliced.length - 1,
          };
        }
        return {
          history: trimmed,
          index: trimmed.length - 1,
        };
      });
      onGridChange?.(nextCloned);
    },
    [onGridChange]
  );

  const setGrid = useCallback(
    (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      setState((prev) => {
        const copy = [...prev.history];
        copy[prev.index] = nextCloned;
        return {
          ...prev,
          history: copy,
        };
      });
      onGridChange?.(nextCloned);
    },
    [onGridChange]
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.index <= 0) return prev;
      const nextIndex = prev.index - 1;
      onGridChange?.(prev.history[nextIndex]);
      return {
        ...prev,
        index: nextIndex,
      };
    });
  }, [onGridChange]);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.index >= prev.history.length - 1) return prev;
      const nextIndex = prev.index + 1;
      onGridChange?.(prev.history[nextIndex]);
      return {
        ...prev,
        index: nextIndex,
      };
    });
  }, [onGridChange]);

  const canUndo = state.index > 0;
  const canRedo = state.index < state.history.length - 1;

  return {
    grid,
    setGrid,
    commitGrid,
    undo,
    redo,
    canUndo,
    canRedo,
    historyIndex: state.index,
    historyLength: state.history.length,
  };
}

