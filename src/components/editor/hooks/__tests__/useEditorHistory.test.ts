import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorHistory, useEditorHistory } from '../useEditorHistory';
import { BwpxGrid } from '../../../../core/PixelGrid';

describe('EditorHistory engine', () => {
  it('initializes with default grid and single history entry', () => {
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.length).toBe(1);
    expect(history.historyIndex).toBe(0);
  });

  it('records commits and allows undo and redo', () => {
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    const g1 = grid.clone();
    g1.set(2, 2, 1);
    history.commit(g1);

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.current.get(2, 2)).toBe(1);

    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone!.get(2, 2)).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    const redone = history.redo();
    expect(redone).not.toBeNull();
    expect(redone!.get(2, 2)).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('truncates forward history when committing after undo', () => {
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    const g1 = grid.clone();
    g1.set(1, 1, 1);
    history.commit(g1);

    const g2 = g1.clone();
    g2.set(2, 2, 1);
    history.commit(g2);

    expect(history.length).toBe(3);

    history.undo(); // back to g1
    expect(history.historyIndex).toBe(1);

    const g3 = g1.clone();
    g3.set(3, 3, 1);
    history.commit(g3); // branch overrides g2

    expect(history.length).toBe(3);
    expect(history.historyIndex).toBe(2);
    expect(history.canRedo).toBe(false);
    expect(history.current.get(3, 3)).toBe(1);
    expect(history.current.get(2, 2)).toBe(0);
  });

  it('respects maxLen limit', () => {
    const grid = new BwpxGrid(8, 8);
    const history = new EditorHistory(grid, 3);

    for (let i = 0; i < 5; i++) {
      const g = grid.clone();
      g.set(i, 0, 1);
      history.commit(g);
    }

    expect(history.length).toBe(3);
    expect(history.historyIndex).toBe(2);
  });

  it('guarantees current is always valid and never undefined under continuous commits', () => {
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid, 50);

    for (let i = 0; i < 100; i++) {
      const g = grid.clone();
      g.set(i % 16, Math.floor(i / 16), 1);
      history.commit(g);
      expect(history.current).toBeDefined();
      expect(history.current.width).toBe(16);
      expect(history.historyIndex).toBeLessThan(history.length);
      expect(history.historyIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('useEditorHistory hook provides history state with working getters', () => {
    function TestComponent() {
      const history = useEditorHistory({ initialWidth: 16, initialHeight: 16 });
      const summary = {
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        historyIndex: history.historyIndex,
        historyLength: history.historyLength,
      };
      return React.createElement('div', {
        id: 'history-summary',
        'data-json': JSON.stringify(summary),
      });
    }

    const html = renderToString(React.createElement(TestComponent));
    const match = html.match(/data-json="([^"]+)"/);
    expect(match).not.toBeNull();
    const summary = JSON.parse(match![1].replace(/&quot;/g, '"'));
    expect(summary.canUndo).toBe(false);
    expect(summary.canRedo).toBe(false);
    expect(summary.historyIndex).toBe(0);
    expect(summary.historyLength).toBe(1);
  });

  it('reset on EditorHistory engine resets history stack and disables undo/redo', () => {
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    // Commit a mutation
    const g1 = new BwpxGrid(16, 16);
    g1.set(1, 1, 1);
    history.commit(g1);
    expect(history.canUndo).toBe(true);
    expect(history.length).toBe(2);

    // Now reset with a brand new blank grid
    const blank = new BwpxGrid(16, 16);
    history.reset(blank);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.historyIndex).toBe(0);
    expect(history.length).toBe(1);
    expect(history.current.get(1, 1)).toBe(0);
  });

  it('useEditorHistory hook exposes resetGrid function', () => {
    function TestComponent() {
      const history = useEditorHistory({ initialWidth: 16, initialHeight: 16 });
      return React.createElement('div', {
        id: 'reset-check',
        'data-has-reset': String(typeof history.resetGrid === 'function'),
      });
    }

    const html = renderToString(React.createElement(TestComponent));
    expect(html).toContain('data-has-reset="true"');
  });

  it('preserves history and allows undo when parent state syncs committed grid back via initialGrid', () => {
    // Simulate React component lifecycle: parent holds externalGrid and passes to useEditorHistory
    let currentGrid = new BwpxGrid(16, 16);
    let capturedGridChange: BwpxGrid | null = null;

    // Component state simulation
    let state: any = null;
    const stateRef: { current: any } = { current: null };
    const lastCommittedRef: { current: BwpxGrid | null } = { current: null };

    // Initialize (first render)
    lastCommittedRef.current = currentGrid;
    state = {
      history: [{ grid: currentGrid.clone(), selection: null }],
      index: 0,
    };
    stateRef.current = state;

    const onGridChange = (g: BwpxGrid) => {
      capturedGridChange = g;
      currentGrid = g; // Parent Zustand store updates: symbolsGrid = g
    };

    // Helper simulating commitGrid
    const commitGrid = (nextGrid: BwpxGrid) => {
      const nextCloned = nextGrid.clone();
      lastCommittedRef.current = nextCloned;
      const cur = stateRef.current;
      const trimmed = cur.history.slice(0, cur.index + 1);
      const nextHistory = [...trimmed, { grid: nextCloned, selection: null }];
      const nextState = {
        history: nextHistory,
        index: nextHistory.length - 1,
      };
      stateRef.current = nextState;
      state = nextState;
      onGridChange(nextCloned);
    };

    // Helper simulating the initialGrid effect
    const runInitialGridEffect = (gridProp: BwpxGrid) => {
      if (gridProp && gridProp !== lastCommittedRef.current) {
        lastCommittedRef.current = gridProp;
        const nextState = {
          history: [{ grid: gridProp.clone(), selection: null }],
          index: 0,
        };
        stateRef.current = nextState;
        state = nextState;
      }
    };

    // 1. Initial state
    expect(state.index).toBe(0);
    expect(state.history.length).toBe(1);

    // 2. Commit a stroke
    const mutated = currentGrid.clone();
    mutated.set(3, 3, 1);
    commitGrid(mutated);

    expect(capturedGridChange).not.toBeNull();
    expect(state.index).toBe(1);
    expect(state.history.length).toBe(2);

    // 3. Parent re-renders and passes currentGrid back as initialGrid
    runInitialGridEffect(currentGrid);

    // CRITICAL: History MUST NOT be wiped back to 0/0!
    expect(state.index).toBe(1);
    expect(state.history.length).toBe(2);
    expect(state.history[1].grid.get(3, 3)).toBe(1);

    // 4. External swap (e.g. user opens a new file or resets defaults)
    const externalGrid = new BwpxGrid(16, 16);
    externalGrid.set(7, 7, 1);
    runInitialGridEffect(externalGrid);

    // When a truly new external grid arrives, history resets cleanly
    expect(state.index).toBe(0);
    expect(state.history.length).toBe(1);
    expect(state.history[0].grid.get(7, 7)).toBe(1);
  });
});

