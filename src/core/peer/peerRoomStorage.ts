import { generateRoomName } from './peerNames';
import { generatePeerId } from './peerIdentity';

export interface RoomSnapshotData {
  roomId?: string;
  roomName: string;
  roomUuid: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  pixels: [number, number, string, number?][];
  pixelCount: number;
  canvasData?: {
    width: number;
    height: number;
    pixels: [number, number, string, number?][];
  };
  thumbnail?: string;
}

export interface RoomMetadata {
  roomId?: string;
  roomName: string;
  roomUuid: string;
  createdAt: number;
  updatedAt: number;
  pixelCount: number;
  width: number;
  height: number;
}

export const ROOMS_INDEX_STORAGE_KEY = 'scyan_pixel_rooms_index';
export const ROOM_DATA_STORAGE_PREFIX = 'scyan_pixel_room_';

/**
 * Returns the localStorage key for a specific room name.
 */
export function getRoomStorageKey(roomName: string): string {
  return `${ROOM_DATA_STORAGE_PREFIX}${roomName}`;
}

/**
 * Lists all stored room snapshots metadata, sorted by last modified (updatedAt) descending.
 */
export function listRoomSnapshots(): RoomMetadata[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ROOMS_INDEX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is RoomMetadata => {
        return (
          item &&
          typeof item.roomName === 'string' &&
          typeof item.roomUuid === 'string' &&
          typeof item.updatedAt === 'number'
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Loads a full room snapshot from localStorage by room name.
 */
export function loadRoomSnapshot(roomName: string): RoomSnapshotData | null {
  if (!roomName || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const key = getRoomStorageKey(roomName);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.roomName === 'string' &&
      typeof parsed.roomUuid === 'string' &&
      (Array.isArray(parsed.pixels) || (parsed.canvasData && Array.isArray(parsed.canvasData.pixels)))
    ) {
      if (!parsed.pixels && parsed.canvasData) {
        parsed.pixels = parsed.canvasData.pixels;
        parsed.width = parsed.width || parsed.canvasData.width;
        parsed.height = parsed.height || parsed.canvasData.height;
      }
      if (!parsed.roomUuid && parsed.roomId) {
        parsed.roomUuid = parsed.roomId;
      }
      return parsed as RoomSnapshotData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves a room snapshot to localStorage and updates the rooms index.
 */
export function saveRoomSnapshot(snapshot: RoomSnapshotData): void {
  if (!snapshot || !snapshot.roomName || typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const key = getRoomStorageKey(snapshot.roomName);
    window.localStorage.setItem(key, JSON.stringify(snapshot));

    // Update rooms index
    const currentList = listRoomSnapshots();
    const existingIdx = currentList.findIndex((item) => item.roomName === snapshot.roomName);

    const metadata: RoomMetadata = {
      roomId: snapshot.roomId || snapshot.roomUuid,
      roomName: snapshot.roomName,
      roomUuid: snapshot.roomUuid,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      pixelCount: snapshot.pixelCount,
      width: snapshot.width,
      height: snapshot.height,
    };

    if (existingIdx !== -1) {
      currentList[existingIdx] = metadata;
    } else {
      currentList.unshift(metadata);
    }

    // Keep most recent 50 rooms to prevent storage bloat
    if (currentList.length > 50) {
      const dropped = currentList.slice(50);
      for (let i = 0; i < dropped.length; i++) {
        window.localStorage.removeItem(getRoomStorageKey(dropped[i].roomName));
      }
    }
    const trimmed = currentList.slice(0, 50);
    window.localStorage.setItem(ROOMS_INDEX_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to save snapshot to localStorage:', err);
  }
}

/**
 * Deletes a stored room snapshot and removes it from the rooms index.
 */
export function deleteRoomSnapshot(roomName: string): void {
  if (!roomName || typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const key = getRoomStorageKey(roomName);
    window.localStorage.removeItem(key);

    const currentList = listRoomSnapshots();
    const filtered = currentList.filter((item) => item.roomName !== roomName);
    window.localStorage.setItem(ROOMS_INDEX_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to delete room snapshot:', err);
  }
}

/**
 * Retrieves the stored UUID for a room name, if one exists.
 */
export function getStoredRoomUuid(roomName: string): string | null {
  const snapshot = loadRoomSnapshot(roomName);
  return snapshot ? snapshot.roomUuid : null;
}

/**
 * Updates the stored UUID for an existing room snapshot (e.g. when resolving conflict by adopting remote UUID).
 */
export function updateStoredRoomUuid(roomName: string, newUuid: string): void {
  const snapshot = loadRoomSnapshot(roomName);
  if (snapshot) {
    snapshot.roomUuid = newUuid;
    snapshot.updatedAt = Date.now();
    saveRoomSnapshot(snapshot);
  }
}

/**
 * Copies an existing room snapshot to a new save with a fresh room name and roomUuid.
 * Prevents peer reconciliation issues and conflict loops by creating a clean independent fork.
 */
export function forkRoomSnapshot(sourceRoomName: string, authorName?: string): RoomSnapshotData | null {
  const sourceSnapshot = loadRoomSnapshot(sourceRoomName);
  if (!sourceSnapshot) return null;

  const newRoomName = generateRoomName(authorName);
  const newUuid =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();
  const now = Date.now();

  const sourcePixels = Array.isArray(sourceSnapshot.pixels)
    ? sourceSnapshot.pixels
    : sourceSnapshot.canvasData && Array.isArray(sourceSnapshot.canvasData.pixels)
      ? sourceSnapshot.canvasData.pixels
      : [];

  const copiedPixels: [number, number, string, number?][] = sourcePixels
    .filter((p) => Boolean(p && p[2] && p[2] !== 'transparent' && p[2] !== 'none'))
    .map((p) => [p[0], p[1], p[2], now]);

  const newSnapshot: RoomSnapshotData = {
    roomId: newUuid,
    roomName: newRoomName,
    roomUuid: newUuid,
    createdAt: now,
    updatedAt: now,
    width: sourceSnapshot.width,
    height: sourceSnapshot.height,
    pixels: copiedPixels,
    pixelCount: copiedPixels.length,
    canvasData: {
      width: sourceSnapshot.width,
      height: sourceSnapshot.height,
      pixels: copiedPixels,
    },
  };

  saveRoomSnapshot(newSnapshot);
  return newSnapshot;
}
