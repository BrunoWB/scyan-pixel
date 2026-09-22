import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EditorStatusBar } from '../EditorStatusBar';
import { PixelGrid } from '../../../../core/PixelGrid';

describe('EditorStatusBar', () => {
  it('renders unified artwork bounds and pixel count', () => {
    const grid = new PixelGrid(32, 32);
    grid.set(2, 3, 1);
    grid.set(10, 15, 1);
    grid.set(20, 25, 1);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    // Bounding box from (2,3) to (20,25) is 19x23, with 3 pixels on
    expect(html).toContain('Artwork:');
    expect(html).toContain('19×23');
    expect(html).toContain('(3 px)');
  });

  it('renders Empty when grid has no active pixels', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={10}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    expect(html).toContain('Artwork:');
    expect(html).toContain('Empty');
    expect(html).toContain('(0 px)');
  });

  it('renders fit to screen icon button next to artwork bounds', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={10}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    expect(html).toContain('title="Fit artwork to screen"');
    expect(html).toContain('aria-label="Fit artwork to screen"');
  });

  it('renders zoom input with numeric percentage', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    expect(html).toContain('Zoom:');
    expect(html).toContain('value="1600"');
    expect(html).toContain('%');
  });

  it('renders position at the end of the left section', () => {
    const grid = new PixelGrid(32, 32);

    const htmlWithHover = renderToString(
      <EditorStatusBar
        hoverPos={{ x: 12, y: 18 }}
        grid={grid}
        selection={null}
        zoom={16}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    expect(htmlWithHover).toContain('Pos:');
    expect(htmlWithHover).toContain('12, 18');

    const htmlWithoutHover = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        onZoomChange={vi.fn()}
        onFitToScreen={vi.fn()}
      />
    );

    expect(htmlWithoutHover).toContain('--');
  });

  it('removes tool name, color display, brush size, grid size, and standalone pixels on', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={{ x: 5, y: 5 }}
        grid={grid}
        selection={null}
        zoom={16}
        activeTool="pencil"
        activeDrawColor="#00e5a3"
        isStrictMonochrome={false}
        brushSize={2}
      />
    );

    expect(html).not.toContain('PENCIL');
    expect(html).not.toContain('Color:');
    expect(html).not.toContain('#00E5A3');
    expect(html).not.toContain('Brush:');
    expect(html).not.toContain('Grid:');
    expect(html).not.toContain('Pixels On:');
  });

  it('renders selection info when selection is active', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={{ active: true, x: 0, y: 0, w: 14, h: 20 }}
        zoom={16}
      />
    );

    expect(html).toContain('Selection:');
    expect(html).toContain('14×20');
  });
});
