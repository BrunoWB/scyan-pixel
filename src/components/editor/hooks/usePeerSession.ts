import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type PeerProfile,
  type ConnectedPeer,
  loadStoredPeerProfile,
  saveStoredPeerProfile,
  generateRandomCityAnimalName,
  getRandomPeerColor,
  generatePeerId,
} from '../../../core/peer/peerIdentity';
import { generateRoomName } from '../../../core/peer/peerNames';
import {
  PeerSessionManager,
  type RoomFactory,
  type PeerSessionCallbacks,
  type RoomConflictEvent,
} from '../../../core/peer/peerSessionManager';
import type {
  CanvasMutationMessage,
  CanvasSnapshotMessage,
  PixelDelta,
  PixelTimestampTracker,
} from '../../../core/peer/peerCanvasSync';
import {
  type RoomSnapshotData,
  type RoomMetadata,
  saveRoomSnapshot,
  loadRoomSnapshot,
  listRoomSnapshots,
  deleteRoomSnapshot,
  getStoredRoomUuid,
  updateStoredRoomUuid,
  forkRoomSnapshot,
} from '../../../core/peer/peerRoomStorage';
import type { PixelGrid } from '../../../core/PixelGrid';

export interface UsePeerSessionOptions {
  onRemoteMutation?: (mutation: CanvasMutationMessage) => void;
  onRemoteSnapshot?: (snapshot: CanvasSnapshotMessage) => void;
  onGetSnapshot?: () => CanvasSnapshotMessage | null;
  onRestoreSnapshot?: (snapshot: RoomSnapshotData) => void;
  onDiscardLocalConflict?: () => void;
  getCurrentGrid?: () => PixelGrid;
  getCurrentTimestamps?: () => PixelTimestampTracker;
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
  roomUuid: string;
  isRoomActiveInUrl: boolean;
  setRoomId: (newRoomId: string, newRoomUuid?: string) => void;
  generateNewRoom: () => string;
  ensureActiveRoom: (grid?: PixelGrid) => string;
  getShareUrl: () => string;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  openShareModal: () => void;
  closeShareModal: () => void;
  // Load / Saved Rooms Modal
  isLoadModalOpen: boolean;
  setIsLoadModalOpen: (open: boolean) => void;
  openLoadModal: () => void;
  closeLoadModal: () => void;
  // Snapshots & Room history
  savedRooms: RoomMetadata[];
  refreshSavedRooms: () => void;
  saveRoom: (
    grid: PixelGrid,
    timestamps?: PixelTimestampTracker,
    targetRoomName?: string,
    targetRoomUuid?: string
  ) => void;
  restoreRoom: (roomName: string) => RoomSnapshotData | null;
  copyRoomToNewSave: (sourceRoomName: string) => RoomSnapshotData | null;
  deleteRoom: (roomName: string) => void;
  // Conflict modal
  conflictInfo: RoomConflictEvent | null;
  isConflictModalOpen: boolean;
  resolveConflictDiscardLocalAndJoin: () => void;
  resolveConflictKeepLocal: () => void;
  // Broadcasting
  requestSnapshot: (targetPeerId?: string) => void;
  broadcastMutation: (mutation: CanvasMutationMessage) => void;
  broadcastPixels: (pixels: PixelDelta[]) => void;
  broadcastClear: () => void;
  broadcastSnapshot: (snapshot: CanvasSnapshotMessage) => void;
}

