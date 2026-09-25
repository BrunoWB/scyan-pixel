import { BwpxGrid } from "./PixelGrid";

export function isPixelInBrush(
  dx: number,
  dy: number,
  brushSize: number,
  isRound = false
): boolean {
  if (!isRound || brushSize <= 2) return true;
  const c = (brushSize - 1) / 2;
  const ox = dx - c;
  const oy = dy - c;
  const distSq = ox * ox + oy * oy;
  const maxRadiusSq = brushSize % 2 === 1
    ? (brushSize / 2) ** 2 - 0.5
    : (brushSize / 2) ** 2;
  return distSq <= maxRadiusSq;
}

export function drawBrushDot(
  grid: BwpxGrid,
  cx: number,
  cy: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string,
  isRound = false
): void {
  const half = Math.floor(brushSize / 2);
  for (let dy = 0; dy < brushSize; dy++) {
    for (let dx = 0; dx < brushSize; dx++) {
      if (isPixelInBrush(dx, dy, brushSize, isRound)) {
        grid.set(cx - half + dx, cy - half + dy, val, color);
      }
    }
  }
}

export function drawLine(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string,
  isRound = false
): void {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let curX = x0;
  let curY = y0;

  while (true) {
    drawBrushDot(grid, curX, curY, val, brushSize, color, isRound);
    if (curX === x1 && curY === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      curX += sx;
    }
    if (e2 < dx) {
      err += dx;
      curY += sy;
    }
  }
}

export function drawRect(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  filled = false,
  brushSize = 1,
  color?: string
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        drawBrushDot(grid, x, y, val, brushSize, color);
      }
    }
  } else {
    drawLine(grid, minX, minY, maxX, minY, val, brushSize, color);
    drawLine(grid, maxX, minY, maxX, maxY, val, brushSize, color);
    drawLine(grid, maxX, maxY, minX, maxY, val, brushSize, color);
    drawLine(grid, minX, maxY, minX, minY, val, brushSize, color);
  }
}

export function drawEllipse(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  filled = false,
  brushSize = 1,
  color?: string
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const a = maxX - minX;
  const b = maxY - minY;

  if (a === 0 && b === 0) {
    drawBrushDot(grid, minX, minY, val, brushSize, color);
    return;
  }
  if (a === 0) {
    drawLine(grid, minX, minY, minX, maxY, val, brushSize, color);
    return;
  }
  if (b === 0) {
    drawLine(grid, minX, minY, maxX, minY, val, brushSize, color);
    return;
  }

  let curX0 = minX;
  let curY0 = minY;
  let curX1 = maxX;
  let curY1 = maxY;

  const b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2: number;

  curY0 += Math.floor((b + 1) / 2);
  curY1 = curY0 - b1;
  const aMul = 8 * a * a;
  const bMul = 8 * b * b;

  if (!filled) {
    const mark =
      brushSize === 1
        ? (px: number, py: number) => grid.set(px, py, val, color)
        : (px: number, py: number) => drawBrushDot(grid, px, py, val, brushSize, color);

    do {
      mark(curX1, curY0);
      mark(curX0, curY0);
      mark(curX0, curY1);
      mark(curX1, curY1);
      e2 = 2 * err;
      if (e2 <= dy) {
        curY0++;
        curY1--;
        err += dy += aMul;
      }
      if (e2 >= dx || 2 * err > dy) {
        curX0++;
        curX1--;
        err += dx += bMul;
      }
    } while (curX0 <= curX1);

    while (curY0 - curY1 < b) {
      mark(curX0 - 1, curY0);
      mark(curX1 + 1, curY0++);
      mark(curX0 - 1, curY1);
      mark(curX1 + 1, curY1--);
    }
  } else {
    const h = maxY - minY + 1;
    const rowMin = new Int32Array(h).fill(1e9);
    const rowMax = new Int32Array(h).fill(-1e9);

    const markRow = (px: number, py: number) => {
      const idx = py - minY;
      if (idx >= 0 && idx < h) {
        if (px < rowMin[idx]) rowMin[idx] = px;
        if (px > rowMax[idx]) rowMax[idx] = px;
      }
    };

    do {
      markRow(curX1, curY0);
      markRow(curX0, curY0);
      markRow(curX0, curY1);
      markRow(curX1, curY1);
      e2 = 2 * err;
      if (e2 <= dy) {
        curY0++;
        curY1--;
        err += dy += aMul;
      }
      if (e2 >= dx || 2 * err > dy) {
        curX0++;
        curX1--;
        err += dx += bMul;
      }
    } while (curX0 <= curX1);

    while (curY0 - curY1 < b) {
      markRow(curX0 - 1, curY0);
      markRow(curX1 + 1, curY0++);
      markRow(curX0 - 1, curY1);
      markRow(curX1 + 1, curY1--);
    }

    for (let r = 0; r < h; r++) {
      const y = minY + r;
      const rx0 = rowMin[r];
      const rx1 = rowMax[r];
      if (rx0 <= rx1) {
        if (brushSize === 1) {
          for (let x = rx0; x <= rx1; x++) {
            grid.set(x, y, val, color);
          }
        } else {
          for (let x = rx0; x <= rx1; x++) {
            drawBrushDot(grid, x, y, val, brushSize, color);
          }
        }
      }
    }
  }
}

