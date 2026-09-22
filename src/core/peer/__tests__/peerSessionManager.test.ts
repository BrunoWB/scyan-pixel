import { describe, it, expect, vi } from 'vitest';
import { PeerSessionManager, type RoomFactory } from '../peerSessionManager';
import type { PeerProfile } from '../peerIdentity';
import type {
  CanvasMutationMessage,
  CanvasSnapshotMessage,
} from '../peerCanvasSync';
import type { Room } from '@trystero-p2p/torrent';

interface MockActionState {
  handlers: ((data: any, ctx: { peerId: string }) => void)[];
  sent: { data: any; target?: string }[];
}

function createMockRoomFactory() {
  const actions = new Map<string, MockActionState>();
  let currentOnPeerJoin: ((peerId: string) => void) | null = null;
  let currentOnPeerLeave: ((peerId: string) => void) | null = null;
  const leaveSpy = vi.fn().mockResolvedValue(undefined);

  const getOrCreateAction = (type: string): MockActionState => {
    let state = actions.get(type);
    if (!state) {
      state = { handlers: [], sent: [] };
      actions.set(type, state);
    }
    return state;
  };

  const factory: RoomFactory = (_config, _roomId) => {
    const mockRoom: Partial<Room> = {
      makeAction: ((type: string) => {
        const state = getOrCreateAction(type);
        return {
          send: vi.fn().mockImplementation(async (data: any, options?: { target?: string }) => {
            state.sent.push({ data, target: options?.target });
          }),
          get onMessage() {
            return state.handlers[0] || null;
          },
          set onMessage(handler: any) {
            state.handlers = [handler];
          },
        };
      }) as any,
      leave: leaveSpy,
      get onPeerJoin() {
        return currentOnPeerJoin;
      },
      set onPeerJoin(handler: any) {
        currentOnPeerJoin = handler;
      },
      get onPeerLeave() {
        return currentOnPeerLeave;
      },
      set onPeerLeave(handler: any) {
        currentOnPeerLeave = handler;
      },
    };
    return mockRoom as Room;
  };

  return {
    factory,
    actions,
    leaveSpy,
    triggerPeerJoin: (peerId: string) => currentOnPeerJoin?.(peerId),
    triggerPeerLeave: (peerId: string) => currentOnPeerLeave?.(peerId),
    triggerReceive: (type: string, data: any, peerId: string) => {
      const state = actions.get(type);
      state?.handlers.forEach((h) => h(data, { peerId }));
    },
    getActionSent: (type: string) => actions.get(type)?.sent || [],
  };
}

