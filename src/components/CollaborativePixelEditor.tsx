import React, { useRef, useCallback, useEffect } from 'react';
import { PixelGrid } from '../core/PixelGrid';
import { PixelEditor } from './PixelEditor';
import type { PixelEditorProps, PixelEditorHandle } from './editor/types';
import { usePeerSession } from './editor/hooks/usePeerSession';
import { ShareModal } from './editor/ui/ShareModal';
import { RoomStorageModal } from './editor/ui/RoomStorageModal';
import { RoomConflictModal } from './editor/ui/RoomConflictModal';
import { RoomJoiningOverlay } from './editor/ui/RoomJoiningOverlay';
import { loadRoomSnapshot } from '../core/peer/peerRoomStorage';

export type CollaborativePixelEditorProps = PixelEditorProps;

export const CollaborativePixelEditor: React.FC<CollaborativePixelEditorProps> = (props) => {
  const editorRef = useRef<PixelEditorHandle>(null);

  const peerSession = usePeerSession({
    onRemoteMutation: (mutation) => editorRef.current?.applyRemoteMutation?.(mutation),
    onRemoteSnapshot: (snapshot) => editorRef.current?.applyRemoteSnapshot?.(snapshot),
    onGetSnapshot: () => editorRef.current?.getSnapshot?.() ?? null,
    onRestoreSnapshot: (snapshot) => editorRef.current?.restoreSnapshot?.(snapshot),
    onDiscardLocalConflict: () => editorRef.current?.discardLocalConflict?.(),
    getCurrentGrid: () => editorRef.current?.getGrid() ?? new PixelGrid(props.initialWidth || 64, props.initialHeight || 64),
  });

  const peerSessionRef = useRef(peerSession);
  useEffect(() => {
    peerSessionRef.current = peerSession;
  }, [peerSession]);

  // Load initial local room snapshot if URL hash specified a room that has a saved snapshot
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.hash) return;
    const match = window.location.hash.match(/#room=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      void loadRoomSnapshot(match[1]).then((saved) => {
        if (saved && saved.pixels.length > 0) {
          const currentGrid = editorRef.current?.getGrid();
          if (!currentGrid || currentGrid.countOn() === 0) {
            editorRef.current?.restoreSnapshot?.(saved);
          }
        }
      });
    }
  }, []);

  const handleNewCanvas = useCallback(() => {
    const currentGrid = editorRef.current?.getGrid();
    if (currentGrid) {
      void peerSessionRef.current.saveRoom(currentGrid, undefined, peerSessionRef.current.roomId);
      const blankGrid = new PixelGrid(
        currentGrid.width,
        currentGrid.height,
        undefined,
        undefined,
        props.defaultPixelColor || '#00e5a3'
      );
      editorRef.current?.resetGrid(blankGrid);
      editorRef.current?.fitToScreen();
    }
    peerSessionRef.current.generateNewRoom();
  }, [props.defaultPixelColor]);

  const handleLoadRoom = useCallback((roomName: string) => {
    const currentGrid = editorRef.current?.getGrid();
    if (currentGrid) {
      void peerSessionRef.current.saveRoom(currentGrid, undefined, peerSessionRef.current.roomId);
    }
    void peerSessionRef.current.restoreRoom(roomName);
    peerSessionRef.current.closeLoadModal();
    peerSessionRef.current.closeShareModal();
  }, []);

  const handleCopyToNewSave = useCallback((roomName: string) => {
    const currentGrid = editorRef.current?.getGrid();
    if (currentGrid) {
      void peerSessionRef.current.saveRoom(currentGrid, undefined, peerSessionRef.current.roomId);
    }
    void peerSessionRef.current.copyRoomToNewSave(roomName);
    peerSessionRef.current.closeLoadModal();
    peerSessionRef.current.closeShareModal();
  }, []);

  const activeColor = props.pixelColor || props.defaultPixelColor || '#00e5a3';

  return (
    <div className="relative w-full h-full">
      <PixelEditor
        ref={editorRef}
        colorMode="palette"
        defaultPixelColor="#00e5a3"
        defaultBgColor="#0f1013"
        {...props}
        collaboration={{
          isRoomActive: peerSession.isRoomActiveInUrl,
          roomId: peerSession.roomId,
          roomUuid: peerSession.roomUuid,
          connectedPeers: peerSession.connectedPeers,
          statusEvents: peerSession.statusEvents,
          roomJoinStatus: peerSession.roomJoinStatus,
          onClearStatusEvents: peerSession.clearStatusEvents,
          onOpenInvite: peerSession.openShareModal,
          onOpenShareModal: peerSession.openShareModal,
          onOpenLoadModal: peerSession.openLoadModal,
          onNewCanvas: handleNewCanvas,
          ensureActiveRoom: (g) => peerSession.ensureActiveRoom(g),
          broadcastPixels: (diff) => peerSession.broadcastPixels(diff),
          broadcastClear: () => peerSession.broadcastClear(),
          saveRoom: (grid, timestamps) => {
            void peerSession.saveRoom(grid, timestamps);
          },
          overlaySlot: (
            <RoomJoiningOverlay
              status={peerSession.roomJoinStatus}
              roomName={peerSession.roomId}
              onRetry={peerSession.retryJoinRoom}
              onNewCanvas={handleNewCanvas}
              accentColor={activeColor}
            />
          ),
        }}
      />

      {/* Share / Collaborative Canvas Modal */}
      <ShareModal
        isOpen={peerSession.isShareModalOpen}
        onClose={peerSession.closeShareModal}
        profile={peerSession.profile}
        onUpdateProfile={peerSession.updateProfile}
        onRandomizeName={peerSession.randomizeName}
        onRandomizeColor={peerSession.randomizeColor}
        onRandomizeProfile={peerSession.randomizeProfile}
        roomId={peerSession.roomId}
        roomUuid={peerSession.roomUuid}
        shareUrl={peerSession.getShareUrl()}
        onGenerateNewRoom={peerSession.generateNewRoom}
        connectedPeers={peerSession.connectedPeers}
        savedRooms={peerSession.savedRooms}
        onRestoreRoom={handleLoadRoom}
        onCopyToNewSave={handleCopyToNewSave}
        onDeleteRoom={peerSession.deleteRoom}
      />

      {/* Saved Rooms / Storage Modal with Import & Export */}
      <RoomStorageModal
        isOpen={peerSession.isLoadModalOpen}
        onClose={peerSession.closeLoadModal}
        savedRooms={peerSession.savedRooms}
        currentRoomId={peerSession.roomId}
        connectedPeers={peerSession.connectedPeers}
        onLoadRoom={handleLoadRoom}
        onCopyToNewSave={handleCopyToNewSave}
        onDeleteRoom={peerSession.deleteRoom}
        onOpenImportModal={() => editorRef.current?.openImportModal()}
        onExportPNG={(t) => editorRef.current?.exportPNG(t)}
        onExportCArray={() => editorRef.current?.exportCArray()}
        onExportJSON={() => editorRef.current?.exportJSON()}
        onSaveJSONFile={() => editorRef.current?.saveJSONFile()}
        onDownloadCHeader={() => editorRef.current?.downloadCHeader()}
        selectionBounds={editorRef.current?.getSelectionBounds() ?? null}
        canvasDimensions={{
          width: editorRef.current?.getGrid().width ?? props.initialWidth ?? 64,
          height: editorRef.current?.getGrid().height ?? props.initialHeight ?? 64,
        }}
      />

      {/* Room ID Conflict Resolution Modal */}
      <RoomConflictModal
        isOpen={peerSession.isConflictModalOpen}
        conflict={peerSession.conflictInfo}
        onDiscardLocalAndJoin={peerSession.resolveConflictDiscardLocalAndJoin}
        onKeepLocal={peerSession.resolveConflictKeepLocal}
      />
    </div>
  );
};

export const ScyanPixelEditor = CollaborativePixelEditor;