export function drawTriangle(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  filled = false,
  brushSize = 1,
  color?: string
): void {
  const tipX = Math.round((x0 + x1) / 2);
  const tipY = Math.min(y0, y1);
  const bLeftX = Math.min(x0, x1);
  const bRightX = Math.max(x0, x1);
  const bY = Math.max(y0, y1);

  if (filled) {
    const height = bY - tipY;
    if (height <= 0) {
      drawLine(grid, bLeftX, bY, bRightX, bY, val, brushSize, color);
      return;
    }
    for (let y = tipY; y <= bY; y++) {
      const progress = (y - tipY) / height;
      const span = (bRightX - bLeftX) * progress;
      const startX = Math.round(tipX - span / 2);
      const endX = Math.round(tipX + span / 2);
      for (let x = startX; x <= endX; x++) {
        drawBrushDot(grid, x, y, val, brushSize, color);
      }
    }
  } else {
    drawLine(grid, tipX, tipY, bLeftX, bY, val, brushSize, color);
    drawLine(grid, bLeftX, bY, bRightX, bY, val, brushSize, color);
    drawLine(grid, bRightX, bY, tipX, tipY, val, brushSize, color);
  }
}

export function drawDiamond(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  filled = false,
  brushSize = 1,
  color?: string
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);

  if (filled) {
    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = rx > 0 ? Math.abs(x - cx) / rx : 0;
        const dy = ry > 0 ? Math.abs(y - cy) / ry : 0;
        if (dx + dy <= 1.0) {
          drawBrushDot(grid, x, y, val, brushSize, color);
        }
      }
    }
  } else {
    drawLine(grid, cx, minY, maxX, cy, val, brushSize, color);
    drawLine(grid, maxX, cy, cx, maxY, val, brushSize, color);
    drawLine(grid, cx, maxY, minX, cy, val, brushSize, color);
    drawLine(grid, minX, cy, cx, minY, val, brushSize, color);
  }
}

export function drawStar(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const r = Math.min(maxX - minX, maxY - minY) / 2;

  // 5-point star points
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    points.push({
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    });
  }

  for (let i = 0; i < 5; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 5];
    drawLine(grid, p1.x, p1.y, p2.x, p2.y, val, brushSize, color);
  }
}

