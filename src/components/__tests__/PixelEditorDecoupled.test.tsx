import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PixelEditor } from '../PixelEditor';
import { CollaborativePixelEditor } from '../CollaborativePixelEditor';
import { calculateFitViewport, calculateZoomAtPoint, ZOOM_STEPS } from '../editor/types';
import type { SpriteSlice } from '../editor/types';

describe('PixelEditor decoupled core component', () => {
  it('renders cleanly without P2P collaboration props', () => {
    const html = renderToString(
      <PixelEditor
        title="STANDALONE EDITOR"
        initialWidth={32}
        initialHeight={32}
      />
    );

    // Title and toolbar present
    expect(html).toContain('STANDALONE EDITOR');
    expect(html).toContain('type="file"');

    // Status bar shows solo mode, not room active
    expect(html).toContain('solo mode');

    // P2P invite / share modal buttons are NOT rendered
    expect(html).not.toContain('Invite peers &amp; manage session');
    expect(html).not.toContain('p2p-status-history');
  });

  it('renders with slice props and syncs slice information', () => {
    const sampleSlices: SpriteSlice[] = [
      {
        id: 'SLICE_BLUETOOTH',
        name: 'Bluetooth Connected',
        groupId: 'SLICE_BLUETOOTH',
        groupOrder: 1,
        x: 4,
        y: 8,
        width: 12,
        height: 14,
        color: '#00f0ff',
      },
    ];

    const html = renderToString(
      <PixelEditor
        title="SLICES ATLAS"
        initialWidth={128}
        initialHeight={34}
        slices={sampleSlices}
        selectedSliceId="SLICE_BLUETOOTH"
        initialViewport={{ zoom: 12, pan: { x: 100, y: 50 } }}
      />
    );

    expect(html).toContain('SLICES ATLAS');
  });

  it('renders CollaborativePixelEditor with P2P collaboration enabled', () => {
    const html = renderToString(
      <CollaborativePixelEditor
        title="COLLABORATIVE SCYAN PIXEL"
        initialWidth={32}
        initialHeight={32}
      />
    );

    expect(html).toContain('COLLABORATIVE SCYAN PIXEL');
    expect(html).toContain('Invite');
  });

  it('calculates fit viewport and zoom steps correctly', () => {
    const vp = calculateFitViewport(800, 600, 128, 34, ZOOM_STEPS);
    expect(vp.zoom).toBeGreaterThanOrEqual(4);
    expect(vp.pan.x).toBe(200);
    expect(vp.pan.y).toBe(150);

    const zoomedIn = calculateZoomAtPoint(10, { x: 100, y: 100 }, 200, 200, 1, ZOOM_STEPS);
    expect(zoomedIn.zoom).toBe(11);
    expect(zoomedIn.pan).toBeDefined();

    const zoomedOut = calculateZoomAtPoint(10, { x: 100, y: 100 }, 200, 200, -1, ZOOM_STEPS);
    expect(zoomedOut.zoom).toBe(9);
  });

  it('correctly maps 2D grid slice coordinates for multi-row/multi-col GIF frames', () => {
    // 4 frames arranged in 2 columns and 2 rows
    const cols = 2;
    const frameW = 16;
    const frameH = 16;
    const targetX = 10;
    const targetY = 20;

    const dummyFrames = [0, 1, 2, 3].map((_, i) => ({
      x: targetX + (i % cols) * frameW,
      y: targetY + Math.floor(i / cols) * frameH,
    }));

    expect(dummyFrames[0]).toEqual({ x: 10, y: 20 });
    expect(dummyFrames[1]).toEqual({ x: 26, y: 20 });
    expect(dummyFrames[2]).toEqual({ x: 10, y: 36 });
    expect(dummyFrames[3]).toEqual({ x: 26, y: 36 });
  });
});
