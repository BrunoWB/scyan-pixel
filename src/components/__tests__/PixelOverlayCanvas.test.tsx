import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { BwpxOverlayCanvas, renderOverlayCanvas } from '../PixelOverlayCanvas';

describe('BwpxOverlayCanvas component & overlay renderer', () => {
  it('renders canvas element with default and custom class names', () => {
    const defaultHtml = renderToString(<BwpxOverlayCanvas />);
    expect(defaultHtml).toContain('<canvas class="bwpx-overlay-canvas"></canvas>');

    const customHtml = renderToString(
      <BwpxOverlayCanvas className="custom-overlay-canvas" style={{ zIndex: 10 }} />
    );
    expect(customHtml).toContain('class="custom-overlay-canvas"');
    expect(customHtml).toContain('z-index:10');
  });

  it('forwards ref properly to underlying canvas element in React tree', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    const element = <BwpxOverlayCanvas ref={canvasRef} />;
    expect(element.props.ref || (element as any).ref).toBeDefined();
  });

  it('renderOverlayCanvas draws marquee and hover highlight without error on mock canvas', () => {
    const mockCtx = {
      imageSmoothingEnabled: true,
      save: () => {},
      restore: () => {},
      translate: () => {},
      clearRect: () => {},
      fillStyle: '',
      fillRect: () => {},
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: () => {},
      strokeRect: () => {},
      shadowColor: '',
      shadowBlur: 0,
      fillText: () => {},
      measureText: () => ({ width: 40 }),
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 800,
      height: 600,
    } as HTMLCanvasElement;

    expect(() => {
      renderOverlayCanvas(mockCanvas, mockCtx, {
        zoom: 10,
        pan: { x: 50, y: 50 },
        hoverPos: { x: 4, y: 5 },
        brushSize: 2,
        showBrushIndicator: true,
        selection: { x: 0, y: 0, w: 16, h: 16, active: true },
        ghost: {
          pixels: [[0, 0], [1, 1]],
          x: 5,
          y: 5,
          w: 8,
          h: 8,
        },
      });
    }).not.toThrow();
  });
});
