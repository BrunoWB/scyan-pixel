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

export type RoomJoinStatus = 'idle' | 'checking_local' | 'connecting' | 'connected' | 'timed_out';

export interface UsePeerSessionOptions {
  onRemoteMutation?: (mutation: CanvasMutationMessage) => void;
  onRemoteSnapshot?: (snapshot: CanvasSnapshotMessage) => void;
  onGetSnapshot?: () => CanvasSnapshotMessage | null;
  onRestoreSnapshot?: (snapshot: RoomSnapshotData) => void;
  onDiscardLocalConflict?: () => void;
  getCurrentGrid?: () => PixelGrid;
  getCurrentTimestamps?: () => PixelTimestampTracker;
  roomFactory?: RoomFactory;
  joinTimeoutMs?: number;
}

export interface PeerStatusEvent {
  id: string;
  timestamp: number;
  type: 'info' | 'peer_join' | 'peer_leave' | 'sync' | 'save' | 'conflict';
  message: string;
  peerName?: string;
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
  roomJoinStatus: RoomJoinStatus;
  retryJoinRoom: () => void;
  cancelJoinRoom: () => string;
  statusEvents: PeerStatusEvent[];
  clearStatusEvents: () => void;
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
  ) => Promise<void>;
  restoreRoom: (roomName: string) => Promise<RoomSnapshotData | null>;
  copyRoomToNewSave: (sourceRoomName: string) => Promise<RoomSnapshotData | null>;
  deleteRoom: (roomName: string) => Promise<void>;
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

  const [roomUuid, setRoomUuidState] = useState<string>('');

  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const roomUuidRef = useRef(roomUuid);
  useEffect(() => {
    roomUuidRef.current = roomUuid;
    if (sessionManagerRef.current && roomUuid) {
      sessionManagerRef.current.updateRoomUuid(roomUuid);
    }
  }, [roomUuid]);

  const [roomJoinStatus, setRoomJoinStatus] = useState<RoomJoinStatus>(() =>
    initialUrlMatch?.[1] ? 'checking_local' : 'idle'
  );

  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearJoinTimeout = useCallback(() => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      // oxlint-disable-next-line react/immutability
      joinTimeoutRef.current = null;
    }
  }, []);

  const optJoinTimeoutMs = options?.joinTimeoutMs;
  const startJoinTimeout = useCallback(() => {
    clearJoinTimeout();
    // oxlint-disable-next-line react/immutability
    joinTimeoutRef.current = setTimeout(() => {
      setRoomJoinStatus((current) => {
        if (current === 'connecting') {
          return 'timed_out';
        }
        return current;
      });
    }, optJoinTimeoutMs ?? 15000);
  }, [clearJoinTimeout, optJoinTimeoutMs]);

  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState<boolean>(false);
  const [savedRooms, setSavedRooms] = useState<RoomMetadata[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (initialUrlMatch?.[1]) {
      const targetRoom = initialUrlMatch[1];
      void loadRoomSnapshot(targetRoom).then((saved) => {
        if (!isMounted) return;
        if (saved) {
          if (saved.roomUuid) {
            roomUuidRef.current = saved.roomUuid;
            setRoomUuidState(saved.roomUuid);
          }
          setRoomJoinStatus('connected');
        } else {
          setRoomJoinStatus('connecting');
          startJoinTimeout();
        }
      });
    }
    void listRoomSnapshots().then((rooms) => {
      if (isMounted) {
        setSavedRooms(rooms);
      }
    });
    return () => {
      isMounted = false;
      clearJoinTimeout();
    };
  }, [initialUrlMatch, startJoinTimeout, clearJoinTimeout]);

  const [statusEvents, setStatusEvents] = useState<PeerStatusEvent[]>(() => [
    {
      id: `init-${Date.now()}`,
      timestamp: Date.now(),
      type: 'info',
      message: initialUrlMatch?.[1]
        ? `Joined room "${initialUrlMatch[1]}" from URL`
        : 'Session ready in solo mode',
    },
  ]);

  const addStatusEvent = useCallback(
    (type: PeerStatusEvent['type'], message: string, peerName?: string) => {
      setStatusEvents((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type,
          message,
          peerName,
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  const clearStatusEvents = useCallback(() => {
    setStatusEvents([]);
  }, []);

  const [conflictInfo, setConflictInfo] = useState<RoomConflictEvent | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);

  const prevPeersRef = useRef<ConnectedPeer[]>([]);
  const handlePeersChange = useCallback(
    (peers: ConnectedPeer[]) => {
      const prev = prevPeersRef.current;
      const prevIds = new Set(prev.map((p) => p.id));
      const newIds = new Set(peers.map((p) => p.id));

      for (const p of peers) {
        if (!prevIds.has(p.id)) {
          addStatusEvent('peer_join', `${p.name} connected`, p.name);
        }
      }
      for (const p of prev) {
        if (!newIds.has(p.id)) {
          addStatusEvent('peer_leave', `${p.name} disconnected`, p.name);
        }
      }

      if (peers.length > 0) {
        clearJoinTimeout();
        setRoomJoinStatus((current) =>
          current === 'connecting' || current === 'timed_out' ? 'connected' : current
        );
      }

      prevPeersRef.current = peers;
      setConnectedPeers(peers);
    },
    [addStatusEvent, clearJoinTimeout]
  );

  const sessionManagerRef = useRef<PeerSessionManager | null>(null);
  const callbacksRef = useRef<PeerSessionCallbacks>({
    onPeersChange: handlePeersChange,
    onRemoteMutation: (mutation) => {
      if (mutation.type === 'clear') {
        addStatusEvent('sync', 'Received canvas clear from peer');
      } else if (mutation.type === 'pixels') {
        addStatusEvent('sync', `Received ${mutation.pixels.length} pixel changes from peer`);
      }
      options?.onRemoteMutation?.(mutation);
    },
    onRemoteSnapshot: (snapshot) => {
      clearJoinTimeout();
      setRoomJoinStatus((current) =>
        current === 'connecting' || current === 'timed_out' ? 'connected' : current
      );
      addStatusEvent('sync', `Synchronized canvas snapshot with ${snapshot.pixels?.length || 0} pixels`);
      options?.onRemoteSnapshot?.(snapshot);
    },
    onGetSnapshot: options?.onGetSnapshot,
    onRoomConflict: (conflict) => {
      addStatusEvent('conflict', `Room conflict detected with peer ${conflict.remotePeerId.slice(0, 4)}`);
      setConflictInfo(conflict);
      setIsConflictModalOpen(true);
    },
    onAdoptRoomUuid: (newUuid) => {
      clearJoinTimeout();
      setRoomJoinStatus((current) =>
        current === 'connecting' || current === 'timed_out' ? 'connected' : current
      );
      addStatusEvent('conflict', `Adopted remote room UUID (${newUuid.slice(0, 8)})`);
      roomUuidRef.current = newUuid;
      setRoomUuidState(newUuid);
      if (roomIdRef.current) {
        updateStoredRoomUuid(roomIdRef.current, newUuid);
      }
    },
  });

  // Keep callbacks ref updated
  const optOnRemoteMutation = options?.onRemoteMutation;
  const optOnRemoteSnapshot = options?.onRemoteSnapshot;
  const optOnGetSnapshot = options?.onGetSnapshot;

  useEffect(() => {
    callbacksRef.current = {
      onPeersChange: handlePeersChange,
      onRemoteMutation: (mutation) => {
        if (mutation.type === 'clear') {
          addStatusEvent('sync', 'Received canvas clear from peer');
        } else if (mutation.type === 'pixels') {
          addStatusEvent('sync', `Received ${mutation.pixels.length} pixel changes from peer`);
        }
        optOnRemoteMutation?.(mutation);
      },
      onRemoteSnapshot: (snapshot) => {
        clearJoinTimeout();
        setRoomJoinStatus((current) =>
          current === 'connecting' || current === 'timed_out' ? 'connected' : current
        );
        addStatusEvent('sync', `Synchronized canvas snapshot with ${snapshot.pixels?.length || 0} pixels`);
        optOnRemoteSnapshot?.(snapshot);
      },
      onGetSnapshot: optOnGetSnapshot,
      onRoomConflict: (conflict) => {
        addStatusEvent('conflict', `Room conflict detected with peer ${conflict.remotePeerId.slice(0, 4)}`);
        setConflictInfo(conflict);
        setIsConflictModalOpen(true);
      },
      onAdoptRoomUuid: (newUuid) => {
        clearJoinTimeout();
        setRoomJoinStatus((current) =>
          current === 'connecting' || current === 'timed_out' ? 'connected' : current
        );
        addStatusEvent('conflict', `Adopted remote room UUID (${newUuid.slice(0, 8)})`);
        roomUuidRef.current = newUuid;
        setRoomUuidState(newUuid);
        if (roomIdRef.current) {
          updateStoredRoomUuid(roomIdRef.current, newUuid);
        }
      },
    };
    sessionManagerRef.current?.setCallbacks(callbacksRef.current);
  }, [optOnRemoteMutation, optOnRemoteSnapshot, optOnGetSnapshot, handlePeersChange, addStatusEvent, clearJoinTimeout]);

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
        clearJoinTimeout();
        roomIdRef.current = newName;
        setRoomIdState(newName);
        setIsRoomActiveInUrl(true);
        setRoomJoinStatus('checking_local');
        void loadRoomSnapshot(newName).then((saved) => {
          if (roomIdRef.current === newName) {
            if (saved) {
              const effectiveUuid = saved.roomUuid || '';
              roomUuidRef.current = effectiveUuid;
              setRoomUuidState(effectiveUuid);
              setRoomJoinStatus('connected');
            } else {
              roomUuidRef.current = '';
              setRoomUuidState('');
              setRoomJoinStatus('connecting');
              startJoinTimeout();
            }
          }
        });
      } else {
        clearJoinTimeout();
        setIsRoomActiveInUrl(false);
        roomUuidRef.current = '';
        setRoomUuidState('');
        setRoomJoinStatus('idle');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [clearJoinTimeout, startJoinTimeout]);

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
      // oxlint-disable-next-line react/immutability
      sessionManagerRef.current = new PeerSessionManager({
        roomId,
        roomUuid: roomUuidRef.current,
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
  }, [roomId]);

  // Manage WebRTC PeerSessionManager lifecycle based on isRoomActiveInUrl and roomId
  useEffect(() => {
    if (!isRoomActiveInUrl) {
      if (sessionManagerRef.current) {
        sessionManagerRef.current.destroy();
        // oxlint-disable-next-line react/immutability
        sessionManagerRef.current = null;
        setConnectedPeers([]);
      }
      return;
    }

    const manager = getManager();
    if (manager.roomId !== roomId) {
      manager.changeRoom(roomId, roomUuidRef.current);
    }

    return () => {
      manager.destroy();
      // oxlint-disable-next-line react/immutability
      sessionManagerRef.current = null;
    };
  }, [isRoomActiveInUrl, roomId, getManager]);

  const refreshSavedRooms = useCallback(() => {
    void listRoomSnapshots().then(setSavedRooms);
  }, []);

  const ensureActiveRoom = useCallback(
    (_grid?: PixelGrid): string => {
      if (roomJoinStatus === 'connecting' || roomJoinStatus === 'timed_out') {
        return roomIdRef.current || roomId;
      }
      const activeName = roomIdRef.current || roomId || generateRoomName(profile.name);
      const activeUuid =
        roomUuidRef.current ||
        roomUuid ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId());

      if (!isRoomActiveInUrl) {
        roomIdRef.current = activeName;
        roomUuidRef.current = activeUuid;
        setRoomIdState(activeName);
        setRoomUuidState(activeUuid);
        setIsRoomActiveInUrl(true);

        if (typeof window !== 'undefined' && window.location) {
          window.location.hash = `room=${activeName}`;
        }
      }

      return activeName;
    },
    [roomJoinStatus, isRoomActiveInUrl, roomId, roomUuid, profile.name]
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
    const fallbackUuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();
    const uuid = newRoomUuid || fallbackUuid;
    roomIdRef.current = newRoomId;
    roomUuidRef.current = uuid;
    setRoomIdState(newRoomId);
    setRoomUuidState(uuid);
    setIsRoomActiveInUrl(true);
    if (typeof window !== 'undefined') {
      window.location.hash = `room=${newRoomId}`;
    }

    addStatusEvent('info', `Active room set to "${newRoomId}"`);

    if (!newRoomUuid) {
      void getStoredRoomUuid(newRoomId).then((storedUuid) => {
        if (storedUuid && roomIdRef.current === newRoomId) {
          roomUuidRef.current = storedUuid;
          setRoomUuidState(storedUuid);
        }
      });
    }
  }, [addStatusEvent]);

  const generateNewRoom = useCallback(() => {
    clearJoinTimeout();
    setRoomJoinStatus('idle');
    const newRoomName = generateRoomName(profile.name);
    const newUuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();
    setRoomId(newRoomName, newUuid);
    return newRoomName;
  }, [profile.name, setRoomId, clearJoinTimeout]);

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
    async (
      grid: PixelGrid,
      timestamps?: PixelTimestampTracker,
      targetRoomName?: string,
      targetRoomUuid?: string
    ): Promise<void> => {
      // Do not auto-save unconfirmed remote room before connecting!
      if (roomJoinStatus === 'connecting' || roomJoinStatus === 'timed_out') {
        return;
      }

      const activeRoomId = targetRoomName || roomIdRef.current || ensureActiveRoom(grid);
      const isTargetingCurrent = !targetRoomName || targetRoomName === roomIdRef.current;
      const storedUuid = await getStoredRoomUuid(activeRoomId);
      const activeRoomUuid =
        targetRoomUuid ||
        (isTargetingCurrent ? roomUuidRef.current || roomUuid : null) ||
        storedUuid ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId());

      if (isTargetingCurrent && !roomUuidRef.current) {
        roomUuidRef.current = activeRoomUuid;
        setRoomUuidState(activeRoomUuid);
      }

      const existing = await loadRoomSnapshot(activeRoomId);
      const pixelCount = grid.countOn();

      // Defer saving until something is actually drawn or modified
      if (pixelCount === 0 && !existing) {
        return;
      }

      if (!isRoomActiveInUrl && isTargetingCurrent) {
        ensureActiveRoom();
      }

      const pixelsWithTime: [number, number, string, number?][] = [];
      grid.forEachPixel((x, y, color) => {
        const ts = timestamps?.get(x, y);
        if (typeof ts === 'number' && ts > 0) {
          pixelsWithTime.push([x, y, color, ts]);
        } else {
          pixelsWithTime.push([x, y, color]);
        }
      });

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
        pixelCount,
      };

      await saveRoomSnapshot(snapshot);
      addStatusEvent('save', `Autosaved "${activeRoomId}" to IndexedDB (${pixelCount} px)`);
      const updatedList = await listRoomSnapshots();
      setSavedRooms(updatedList);
    },
    [roomJoinStatus, roomUuid, isRoomActiveInUrl, ensureActiveRoom, addStatusEvent]
  );

  const restoreRoom = useCallback(
    async (targetRoomName: string): Promise<RoomSnapshotData | null> => {
      clearJoinTimeout();
      setRoomJoinStatus('connected');
      const snapshot = await loadRoomSnapshot(targetRoomName);
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
    [options, clearJoinTimeout]
  );

  const retryJoinRoom = useCallback(() => {
    clearJoinTimeout();
    setRoomJoinStatus('connecting');
    addStatusEvent('info', `Retrying connection to room "${roomIdRef.current}"...`);
    if (sessionManagerRef.current) {
      sessionManagerRef.current.changeRoom(roomIdRef.current, roomUuidRef.current);
      sessionManagerRef.current.requestSnapshot();
    }
    startJoinTimeout();
  }, [clearJoinTimeout, startJoinTimeout, addStatusEvent]);

  const cancelJoinRoom = useCallback(() => {
    clearJoinTimeout();
    setRoomJoinStatus('idle');
    const newRoomName = generateNewRoom();
    addStatusEvent('info', `Cancelled joining room. Created fresh room "${newRoomName}"`);
    return newRoomName;
  }, [clearJoinTimeout, generateNewRoom, addStatusEvent]);

  const copyRoomToNewSave = useCallback(
    async (sourceRoomName: string): Promise<RoomSnapshotData | null> => {
      const newSnapshot = await forkRoomSnapshot(sourceRoomName, profile.name);
      if (!newSnapshot) return null;

      const updatedList = await listRoomSnapshots();
      setSavedRooms(updatedList);

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

  const deleteRoom = useCallback(async (targetRoomName: string) => {
    await deleteRoomSnapshot(targetRoomName);
    const updatedList = await listRoomSnapshots();
    setSavedRooms(updatedList);
  }, []);

  const resolveConflictDiscardLocalAndJoin = useCallback(async () => {
    if (!conflictInfo) return;
    const { roomName, remoteUuid, remotePeerId } = conflictInfo;
    await updateStoredRoomUuid(roomName, remoteUuid);
    setRoomUuidState(remoteUuid);
    options?.onDiscardLocalConflict?.();
    const manager = getManager();
    manager.resolveConflictAdopt(remoteUuid, remotePeerId);
    setIsConflictModalOpen(false);
    setConflictInfo(null);
    const updatedList = await listRoomSnapshots();
    setSavedRooms(updatedList);
  }, [conflictInfo, getManager, options]);

  const resolveConflictKeepLocal = useCallback(() => {
    if (!conflictInfo) return;
    const forkedName = generateRoomName(profile.name);
    const forkedUuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generatePeerId();

    const currentGrid = options?.getCurrentGrid?.();
    const count = currentGrid?.countOn() ?? 0;
    if (count > 0 && currentGrid) {
      saveRoom(currentGrid, options?.getCurrentTimestamps?.(), forkedName, forkedUuid);
    }

    setRoomId(forkedName, forkedUuid);
    setIsConflictModalOpen(false);
    setConflictInfo(null);
  }, [conflictInfo, profile.name, saveRoom, setRoomId, options]);

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
    roomJoinStatus,
    retryJoinRoom,
    cancelJoinRoom,
    statusEvents,
    clearStatusEvents,
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
