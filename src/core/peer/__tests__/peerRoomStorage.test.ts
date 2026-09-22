import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveRoomSnapshot,
  loadRoomSnapshot,
  listRoomSnapshots,
  deleteRoomSnapshot,
  getStoredRoomUuid,
  updateStoredRoomUuid,
  forkRoomSnapshot,
  type RoomSnapshotData,
  ROOMS_INDEX_STORAGE_KEY,
} from '../peerRoomStorage';

describe('peerRoomStorage', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };
    vi.stubGlobal('window', { localStorage: localStorageMock });
    vi.stubGlobal('localStorage', localStorageMock);
  });

  it('saves and loads a room snapshot', () => {
    const snapshot: RoomSnapshotData = {
      roomName: 'montreal-lion-roar',
      roomUuid: 'uuid-1234',
      createdAt: 1000,
      updatedAt: 2000,
      width: 16,
      height: 16,
      pixels: [[1, 2, '#ff0000', 1500]],
      pixelCount: 1,
    };

    saveRoomSnapshot(snapshot);
    const loaded = loadRoomSnapshot('montreal-lion-roar');

    expect(loaded).toEqual(snapshot);
    expect(getStoredRoomUuid('montreal-lion-roar')).toBe('uuid-1234');
  });

  it('saves and loads snapshots with canvasData and roomId', () => {
    const snapshot: RoomSnapshotData = {
      roomId: 'uuid-custom-5678',
      roomName: 'tokyo-falcon-glide',
      roomUuid: 'uuid-custom-5678',
      createdAt: 5000,
      updatedAt: 6000,
      width: 32,
      height: 32,
      pixels: [[4, 5, '#00ffaa']],
      pixelCount: 1,
      canvasData: {
        width: 32,
        height: 32,
        pixels: [[4, 5, '#00ffaa']],
      },
    };

    saveRoomSnapshot(snapshot);
    const loaded = loadRoomSnapshot('tokyo-falcon-glide');

    expect(loaded).toEqual(snapshot);
    expect(loaded?.roomId).toBe('uuid-custom-5678');
    expect(loaded?.canvasData?.pixels).toEqual([[4, 5, '#00ffaa']]);
  });

  it('returns null for non-existent room snapshot', () => {
    expect(loadRoomSnapshot('non-existent')).toBeNull();
    expect(getStoredRoomUuid('non-existent')).toBeNull();
  });

  it('lists room snapshots sorted by updatedAt descending', () => {
    saveRoomSnapshot({
      roomName: 'room-alpha',
      roomUuid: 'uuid-a',
      createdAt: 1000,
      updatedAt: 2000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    });

    saveRoomSnapshot({
      roomName: 'room-beta',
      roomUuid: 'uuid-b',
      createdAt: 1000,
      updatedAt: 5000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    });

    saveRoomSnapshot({
      roomName: 'room-gamma',
      roomUuid: 'uuid-c',
      createdAt: 1000,
      updatedAt: 3000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    });

    const list = listRoomSnapshots();
    expect(list).toHaveLength(3);
    expect(list[0].roomName).toBe('room-beta');
    expect(list[1].roomName).toBe('room-gamma');
    expect(list[2].roomName).toBe('room-alpha');
  });

  it('updates existing snapshot in index when resaved', () => {
    const snap1: RoomSnapshotData = {
      roomName: 'montreal-wolf-leap',
      roomUuid: 'uuid-1',
      createdAt: 1000,
      updatedAt: 1000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    };
    saveRoomSnapshot(snap1);

    const snap2: RoomSnapshotData = {
      ...snap1,
      updatedAt: 2500,
      pixels: [[0, 0, '#ffffff']],
      pixelCount: 1,
    };
    saveRoomSnapshot(snap2);

    const list = listRoomSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].updatedAt).toBe(2500);
    expect(list[0].pixelCount).toBe(1);
  });

  it('deletes a snapshot and updates the index', () => {
    saveRoomSnapshot({
      roomName: 'room-to-delete',
      roomUuid: 'uuid-del',
      createdAt: 1000,
      updatedAt: 1000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    });

    expect(loadRoomSnapshot('room-to-delete')).not.toBeNull();
    deleteRoomSnapshot('room-to-delete');

    expect(loadRoomSnapshot('room-to-delete')).toBeNull();
    expect(listRoomSnapshots()).toEqual([]);
  });

  it('updates stored UUID for a room snapshot', () => {
    saveRoomSnapshot({
      roomName: 'shared-room',
      roomUuid: 'old-uuid',
      createdAt: 1000,
      updatedAt: 1000,
      width: 16,
      height: 16,
      pixels: [],
      pixelCount: 0,
    });

    updateStoredRoomUuid('shared-room', 'new-remote-uuid');
    expect(getStoredRoomUuid('shared-room')).toBe('new-remote-uuid');
    const loaded = loadRoomSnapshot('shared-room');
    expect(loaded?.roomUuid).toBe('new-remote-uuid');
  });

  it('handles invalid corrupted localStorage JSON gracefully', () => {
    mockStore[ROOMS_INDEX_STORAGE_KEY] = 'invalid-json{{{';
    expect(listRoomSnapshots()).toEqual([]);
  });

  it('forks an existing room snapshot to a new save with a fresh name and UUID', () => {
    saveRoomSnapshot({
      roomName: 'original-source-room',
      roomUuid: 'orig-uuid-111',
      createdAt: 1000,
      updatedAt: 1500,
      width: 32,
      height: 32,
      pixels: [[5, 6, '#00e5a3', 1200]],
      pixelCount: 1,
    });

    const forked = forkRoomSnapshot('original-source-room', 'montreal-wolf');
    expect(forked).not.toBeNull();
    expect(forked!.roomName).not.toBe('original-source-room');
    expect(forked!.roomName.startsWith('montreal-wolf-')).toBe(true);
    expect(forked!.roomUuid).not.toBe('orig-uuid-111');
    expect(forked!.width).toBe(32);
    expect(forked!.height).toBe(32);
    expect(forked!.pixelCount).toBe(1);
    expect(forked!.pixels[0][0]).toBe(5);
    expect(forked!.pixels[0][1]).toBe(6);
    expect(forked!.pixels[0][2]).toBe('#00e5a3');

    // Check that it's persisted in storage
    const loadedFork = loadRoomSnapshot(forked!.roomName);
    expect(loadedFork).not.toBeNull();
    expect(loadedFork?.roomName).toBe(forked!.roomName);
    expect(loadedFork?.roomUuid).toBe(forked!.roomUuid);

    // Both original and forked rooms are in the index
    const list = listRoomSnapshots();
    expect(list).toHaveLength(2);
    expect(list.some((r) => r.roomName === 'original-source-room')).toBe(true);
    expect(list.some((r) => r.roomName === forked!.roomName)).toBe(true);
  });

  it('returns null when attempting to fork a non-existent room', () => {
    const forked = forkRoomSnapshot('does-not-exist', 'test-user');
    expect(forked).toBeNull();
  });
});
