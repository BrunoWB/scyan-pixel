import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type PeerProfile,
  type ConnectedPeer,
  loadStoredPeerProfile,
  saveStoredPeerProfile,
  generateRandomCityAnimalName,
  getRandomPeerColor,
} from '../../../core/peer/peerIdentity';
import {
  PeerSessionManager,
  type RoomFactory,
  type PeerSessionCallbacks,
} from '../../../core/peer/peerSessionManager';
import type {
  CanvasMutationMessage,
  CanvasSnapshotMessage,
  PixelDelta,
} from '../../../core/peer/peerCanvasSync';

function getInitialRoomId(): string {
  if (typeof window !== 'undefined' && window.location?.hash) {
    const match = window.location.hash.match(/#room=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return 'canvas-' + Math.random().toString(36).substring(2, 8);
}

export interface UsePeerSessionOptions {
  onRemoteMutation?: (mutation: CanvasMutationMessage) => void;
  onRemoteSnapshot?: (snapshot: CanvasSnapshotMessage) => void;
  onGetSnapshot?: () => CanvasSnapshotMessage | null;
  roomFactory?: RoomFactory;
}

export interface UsePeerSessionReturn {
  profile: PeerProfile;
  setProfile: React.Dispatch<React.SetStateAction<PeerProfile>>;
  updateProfile: (patch: Partial<Omit<PeerProfile, 'id'>>) => void;
  randomizeName: () => void;
  randomizeColor: () => void;
  randomizeProfile: () => void;
  connectedPeers: ConnectedPeer[];
  setConnectedPeers: React.Dispatch<React.SetStateAction<ConnectedPeer[]>>;
  roomId: string;
  setRoomId: (roomId: string) => void;
  generateNewRoom: () => string;
  getShareUrl: () => string;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  openShareModal: () => void;
  closeShareModal: () => void;
  broadcastMutation: (mutation: CanvasMutationMessage) => void;
  broadcastPixels: (pixels: PixelDelta[]) => void;
  broadcastClear: () => void;
  broadcastSnapshot: (snapshot: CanvasSnapshotMessage) => void;
}

export function usePeerSession(options?: UsePeerSessionOptions): UsePeerSessionReturn {
  const [profile, setProfile] = useState<PeerProfile>(() => loadStoredPeerProfile());
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
  const [roomId, setRoomIdState] = useState<string>(getInitialRoomId);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const sessionManagerRef = useRef<PeerSessionManager | null>(null);
  const callbacksRef = useRef<PeerSessionCallbacks>({
    onPeersChange: setConnectedPeers,
    onRemoteMutation: options?.onRemoteMutation,
    onRemoteSnapshot: options?.onRemoteSnapshot,
    onGetSnapshot: options?.onGetSnapshot,
  });

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = {
      onPeersChange: setConnectedPeers,
      onRemoteMutation: options?.onRemoteMutation,
      onRemoteSnapshot: options?.onRemoteSnapshot,
      onGetSnapshot: options?.onGetSnapshot,
    };
    sessionManagerRef.current?.setCallbacks(callbacksRef.current);
  }, [options?.onRemoteMutation, options?.onRemoteSnapshot, options?.onGetSnapshot]);

  // Sync hash changes in browser and ensure URL hash has roomId
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If no room hash in URL, sync initial roomId into URL hash so reload keeps same room
    if (!window.location.hash || !window.location.hash.includes('room=')) {
      const url = new URL(window.location.href);
      url.hash = `room=${roomId}`;
      window.history.replaceState(null, '', url.toString());
    }

    const handleHashChange = () => {
      const match = window.location.hash.match(/#room=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setRoomIdState(match[1]);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [roomId]);

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const roomFactoryRef = useRef(options?.roomFactory);
  useEffect(() => {
    roomFactoryRef.current = options?.roomFactory;
  }, [options?.roomFactory]);

  const getManager = useCallback(() => {
    if (!sessionManagerRef.current) {
      sessionManagerRef.current = new PeerSessionManager({
        roomId,
        profile: profileRef.current,
        callbacks: {
          onPeersChange: (peers) => setConnectedPeers(peers),
          onRemoteMutation: (mutation) => callbacksRef.current.onRemoteMutation?.(mutation),
          onRemoteSnapshot: (snapshot) => callbacksRef.current.onRemoteSnapshot?.(snapshot),
          onGetSnapshot: () => callbacksRef.current.onGetSnapshot?.() ?? null,
        },
        roomFactory: roomFactoryRef.current,
      });
    }
    return sessionManagerRef.current;
  }, [roomId]);

  // Manage WebRTC PeerSessionManager lifecycle based on roomId
  useEffect(() => {
    const manager = getManager();
    if (manager.roomId !== roomId) {
      manager.changeRoom(roomId);
    }

    return () => {
      manager.destroy();
      sessionManagerRef.current = null;
    };
  }, [roomId, getManager]);

  const updateProfile = useCallback((patch: Partial<Omit<PeerProfile, 'id'>>) => {
    setProfile((prev) => {
      const updated: PeerProfile = {
        ...prev,
        ...patch,
      };
      saveStoredPeerProfile(updated);
      getManager().updateProfile(updated);
      return updated;
    });
  }, [getManager]);

  const randomizeName = useCallback(() => {
    const newName = generateRandomCityAnimalName();
    updateProfile({ name: newName });
  }, [updateProfile]);

  const randomizeColor = useCallback(() => {
    const newColor = getRandomPeerColor();
    updateProfile({ color: newColor });
  }, [updateProfile]);

  const randomizeProfile = useCallback(() => {
    const newName = generateRandomCityAnimalName();
    const newColor = getRandomPeerColor();
    updateProfile({ name: newName, color: newColor });
  }, [updateProfile]);

  const setRoomId = useCallback((newRoomId: string) => {
    setRoomIdState(newRoomId);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.hash = `room=${newRoomId}`;
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const generateNewRoom = useCallback(() => {
    const newRoomId = 'canvas-' + Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
    return newRoomId;
  }, [setRoomId]);

  const getShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#room=${roomId}`;
  }, [roomId]);

  const openShareModal = useCallback(() => setIsShareModalOpen(true), []);
  const closeShareModal = useCallback(() => setIsShareModalOpen(false), []);

  const broadcastMutation = useCallback((mutation: CanvasMutationMessage) => {
    getManager().broadcastMutation(mutation);
  }, [getManager]);

  const broadcastPixels = useCallback((pixels: PixelDelta[]) => {
    getManager().broadcastPixels(pixels);
  }, [getManager]);

  const broadcastClear = useCallback(() => {
    getManager().broadcastClear();
  }, [getManager]);

  const broadcastSnapshot = useCallback((snapshot: CanvasSnapshotMessage) => {
    getManager().broadcastSnapshot(snapshot);
  }, [getManager]);

  return {
    profile,
    setProfile,
    updateProfile,
    randomizeName,
    randomizeColor,
    randomizeProfile,
    connectedPeers,
    setConnectedPeers,
    roomId,
    setRoomId,
    generateNewRoom,
    getShareUrl,
    isShareModalOpen,
    setIsShareModalOpen,
    openShareModal,
    closeShareModal,
    broadcastMutation,
    broadcastPixels,
    broadcastClear,
    broadcastSnapshot,
  };
}
