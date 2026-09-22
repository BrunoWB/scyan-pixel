import { describe, it, expect } from 'vitest';
import { PeerSessionManager, type RoomConflictEvent } from '../peerSessionManager';
import { createDefaultPeerProfile } from '../peerIdentity';


describe('PeerSessionManager UUID handshake and conflict detection', () => {
  function createMockRoomFactory() {
    const actionHandlers = new Map<string, (data: any, peerId: string) => void>();
    const sentActions: { type: string; data: any; target?: string }[] = [];

    const roomMock: any = {
      makeAction: (type: string) => {
        return [
          async (data: any, targetPeerId?: string) => {
            sentActions.push({ type, data, target: targetPeerId });
          },
          (handler: (data: any, peerId: string) => void) => {
            actionHandlers.set(type, handler);
          },
        ];
      },
      leave: async () => {},
      onPeerJoin: null,
      onPeerLeave: null,
    };

    const factory = () => roomMock;
    return { factory, roomMock, actionHandlers, sentActions };
  }

  it('sends roomInfo with roomName and roomUuid on peer join', () => {
    const { factory, roomMock, sentActions } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();

    new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-1234',
      profile,
      roomFactory: factory,
    });

    // Simulate peer joining
    roomMock.onPeerJoin?.('peer-alice');

    const roomInfoSent = sentActions.find((a) => a.type === 'roomInfo');
    expect(roomInfoSent).toBeDefined();
    expect(roomInfoSent?.data).toEqual({
      roomName: 'montreal-lion-roar',
      roomUuid: 'uuid-1234',
      peerId: profile.id,
    });
    expect(roomInfoSent?.target).toBe('peer-alice');
  });

  it('triggers onRoomConflict when remote peer sends different roomUuid', () => {
    const { factory, actionHandlers } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();
    let conflictEvent: RoomConflictEvent | null = null;

    new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-local-1111',
      profile,
      roomFactory: factory,
      callbacks: {
        onRoomConflict: (conflict) => {
          conflictEvent = conflict;
        },
      },
    });

    // Simulate receiving roomInfo from peer with different UUID
    const roomInfoHandler = actionHandlers.get('roomInfo');
    expect(roomInfoHandler).toBeDefined();

    roomInfoHandler?.(
      {
        roomName: 'montreal-lion-roar',
        roomUuid: 'uuid-remote-9999',
        peerId: 'peer-bob',
      },
      'peer-bob'
    );

    expect(conflictEvent).not.toBeNull();
    const event = conflictEvent as unknown as RoomConflictEvent;
    expect(event.roomName).toBe('montreal-lion-roar');
    expect(event.localUuid).toBe('uuid-local-1111');
    expect(event.remoteUuid).toBe('uuid-remote-9999');
    expect(event.remotePeerId).toBe('peer-bob');
  });

  it('adopts remote roomUuid when local has no UUID assigned yet', () => {
    const { factory, actionHandlers } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();
    let adoptedUuid: string | null = null;

    const manager = new PeerSessionManager({
      roomId: 'shared-room',
      roomUuid: '', // No UUID initially
      profile,
      roomFactory: factory,
      callbacks: {
        onAdoptRoomUuid: (uuid) => {
          adoptedUuid = uuid;
        },
      },
    });

    const roomInfoHandler = actionHandlers.get('roomInfo');
    roomInfoHandler?.(
      {
        roomName: 'shared-room',
        roomUuid: 'uuid-adopted-4444',
        peerId: 'peer-host',
      },
      'peer-host'
    );

    expect(adoptedUuid).toBe('uuid-adopted-4444');
    expect(manager.roomUuid).toBe('uuid-adopted-4444');
  });

  it('blocks snapshot and mutations from peer with conflicting UUID', () => {
    const { factory, actionHandlers } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();
    let snapshotReceived = false;
    let mutationReceived = false;

    new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-local-1111',
      profile,
      roomFactory: factory,
      callbacks: {
        onRemoteSnapshot: () => {
          snapshotReceived = true;
        },
        onRemoteMutation: () => {
          mutationReceived = true;
        },
      },
    });

    const roomInfoHandler = actionHandlers.get('roomInfo');
    const snapshotHandler = actionHandlers.get('snapshot');
    const mutationHandler = actionHandlers.get('mutation');

    // Peer connects with conflicting UUID
    roomInfoHandler?.(
      {
        roomName: 'montreal-lion-roar',
        roomUuid: 'uuid-conflicting-9999',
        peerId: 'peer-charlie',
      },
      'peer-charlie'
    );

    // Send snapshot from conflicting peer
    snapshotHandler?.(
      {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[0, 0, '#ff0000']],
      },
      'peer-charlie'
    );

    // Send mutation from conflicting peer
    mutationHandler?.(
      {
        type: 'pixels',
        pixels: [[0, 0, '#ff0000', 100]],
      },
      'peer-charlie'
    );

    expect(snapshotReceived).toBe(false);
    expect(mutationReceived).toBe(false);
  });

  it('buffers snapshot until UUID verified and flushes it when UUID matches', () => {
    const { factory, actionHandlers } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();
    let receivedSnapshot: any = null;

    new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-shared-1234',
      profile,
      roomFactory: factory,
      callbacks: {
        onRemoteSnapshot: (snapshot) => {
          receivedSnapshot = snapshot;
        },
      },
    });

    const roomInfoHandler = actionHandlers.get('roomInfo');
    const snapshotHandler = actionHandlers.get('snapshot');

    // Snapshot arrives BEFORE roomInfo handshake completes
    snapshotHandler?.(
      {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[5, 5, '#00ff00']],
      },
      'peer-david'
    );

    // Snapshot should be held in pending buffer
    expect(receivedSnapshot).toBeNull();

    // Now roomInfo arrives with matching UUID
    roomInfoHandler?.(
      {
        roomName: 'montreal-lion-roar',
        roomUuid: 'uuid-shared-1234',
        peerId: 'peer-david',
      },
      'peer-david'
    );

    // Now buffered snapshot should be applied
    expect(receivedSnapshot).not.toBeNull();
    expect(receivedSnapshot.pixels).toEqual([[5, 5, '#00ff00']]);
  });

  it('discards buffered snapshot if UUID handshake detects conflict', () => {
    const { factory, actionHandlers } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();
    let receivedSnapshot: any = null;
    let conflictDetected = false;

    new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-local-5555',
      profile,
      roomFactory: factory,
      callbacks: {
        onRemoteSnapshot: (snapshot) => {
          receivedSnapshot = snapshot;
        },
        onRoomConflict: () => {
          conflictDetected = true;
        },
      },
    });

    const roomInfoHandler = actionHandlers.get('roomInfo');
    const snapshotHandler = actionHandlers.get('snapshot');

    // Snapshot arrives BEFORE roomInfo
    snapshotHandler?.(
      {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[3, 3, '#0000ff']],
      },
      'peer-eve'
    );

    expect(receivedSnapshot).toBeNull();

    // Handshake arrives with DIFFERENT UUID
    roomInfoHandler?.(
      {
        roomName: 'montreal-lion-roar',
        roomUuid: 'uuid-remote-7777',
        peerId: 'peer-eve',
      },
      'peer-eve'
    );

    expect(conflictDetected).toBe(true);
    expect(receivedSnapshot).toBeNull();
  });

  it('allows adopting remote UUID on resolveConflictAdopt and requests snapshot', () => {
    const { factory, sentActions } = createMockRoomFactory();
    const profile = createDefaultPeerProfile();

    const manager = new PeerSessionManager({
      roomId: 'montreal-lion-roar',
      roomUuid: 'uuid-local-1111',
      profile,
      roomFactory: factory,
    });

    manager.resolveConflictAdopt('uuid-remote-9999', 'peer-bob');

    expect(manager.roomUuid).toBe('uuid-remote-9999');
    const snapshotReq = sentActions.find((a) => a.type === 'snapshotRequest');
    expect(snapshotReq).toBeDefined();
    expect(snapshotReq?.target).toBe('peer-bob');
  });
});
