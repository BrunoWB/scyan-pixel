export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Packs signed 16-bit integers (x, y) into a 32-bit signed integer.
 * Supports coordinates from -32768 to 32767.
 */
export function packCoord(x: number, y: number): number {
  return (x << 16) | (y & 0xffff);
}

/**
 * Unpacks a 32-bit integer key into [x, y] coordinates.
 */
export function unpackCoord(key: number): [number, number] {
  return [key >> 16, (key << 16) >> 16];
}

export class PixelGrid {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Set<number>;
  private readonly colors: Map<number, string>;
  public defaultColor: string;

  constructor(
    width = 64,
    height = 64,
    initialData?: Uint8Array | number[] | Set<string> | Set<number> | Map<number, string> | [number, number, string][],
    initialColors?: Map<number, string> | Record<number, string> | Record<string, string>,
    defaultColor = '#00e5a3'
  ) {
    this.width = width;
    this.height = height;
    this.defaultColor = defaultColor;
    this.pixels = new Set<number>();
    this.colors = new Map<number, string>();

    if (initialColors instanceof Map) {
      for (const [k, c] of initialColors) {
        this.colors.set(k, c);
      }
    } else if (initialColors && typeof initialColors === 'object') {
      for (const [k, c] of Object.entries(initialColors)) {
        this.colors.set(Number(k), c);
      }
    }

    if (initialData instanceof Map) {
      for (const [k, c] of initialData) {
        this.pixels.add(k);
        this.colors.set(k, c);
      }
    } else if (Array.isArray(initialData) && initialData.length > 0 && Array.isArray(initialData[0])) {
      for (const item of initialData as unknown as [number, number, string][]) {
        const [x, y, color] = item;
        const key = packCoord(x, y);
        this.pixels.add(key);
        this.colors.set(key, color || this.defaultColor);
      }
    } else if (initialData instanceof Set) {
      for (const k of initialData) {
        if (typeof k === 'number') {
          this.pixels.add(k);
        } else if (typeof k === 'string') {
          const comma = k.indexOf(',');
          if (comma !== -1) {
            const x = parseInt(k.slice(0, comma), 10);
            const y = parseInt(k.slice(comma + 1), 10);
            this.pixels.add(packCoord(x, y));
          }
        }
      }
    } else if (initialData && initialData.length > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (initialData[idx]) {
            this.pixels.add(packCoord(x, y));
          }
        }
      }
    }
  }

  /**
   * For backwards compatibility with code accessing .data
   */
  get data(): Uint8Array {
    const arr = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.pixels.has(packCoord(x, y))) {
          arr[y * this.width + x] = 1;
        }
      }
    }
    return arr;
  }

  getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * On an infinite grid, any finite integer coordinates are valid.
   */
  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y);
  }

  get(x: number, y: number): number {
    return this.pixels.has(packCoord(x, y)) ? 1 : 0;
  }

  getColor(x: number, y: number): string | null {
    const key = packCoord(x, y);
    if (!this.pixels.has(key)) return null;
    return this.colors.get(key) || this.defaultColor;
  }

  setColor(x: number, y: number, color: string | null): void {
    const key = packCoord(x, y);
    if (!color || color === 'transparent' || color === 'none') {
      this.pixels.delete(key);
      this.colors.delete(key);
    } else {
      this.pixels.add(key);
      this.colors.set(key, color);
    }
  }

  set(x: number, y: number, val: number | string, color?: string): void {
    const key = packCoord(x, y);
    if (typeof val === 'string') {
      if (val === '' || val === '0' || val === 'transparent' || val === 'none') {
        this.pixels.delete(key);
        this.colors.delete(key);
      } else {
        this.pixels.add(key);
        this.colors.set(key, val);
      }
    } else {
      if (val === 0) {
        this.pixels.delete(key);
        this.colors.delete(key);
      } else {
        this.pixels.add(key);
        if (color) {
          this.colors.set(key, color);
        } else if (!this.colors.has(key)) {
          this.colors.set(key, this.defaultColor);
        }
      }
    }
  }

  toggle(x: number, y: number, color?: string): void {
    const key = packCoord(x, y);
    if (this.pixels.has(key)) {
      this.pixels.delete(key);
      this.colors.delete(key);
    } else {
      this.pixels.add(key);
      this.colors.set(key, color || this.defaultColor);
    }
  }

  clear(_val = 0): void {
    this.pixels.clear();
    this.colors.clear();
  }

  countOn(): number {
    return this.pixels.size;
  }

  getPixelCount(): number {
    return this.pixels.size;
  }

  /**
   * Returns the bounding box of all active pixels.
   */
  getBounds(): GridBounds {
    if (this.pixels.size === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const key of this.pixels) {
      const x = key >> 16;
      const y = (key << 16) >> 16;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Returns all active pixel coordinates as [x, y] tuples.
   */
  getAllPixels(): [number, number][] {
    const list: [number, number][] = [];
    for (const key of this.pixels) {
      list.push([key >> 16, (key << 16) >> 16]);
    }
    return list;
  }

  /**
   * Returns all active pixel coordinates and colors as [x, y, color] tuples.
   */
  getAllColoredPixels(): [number, number, string][] {
    const list: [number, number, string][] = [];
    for (const key of this.pixels) {
      const x = key >> 16;
      const y = (key << 16) >> 16;
      list.push([x, y, this.colors.get(key) || this.defaultColor]);
    }
    return list;
  }

  /**
   * Directly iterates over all active pixel coordinates with color without allocating an array.
   */
  forEachPixel(callback: (x: number, y: number, color: string) => void): void {
    for (const key of this.pixels) {
      const x = key >> 16;
      const y = (key << 16) >> 16;
      callback(x, y, this.colors.get(key) || this.defaultColor);
    }
  }

  /**
   * Extracts pixels inside a rectangle, returning relative coordinate tuples [relX, relY].
   */
  extractRect(rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): [number, number][] {
    const extracted: [number, number][] = [];
    const w = rect.w ?? rect.width ?? 0;
    const h = rect.h ?? rect.height ?? 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (this.get(rect.x + dx, rect.y + dy)) {
          extracted.push([dx, dy]);
        }
      }
    }
    return extracted;
  }

  /**
   * Extracts pixels inside a rectangle with colors, returning relative coordinate tuples [relX, relY, color].
   */
  extractColoredRect(rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): [number, number, string][] {
    const extracted: [number, number, string][] = [];
    const w = rect.w ?? rect.width ?? 0;
    const h = rect.h ?? rect.height ?? 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const curX = rect.x + dx;
        const curY = rect.y + dy;
        if (this.get(curX, curY)) {
          extracted.push([dx, dy, this.getColor(curX, curY) || this.defaultColor]);
        }
      }
    }
    return extracted;
  }

  /**
   * Clears all pixels in a rectangle.
   */
  clearRect(rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): void {
    const w = rect.w ?? rect.width ?? 0;
    const h = rect.h ?? rect.height ?? 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(rect.x + dx, rect.y + dy, 0);
      }
    }
  }

  invert(bounds?: { minX: number; minY: number; width: number; height: number }): PixelGrid {
    const next = this.clone();
    const b = bounds || {
      minX: 0,
      minY: 0,
      width: this.width,
      height: this.height,
    };

    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const curX = b.minX + x;
        const curY = b.minY + y;
        next.set(curX, curY, next.get(curX, curY) ? 0 : 1);
      }
    }
    return next;
  }

  flipH(bounds?: { minX: number; minY: number; width: number; height: number }): PixelGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractColoredRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy, color]) => {
      const flippedDx = b.width - 1 - dx;
      next.set(b.minX + flippedDx, b.minY + dy, color);
    });

    return next;
  }

  flipV(bounds?: { minX: number; minY: number; width: number; height: number }): PixelGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractColoredRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy, color]) => {
      const flippedDy = b.height - 1 - dy;
      next.set(b.minX + dx, b.minY + flippedDy, color);
    });

    return next;
  }

  rotate90(bounds?: { minX: number; minY: number; width: number; height: number }): PixelGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractColoredRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy, color]) => {
      const newDx = b.height - 1 - dy;
      const newDy = dx;
      next.set(b.minX + newDx, b.minY + newDy, color);
    });

    return next;
  }

  clone(): PixelGrid {
    return new PixelGrid(this.width, this.height, this.pixels, this.colors, this.defaultColor);
  }

  /**
   * Resizes canvas dimensions with anchor alignment (cropping or expanding).
   */
  resize(
    newWidth: number,
    newHeight: number,
    anchorX: 'left' | 'center' | 'right' = 'left',
    anchorY: 'top' | 'center' | 'bottom' = 'top'
  ): PixelGrid {
    const next = new PixelGrid(newWidth, newHeight, undefined, undefined, this.defaultColor);
    let offsetX = 0;
    if (anchorX === 'center') offsetX = Math.floor((newWidth - this.width) / 2);
    else if (anchorX === 'right') offsetX = newWidth - this.width;

    let offsetY = 0;
    if (anchorY === 'center') offsetY = Math.floor((newHeight - this.height) / 2);
    else if (anchorY === 'bottom') offsetY = newHeight - this.height;

    this.forEachPixel((x, y, color) => {
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (targetX >= 0 && targetX < newWidth && targetY >= 0 && targetY < newHeight) {
        next.set(targetX, targetY, color);
      }
    });

    return next;
  }

  /**
   * Nearest-neighbor rescales artwork to fit new canvas dimensions.
   */
  rescale(newWidth: number, newHeight: number): PixelGrid {
    const next = new PixelGrid(newWidth, newHeight, undefined, undefined, this.defaultColor);
    const xRatio = this.width / newWidth;
    const yRatio = this.height / newHeight;

    for (let y = 0; y < newHeight; y++) {
      const srcY = Math.min(this.height - 1, Math.floor(y * yRatio));
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.min(this.width - 1, Math.floor(x * xRatio));
        if (this.get(srcX, srcY)) {
          next.set(x, y, this.getColor(srcX, srcY) || this.defaultColor);
        }
      }
    }

    return next;
  }

  /**
   * Serializes to 1-bit-per-pixel byte array with row-major MSB first stride
   * (matching standard Zephyr / SSD1306 display drivers).
   * Optionally accepts a thresholdFn to map color to binary 1/0.
   */
  to1bppBytes(
    stride?: number,
    originX = 0,
    originY = 0,
    width?: number,
    height?: number,
    thresholdFn?: (color: string) => boolean
  ): Uint8Array {
    const w = width ?? this.width;
    const h = height ?? this.height;
    const actualStride = stride ?? Math.ceil(w / 8);
    const bytes = new Uint8Array(h * actualStride);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const curX = originX + x;
        const curY = originY + y;
        if (this.get(curX, curY)) {
          let lit = true;
          if (thresholdFn) {
            const color = this.getColor(curX, curY) || this.defaultColor;
            lit = thresholdFn(color);
          }
          if (lit) {
            const byteIdx = y * actualStride + Math.floor(x / 8);
            const bitIdx = 7 - (x % 8);
            bytes[byteIdx] |= 1 << bitIdx;
          }
        }
      }
    }

    return bytes;
  }

  static from1bppBytes(
    bytes: Uint8Array,
    width: number,
    height: number,
    stride?: number,
    originX = 0,
    originY = 0,
    color?: string
  ): PixelGrid {
    const actualStride = stride ?? Math.ceil(width / 8);
    const grid = new PixelGrid(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIdx = y * actualStride + Math.floor(x / 8);
        if (byteIdx < bytes.length) {
          const bitIdx = 7 - (x % 8);
          const isSet = (bytes[byteIdx] >> bitIdx) & 1;
          if (isSet) {
            grid.set(originX + x, originY + y, color || 1);
          }
        }
      }
    }

    return grid;
  }

  /**
   * Generates a readable C array with hex values and binary ASCII visual comments.
   * Standard Zephyr / SSD1306 compatible monochrome format.
   */
  toCArray(varName = 'IMAGE_BITMAP', thresholdFn?: (color: string) => boolean): string {
    const bounds = this.getBounds();
    const w = bounds.width > 0 ? bounds.width : 16;
    const h = bounds.height > 0 ? bounds.height : 16;
    const originX = bounds.width > 0 ? bounds.minX : 0;
    const originY = bounds.height > 0 ? bounds.minY : 0;
    const stride = Math.ceil(w / 8);
    const bytes = this.to1bppBytes(stride, originX, originY, w, h, thresholdFn);
    const lines: string[] = [];

    lines.push(`/* ${w}x${h} 1bpp monochrome bitmap (stride ${stride}) */`);
    lines.push(`static const uint8_t ${varName}[${h * stride}] = {`);

    for (let y = 0; y < h; y++) {
      const hexParts: string[] = [];
      let asciiComment = '';

      for (let s = 0; s < stride; s++) {
        const b = bytes[y * stride + s];
        hexParts.push('0x' + b.toString(16).toUpperCase().padStart(2, '0'));
      }

      for (let x = 0; x < w; x++) {
        const curX = originX + x;
        const curY = originY + y;
        let lit = this.get(curX, curY) === 1;
        if (lit && thresholdFn) {
          lit = thresholdFn(this.getColor(curX, curY) || this.defaultColor);
        }
        asciiComment += lit ? '#' : ' ';
      }

      lines.push(`    ${hexParts.join(', ')}, // Row ${y.toString().padStart(2, ' ')}: |${asciiComment}|`);
    }

    lines.push('};');
    return lines.join('\n');
  }

  /**
   * Extracts a sub-rectangle region as a new PixelGrid.
   */
  getSubRect(x: number, y: number, w: number, h: number): PixelGrid {
    const sub = new PixelGrid(w, h, undefined, undefined, this.defaultColor);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (this.get(x + c, y + r)) {
          sub.set(c, r, this.getColor(x + c, y + r) || this.defaultColor);
        }
      }
    }
    return sub;
  }

  /**
   * Pastes a sub-rectangle region into this grid at (dstX, dstY).
   */
  blit(src: PixelGrid, dstX: number, dstY: number, transparentZero = false): void {
    if (!transparentZero) {
      this.clearRect({ x: dstX, y: dstY, width: src.width, height: src.height });
    }
    src.forEachPixel((x, y, color) => {
      this.set(dstX + x, dstY + y, color || src.defaultColor);
    });
  }
}

export { PixelGrid as BwpxGrid };
