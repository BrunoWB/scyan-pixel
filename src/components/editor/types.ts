import type { BwpxGrid } from '../../core/PixelGrid';

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'eyedropper'
  | 'select'
  | 'move'
  | 'line'
  | 'rect'
  | 'filled-rect'
  | 'ellipse'
  | 'filled-ellipse'
  | 'triangle'
  | 'filled-triangle'
  | 'diamond'
  | 'star'
  | 'arrow'
  | 'filled-arrow'
  | 'plus';

export interface ThemePreset {
  id: string;
  name: string;
  pixelColor: string;
  bgColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'neon', name: 'Neon Emerald', pixelColor: '#00e5a3', bgColor: '#0f1013' },
  { id: 'cyan', name: 'Electric Cyan', pixelColor: '#00d2ff', bgColor: '#08101a' },
  { id: 'amber', name: 'Amber OLED', pixelColor: '#ffaa00', bgColor: '#140d04' },
  { id: 'green', name: 'Phosphor Green', pixelColor: '#33ff33', bgColor: '#061206' },
  { id: 'gameboy', name: 'GameBoy Classic', pixelColor: '#9bbc0f', bgColor: '#0f380f' },
  { id: 'monochrome', name: 'OLED Monochrome', pixelColor: '#ffffff', bgColor: '#000000' },
];

export const DEFAULT_PALETTE: string[] = [
  '#000000',
  '#1d2b53',
  '#7e2553',
  '#008751',
  '#ab5236',
  '#5f574f',
  '#c2c3c7',
  '#ffffff',
  '#ff004d',
  '#ffa300',
  '#ffec27',
  '#00e436',
  '#00e5a3',
  '#29adff',
  '#83769c',
  '#ff77a8',
  '#ffccaa',
  '#00d2ff',
];

export const WHEEL_ZOOM_THRESHOLD = 80;

/**
 * Normalizes wheel delta across pixel, line, and page modes, accumulates
 * successive high-frequency events (trackpads, high-res mouse wheels),
 * and calculates the discrete step (+1 or -1) when the threshold is crossed.
 */
export function processWheelZoomDelta(
  currentAccumulator: number,
  deltaY: number,
  deltaMode: number = 0,
  threshold: number = WHEEL_ZOOM_THRESHOLD
): { nextAccumulator: number; step: number } {
  if (deltaY === 0) {
    return { nextAccumulator: currentAccumulator, step: 0 };
  }

  const dy = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;

  let acc = currentAccumulator;
  if ((dy > 0 && acc < 0) || (dy < 0 && acc > 0)) {
    acc = 0;
  }

  acc += dy;

  if (Math.abs(acc) < threshold) {
    return { nextAccumulator: acc, step: 0 };
  }

  const step = acc < 0 ? 1 : -1;
  return { nextAccumulator: 0, step };
}

export interface BwpxEditorProps {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
  title?: string;
  badgeText?: string;
  showPresets?: boolean;
  colorMode?: 'palette' | 'monochrome';
  defaultPixelColor?: string;
  defaultBgColor?: string;
  initialDrawColor?: string;
  pixelColor?: string;
  bgColor?: string;
  allowColorThemes?: boolean;
}
