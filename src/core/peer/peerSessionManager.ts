import { joinRoom as defaultJoinRoom, type Room } from '@trystero-p2p/torrent';
import type { PeerProfile, ConnectedPeer } from './peerIdentity';
import type {
  CanvasMutationMessage,
  CanvasSnapshotMessage,
  CanvasRequestSnapshotMessage,
  PixelDelta,
} from './peerCanvasSync';

export const SCYAN_PIXEL_APP_ID = 'scyan-pixel';

export type RoomFactory = (config: { appId: string }, roomId: string) => Room;

export interface PeerSessionCallbacks {
  onPeersChange?: (peers: ConnectedPeer[]) => void;
  onRemoteMutation?: (mutation: CanvasMutationMessage) => void;
  onRemoteSnapshot?: (snapshot: CanvasSnapshotMessage) => void;
  onGetSnapshot?: () => CanvasSnapshotMessage | null;
}

export interface PeerSessionConfig {
  appId?: string;
  roomId: string;
  profile: PeerProfile;
  callbacks?: PeerSessionCallbacks;
  roomFactory?: RoomFactory;
}

interface WrappedAction<T> {
  send: (data: T, targetPeerId?: string) => Promise<void>;
  onReceive: (handler: (data: T, peerId: string) => void) => void;
}

function wrapAction<T>(rawAction: any): WrappedAction<T> {
  if (Array.isArray(rawAction)) {
    const [sendFn, getFn] = rawAction;
    return {
      send: async (data: T, targetPeerId?: string) => {
        try {
          if (typeof sendFn === 'function') {
            if (targetPeerId) {
              await sendFn(data, targetPeerId);
            } else {
              await sendFn(data);
            }
          }
        } catch (err) {
          console.warn('[PeerSessionManager] Failed to send WebRTC action:', err);
        }
      },
      onReceive: (handler: (data: T, peerId: string) => void) => {
        if (typeof getFn === 'function') {
          getFn((data: T, peerId: string) => {
            handler(data, peerId);
          });
        }
      },
    };
  }

  return {
    send: async (data: T, targetPeerId?: string) => {
      if (!rawAction) return;
      try {
        if (typeof rawAction.send === 'function') {
          if (targetPeerId) {
            await rawAction.send(data, { target: targetPeerId });
          } else {
            await rawAction.send(data);
          }
        }
      } catch (err) {
        console.warn('[PeerSessionManager] Failed to send WebRTC action:', err);
      }
    },
    onReceive: (handler: (data: T, peerId: string) => void) => {
      if (!rawAction) return;
      rawAction.onMessage = (data: T, context: { peerId: string }) => {
        handler(data, context?.peerId);
      };
    },
  };
}

export class PeerSessionManager {
  readonly appId: string;
  private currentRoomId: string;
  private profile: PeerProfile;
  private callbacks: PeerSessionCallbacks;
  private roomFactory: RoomFactory;

  private currentRoom: Room | null = null;
  private peersMap = new Map<string, ConnectedPeer>();

  private profileAction: WrappedAction<PeerProfile> | null = null;
  private snapshotAction: WrappedAction<CanvasSnapshotMessage> | null = null;
  private snapshotRequestAction: WrappedAction<CanvasRequestSnapshotMessage> | null = null;
  private mutationAction: WrappedAction<CanvasMutationMessage> | null = null;

  constructor(config: PeerSessionConfig) {
    this.appId = config.appId || SCYAN_PIXEL_APP_ID;
    this.currentRoomId = config.roomId;
    this.profile = config.profile;
    this.callbacks = config.callbacks || {};
    this.roomFactory = config.roomFactory || defaultJoinRoom;

    this.join(this.currentRoomId);
  }

  get roomId(): string {
    return this.currentRoomId;
  }

  get connectedPeers(): ConnectedPeer[] {
    return Array.from(this.peersMap.values());
  }