export function fillTrianglePoints(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string
): void {
  let [ax, ay] = [x0, y0];
  let [bx, by] = [x1, y1];
  let [cx, cy] = [x2, y2];

  if (ay > by) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
  if (ay > cy) { [ax, cx] = [cx, ax]; [ay, cy] = [cy, ay]; }
  if (by > cy) { [bx, cx] = [cx, bx]; [by, cy] = [cy, by]; }

  const totalHeight = cy - ay;
  if (totalHeight === 0) {
    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    for (let x = minX; x <= maxX; x++) {
      drawBrushDot(grid, x, ay, val, brushSize, color);
    }
  } else {
    for (let y = ay; y <= cy; y++) {
      const secondHalf = y > by || by === ay;
      const segmentHeight = secondHalf ? cy - by : by - ay;
      const alpha = (y - ay) / totalHeight;
      const beta = segmentHeight === 0 ? 0 : (y - (secondHalf ? by : ay)) / segmentHeight;

      let startX = Math.round(ax + (cx - ax) * alpha);
      let endX = secondHalf
        ? Math.round(bx + (cx - bx) * beta)
        : Math.round(ax + (bx - ax) * beta);

      if (startX > endX) {
        const tmp = startX;
        startX = endX;
        endX = tmp;
      }
      for (let x = startX; x <= endX; x++) {
        drawBrushDot(grid, x, y, val, brushSize, color);
      }
    }
  }

  drawLine(grid, x0, y0, x1, y1, val, brushSize, color);
  drawLine(grid, x1, y1, x2, y2, val, brushSize, color);
  drawLine(grid, x2, y2, x0, y0, val, brushSize, color);
}

export function drawArrow(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string,
  filledHead = false
): void {
  drawLine(grid, x0, y0, x1, y1, val, brushSize, color);

  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = Math.min(10, Math.hypot(x1 - x0, y1 - y0) / 2);

  const a1 = angle - Math.PI / 6;
  const a2 = angle + Math.PI / 6;

  const tip1X = Math.round(x1 - headLen * Math.cos(a1));
  const tip1Y = Math.round(y1 - headLen * Math.sin(a1));
  const tip2X = Math.round(x1 - headLen * Math.cos(a2));
  const tip2Y = Math.round(y1 - headLen * Math.sin(a2));

  if (filledHead) {
    fillTrianglePoints(grid, x1, y1, tip1X, tip1Y, tip2X, tip2Y, val, brushSize, color);
  } else {
    drawLine(grid, x1, y1, tip1X, tip1Y, val, brushSize, color);
    drawLine(grid, x1, y1, tip2X, tip2Y, val, brushSize, color);
  }
}

export function drawPlus(
  grid: BwpxGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);

  drawLine(grid, minX, cy, maxX, cy, val, brushSize, color);
  drawLine(grid, cx, minY, cx, maxY, val, brushSize, color);
}

export interface FloodFillOptions {
  selection?: { x: number; y: number; w: number; h: number } | null;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  maxPixels?: number;
}

export interface FloodFillResult {
  filled: boolean;
  pixelCount: number;
  reason?: 'unbounded_void' | 'no_change' | 'out_of_bounds';
}

