import { describe, it, expect, vi } from 'vitest';
import { renderOverlayCanvas, type GhostOverlay, type SelectionOverlay } from '../gridRenderer';

function createMockCanvasAndContext() {
  const canvas = {
    width: 800,
    height: 600,
  } as unknown as HTMLCanvasElement;

  const calls: { method: string; args: unknown[] }[] = [];

  const ctx = {
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] })
    ),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'clearRect', args: [x, y, w, h] })
    ),
    setLineDash: vi.fn((dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] })),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    imageSmoothingEnabled: false,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
  } as unknown as CanvasRenderingContext2D;

  return { canvas, ctx, calls };
}

describe('renderOverlayCanvas', () => {
  it('does NOT render bounding outline or backdrop when ghost is a shape preview (showOutline and showBackdrop false)', () => {
    const { canvas, ctx, calls } = createMockCanvasAndContext();

    const shapeGhost: GhostOverlay = {
      pixels: [[2, 2, '#00e5a3'], [3, 2, '#00e5a3']],
      x: 0,
      y: 0,
      w: 64,
      h: 64,
      showOutline: false,
      showBackdrop: false,
    };

    renderOverlayCanvas(canvas, ctx, {
      zoom: 10,
      pan: { x: 0, y: 0 },
      ghost: shapeGhost,
      selection: null,
      hoverPos: null,
    });

    // Should NOT call strokeRect for a bounding box / selection marquee
    const strokeCalls = calls.filter((c) => c.method === 'strokeRect');
    expect(strokeCalls).toHaveLength(0);

    // fillRect should only be called for the 2 shape pixels, NOT the 64x64 grid backdrop
    const fillRectCalls = calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls).toHaveLength(2);
    // Verifying pixel coords were rendered
    expect(fillRectCalls[0].args).toEqual([20, 20, 10, 10]);
    expect(fillRectCalls[1].args).toEqual([30, 20, 10, 10]);
  });

  it('renders bounding outline and backdrop when ghost explicitly has showOutline and showBackdrop true (selection move)', () => {
    const { canvas, ctx, calls } = createMockCanvasAndContext();

    const movingSelectionGhost: GhostOverlay = {
      pixels: [[0, 0, '#00e5a3']],
      x: 5,
      y: 5,
      w: 10,
      h: 10,
      showOutline: true,
      showBackdrop: true,
    };

    renderOverlayCanvas(canvas, ctx, {
      zoom: 10,
      pan: { x: 0, y: 0 },
      ghost: movingSelectionGhost,
      selection: null,
      hoverPos: null,
    });

    // Should call strokeRect for moving selection outline
    const strokeCalls = calls.filter((c) => c.method === 'strokeRect');
    expect(strokeCalls.length).toBeGreaterThan(0);
    expect(strokeCalls[0].args).toEqual([50.5, 50.5, 100, 100]);

    // Should fill backdrop, pixel, and marquee tint
    const fillRectCalls = calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBe(3); // backdrop + pixel + marquee fill
  });

  it('renders selection marquee when an active selection is passed', () => {
    const { canvas, ctx, calls } = createMockCanvasAndContext();

    const selection: SelectionOverlay = {
      x: 2,
      y: 3,
      w: 4,
      h: 5,
      active: true,
    };

    renderOverlayCanvas(canvas, ctx, {
      zoom: 10,
      pan: { x: 0, y: 0 },
      ghost: null,
      selection,
      hoverPos: null,
    });

    const strokeCalls = calls.filter((c) => c.method === 'strokeRect');
    expect(strokeCalls).toHaveLength(1);
    expect(strokeCalls[0].args).toEqual([20.5, 30.5, 40, 50]);
  });
});