  setCallbacks(callbacks: PeerSessionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  updateProfile(profile: PeerProfile): void {
    this.profile = profile;
    this.profileAction?.send(profile);
  }

  changeRoom(newRoomId: string): void {
    if (newRoomId === this.currentRoomId && this.currentRoom) {
      return;
    }
    this.leaveCurrentRoom();
    this.currentRoomId = newRoomId;
    this.join(newRoomId);
  }

  broadcastMutation(mutation: CanvasMutationMessage): void {
    this.mutationAction?.send(mutation);
  }

  broadcastPixels(pixels: PixelDelta[]): void {
    if (!pixels || pixels.length === 0) return;
    this.broadcastMutation({
      type: 'pixels',
      pixels,
    });
  }

  broadcastClear(): void {
    this.broadcastMutation({
      type: 'clear',
    });
  }

  broadcastSnapshot(snapshot: CanvasSnapshotMessage): void {
    this.snapshotAction?.send(snapshot);
  }

  requestSnapshot(targetPeerId?: string): void {
    this.snapshotRequestAction?.send({ fromPeer: this.profile.id }, targetPeerId);
  }

  destroy(): void {
    this.leaveCurrentRoom();
    this.callbacks = {};
  }

  private join(roomId: string): void {
    // Check if WebRTC is supported in the current environment
    const isWebRTCAvailable =
      typeof RTCPeerConnection !== 'undefined' || Boolean(this.roomFactory !== defaultJoinRoom);

    if (!isWebRTCAvailable) {
      console.warn('[PeerSessionManager] RTCPeerConnection is unavailable in this environment.');
      return;
    }

    try {
      const room = this.roomFactory({ appId: this.appId }, roomId);
      this.currentRoom = room;

      // Initialize typed actions
      this.profileAction = wrapAction<PeerProfile>(room.makeAction('profile'));
      this.snapshotAction = wrapAction<CanvasSnapshotMessage>(room.makeAction('snapshot'));
      this.snapshotRequestAction = wrapAction<CanvasRequestSnapshotMessage>(
        room.makeAction('snapshotRequest')
      );
      this.mutationAction = wrapAction<CanvasMutationMessage>(room.makeAction('mutation'));

      // 1. Peer Presence: On Peer Join
      room.onPeerJoin = (peerId: string) => {
        if (!this.peersMap.has(peerId)) {
          this.peersMap.set(peerId, {
            id: peerId,
            name: 'Peer ' + peerId.slice(0, 4),
            color: '#3b82f6',
            joinedAt: Date.now(),
          });
          this.notifyPeersChange();
        }

        // Broadcast profile to the newly joined peer
        this.profileAction?.send(this.profile, peerId);

        // Canvas State Synchronization
        const snapshot = this.callbacks.onGetSnapshot?.();
        if (snapshot && snapshot.pixels && snapshot.pixels.length > 0) {
          // If we have canvas contents, send state to the new peer so they immediately see existing drawings
          this.snapshotAction?.send(snapshot, peerId);
        } else {
          // If local canvas is empty, request snapshot from the peer
          this.snapshotRequestAction?.send({ fromPeer: this.profile.id }, peerId);
        }
      };

      // 2. Peer Presence: On Peer Leave
      room.onPeerLeave = (peerId: string) => {
        if (this.peersMap.has(peerId)) {
          this.peersMap.delete(peerId);
          this.notifyPeersChange();
        }
      };

      // 3. Peer Profile Action Listener
      this.profileAction.onReceive((profileData: PeerProfile, peerId: string) => {
        if (!peerId) return;
        this.peersMap.set(peerId, {
          id: peerId,
          name: profileData.name || 'Anonymous Peer',
          color: profileData.color || '#3b82f6',
          joinedAt: this.peersMap.get(peerId)?.joinedAt || Date.now(),
        });
        this.notifyPeersChange();
      });

      // 4. Canvas Snapshot Request Listener
      this.snapshotRequestAction.onReceive((_req: CanvasRequestSnapshotMessage, peerId: string) => {
        const snapshot = this.callbacks.onGetSnapshot?.();
        if (snapshot && snapshot.pixels && snapshot.pixels.length > 0) {
          this.snapshotAction?.send(snapshot, peerId);
        }
      });

      // 5. Canvas Snapshot Response Listener
      this.snapshotAction.onReceive((snapshot: CanvasSnapshotMessage, _peerId: string) => {
        if (snapshot && Array.isArray(snapshot.pixels)) {
          this.callbacks.onRemoteSnapshot?.(snapshot);
        }
      });

      // 6. Canvas Delta Mutation Listener
      this.mutationAction.onReceive((mutation: CanvasMutationMessage, _peerId: string) => {
        if (mutation) {
          this.callbacks.onRemoteMutation?.(mutation);
        }
      });
    } catch (err) {
      console.error('[PeerSessionManager] Error joining room:', err);
    }
  }

  private leaveCurrentRoom(): void {
    if (this.currentRoom) {
      try {
        this.currentRoom.leave().catch((err: unknown) => {
          console.warn('[PeerSessionManager] Error leaving room:', err);
        });
      } catch (err) {
        console.warn('[PeerSessionManager] Exception leaving room:', err);
      }
      this.currentRoom = null;
    }
    this.peersMap.clear();
    this.notifyPeersChange();
    this.profileAction = null;
    this.snapshotAction = null;
    this.snapshotRequestAction = null;
    this.mutationAction = null;
  }

  private notifyPeersChange(): void {
    const list = Array.from(this.peersMap.values());
    this.callbacks.onPeersChange?.(list);
  }
}
