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

  it('renders solo mode when isRoomActive is false or omitted', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        isRoomActive={false}
      />
    );

    expect(html).toContain('solo mode');
    expect(html).toContain('data-slot="p2p-status"');
  });

  it('renders waiting for peers status when room is active with 0 peers', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        isRoomActive={true}
        roomId="montreal-lion-roar"
        peerCount={0}
      />
    );

    expect(html).toContain('waiting for peers');
    expect(html).toContain('(montreal-lion-roar)');
    expect(html).toContain('bg-cyan-400/90');
  });

  it('renders connected peer count when room is active with peers', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        isRoomActive={true}
        roomId="montreal-lion-roar"
        peerCount={2}
      />
    );

    expect(html).toContain('2 peers');
    expect(html).toContain('(montreal-lion-roar)');
    expect(html).toContain('bg-emerald-400');
  });

  it('renders status history popover with timestamps when opened', () => {
    const grid = new PixelGrid(32, 32);
    const testEvents = [
      {
        id: 'evt-1',
        timestamp: 1727042000000,
        type: 'peer_join' as const,
        message: 'Falcon connected',
      },
      {
        id: 'evt-2',
        timestamp: 1727042015000,
        type: 'sync' as const,
        message: 'Synchronized canvas snapshot with 16 pixels',
      },
      {
        id: 'evt-3',
        timestamp: 1727042030000,
        type: 'save' as const,
        message: 'Autosaved "montreal-lion-roar" to IndexedDB (16 px)',
      },
    ];

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        isRoomActive={true}
        roomId="montreal-lion-roar"
        peerCount={1}
        statusEvents={testEvents}
        defaultHistoryOpen={true}
        onClearStatusEvents={vi.fn()}
        onOpenInvite={vi.fn()}
      />
    );

    expect(html).toContain('data-slot="p2p-status-history"');
    expect(html).toContain('P2P Status &amp; Activity Log');
    expect(html).toContain('Falcon connected');
    expect(html).toContain('Synchronized canvas snapshot with 16 pixels');
    expect(html).toContain('Autosaved &quot;montreal-lion-roar&quot; to IndexedDB (16 px)');
    expect(html).toContain('Invite');
  });

  it('renders empty history message when no events are recorded', () => {
    const grid = new PixelGrid(32, 32);

    const html = renderToString(
      <EditorStatusBar
        hoverPos={null}
        grid={grid}
        selection={null}
        zoom={16}
        isRoomActive={true}
        roomId="montreal-lion-roar"
        statusEvents={[]}
        defaultHistoryOpen={true}
      />
    );

    expect(html).toContain('data-slot="p2p-status-history"');
    expect(html).toContain('No status events recorded yet');
  });
});
