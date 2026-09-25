import type { BwpxGrid } from '../../core/PixelGrid';

export type ToolType =
  | 'pencil'
  | 'round-pencil'
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

export const ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64];
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

export function calculateZoomAtPoint(
  prevZoom: number,
  prevPan: { x: number; y: number },
  mouseX: number,
  mouseY: number,
  step: number,
  zoomSteps: number[] = ZOOM_STEPS
): { zoom: number; pan: { x: number; y: number } } {
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < zoomSteps.length; i++) {
    const diff = Math.abs(zoomSteps[i] - prevZoom);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const nextIdx = Math.max(0, Math.min(zoomSteps.length - 1, closestIdx + step));
  const nextZoom = zoomSteps[nextIdx];

  if (nextZoom === prevZoom) {
    return { zoom: prevZoom, pan: prevPan };
  }

  const nextPan = {
    x: Math.round(mouseX - ((mouseX - prevPan.x) * nextZoom) / prevZoom),
    y: Math.round(mouseY - ((mouseY - prevPan.y) * nextZoom) / prevZoom),
  };

  return { zoom: nextZoom, pan: nextPan };
}

export function calculateFitViewport(
  viewportWidth: number,
  viewportHeight: number,
  targetW: number = 128,
  targetH: number = 34,
  zoomSteps: number[] = ZOOM_STEPS
): { zoom: number; pan: { x: number; y: number } } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: 10, pan: { x: 300, y: 200 } };
  }

  const pan = {
    x: Math.round(viewportWidth / 4),
    y: Math.round(viewportHeight / 4),
  };

  const availableW = viewportWidth * 0.75 - 40;
  const availableH = viewportHeight * 0.75 - 40;
  const rawFitZoom = Math.min(18, Math.max(4, Math.floor(Math.min(availableW / targetW, availableH / targetH))));

  const snapZoom = [...zoomSteps].reverse().find((z) => z <= rawFitZoom) ?? 4;

  return { zoom: snapZoom, pan };
}

export interface EditorViewport {
  zoom: number;
  pan: { x: number; y: number };
}

export interface SpriteSlice {
  id: string;
  name?: string;
  groupId?: string;
  groupOrder?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface ConnectedPeer {
  id: string;
  name: string;
  color: string;
  isSelf?: boolean;
  joinedAt?: number;
}

export interface PeerStatusEvent {
  id: string;
  timestamp: number;
  type: 'info' | 'peer_join' | 'peer_leave' | 'sync' | 'save' | 'conflict' | string;
  message: string;
  peerName?: string;
  peerId?: string;
}

export function getPeerInitials(name: string): string {
  if (!name) return '';
  const trimmed = name.trim().replace(/^[\s\-_]+|[\s\-_]+$/g, '');
  if (!trimmed) return '';

  const parts = trimmed.split(/[\s\-_]+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0].match(/\p{L}/u)?.[0] || parts[0][0] || '';
    const second = parts[parts.length - 1].match(/\p{L}/u)?.[0] || parts[parts.length - 1][0] || '';
    return (first + second).toUpperCase();
  }

  const letters = trimmed.match(/\p{L}/gu) || [];
  if (letters.length >= 2) {
    return (letters[0] + letters[1]).toUpperCase();
  }
  if (letters.length === 1) {
    return letters[0].toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export interface RoomSnapshotData {
  roomId?: string;
  roomName?: string;
  roomUuid?: string;
  createdAt?: number;
  updatedAt?: number;
  width: number;
  height: number;
  pixels: [number, number, string, number?][];
  pixelCount?: number;
  canvasData?: {
    width: number;
    height: number;
    pixels: [number, number, string, number?][];
  };
  thumbnail?: string;
}

export interface PixelEditorCollaborationProps {
  isRoomActive?: boolean;
  roomId?: string;
  roomUuid?: string;
  connectedPeers?: ConnectedPeer[];
  statusEvents?: any[];
  roomJoinStatus?: string;
  onClearStatusEvents?: () => void;
  onOpenInvite?: () => void;
  onOpenShareModal?: () => void;
  onOpenLoadModal?: () => void;
  onNewCanvas?: () => void;
  ensureActiveRoom?: (grid?: BwpxGrid) => void;
  broadcastPixels?: (pixels: any[]) => void;
  broadcastClear?: () => void;
  saveRoom?: (grid: BwpxGrid, timestamps?: any) => void;
  overlaySlot?: React.ReactNode;
}

export interface PixelEditorHandle {
  getGrid: () => BwpxGrid;
  setGrid: (grid: BwpxGrid) => void;
  resetGrid: (grid: BwpxGrid) => void;
  commitGrid: (grid: BwpxGrid) => void;
  applyRemoteMutation?: (mutation: any) => void;
  applyRemoteSnapshot?: (snapshot: any) => void;
  getSnapshot?: () => any;
  restoreSnapshot?: (snapshot: any) => void;
  discardLocalConflict?: () => void;
  fitToScreen: () => void;
  openImportModal: () => void;
  exportPNG: (type: 'colored' | 'monochrome' | 'transparent') => void;
  exportCArray: () => void;
  exportJSON: () => void;
  saveJSONFile: () => void;
  downloadCHeader: () => void;
  getSelectionBounds: () => { width: number; height: number } | null;
}

export interface PixelEditorProps {
  initialWidth?: number;
  initialHeight?: number;
  initialGrid?: BwpxGrid;
  onGridChange?: (grid: BwpxGrid) => void;
  title?: string;
  badgeText?: string;
  showLogo?: boolean;
  showNewButton?: boolean;
  loadButtonLabel?: string;
  loadButtonIcon?: 'upload' | 'folder';
  showPresets?: boolean;
  colorMode?: 'palette' | 'monochrome';
  defaultPixelColor?: string;
  defaultBgColor?: string;
  initialDrawColor?: string;
  pixelColor?: string;
  bgColor?: string;
  allowColorThemes?: boolean;

  // Slices & Atlas integration
  slices?: SpriteSlice[];
  selectedSliceId?: string;
  selectedSliceIds?: string[];
  pendingSelection?: { x: number; y: number; width: number; height: number } | null;
  onSelectSlice?: (id: string, isMulti?: boolean) => void;
  onSelectSlices?: (ids: string[]) => void;
  onNewSelection?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSliceMove?: (sliceId: string, newX: number, newY: number) => void;
  onSlicesMove?: (updates: { id: string; dx: number; dy: number }[]) => void;
  onAddSlices?: (slices: SpriteSlice[]) => void;
  onSlicesChange?: (slices: SpriteSlice[]) => void;
  externalTool?: ToolType;
  initialViewport?: EditorViewport;
  onViewportChange?: (viewport: EditorViewport) => void;

  // Optional collaboration adapter
  collaboration?: PixelEditorCollaborationProps;
}

export type BwpxEditorProps = PixelEditorProps;

