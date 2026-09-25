import { describe, it, expect } from 'vitest';
import { BwpxGrid } from '../PixelGrid';
import {
  drawEllipse,
  drawBrushDot,
  drawArrow,
  calculateShapeEndpoints,
  drawShape,
  isShapeTool,
  SHAPE_TOOLS,
  floodFill,
  isPixelInBrush,
} from '../algorithms';

describe('algorithms', () => {
  describe('drawBrushDot', () => {
    it('draws a 1x1 dot at brushSize=1', () => {
      const grid = new BwpxGrid(10, 10);
      drawBrushDot(grid, 5, 5, 1, 1);
      expect(grid.get(5, 5)).toBe(1);
      expect(grid.countOn()).toBe(1);
    });

    it('draws a 2x2 dot at brushSize=2', () => {
      const grid = new BwpxGrid(10, 10);
      drawBrushDot(grid, 5, 5, 1, 2);
      expect(grid.countOn()).toBe(4);
      expect(grid.get(4, 4)).toBe(1);
      expect(grid.get(5, 4)).toBe(1);
      expect(grid.get(4, 5)).toBe(1);
      expect(grid.get(5, 5)).toBe(1);
    });

    it('draws a 3x3 dot at brushSize=3 centered on coordinate', () => {
      const grid = new BwpxGrid(10, 10);
      drawBrushDot(grid, 5, 5, 1, 3);
      expect(grid.countOn()).toBe(9);
      for (let y = 4; y <= 6; y++) {
        for (let x = 4; x <= 6; x++) {
          expect(grid.get(x, y)).toBe(1);
        }
      }
    });
  });

  describe('drawEllipse', () => {
    it('draws a 1-pixel outline circle with proper symmetry', () => {
      const grid = new BwpxGrid(16, 16);
      drawEllipse(grid, 0, 0, 8, 8, 1, false, 1);

      // Top and bottom flats
      expect(grid.get(3, 0)).toBe(1);
      expect(grid.get(4, 0)).toBe(1);
      expect(grid.get(5, 0)).toBe(1);
      expect(grid.get(3, 8)).toBe(1);
      expect(grid.get(4, 8)).toBe(1);
      expect(grid.get(5, 8)).toBe(1);

      // Left and right flats
      expect(grid.get(0, 3)).toBe(1);
      expect(grid.get(0, 4)).toBe(1);
      expect(grid.get(0, 5)).toBe(1);
      expect(grid.get(8, 3)).toBe(1);
      expect(grid.get(8, 4)).toBe(1);
      expect(grid.get(8, 5)).toBe(1);

      // Center should remain empty (it is an outline)
      expect(grid.get(4, 4)).toBe(0);

      // Check bounds
      const bounds = grid.getBounds();
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(8);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(8);
    });

    it('produces identical outlines regardless of drag direction', () => {
      const g1 = new BwpxGrid(16, 16);
      const g2 = new BwpxGrid(16, 16);
      const g3 = new BwpxGrid(16, 16);
      const g4 = new BwpxGrid(16, 16);

      drawEllipse(g1, 2, 2, 10, 10, 1, false, 1);
      drawEllipse(g2, 10, 10, 2, 2, 1, false, 1);
      drawEllipse(g3, 2, 10, 10, 2, 1, false, 1);
      drawEllipse(g4, 10, 2, 2, 10, 1, false, 1);

      const toCoordStrings = (g: BwpxGrid) =>
        g.getAllPixels().map(([x, y]) => `${x},${y}`).sort();

      const pix1 = toCoordStrings(g1);
      const pix2 = toCoordStrings(g2);
      const pix3 = toCoordStrings(g3);
      const pix4 = toCoordStrings(g4);

      expect(pix1).toEqual(pix2);
      expect(pix1).toEqual(pix3);
      expect(pix1).toEqual(pix4);
    });

    it('uses the current brush thickness for circle outline', () => {
      const gridThick1 = new BwpxGrid(20, 20);
      const gridThick2 = new BwpxGrid(20, 20);
      const gridThick3 = new BwpxGrid(20, 20);

      drawEllipse(gridThick1, 2, 2, 16, 16, 1, false, 1);
      drawEllipse(gridThick2, 2, 2, 16, 16, 1, false, 2);
      drawEllipse(gridThick3, 2, 2, 16, 16, 1, false, 3);

      const count1 = gridThick1.countOn();
      const count2 = gridThick2.countOn();
      const count3 = gridThick3.countOn();

      expect(count2).toBeGreaterThan(count1);
      expect(count3).toBeGreaterThan(count2);

      // Verify that at thickness 3, the stroke extends outward and inward
      expect(gridThick3.get(1, 9)).toBe(1); // 1 pixel outside of minX (minX = 2)
      expect(gridThick3.get(3, 9)).toBe(1); // 1 pixel inside
    });

    it('renders filled circle completely filling interior and matching bounds', () => {
      const grid = new BwpxGrid(16, 16);
      drawEllipse(grid, 0, 0, 8, 8, 1, true, 1);

      // Center must be filled
      expect(grid.get(4, 4)).toBe(1);
      // All intermediate points inside the circle
      for (let y = 3; y <= 5; y++) {
        for (let x = 3; x <= 5; x++) {
          expect(grid.get(x, y)).toBe(1);
        }
      }

      // Corners outside the circle should remain 0
      expect(grid.get(0, 0)).toBe(0);
      expect(grid.get(8, 0)).toBe(0);
      expect(grid.get(0, 8)).toBe(0);
      expect(grid.get(8, 8)).toBe(0);

      // Cardinal perimeter pixels should be 1
      expect(grid.get(4, 0)).toBe(1);
      expect(grid.get(4, 8)).toBe(1);
      expect(grid.get(0, 4)).toBe(1);
      expect(grid.get(8, 4)).toBe(1);
    });

    it('handles degenerate cases: single point, width 0, height 0', () => {
      // 1x1 point
      const gPoint = new BwpxGrid(10, 10);
      drawEllipse(gPoint, 3, 3, 3, 3, 1, false, 1);
      expect(gPoint.countOn()).toBe(1);
      expect(gPoint.get(3, 3)).toBe(1);

      // Vertical line (width 0)
      const gVert = new BwpxGrid(10, 10);
      drawEllipse(gVert, 4, 1, 4, 6, 1, false, 1);
      expect(gVert.countOn()).toBe(6);
      for (let y = 1; y <= 6; y++) {
        expect(gVert.get(4, y)).toBe(1);
      }

      // Horizontal line (height 0)
      const gHoriz = new BwpxGrid(10, 10);
      drawEllipse(gHoriz, 2, 5, 7, 5, 1, false, 1);
      expect(gHoriz.countOn()).toBe(6);
      for (let x = 2; x <= 7; x++) {
        expect(gHoriz.get(x, 5)).toBe(1);
      }
    });

    it('supports custom color and val=0 eraser', () => {
      const grid = new BwpxGrid(16, 16);
      drawEllipse(grid, 2, 2, 8, 8, 1, false, 1, '#ff00ff');
      expect(grid.getColor(5, 2)).toBe('#ff00ff');

      // Erase
      drawEllipse(grid, 2, 2, 8, 8, 0, false, 1);
      expect(grid.get(5, 2)).toBe(0);
    });
  });

  describe('drawArrow', () => {
    it('draws an arrow with an outline head by default', () => {
      const grid = new BwpxGrid(32, 32);
      drawArrow(grid, 4, 16, 24, 16, 1, 1, '#00e5a3', false);

      // Shaft should be drawn
      expect(grid.get(4, 16)).toBe(1);
      expect(grid.get(24, 16)).toBe(1);
      expect(grid.countOn()).toBeGreaterThan(10);
    });

    it('draws an arrow with a filled head with more pixels than outline head', () => {
      const gridOutline = new BwpxGrid(32, 32);
      const gridFilled = new BwpxGrid(32, 32);

      drawArrow(gridOutline, 4, 16, 26, 16, 1, 1, '#00e5a3', false);
      drawArrow(gridFilled, 4, 16, 26, 16, 1, 1, '#00e5a3', true);

      // Both should have the tip drawn
      expect(gridOutline.get(26, 16)).toBe(1);
      expect(gridFilled.get(26, 16)).toBe(1);

      // Filled head arrow should have more pixels than outline head
      expect(gridFilled.countOn()).toBeGreaterThan(gridOutline.countOn());
    });
  });

  describe('calculateShapeEndpoints', () => {
    const start = { x: 50, y: 50 };

    describe('line and arrow snapping (Shift)', () => {
      it('snaps horizontal right (0 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 70, y: 52 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 70, y1: 50 });
      });

      it('snaps diagonal down-right (45 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 70, y: 68 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 70, y1: 70 });
      });

      it('snaps vertical down (90 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 52, y: 70 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 50, y1: 70 });
      });

      it('snaps diagonal down-left (135 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 30, y: 72 }, { shiftKey: true });
        // dx = -20, dy = 22 -> max len = 22
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 28, y1: 72 });
      });

      it('snaps horizontal left (180 deg)', () => {
        const pt = calculateShapeEndpoints('arrow', start, { x: 20, y: 51 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 20, y1: 50 });
      });

      it('snaps diagonal up-left (225 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 35, y: 35 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 35, y1: 35 });
      });

      it('snaps vertical up (270 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 49, y: 20 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 50, y1: 20 });
      });

      it('snaps diagonal up-right (315 deg)', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 65, y: 35 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 65, y1: 35 });
      });

      it('handles zero delta without crashing', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 50, y: 50 }, { shiftKey: true });
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 50, y1: 50 });
      });
    });

    describe('bounding-box shapes proportional 1:1 (Shift)', () => {
      it('constrains rectangle to a square', () => {
        const pt = calculateShapeEndpoints('rect', start, { x: 60, y: 75 }, { shiftKey: true });
        // dx = 10, dy = 25 -> size = 25 -> x1 = 50 + 25 = 75, y1 = 50 + 25 = 75
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 75, y1: 75 });
      });

      it('constrains ellipse to a circle across negative quadrant', () => {
        const pt = calculateShapeEndpoints('ellipse', start, { x: 30, y: 40 }, { shiftKey: true });
        // dx = -20, dy = -10 -> size = 20 -> x1 = 50 - 20 = 30, y1 = 50 - 20 = 30
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 30, y1: 30 });
      });

      it('constrains triangle proportionally in mixed quadrant', () => {
        const pt = calculateShapeEndpoints('triangle', start, { x: 70, y: 35 }, { shiftKey: true });
        // dx = 20, dy = -15 -> size = 20 -> x1 = 50 + 20 = 70, y1 = 50 - 20 = 30
        expect(pt).toEqual({ x0: 50, y0: 50, x1: 70, y1: 30 });
      });
    });

    describe('center origin (Ctrl)', () => {
      it('makes start position the center of a rectangle', () => {
        const pt = calculateShapeEndpoints('rect', start, { x: 60, y: 55 }, { ctrlKey: true });
        // dx = 10, dy = 5 -> from = (40, 45), to = (60, 55)
        expect(pt).toEqual({ x0: 40, y0: 45, x1: 60, y1: 55 });
        expect((pt.x0 + pt.x1) / 2).toBe(start.x);
        expect((pt.y0 + pt.y1) / 2).toBe(start.y);
      });

      it('makes start position the center of a line', () => {
        const pt = calculateShapeEndpoints('line', start, { x: 70, y: 60 }, { ctrlKey: true });
        expect(pt).toEqual({ x0: 30, y0: 40, x1: 70, y1: 60 });
        expect((pt.x0 + pt.x1) / 2).toBe(start.x);
        expect((pt.y0 + pt.y1) / 2).toBe(start.y);
      });
    });

    describe('combined Shift + Ctrl', () => {
      it('draws a square centered at origin', () => {
        const pt = calculateShapeEndpoints(
          'rect',
          start,
          { x: 60, y: 55 },
          { shiftKey: true, ctrlKey: true }
        );
        // dx = 10, dy = 5 -> size = 10 -> snapped = (10, 10)
        // center at (50, 50) -> x0 = 40, y0 = 40, x1 = 60, y1 = 60
        expect(pt).toEqual({ x0: 40, y0: 40, x1: 60, y1: 60 });
        expect((pt.x0 + pt.x1) / 2).toBe(start.x);
        expect((pt.y0 + pt.y1) / 2).toBe(start.y);
        expect(pt.x1 - pt.x0).toBe(pt.y1 - pt.y0);
      });

      it('draws a 45-degree line centered at origin', () => {
        const pt = calculateShapeEndpoints(
          'line',
          start,
          { x: 65, y: 62 },
          { shiftKey: true, ctrlKey: true }
        );
        // dx = 15, dy = 12 -> snaps to 45 deg: snappedDx = 15, snappedDy = 15
        // center at (50, 50) -> (35, 35) to (65, 65)
        expect(pt).toEqual({ x0: 35, y0: 35, x1: 65, y1: 65 });
        expect((pt.x0 + pt.x1) / 2).toBe(start.x);
        expect((pt.y0 + pt.y1) / 2).toBe(start.y);
      });
    });
  });

  describe('isShapeTool and drawShape', () => {
    it('identifies shape tools correctly', () => {
      expect(isShapeTool('line')).toBe(true);
      expect(isShapeTool('rect')).toBe(true);
      expect(isShapeTool('filled-rect')).toBe(true);
      expect(isShapeTool('ellipse')).toBe(true);
      expect(isShapeTool('arrow')).toBe(true);
      expect(isShapeTool('pencil')).toBe(false);
      expect(isShapeTool('eraser')).toBe(false);
      expect(isShapeTool('bucket')).toBe(false);
      expect(isShapeTool('select')).toBe(false);
      expect(SHAPE_TOOLS).toContain('star');
      expect(SHAPE_TOOLS).toContain('plus');
      expect(SHAPE_TOOLS).toContain('diamond');
    });

    it('drawShape draws rectangle and line onto grid', () => {
      const grid = new BwpxGrid(20, 20);
      drawShape(grid, 'rect', 2, 2, 8, 8, 1, 1, '#00e5a3');
      expect(grid.get(2, 2)).toBe(1);
      expect(grid.get(8, 8)).toBe(1);
      expect(grid.get(5, 5)).toBe(0); // outline rect

      drawShape(grid, 'line', 0, 0, 4, 0, 1, 1, '#00e5a3');
      for (let x = 0; x <= 4; x++) {
        expect(grid.get(x, 0)).toBe(1);
      }
    });
  });

  describe('isPixelInBrush & Round Brush', () => {
    it('isPixelInBrush produces round pixel footprint for brush sizes 1..5', () => {
      // Size 1: 1 pixel
      expect(isPixelInBrush(0, 0, 1, true)).toBe(true);

      // Size 2: 4 pixels
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          expect(isPixelInBrush(dx, dy, 2, true)).toBe(true);
        }
      }

      // Size 3: cross shape (5 pixels), corners excluded
      let count3 = 0;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (isPixelInBrush(dx, dy, 3, true)) count3++;
        }
      }
      expect(count3).toBe(5);
      expect(isPixelInBrush(0, 0, 3, true)).toBe(false); // Top-left corner excluded
      expect(isPixelInBrush(2, 0, 3, true)).toBe(false); // Top-right corner excluded
      expect(isPixelInBrush(0, 2, 3, true)).toBe(false); // Bottom-left corner excluded
      expect(isPixelInBrush(2, 2, 3, true)).toBe(false); // Bottom-right corner excluded
      expect(isPixelInBrush(1, 1, 3, true)).toBe(true);  // Center included
      expect(isPixelInBrush(1, 0, 3, true)).toBe(true);  // Top edge included

      // Size 4: 12 pixels (4 corners excluded)
      let count4 = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          if (isPixelInBrush(dx, dy, 4, true)) count4++;
        }
      }
      expect(count4).toBe(12);

      // Size 5: 21 pixels (4 corners excluded)
      let count5 = 0;
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          if (isPixelInBrush(dx, dy, 5, true)) count5++;
        }
      }
      expect(count5).toBe(21);
    });

    it('draws circular dot when isRound is true', () => {
      const grid = new BwpxGrid(10, 10);
      drawBrushDot(grid, 5, 5, 1, 3, undefined, true);
      expect(grid.countOn()).toBe(5);
      expect(grid.get(5, 5)).toBe(1); // center
      expect(grid.get(5, 4)).toBe(1); // top
      expect(grid.get(5, 6)).toBe(1); // bottom
      expect(grid.get(4, 5)).toBe(1); // left
      expect(grid.get(6, 5)).toBe(1); // right
      expect(grid.get(4, 4)).toBe(0); // corner
      expect(grid.get(6, 4)).toBe(0); // corner
    });
  });

  describe('floodFill bounded void limits', () => {
    it('refuses to fill on empty grid without enclosed boundary or selection', () => {
      const grid = new BwpxGrid(20, 20);
      const res = floodFill(grid, 10, 10, 1, '#00e5a3');
      expect(res.filled).toBe(false);
      expect(res.reason).toBe('unbounded_void');
      expect(grid.countOn()).toBe(0);
    });

    it('refuses to fill when clicking outside drawn boundary into the void', () => {
      const grid = new BwpxGrid(30, 30);
      // Draw an enclosed 10x10 square at (5,5) to (14,14)
      for (let x = 5; x <= 14; x++) {
        grid.set(x, 5, 1);
        grid.set(x, 14, 1);
      }
      for (let y = 5; y <= 14; y++) {
        grid.set(5, y, 1);
        grid.set(14, y, 1);
      }

      // Click outside at (25, 25)
      const res = floodFill(grid, 25, 25, 1, '#00e5a3');
      expect(res.filled).toBe(false);
      expect(res.reason).toBe('unbounded_void');
    });

    it('successfully fills inside an enclosed shape', () => {
      const grid = new BwpxGrid(20, 20);
      // Draw an enclosed 6x6 square from (5,5) to (10,10)
      for (let x = 5; x <= 10; x++) {
        grid.set(x, 5, 1);
        grid.set(x, 10, 1);
      }
      for (let y = 5; y <= 10; y++) {
        grid.set(5, y, 1);
        grid.set(10, y, 1);
      }
      const initialBorderPixels = grid.countOn();

      // Click inside at (7, 7)
      const res = floodFill(grid, 7, 7, 1, '#00e5a3');
      expect(res.filled).toBe(true);
      expect(res.pixelCount).toBe(16); // 4x4 interior
      expect(grid.countOn()).toBe(initialBorderPixels + 16);
      expect(grid.get(7, 7)).toBe(1);
    });

    it('aborts without mutating grid when shape has a hole leaking to the void', () => {
      const grid = new BwpxGrid(20, 20);
      // Draw a square with a gap in the right wall at (10, 7)
      for (let x = 5; x <= 10; x++) {
        grid.set(x, 5, 1);
        grid.set(x, 10, 1);
      }
      for (let y = 5; y <= 10; y++) {
        if (y !== 7) {
          grid.set(5, y, 1);
          grid.set(10, y, 1);
        }
      }
      const beforeCount = grid.countOn();

      // Click inside: leaks through (10, 7) into void
      const res = floodFill(grid, 7, 7, 1, '#00e5a3');
      expect(res.filled).toBe(false);
      expect(res.reason).toBe('unbounded_void');
      // Must not modify a single pixel!
      expect(grid.countOn()).toBe(beforeCount);
      expect(grid.get(7, 7)).toBe(0);
    });

    it('fills empty area when bounded by an active selection', () => {
      const grid = new BwpxGrid(20, 20);
      const res = floodFill(grid, 5, 5, 1, '#00e5a3', {
        selection: { x: 4, y: 4, w: 5, h: 5 },
      });
      expect(res.filled).toBe(true);
      expect(res.pixelCount).toBe(25);
      expect(grid.countOn()).toBe(25);
      expect(grid.get(4, 4)).toBe(1);
      expect(grid.get(8, 8)).toBe(1);
      expect(grid.get(9, 9)).toBe(0);
    });
  });
});