describe('PeerSessionManager', () => {
  const selfProfile: PeerProfile = {
    id: 'self-123',
    name: 'tokyo-kitsune',
    color: '#06b6d4',
  };

  it('joins room and sets up actions via room factory', () => {
    const mock = createMockRoomFactory();
    const manager = new PeerSessionManager({
      roomId: 'room-abc',
      profile: selfProfile,
      roomFactory: mock.factory,
    });

    expect(manager.roomId).toBe('room-abc');
    expect(manager.connectedPeers).toEqual([]);

    manager.destroy();
    expect(mock.leaveSpy).toHaveBeenCalled();
  });

  it('broadcasts profile and requests snapshot when peer joins and local canvas is empty', () => {
    const mock = createMockRoomFactory();
    const manager = new PeerSessionManager({
      roomId: 'room-1',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: {
        onGetSnapshot: () => ({
          type: 'snapshot',
          width: 16,
          height: 16,
          pixels: [],
          count: 0,
        }),
      },
    });

    mock.triggerPeerJoin('remote-peer-99');

    // Should have sent profile
    const profileSent = mock.getActionSent('profile');
    expect(profileSent).toHaveLength(1);
    expect(profileSent[0].data).toEqual(selfProfile);
    expect(profileSent[0].target).toBe('remote-peer-99');

    // Since canvas had 0 pixels, should have requested snapshot
    const requestSent = mock.getActionSent('snapshotRequest');
    expect(requestSent).toHaveLength(1);
    expect(requestSent[0].target).toBe('remote-peer-99');

    manager.destroy();
  });

  it('sends existing canvas snapshot when peer joins and local canvas has content', () => {
    const mock = createMockRoomFactory();
    const existingSnapshot: CanvasSnapshotMessage = {
      type: 'snapshot',
      width: 16,
      height: 16,
      pixels: [[2, 2, '#3b82f6']],
      count: 1,
    };

    const manager = new PeerSessionManager({
      roomId: 'room-1',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: {
        onGetSnapshot: () => existingSnapshot,
      },
    });

    mock.triggerPeerJoin('friend-peer-42');

    // Should have sent snapshot to late-joining friend
    const snapshotSent = mock.getActionSent('snapshot');
    expect(snapshotSent).toHaveLength(1);
    expect(snapshotSent[0].data).toEqual(existingSnapshot);
    expect(snapshotSent[0].target).toBe('friend-peer-42');

    manager.destroy();
  });

  it('updates connected peers on receiving remote peer profile and on peer leave', () => {
    const mock = createMockRoomFactory();
    const onPeersChange = vi.fn();

    const manager = new PeerSessionManager({
      roomId: 'room-test',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: { onPeersChange },
    });

    // Remote peer sends their profile
    mock.triggerReceive(
      'profile',
      { id: 'custom-peer-id', name: 'montreal-wolf', color: '#ec4899' },
      'conn-peer-1'
    );

    expect(onPeersChange).toHaveBeenCalled();
    expect(manager.connectedPeers).toHaveLength(1);
    expect(manager.connectedPeers[0].id).toBe('conn-peer-1');
    expect(manager.connectedPeers[0].name).toBe('montreal-wolf');
    expect(manager.connectedPeers[0].color).toBe('#ec4899');

    // When that peer leaves
    mock.triggerPeerLeave('conn-peer-1');
    expect(manager.connectedPeers).toHaveLength(0);

    manager.destroy();
  });

  it('broadcasts mutations and invokes callback on remote mutations', () => {
    const mock = createMockRoomFactory();
    const onRemoteMutation = vi.fn();

    const manager = new PeerSessionManager({
      roomId: 'room-draw',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: { onRemoteMutation },
    });

    // Local user broadcasts pixels
    manager.broadcastPixels([[5, 5, '#10b981']]);
    const sentMutations = mock.getActionSent('mutation');
    expect(sentMutations).toHaveLength(1);
    expect(sentMutations[0].data).toEqual({
      type: 'pixels',
      pixels: [[5, 5, '#10b981']],
    });

    // Local user broadcasts clear
    manager.broadcastClear();
    expect(sentMutations).toHaveLength(2);
    expect(sentMutations[1].data).toEqual({ type: 'clear' });

    // Remote peer sends mutation
    const remoteMutation: CanvasMutationMessage = {
      type: 'pixels',
      pixels: [[8, 8, '#f59e0b']],
    };
    mock.triggerReceive('mutation', remoteMutation, 'conn-peer-2');
    expect(onRemoteMutation).toHaveBeenCalledWith(remoteMutation);

    manager.destroy();
  });

  it('invokes callback on remote snapshot receipt', () => {
    const mock = createMockRoomFactory();
    const onRemoteSnapshot = vi.fn();

    const manager = new PeerSessionManager({
      roomId: 'room-snapshot',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: { onRemoteSnapshot },
    });

    const incomingSnapshot: CanvasSnapshotMessage = {
      type: 'snapshot',
      width: 32,
      height: 32,
      pixels: [[10, 10, '#ffffff']],
    };

    mock.triggerReceive('snapshot', incomingSnapshot, 'conn-peer-3');
    expect(onRemoteSnapshot).toHaveBeenCalledWith(incomingSnapshot);

    manager.destroy();
  });

  it('switches rooms cleanly when changeRoom is called', () => {
    const mock = createMockRoomFactory();
    const manager = new PeerSessionManager({
      roomId: 'room-alpha',
      profile: selfProfile,
      roomFactory: mock.factory,
    });

    expect(manager.roomId).toBe('room-alpha');

    manager.changeRoom('room-beta');
    expect(manager.roomId).toBe('room-beta');
    expect(mock.leaveSpy).toHaveBeenCalledTimes(1);

    // Calling changeRoom with same roomId is a no-op
    manager.changeRoom('room-beta');
    expect(mock.leaveSpy).toHaveBeenCalledTimes(1);

    manager.destroy();
    expect(mock.leaveSpy).toHaveBeenCalledTimes(2);
  });

  it('immediately adds connecting placeholder on peer join before profile action is received', () => {
    const mock = createMockRoomFactory();
    const onPeersChange = vi.fn();

    const manager = new PeerSessionManager({
      roomId: 'room-presence',
      profile: selfProfile,
      roomFactory: mock.factory,
      callbacks: { onPeersChange },
    });

    mock.triggerPeerJoin('fresh-peer-7');
    expect(manager.connectedPeers).toHaveLength(1);
    expect(manager.connectedPeers[0].id).toBe('fresh-peer-7');
    expect(manager.connectedPeers[0].name).toContain('Peer fres');

    // Once profile arrives, it refines the placeholder
    mock.triggerReceive('profile', { id: 'fresh-peer-7', name: 'Cool Fox', color: '#10b981' }, 'fresh-peer-7');
    expect(manager.connectedPeers).toHaveLength(1);
    expect(manager.connectedPeers[0].name).toBe('Cool Fox');
    expect(manager.connectedPeers[0].color).toBe('#10b981');

    manager.destroy();
  });

  it('supports legacy tuple action format [send, get] transparently', () => {
    const sentData: any[] = [];
    let messageReceiver: ((data: any, peerId: string) => void) | null = null;
    const onRemoteMutation = vi.fn();

    const tupleRoomFactory: RoomFactory = () => {
      return {
        makeAction: () => [
          vi.fn().mockImplementation(async (data: any) => {
            sentData.push(data);
          }),
          vi.fn().mockImplementation((fn: any) => {
            messageReceiver = fn;
          }),
        ],
        leave: vi.fn().mockResolvedValue(undefined),
        onPeerJoin: null,
        onPeerLeave: null,
      } as any;
    };

    const manager = new PeerSessionManager({
      roomId: 'room-tuple',
      profile: selfProfile,
      roomFactory: tupleRoomFactory,
      callbacks: { onRemoteMutation },
    });

    manager.broadcastPixels([[1, 2, '#ffffff']]);
    expect(sentData).toHaveLength(1);
    expect(sentData[0]).toEqual({
      type: 'pixels',
      pixels: [[1, 2, '#ffffff']],
    });

    if (messageReceiver) {
      (messageReceiver as any)({ type: 'clear' }, 'peer-tuple-1');
      expect(onRemoteMutation).toHaveBeenCalledWith({ type: 'clear' });
    }

    manager.destroy();
  });
});
