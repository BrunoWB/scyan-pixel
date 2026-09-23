import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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

export interface ScyanPixelDB extends DBSchema {
  rooms: {
    key: string;
    value: RoomSnapshotData;
    indexes: { 'by-updated': number };
  };
}

export const DB_NAME = 'scyan-pixel-db';
export const DB_VERSION = 1;

export const ROOMS_INDEX_STORAGE_KEY = 'scyan_pixel_rooms_index';
export const ROOM_DATA_STORAGE_PREFIX = 'scyan_pixel_room_';

/**
 * Returns the legacy localStorage key for a specific room name.
 */
export function getRoomStorageKey(roomName: string): string {
  return `${ROOM_DATA_STORAGE_PREFIX}${roomName}`;
}

let dbPromise: Promise<IDBPDatabase<ScyanPixelDB> | null> | null = null;

/**
 * Closes the active database connection and resets the singleton.
 * Primarily useful for test isolation.
 */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    if (db) {
      db.close();
    }
    dbPromise = null;
  }
}

/**
 * Requests persistent storage from the browser to prevent eviction under disk pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Migrates existing room snapshots from legacy localStorage to IndexedDB.
 */
export async function migrateFromLocalStorage(db: IDBPDatabase<ScyanPixelDB>): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const rawIndex = window.localStorage.getItem(ROOMS_INDEX_STORAGE_KEY);
    if (!rawIndex) return;

    const parsedIndex = JSON.parse(rawIndex);
    if (!Array.isArray(parsedIndex)) return;

    for (const item of parsedIndex) {
      if (item && typeof item.roomName === 'string') {
        const key = getRoomStorageKey(item.roomName);
        const rawRoom = window.localStorage.getItem(key);
        if (rawRoom) {
          try {
            const parsedRoom = JSON.parse(rawRoom) as RoomSnapshotData;
            if (parsedRoom && parsedRoom.roomName) {
              await db.put('rooms', parsedRoom);
            }
          } catch {
            // Ignore malformed snapshot
          }
          window.localStorage.removeItem(key);
        }
      }
    }

    // Clean up index key after migration completes
    window.localStorage.removeItem(ROOMS_INDEX_STORAGE_KEY);
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to migrate rooms from localStorage:', err);
  }
}

/**
 * Opens and initializes the IndexedDB database instance.
 */
export async function getDB(): Promise<IDBPDatabase<ScyanPixelDB> | null> {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await openDB<ScyanPixelDB>(DB_NAME, DB_VERSION, {
          upgrade(database) {
            if (!database.objectStoreNames.contains('rooms')) {
              const store = database.createObjectStore('rooms', { keyPath: 'roomName' });
              store.createIndex('by-updated', 'updatedAt');
            }
          },
        });

        // Trigger non-blocking eviction resistance and migration
        void requestPersistentStorage();
        await migrateFromLocalStorage(db);

        return db;
      } catch (err) {
        console.warn('[peerRoomStorage] Failed to open IndexedDB:', err);
        return null;
      }
    })();
  }

  return dbPromise;
}

/**
 * Lists all stored room snapshots metadata, sorted by last modified (updatedAt) descending.
 */
export async function listRoomSnapshots(): Promise<RoomMetadata[]> {
  const db = await getDB();
  if (!db) return [];

  try {
    const snapshots = await db.getAllFromIndex('rooms', 'by-updated');
    return snapshots
      .map((item): RoomMetadata => ({
        roomId: item.roomId || item.roomUuid,
        roomName: item.roomName,
        roomUuid: item.roomUuid,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        pixelCount: item.pixelCount,
        width: item.width,
        height: item.height,
      }))
      .reverse(); // descending order
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to list room snapshots:', err);
    return [];
  }
}

/**
 * Loads a full room snapshot from IndexedDB by room name.
 */
export async function loadRoomSnapshot(roomName: string): Promise<RoomSnapshotData | null> {
  if (!roomName) return null;
  const db = await getDB();
  if (!db) return null;

  try {
    const snapshot = await db.get('rooms', roomName);
    if (!snapshot) return null;

    if (!snapshot.pixels && snapshot.canvasData) {
      snapshot.pixels = snapshot.canvasData.pixels;
      snapshot.width = snapshot.width || snapshot.canvasData.width;
      snapshot.height = snapshot.height || snapshot.canvasData.height;
    }
    if (!snapshot.roomUuid && snapshot.roomId) {
      snapshot.roomUuid = snapshot.roomId;
    }
    return snapshot;
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to load room snapshot:', err);
    return null;
  }
}

/**
 * Saves a room snapshot to IndexedDB.
 */
export async function saveRoomSnapshot(snapshot: RoomSnapshotData): Promise<void> {
  if (!snapshot || !snapshot.roomName) return;
  const db = await getDB();
  if (!db) return;

  try {
    await db.put('rooms', snapshot);
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to save snapshot to IndexedDB:', err);
  }
}

/**
 * Deletes a stored room snapshot from IndexedDB.
 */
export async function deleteRoomSnapshot(roomName: string): Promise<void> {
  if (!roomName) return;
  const db = await getDB();
  if (!db) return;

  try {
    await db.delete('rooms', roomName);
  } catch (err) {
    console.warn('[peerRoomStorage] Failed to delete room snapshot:', err);
  }
}

/**
 * Retrieves the stored UUID for a room name, if one exists.
 */
export async function getStoredRoomUuid(roomName: string): Promise<string | null> {
  const snapshot = await loadRoomSnapshot(roomName);
  return snapshot ? snapshot.roomUuid : null;
}

/**
 * Updates the stored UUID for an existing room snapshot (e.g. when resolving conflict by adopting remote UUID).
 */
export async function updateStoredRoomUuid(roomName: string, newUuid: string): Promise<void> {
  const snapshot = await loadRoomSnapshot(roomName);
  if (snapshot) {
    snapshot.roomUuid = newUuid;
    snapshot.updatedAt = Date.now();
    await saveRoomSnapshot(snapshot);
  }
}

/**
 * Copies an existing room snapshot to a new save with a fresh room name and roomUuid.
 * Prevents peer reconciliation issues and conflict loops by creating a clean independent fork.
 */
export async function forkRoomSnapshot(
  sourceRoomName: string,
  authorName?: string
): Promise<RoomSnapshotData | null> {
  const sourceSnapshot = await loadRoomSnapshot(sourceRoomName);
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

  await saveRoomSnapshot(newSnapshot);
  return newSnapshot;
}