export function floodFill(
  grid: BwpxGrid,
  startX: number,
  startY: number,
  newVal: number | string = 1,
  newColor?: string,
  optionsOrMaxPixels?: number | FloodFillOptions
): FloodFillResult {
  if (!grid.inBounds(startX, startY)) {
    return { filled: false, pixelCount: 0, reason: 'out_of_bounds' };
  }

  const targetVal = grid.get(startX, startY);
  const targetColor = grid.getColor(startX, startY);

  const fillVal = typeof newVal === 'string' ? 1 : newVal;
  const fillColor = typeof newVal === 'string' ? newVal : newColor || grid.defaultColor;

  // If erasing to 0
  if (fillVal === 0) {
    if (targetVal === 0) {
      return { filled: false, pixelCount: 0, reason: 'no_change' };
    }
  } else {
    // If filling with color
    if (targetVal === 1 && targetColor?.toLowerCase() === fillColor?.toLowerCase()) {
      return { filled: false, pixelCount: 0, reason: 'no_change' };
    }
  }

  const options: FloodFillOptions =
    typeof optionsOrMaxPixels === 'number'
      ? { maxPixels: optionsOrMaxPixels }
      : optionsOrMaxPixels || {};
  const maxPixels = options.maxPixels ?? 50000;
  const selection =
    options.selection && options.selection.w > 0 && options.selection.h > 0
      ? options.selection
      : null;

  // When targetVal === 0 (filling empty void/background):
  // Must be strictly bounded by an active selection OR an enclosed boundary of drawn pixels!
  let minAllowedX = -Infinity;
  let maxAllowedX = Infinity;
  let minAllowedY = -Infinity;
  let maxAllowedY = Infinity;

  if (targetVal === 0) {
    if (selection) {
      // Must start within the selection
      if (
        startX < selection.x ||
        startX >= selection.x + selection.w ||
        startY < selection.y ||
        startY >= selection.y + selection.h
      ) {
        return { filled: false, pixelCount: 0, reason: 'unbounded_void' };
      }
      minAllowedX = selection.x;
      maxAllowedX = selection.x + selection.w - 1;
      minAllowedY = selection.y;
      maxAllowedY = selection.y + selection.h - 1;
    } else {
      // No selection: check existing drawn bounds
      const bounds = grid.getBounds();
      // If there are no drawn pixels, the whole canvas is unbounded void!
      if (bounds.width === 0 || bounds.height === 0) {
        return { filled: false, pixelCount: 0, reason: 'unbounded_void' };
      }
      // If clicked outside all drawn pixels, it is directly in the void
      if (
        startX < bounds.minX ||
        startX > bounds.maxX ||
        startY < bounds.minY ||
        startY > bounds.maxY
      ) {
        return { filled: false, pixelCount: 0, reason: 'unbounded_void' };
      }
      minAllowedX = bounds.minX;
      maxAllowedX = bounds.maxX;
      minAllowedY = bounds.minY;
      maxAllowedY = bounds.maxY;
    }
  }

  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  visited.add(`${startX},${startY}`);
  const toFill: [number, number][] = [];

  while (queue.length > 0) {
    if (toFill.length > maxPixels) {
      return { filled: false, pixelCount: 0, reason: 'unbounded_void' };
    }
    const [x, y] = queue.pop()!;

    // When targetVal === 0 without selection, if traversal reaches outside drawn bounds,
    // it means the empty space is not enclosed and leaked into the open void!
    if (targetVal === 0 && !selection) {
      if (x < minAllowedX || x > maxAllowedX || y < minAllowedY || y > maxAllowedY) {
        return { filled: false, pixelCount: 0, reason: 'unbounded_void' };
      }
    }

    const curVal = grid.get(x, y);
    const curColor = grid.getColor(x, y);

    const matches =
      targetVal === 0
        ? curVal === 0
        : curVal === 1 && (targetColor === null || curColor === targetColor);

    if (matches) {
      toFill.push([x, y]);

      const neighbors: [number, number][] = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (targetVal === 0) {
          if (selection) {
            // Respect selection boundary walls
            if (nx < minAllowedX || nx > maxAllowedX || ny < minAllowedY || ny > maxAllowedY) {
              continue;
            }
          }
        }
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }
  }

  // Entire search completed within boundary without leaking into void
  for (const [fx, fy] of toFill) {
    if (fillVal === 0) {
      grid.set(fx, fy, 0);
    } else {
      grid.set(fx, fy, 1, fillColor);
    }
  }

  return { filled: true, pixelCount: toFill.length };
}

export const SHAPE_TOOLS = [
  'line',
  'arrow',
  'filled-arrow',
  'rect',
  'filled-rect',
  'ellipse',
  'filled-ellipse',
  'triangle',
  'filled-triangle',
  'diamond',
  'star',
  'plus',
] as const;