export function usePeerSession(options?: UsePeerSessionOptions): UsePeerSessionReturn {
  const [profile, setProfile] = useState<PeerProfile>(() => loadStoredPeerProfile());
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);

  // Check URL hash for pre-existing room
  const initialUrlMatch =
    typeof window !== 'undefined' && window.location?.hash
      ? window.location.hash.match(/#room=([a-zA-Z0-9_-]+)/)
      : null;

  const [isRoomActiveInUrl, setIsRoomActiveInUrl] = useState<boolean>(Boolean(initialUrlMatch?.[1]));

  const [roomId, setRoomIdState] = useState<string>(() => {
    if (initialUrlMatch?.[1]) {
      return initialUrlMatch[1];
    }
    return generateRoomName(profile.name);
  });

  const [roomUuid, setRoomUuidState] = useState<string>(() => {
    if (initialUrlMatch?.[1]) {
      const storedUuid = getStoredRoomUuid(initialUrlMatch[1]);
      return storedUuid || '';
    }
    return '';
  });

  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const roomUuidRef = useRef(roomUuid);
  useEffect(() => {
    roomUuidRef.current = roomUuid;
  }, [roomUuid]);

  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState<boolean>(false);
  const [savedRooms, setSavedRooms] = useState<RoomMetadata[]>(() => listRoomSnapshots());
  const [conflictInfo, setConflictInfo] = useState<RoomConflictEvent | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);

  const sessionManagerRef = useRef<PeerSessionManager | null>(null);
  const callbacksRef = useRef<PeerSessionCallbacks>({
    onPeersChange: setConnectedPeers,
    onRemoteMutation: options?.onRemoteMutation,
    onRemoteSnapshot: options?.onRemoteSnapshot,
    onGetSnapshot: options?.onGetSnapshot,
    onRoomConflict: (conflict) => {
      setConflictInfo(conflict);
      setIsConflictModalOpen(true);
    },
    onAdoptRoomUuid: (newUuid) => {
      roomUuidRef.current = newUuid;
      setRoomUuidState(newUuid);
      if (roomIdRef.current) {
        updateStoredRoomUuid(roomIdRef.current, newUuid);
      }
    },
  });

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = {
      onPeersChange: setConnectedPeers,
      onRemoteMutation: options?.onRemoteMutation,
      onRemoteSnapshot: options?.onRemoteSnapshot,
      onGetSnapshot: options?.onGetSnapshot,
      onRoomConflict: (conflict) => {
        setConflictInfo(conflict);
        setIsConflictModalOpen(true);
      },
      onAdoptRoomUuid: (newUuid) => {
        roomUuidRef.current = newUuid;
        setRoomUuidState(newUuid);
        if (roomIdRef.current) {
          updateStoredRoomUuid(roomIdRef.current, newUuid);
        }
      },
    };
    sessionManagerRef.current?.setCallbacks(callbacksRef.current);
  }, [options?.onRemoteMutation, options?.onRemoteSnapshot, options?.onGetSnapshot]);

  // Handle external hash changes (e.g. user back/forward in browser history)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      const match = window.location.hash.match(/#room=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const newName = match[1];
        if (newName === roomIdRef.current) {
          return;
        }
        roomIdRef.current = newName;
        setRoomIdState(newName);
        setIsRoomActiveInUrl(true);
        const storedUuid = getStoredRoomUuid(newName);
        const effectiveUuid = storedUuid || '';
        roomUuidRef.current = effectiveUuid;
        setRoomUuidState(effectiveUuid);
      } else {
        setIsRoomActiveInUrl(false);
        roomUuidRef.current = '';
        setRoomUuidState('');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
        roomUuid,
        profile: profileRef.current,
        callbacks: {
          onPeersChange: (peers) => setConnectedPeers(peers),
          onRemoteMutation: (mutation) => callbacksRef.current.onRemoteMutation?.(mutation),
          onRemoteSnapshot: (snapshot) => callbacksRef.current.onRemoteSnapshot?.(snapshot),
          onGetSnapshot: () => callbacksRef.current.onGetSnapshot?.() ?? null,
          onRoomConflict: (conflict) => callbacksRef.current.onRoomConflict?.(conflict),
          onAdoptRoomUuid: (newUuid) => callbacksRef.current.onAdoptRoomUuid?.(newUuid),
        },
        roomFactory: roomFactoryRef.current,
      });
    }
    return sessionManagerRef.current;
  }, [roomId, roomUuid]);

  // Manage WebRTC PeerSessionManager lifecycle based on isRoomActiveInUrl, roomId and roomUuid
  useEffect(() => {
    if (!isRoomActiveInUrl) {
      if (sessionManagerRef.current) {
        sessionManagerRef.current.destroy();
        sessionManagerRef.current = null;
        setConnectedPeers([]);
      }
      return;
    }

    const manager = getManager();
    if (manager.roomId !== roomId || manager.roomUuid !== roomUuid) {
      manager.changeRoom(roomId, roomUuid);
    }

    return () => {
      manager.destroy();
      sessionManagerRef.current = null;
    };
  }, [isRoomActiveInUrl, roomId, roomUuid, getManager]);

  const refreshSavedRooms = useCallback(() => {
    setSavedRooms(listRoomSnapshots());
  }, []);

  const ensureActiveRoom = useCallback(
    (grid?: PixelGrid): string => {
      const activeName = roomId || generateRoomName(profile.name);
      const activeUuid =
        roomUuid ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId());

      if (!isRoomActiveInUrl) {
        roomIdRef.current = activeName;
        setRoomIdState(activeName);
        setRoomUuidState(activeUuid);
        setIsRoomActiveInUrl(true);

        if (typeof window !== 'undefined') {
          window.location.hash = `room=${activeName}`;
        }

        const currentGrid = grid || options?.getCurrentGrid?.();
        const timestamps = options?.getCurrentTimestamps?.();
        const pixelsWithTime: [number, number, string, number?][] = [];
        if (currentGrid) {
          currentGrid.forEachPixel((x, y, color) => {
            const ts = timestamps?.get(x, y);
            if (typeof ts === 'number' && ts > 0) {
              pixelsWithTime.push([x, y, color, ts]);
            } else {
              pixelsWithTime.push([x, y, color]);
            }
          });
        }

        const initialSnapshot: RoomSnapshotData = {
          roomId: activeUuid,
          roomName: activeName,
          roomUuid: activeUuid,
          canvasData: {
            width: currentGrid?.width ?? 64,
            height: currentGrid?.height ?? 64,
            pixels: pixelsWithTime,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          width: currentGrid?.width ?? 64,
          height: currentGrid?.height ?? 64,
          pixels: pixelsWithTime,
          pixelCount: currentGrid?.countOn() ?? 0,
        };
        saveRoomSnapshot(initialSnapshot);
        setSavedRooms(listRoomSnapshots());
      }

      return activeName;
    },
    [isRoomActiveInUrl, roomId, roomUuid, profile.name, options]
  );

  const updateProfile = useCallback(
    (patch: Partial<Omit<PeerProfile, 'id'>>) => {
      setProfile((prev) => {
        const updated: PeerProfile = {
          ...prev,
          ...patch,
        };
        saveStoredPeerProfile(updated);
        getManager().updateProfile(updated);
        if (!isRoomActiveInUrl && patch.name) {
          const newRoomName = generateRoomName(patch.name);
          roomIdRef.current = newRoomName;
          setRoomIdState(newRoomName);
        }
        return updated;
      });
    },
    [getManager, isRoomActiveInUrl]
  );

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

  const setRoomId = useCallback((newRoomId: string, newRoomUuid?: string) => {
    const uuid =
      newRoomUuid ||
      getStoredRoomUuid(newRoomId) ||
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId());
    roomIdRef.current = newRoomId;
    roomUuidRef.current = uuid;
    setRoomIdState(newRoomId);
    setRoomUuidState(uuid);
    setIsRoomActiveInUrl(true);
    if (typeof window !== 'undefined') {
      window.location.hash = `room=${newRoomId}`;
    }
  }, []);

  const generateNewRoom = useCallback(() => {
    const newRoomName = generateRoomName(profile.name);
    const newUuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();
    setRoomId(newRoomName, newUuid);
    return newRoomName;
  }, [profile.name, setRoomId]);

  const getShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const activeName = ensureActiveRoom();
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#room=${activeName}`;
  }, [ensureActiveRoom]);

  const openShareModal = useCallback(() => {
    ensureActiveRoom();
    refreshSavedRooms();
    setIsShareModalOpen(true);
  }, [ensureActiveRoom, refreshSavedRooms]);

  const closeShareModal = useCallback(() => setIsShareModalOpen(false), []);

  const openLoadModal = useCallback(() => {
    refreshSavedRooms();
    setIsLoadModalOpen(true);
  }, [refreshSavedRooms]);

  const closeLoadModal = useCallback(() => setIsLoadModalOpen(false), []);

  const saveRoom = useCallback(
    (
      grid: PixelGrid,
      timestamps?: PixelTimestampTracker,
      targetRoomName?: string,
      targetRoomUuid?: string
    ) => {
      const activeRoomId = targetRoomName || roomIdRef.current || ensureActiveRoom(grid);
      const activeRoomUuid =
        targetRoomUuid ||
        roomUuidRef.current ||
        roomUuid ||
        getStoredRoomUuid(activeRoomId) ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId());

      const pixelsWithTime: [number, number, string, number?][] = [];
      grid.forEachPixel((x, y, color) => {
        const ts = timestamps?.get(x, y);
        if (typeof ts === 'number' && ts > 0) {
          pixelsWithTime.push([x, y, color, ts]);
        } else {
          pixelsWithTime.push([x, y, color]);
        }
      });

      const existing = loadRoomSnapshot(activeRoomId);
      const snapshot: RoomSnapshotData = {
        roomId: activeRoomUuid,
        roomName: activeRoomId,
        roomUuid: activeRoomUuid,
        canvasData: {
          width: grid.width,
          height: grid.height,
          pixels: pixelsWithTime,
        },
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        width: grid.width,
        height: grid.height,
        pixels: pixelsWithTime,
        pixelCount: grid.countOn(),
      };

      saveRoomSnapshot(snapshot);
      setSavedRooms(listRoomSnapshots());
    },
    [roomUuid, ensureActiveRoom]
  );

  const restoreRoom = useCallback(
    (targetRoomName: string): RoomSnapshotData | null => {
      const snapshot = loadRoomSnapshot(targetRoomName);
      if (!snapshot) return null;

      roomIdRef.current = snapshot.roomName;
      roomUuidRef.current = snapshot.roomUuid;
      setRoomIdState(snapshot.roomName);
      setRoomUuidState(snapshot.roomUuid);
      setIsRoomActiveInUrl(true);

      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = `room=${snapshot.roomName}`;
      }

      options?.onRestoreSnapshot?.(snapshot);
      sessionManagerRef.current?.requestSnapshot();
      return snapshot;
    },
    [options]
  );

  const copyRoomToNewSave = useCallback(
    (sourceRoomName: string): RoomSnapshotData | null => {
      const newSnapshot = forkRoomSnapshot(sourceRoomName, profile.name);
      if (!newSnapshot) return null;

      setSavedRooms(listRoomSnapshots());

      roomIdRef.current = newSnapshot.roomName;
      roomUuidRef.current = newSnapshot.roomUuid;
      setRoomIdState(newSnapshot.roomName);
      setRoomUuidState(newSnapshot.roomUuid);
      setIsRoomActiveInUrl(true);

      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = `room=${newSnapshot.roomName}`;
      }

      options?.onRestoreSnapshot?.(newSnapshot);
      return newSnapshot;
    },
    [profile.name, options]
  );

  const deleteRoom = useCallback((targetRoomName: string) => {
    deleteRoomSnapshot(targetRoomName);
    setSavedRooms(listRoomSnapshots());
  }, []);

  const resolveConflictDiscardLocalAndJoin = useCallback(() => {
    if (!conflictInfo) return;
    const { roomName, remoteUuid, remotePeerId } = conflictInfo;
    updateStoredRoomUuid(roomName, remoteUuid);
    setRoomUuidState(remoteUuid);
    options?.onDiscardLocalConflict?.();
    const manager = getManager();
    manager.resolveConflictAdopt(remoteUuid, remotePeerId);
    setIsConflictModalOpen(false);
    setConflictInfo(null);
  }, [conflictInfo, getManager, options]);

  const resolveConflictKeepLocal = useCallback(() => {
    if (!conflictInfo) return;
    const forkedName = generateRoomName(profile.name);
    const forkedUuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();

    const currentGrid = options?.getCurrentGrid?.();
    const timestamps = options?.getCurrentTimestamps?.();
    const pixelsWithTime: [number, number, string, number?][] = [];
    if (currentGrid) {
      currentGrid.forEachPixel((x, y, color) => {
        const ts = timestamps?.get(x, y);
        if (typeof ts === 'number' && ts > 0) {
          pixelsWithTime.push([x, y, color, ts]);
        } else {
          pixelsWithTime.push([x, y, color]);
        }
      });
    }

    const snapshot: RoomSnapshotData = {
      roomId: forkedUuid,
      roomName: forkedName,
      roomUuid: forkedUuid,
      canvasData: {
        width: currentGrid?.width ?? 64,
        height: currentGrid?.height ?? 64,
        pixels: pixelsWithTime,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      width: currentGrid?.width ?? 64,
      height: currentGrid?.height ?? 64,
      pixels: pixelsWithTime,
      pixelCount: currentGrid?.countOn() ?? 0,
    };
    saveRoomSnapshot(snapshot);
    setSavedRooms(listRoomSnapshots());

    setRoomId(forkedName, forkedUuid);
    setIsConflictModalOpen(false);
    setConflictInfo(null);
  }, [conflictInfo, profile.name, setRoomId, options]);

  const broadcastMutation = useCallback(
    (mutation: CanvasMutationMessage) => {
      if (!isRoomActiveInUrl) {
        ensureActiveRoom();
      }
      getManager().broadcastMutation(mutation);
    },
    [isRoomActiveInUrl, ensureActiveRoom, getManager]
  );

  const broadcastPixels = useCallback(
    (pixels: PixelDelta[]) => {
      if (!isRoomActiveInUrl) {
        ensureActiveRoom();
      }
      getManager().broadcastPixels(pixels);
    },
    [isRoomActiveInUrl, ensureActiveRoom, getManager]
  );

  const broadcastClear = useCallback(() => {
    if (!isRoomActiveInUrl) {
      ensureActiveRoom();
    }
    getManager().broadcastClear();
  }, [isRoomActiveInUrl, ensureActiveRoom, getManager]);

  const broadcastSnapshot = useCallback(
    (snapshot: CanvasSnapshotMessage) => {
      if (!isRoomActiveInUrl) {
        ensureActiveRoom();
      }
      getManager().broadcastSnapshot(snapshot);
    },
    [isRoomActiveInUrl, ensureActiveRoom, getManager]
  );

  const requestSnapshot = useCallback(
    (targetPeerId?: string) => {
      sessionManagerRef.current?.requestSnapshot(targetPeerId);
    },
    []
  );

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
    roomUuid,
    isRoomActiveInUrl,
    setRoomId,
    generateNewRoom,
    ensureActiveRoom,
    getShareUrl,
    isShareModalOpen,
    setIsShareModalOpen,
    openShareModal,
    closeShareModal,
    isLoadModalOpen,
    setIsLoadModalOpen,
    openLoadModal,
    closeLoadModal,
    savedRooms,
    refreshSavedRooms,
    saveRoom,
    restoreRoom,
    copyRoomToNewSave,
    deleteRoom,
    conflictInfo,
    isConflictModalOpen,
    resolveConflictDiscardLocalAndJoin,
    resolveConflictKeepLocal,
    requestSnapshot,
    broadcastMutation,
    broadcastPixels,
    broadcastClear,
    broadcastSnapshot,
  };
}
