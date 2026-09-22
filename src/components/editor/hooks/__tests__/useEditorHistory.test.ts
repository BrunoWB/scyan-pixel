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
});
