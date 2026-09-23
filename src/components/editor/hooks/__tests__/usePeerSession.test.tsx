import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderToString } from 'react-dom/server';
import { usePeerSession } from '../usePeerSession';
import { PixelGrid } from '../../../../core/PixelGrid';
import {
  loadRoomSnapshot,
  listRoomSnapshots,
  closeDB,
  DB_NAME,
} from '../../../../core/peer/peerRoomStorage';

describe('usePeerSession hook', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(async () => {
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
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      location: {
        hash: '',
        origin: 'http://localhost',
        pathname: '/',
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('localStorage', localStorageMock);

    await closeDB();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  afterEach(async () => {
    await closeDB();
  });
  it('provides complete collaborative session API and initialized profile', () => {
    function TestComponent() {
      const session = usePeerSession();
      const summary = {
        hasId: Boolean(session.profile.id),
        name: session.profile.name,
        hasColor: Boolean(session.profile.color),
        roomId: session.roomId,
        peersCount: session.connectedPeers.length,
        hasBroadcastPixels: typeof session.broadcastPixels === 'function',
        hasBroadcastClear: typeof session.broadcastClear === 'function',
        hasBroadcastSnapshot: typeof session.broadcastSnapshot === 'function',
        hasBroadcastMutation: typeof session.broadcastMutation === 'function',
        hasGenerateNewRoom: typeof session.generateNewRoom === 'function',
        hasGetShareUrl: typeof session.getShareUrl === 'function',
        hasUpdateProfile: typeof session.updateProfile === 'function',
      };
      return (
        <div id="session-summary" data-json={JSON.stringify(summary)}>
          {session.profile.name}
        </div>
      );
    }

    const html = renderToString(<TestComponent />);
    const match = html.match(/data-json="([^"]+)"/);
    expect(match).not.toBeNull();

    const summary = JSON.parse(match![1].replace(/&quot;/g, '"'));
    expect(summary.hasId).toBe(true);
    expect(summary.name).toBeTruthy();
    expect(summary.hasColor).toBe(true);
    expect(summary.roomId).toBeTruthy();
    expect(summary.peersCount).toBe(0);
    expect(summary.hasBroadcastPixels).toBe(true);
    expect(summary.hasBroadcastClear).toBe(true);
    expect(summary.hasBroadcastSnapshot).toBe(true);
    expect(summary.hasBroadcastMutation).toBe(true);
    expect(summary.hasGenerateNewRoom).toBe(true);
    expect(summary.hasGetShareUrl).toBe(true);
    expect(summary.hasUpdateProfile).toBe(true);
    expect(html).toContain(summary.name);
  });

  it('exposes methods to manipulate share modal state', () => {
    function TestComponent() {
      const session = usePeerSession();
      return <div>{session.isShareModalOpen ? 'open' : 'closed'}</div>;
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('closed');
  });

  it('wires roomFactory to broadcast mutations and handle callbacks', () => {
    const sentActions: { type: string; data: any }[] = [];
    const actionHandlers = new Map<string, (data: any, ctx: { peerId: string }) => void>();

    const mockFactory = () => {
      return {
        makeAction: (type: string) => {
          return {
            send: async (data: any) => {
              sentActions.push({ type, data });
            },
            set onMessage(handler: any) {
              actionHandlers.set(type, handler);
            },
            get onMessage() {
              return actionHandlers.get(type) || null;
            },
          };
        },
        leave: async () => {},
        onPeerJoin: null,
        onPeerLeave: null,
      } as any;
    };

    function TestComponent() {
      const session = usePeerSession({
        roomFactory: mockFactory,
      });

      // Invoke broadcasting within component
      session.broadcastPixels([[10, 12, '#3b82f6']]);
      session.broadcastClear();
      session.broadcastSnapshot({
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[1, 1, '#ff0000']],
      });

      return <div>session-active</div>;
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('session-active');

    // Verify broadcastPixels sends mutation
    expect(sentActions.some((a) => a.type === 'mutation' && a.data.type === 'pixels')).toBe(true);

    // Verify broadcastClear sends clear mutation
    expect(sentActions.some((a) => a.type === 'mutation' && a.data.type === 'clear')).toBe(true);

    // Verify broadcastSnapshot sends snapshot
    expect(sentActions.some((a) => a.type === 'snapshot')).toBe(true);
  });

  it('exposes room snapshot storage and conflict resolution APIs', () => {
    function TestComponent() {
      const session = usePeerSession();
      const summary = {
        hasSaveRoom: typeof session.saveRoom === 'function',
        hasRestoreRoom: typeof session.restoreRoom === 'function',
        hasCopyRoomToNewSave: typeof session.copyRoomToNewSave === 'function',
        hasDeleteRoom: typeof session.deleteRoom === 'function',
        hasEnsureActiveRoom: typeof session.ensureActiveRoom === 'function',
        hasOpenLoadModal: typeof session.openLoadModal === 'function',
        hasCloseLoadModal: typeof session.closeLoadModal === 'function',
        isLoadModalOpen: session.isLoadModalOpen,
        hasRequestSnapshot: typeof session.requestSnapshot === 'function',
        hasResolveDiscard: typeof session.resolveConflictDiscardLocalAndJoin === 'function',
        hasResolveKeep: typeof session.resolveConflictKeepLocal === 'function',
        isSavedRoomsArray: Array.isArray(session.savedRooms),
        isConflictModalOpen: session.isConflictModalOpen,
      };
      return <div id="session-storage-summary" data-json={JSON.stringify(summary)} />;
    }

    const html = renderToString(<TestComponent />);
    const match = html.match(/data-json="([^"]+)"/);
    expect(match).not.toBeNull();

    const summary = JSON.parse(match![1].replace(/&quot;/g, '"'));
    expect(summary.hasSaveRoom).toBe(true);
    expect(summary.hasRestoreRoom).toBe(true);
    expect(summary.hasCopyRoomToNewSave).toBe(true);
    expect(summary.hasDeleteRoom).toBe(true);
    expect(summary.hasEnsureActiveRoom).toBe(true);
    expect(summary.hasOpenLoadModal).toBe(true);
    expect(summary.hasCloseLoadModal).toBe(true);
    expect(summary.isLoadModalOpen).toBe(false);
    expect(summary.hasRequestSnapshot).toBe(true);
    expect(summary.hasResolveDiscard).toBe(true);
    expect(summary.hasResolveKeep).toBe(true);
    expect(summary.isSavedRoomsArray).toBe(true);
    expect(summary.isConflictModalOpen).toBe(false);
  });

  it('defers saving snapshot to storage when creating or activating an empty room until modified', async () => {
    const holder: { session?: ReturnType<typeof usePeerSession> } = {};
    // oxlint-disable-next-line react/immutability, react/globals
    function TestComponent() {
      // oxlint-disable-next-line react/immutability, react/globals
      holder.session = usePeerSession();
      return <div data-success="true">room-session</div>;
    }

    renderToString(<TestComponent />);
    expect(holder.session).toBeDefined();
    const session = holder.session!;

    // 1. Initial state: no rooms saved
    expect(await listRoomSnapshots()).toHaveLength(0);

    // 2. ensureActiveRoom on empty grid does not create a saved room
    const blankGrid = new PixelGrid(16, 16);
    const room1 = session.ensureActiveRoom(blankGrid);
    expect(await loadRoomSnapshot(room1)).toBeNull();
    expect(await listRoomSnapshots()).toHaveLength(0);

    // 3. saveRoom on a blank grid with no existing record does not save
    await session.saveRoom(blankGrid, undefined, room1);
    expect(await loadRoomSnapshot(room1)).toBeNull();
    expect(await listRoomSnapshots()).toHaveLength(0);

    // 4. generateNewRoom creates a new room ID but does not save an empty snapshot
    const room2 = session.generateNewRoom();
    expect(await loadRoomSnapshot(room2)).toBeNull();
    expect(await listRoomSnapshots()).toHaveLength(0);

    // 5. Drawing/modifying the grid (e.g. setting a pixel) and calling saveRoom DOES persist the room
    const modifiedGrid = new PixelGrid(16, 16);
    modifiedGrid.set(2, 3, 1, '#00e5a3');
    await session.saveRoom(modifiedGrid, undefined, room2);

    expect(await loadRoomSnapshot(room2)).not.toBeNull();
    const saved = await loadRoomSnapshot(room2);
    expect(saved?.roomName).toBe(room2);
    expect(saved?.pixelCount).toBe(1);
    const allRooms = await listRoomSnapshots();
    expect(allRooms.map((r) => r.roomName)).toContain(room2);

    // 6. Clearing the already-persisted room updates the existing record
    const clearedGrid = new PixelGrid(16, 16);
    await session.saveRoom(clearedGrid, undefined, room2);
    expect(await loadRoomSnapshot(room2)).not.toBeNull();
    const clearedSnapshot = await loadRoomSnapshot(room2);
    expect(clearedSnapshot?.pixelCount).toBe(0);
  });

  it('does not save a snapshot when opening share modal or getting share url on a blank canvas', async () => {
    const holder: { session?: ReturnType<typeof usePeerSession> } = {};
    // oxlint-disable-next-line react/immutability, react/globals
    function TestComponent() {
      // oxlint-disable-next-line react/immutability, react/globals
      holder.session = usePeerSession();
      return <div>share-test</div>;
    }

    renderToString(<TestComponent />);
    const session = holder.session!;

    expect(await listRoomSnapshots()).toHaveLength(0);

    // Call getShareUrl on empty canvas
    const url = session.getShareUrl();
    expect(url).toContain('#room=');
    expect(await listRoomSnapshots()).toHaveLength(0);

    // Open share modal on empty canvas
    session.openShareModal();
    expect(await listRoomSnapshots()).toHaveLength(0);

    // Repeated generateNewRoom calls
    session.generateNewRoom();
    session.generateNewRoom();
    expect(await listRoomSnapshots()).toHaveLength(0);
  });

  it('does not create an empty save when resolving conflict with a blank canvas', async () => {
    let mockGrid = new PixelGrid(16, 16);
    const holder: { session?: ReturnType<typeof usePeerSession> } = {};
    // oxlint-disable-next-line react/immutability, react/globals
    function TestComponent() {
      // oxlint-disable-next-line react/immutability, react/globals
      holder.session = usePeerSession({
        getCurrentGrid: () => mockGrid,
      });
      return <div>conflict-test</div>;
    }

    renderToString(<TestComponent />);
    const session = holder.session!;

    // Resolve conflict with blank canvas
    session.resolveConflictKeepLocal();
    expect(await listRoomSnapshots()).toHaveLength(0);

    // Now with pixels
    mockGrid = new PixelGrid(16, 16);
    mockGrid.set(1, 1, 1, '#ff0055');
    // Simulate setting conflict info
    const conflictSession = holder.session!;
    // Calling saveRoom on a modified canvas persists
    await conflictSession.saveRoom(mockGrid);
    const rooms = await listRoomSnapshots();
    expect(rooms.length).toBeGreaterThan(0);
  });

  it('does not cross-contaminate active room UUID when saving another room', async () => {
    const holder: { session?: ReturnType<typeof usePeerSession> } = {};
    // oxlint-disable-next-line react/immutability, react/globals
    function TestComponent() {
      // oxlint-disable-next-line react/immutability, react/globals
      holder.session = usePeerSession();
      return <div>uuid-test</div>;
    }

    renderToString(<TestComponent />);
    const session = holder.session!;

    const activeRoom = session.roomId;
    const targetRoom = 'independent-external-room';

    const grid = new PixelGrid(16, 16);
    grid.set(0, 0, 1, '#123456');

    await session.saveRoom(grid, undefined, targetRoom);
    const savedTarget = await loadRoomSnapshot(targetRoom);
    expect(savedTarget).not.toBeNull();
    expect(savedTarget?.roomName).toBe(targetRoom);

    // Active room remains unsaved
    expect(await loadRoomSnapshot(activeRoom)).toBeNull();
  });
});


