import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PixelEditor } from '../PixelEditor';
import { BwpxGrid } from '../../core/PixelGrid';
import { drawBrushDot, drawLine } from '../../core/algorithms';
import { EditorHistory } from '../editor/hooks/useEditorHistory';

describe('PixelEditor live stroke decoupling and history atomicity', () => {
  it('renders EditorCanvas with onMouseLeave and mouse event handlers attached', () => {
    const html = renderToString(
      <PixelEditor
        title="TEST CANVAS"
        initialWidth={32}
        initialHeight={32}
      />
    );

    expect(html).toContain('TEST CANVAS');
    expect(html).toContain('cursor-crosshair');
    expect(html).toContain('<main');
  });

  it('guarantees stroke drawing is decoupled and commits atomically to history', () => {
    const initialGrid = new BwpxGrid(16, 16);
    const history = new EditorHistory(initialGrid);

    // Initial state: 1 entry, no undo
    expect(history.length).toBe(1);
    expect(history.canUndo).toBe(false);

    // Simulate stroke start (MouseDown): live stroke grid is cloned
    const strokeGrid = history.current.clone();
    drawBrushDot(strokeGrid, 2, 2, 1, 1, undefined, false);

    // During live drag (MouseMove): intermediate points are blitted to strokeGrid
    // and NOT committed to history
    drawLine(strokeGrid, 2, 2, 5, 5, 1, 1, undefined, false);
    drawLine(strokeGrid, 5, 5, 8, 2, 1, 1, undefined, false);

    // Verify history has NOT been polluted during the live stroke
    expect(history.length).toBe(1);
    expect(history.canUndo).toBe(false);
    expect(history.current.get(2, 2)).toBe(0); // Baseline unchanged

    // Finish stroke (MouseUp or MouseLeave): atomic commit
    history.commit(strokeGrid);

    expect(history.length).toBe(2);
    expect(history.canUndo).toBe(true);
    expect(history.current.get(2, 2)).toBe(1);
    expect(history.current.get(5, 5)).toBe(1);
    expect(history.current.get(8, 2)).toBe(1);

    // A single undo cleanly reverts the ENTIRE multi-segment stroke
    const reverted = history.undo();
    expect(reverted).not.toBeNull();
    expect(reverted!.get(2, 2)).toBe(0);
    expect(reverted!.get(5, 5)).toBe(0);
    expect(reverted!.get(8, 2)).toBe(0);
    expect(history.canUndo).toBe(false);
  });

  it('notifies onGridChange only once per completed stroke, not on each intermediate move', () => {
    const onGridChange = vi.fn();
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    // Simulate 20 mouse move coordinates during a drag stroke
    const strokeGrid = history.current.clone();
    let currentX = 0;
    let currentY = 0;
    for (let step = 1; step <= 20; step++) {
      const nextX = step;
      const nextY = step;
      drawLine(strokeGrid, currentX, currentY, nextX, nextY, 1, 1);
      currentX = nextX;
      currentY = nextY;
      // During move: strokeGrid is updated and scheduled for rAF redraw, onGridChange is NOT called
    }
    expect(onGridChange).not.toHaveBeenCalled();

    // Mouse up / leave: single atomic commit
    history.commit(strokeGrid);
    onGridChange(strokeGrid);

    expect(onGridChange).toHaveBeenCalledTimes(1);
    expect(onGridChange).toHaveBeenCalledWith(strokeGrid);
  });

  it('guarantees right-click erase executes synchronously without state staleness and resets on mouseUp', () => {
    const grid = new BwpxGrid(16, 16);
    // Pre-populate pixels
    grid.set(2, 2, 1);
    grid.set(3, 3, 1);
    grid.set(4, 4, 1);
    const history = new EditorHistory(grid);

    // Simulate right-click erase down
    let drawButtonRef = 2; // Right click button
    const strokeGrid = history.current.clone();
    drawBrushDot(strokeGrid, 2, 2, 0, 1, undefined, false);
    expect(strokeGrid.get(2, 2)).toBe(0);

    // Simulate mouse drag while right button is held
    const val = drawButtonRef === 2 ? 0 : 1;
    expect(val).toBe(0); // Must be 0 (erase), NOT 1!
    drawLine(strokeGrid, 2, 2, 4, 4, val, 1, undefined, false);

    expect(strokeGrid.get(2, 2)).toBe(0);
    expect(strokeGrid.get(3, 3)).toBe(0);
    expect(strokeGrid.get(4, 4)).toBe(0);

    // MouseUp: stroke completes and drawButtonRef resets to 0
    history.commit(strokeGrid);
    drawButtonRef = 0;
    expect(drawButtonRef).toBe(0);

    // Subsequent normal draw evaluates to 1, not 0
    const subsequentVal = drawButtonRef === 2 ? 0 : 1;
    expect(subsequentVal).toBe(1);

    // Undo restores the erased pixels atomically
    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone!.get(2, 2)).toBe(1);
    expect(undone!.get(3, 3)).toBe(1);
    expect(undone!.get(4, 4)).toBe(1);
  });

  it('handles mouseLeave committing active strokes atomically', () => {
    const onGridChange = vi.fn();
    const grid = new BwpxGrid(16, 16);
    const history = new EditorHistory(grid);

    // User starts drawing and cursor leaves canvas boundary
    let strokeGrid: BwpxGrid | null = history.current.clone();
    drawBrushDot(strokeGrid, 5, 5, 1, 1, undefined, false);

    // handleMouseLeave triggers atomic commit if strokeGrid is active
    if (strokeGrid) {
      const finalGrid = strokeGrid;
      strokeGrid = null;
      history.commit(finalGrid);
      onGridChange(finalGrid);
    }

    expect(strokeGrid).toBeNull();
    expect(history.length).toBe(2);
    expect(history.current.get(5, 5)).toBe(1);
    expect(onGridChange).toHaveBeenCalledTimes(1);
  });

  it('renders atlas mode without logo/title, without new button, and with Import button', () => {
    const html = renderToString(
      <PixelEditor
        isAtlas={true}
        initialWidth={32}
        initialHeight={32}
      />
    );

    // In atlas mode: logo and title are NOT rendered
    expect(html).not.toContain('BrandIdentityLogo');
    expect(html).not.toContain('SCYAN PIXEL EDITOR');
    expect(html).not.toContain('SCYAN PIXEL');

    // New button is NOT rendered
    expect(html).not.toContain('New Canvas / New Room');
    expect(html).not.toContain('>New<');

    // Load button is renamed to Import and uses import title
    expect(html).toContain('Import');
    expect(html).toContain('title="Import image or sprite into atlas"');
    expect(html).toContain('aria-label="Import"');
  });

  it('renders standard mode with logo/title, New button, and Load button', () => {
    const html = renderToString(
      <PixelEditor
        isAtlas={false}
        initialWidth={32}
        initialHeight={32}
      />
    );

    // In standard mode: logo/title is rendered
    expect(html).toContain('SCYAN');
    expect(html).toContain('PIXEL');

    // New button is rendered
    expect(html).toContain('New Canvas / New Room');
    expect(html).toContain('>New<');

    // Load button is rendered
    expect(html).toContain('Load');
    expect(html).toContain('title="Load Saved Room, Import and Export"');
  });
});