export type ShapeTool = (typeof SHAPE_TOOLS)[number];

export function isShapeTool(tool: string): boolean {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

export interface ShapeCoordsOptions {
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

export interface ShapeEndpoints {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Calculates start and end coordinates for drawing shapes, with keyboard modifier assistance.
 * - Shift snaps lines/arrows to 45-degree angle increments, and constrains other shapes to 1:1 aspect ratio.
 * - Ctrl/Command sets the initial click position as the center of the shape instead of a corner/start.
 */
export function calculateShapeEndpoints(
  tool: string,
  start: { x: number; y: number },
  current: { x: number; y: number },
  options: ShapeCoordsOptions = {}
): ShapeEndpoints {
  const isLine = tool === 'line' || tool === 'arrow' || tool === 'filled-arrow';
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  let snappedDx = dx;
  let snappedDy = dy;

  if (options.shiftKey) {
    if (isLine) {
      if (dx === 0 && dy === 0) {
        snappedDx = 0;
        snappedDy = 0;
      } else {
        const angle = Math.atan2(dy, dx);
        // Map to 8 octants (-4 to 4)
        const octant = Math.round(angle / (Math.PI / 4));
        const len = Math.max(Math.abs(dx), Math.abs(dy));

        if (octant === 0 || octant === 4 || octant === -4) {
          snappedDx = dx;
          snappedDy = 0;
        } else if (octant === 2 || octant === -2) {
          snappedDx = 0;
          snappedDy = dy;
        } else {
          // 45, 135, -135, -45 degrees
          snappedDx = octant === 1 || octant === -1 ? len : -len;
          snappedDy = octant === 1 || octant === 3 ? len : -len;
        }
      }
    } else {
      // Bounding box shapes: 1:1 aspect ratio
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;
      snappedDx = signX * size;
      snappedDy = signY * size;
    }
  }

  if (options.ctrlKey) {
    // Start position is the center of the shape
    return {
      x0: start.x - snappedDx,
      y0: start.y - snappedDy,
      x1: start.x + snappedDx,
      y1: start.y + snappedDy,
    };
  }

  return {
    x0: start.x,
    y0: start.y,
    x1: start.x + snappedDx,
    y1: start.y + snappedDy,
  };
}

/**
 * Dispatches a shape drawing call to the appropriate rasterizer.
 */
export function drawShape(
  grid: BwpxGrid,
  tool: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  val: number | string = 1,
  brushSize = 1,
  color?: string
): void {
  switch (tool) {
    case 'line':
      drawLine(grid, x0, y0, x1, y1, val, brushSize, color);
      break;
    case 'arrow':
      drawArrow(grid, x0, y0, x1, y1, val, brushSize, color, false);
      break;
    case 'filled-arrow':
      drawArrow(grid, x0, y0, x1, y1, val, brushSize, color, true);
      break;
    case 'rect':
      drawRect(grid, x0, y0, x1, y1, val, false, brushSize, color);
      break;
    case 'filled-rect':
      drawRect(grid, x0, y0, x1, y1, val, true, brushSize, color);
      break;
    case 'ellipse':
      drawEllipse(grid, x0, y0, x1, y1, val, false, brushSize, color);
      break;
    case 'filled-ellipse':
      drawEllipse(grid, x0, y0, x1, y1, val, true, brushSize, color);
      break;
    case 'triangle':
      drawTriangle(grid, x0, y0, x1, y1, val, false, brushSize, color);
      break;
    case 'filled-triangle':
      drawTriangle(grid, x0, y0, x1, y1, val, true, brushSize, color);
      break;
    case 'diamond':
      drawDiamond(grid, x0, y0, x1, y1, val, false, brushSize, color);
      break;
    case 'star':
      drawStar(grid, x0, y0, x1, y1, val, brushSize, color);
      break;
    case 'plus':
      drawPlus(grid, x0, y0, x1, y1, val, brushSize, color);
      break;
  }
}
