import React, { useEffect, useRef } from 'react';
import {
  FolderOpen,
  CopyPlus,
  Trash2,
  X,
  Clock,
  Layers,
  FolderX,
  Users,
  RefreshCw,
} from 'lucide-react';
import {
  type RoomMetadata,
  loadRoomSnapshot,
} from '../../../core/peer/peerRoomStorage';
import type { ConnectedPeer } from '../../../core/peer/peerIdentity';
import { useRoomPeerCounts } from '../hooks/useRoomPeerCounts';

export interface RoomThumbnailProps {
  roomName: string;
  width?: number;
  height?: number;
  className?: string;
}

export const RoomThumbnail: React.FC<RoomThumbnailProps> = ({
  roomName,
  width = 52,
  height = 52,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const snapshot = loadRoomSnapshot(roomName);
      const gridW = snapshot?.width || 64;
      const gridH = snapshot?.height || 64;
      canvas.width = gridW;
      canvas.height = gridH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, gridW, gridH);

      const pixels =
        snapshot && Array.isArray(snapshot.pixels) && snapshot.pixels.length > 0
          ? snapshot.pixels
          : snapshot?.canvasData && Array.isArray(snapshot.canvasData.pixels)
            ? snapshot.canvasData.pixels
            : null;

      if (pixels && pixels.length > 0) {
        for (let i = 0; i < pixels.length; i++) {
          const p = pixels[i];
          if (!p || !p[2] || p[2] === 'transparent' || p[2] === 'none') continue;
          ctx.fillStyle = p[2];
          ctx.fillRect(p[0], p[1], 1, 1);
        }
      } else {
        // Subtle placeholder dot in the center for empty canvas
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(Math.floor(gridW / 2) - 1, Math.floor(gridH / 2) - 1, 2, 2);
      }
    } catch {
      // In non-canvas/SSR test environments, silently ignore draw errors
    }
  }, [roomName]);

  return (
    <canvas
      ref={canvasRef}
      data-slot="room-thumbnail"
      data-room-name={roomName}
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        objectFit: 'contain',
        imageRendering: 'pixelated',
      }}
      className={`rounded border border-[#242b3c] bg-[#0c0e14] shrink-0 shadow-inner ${className}`}
      aria-label={`Thumbnail preview for ${roomName}`}
    />
  );
};

export interface RoomStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRooms: RoomMetadata[];
  currentRoomId: string;
  onLoadRoom: (roomName: string) => void;
  onCopyToNewSave: (roomName: string) => void;
  onDeleteRoom: (roomName: string) => void;
  connectedPeers?: ConnectedPeer[];
}

function formatTimestamp(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown date';
  }
}

export const RoomStorageModal: React.FC<RoomStorageModalProps> = ({
  isOpen,
  onClose,
  savedRooms,
  currentRoomId,
  onLoadRoom,
  onCopyToNewSave,
  onDeleteRoom,
  connectedPeers = [],
}) => {
  const { peerCounts, isLoading, refresh } = useRoomPeerCounts({
    savedRooms,
    currentRoomId,
    connectedPeersCount: connectedPeers.length,
    isOpen,
  });

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-storage-modal-title"
    >
      <div
        className="bg-[#12151d] border border-[#232938] rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#212636] bg-[#0e1017]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 id="room-storage-modal-title" className="font-bold text-sm text-white tracking-wide">
                Saved Rooms & Canvas Snapshots
              </h3>
              <p className="text-[11px] text-slate-400">
                Load previous rooms, copy to fresh saves, or manage local files
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isLoading}
              className={`p-1.5 rounded-md hover:bg-[#1f2433] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-50 ${
                isLoading ? 'text-cyan-400' : ''
              }`}
              title={isLoading ? 'Checking tracker swarms...' : 'Refresh peer counts'}
              aria-label="Refresh peer counts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md hover:bg-[#1f2433] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
          {savedRooms.length > 0 ? (
            <div className="space-y-2.5">
              {savedRooms.map((room) => {
                const isCurrent = room.roomName === currentRoomId;
                const peerCount = peerCounts[room.roomName];

                return (
                  <div
                    key={room.roomName}
                    data-room-item={room.roomName}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-cyan-950/20 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.06)]'
                        : 'bg-[#151923] border-[#242b3c] hover:border-[#354058]'
                    }`}
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <RoomThumbnail roomName={room.roomName} width={52} height={52} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-slate-100 text-xs sm:text-sm truncate">
                            {room.roomName}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                              Active Room
                            </span>
                          )}

                          {/* Peer count badge */}
                          {isCurrent ? (
                            <span
                              data-slot="room-peer-badge"
                              data-room={room.roomName}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0"
                              title={`${connectedPeers.length} peer(s) connected`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              <Users className="w-2.5 h-2.5" />
                              <span>{`${connectedPeers.length} online`}</span>
                            </span>
                          ) : peerCount !== undefined ? (
                            <span
                              data-slot="room-peer-badge"
                              data-room={room.roomName}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium shrink-0 ${
                                peerCount > 0
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/40'
                              }`}
                              title={`${peerCount} peer(s) active on tracker`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  peerCount > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                              <Users className="w-2.5 h-2.5" />
                              <span>{`${peerCount} online`}</span>
                            </span>
                          ) : isLoading ? (
                            <span
                              data-slot="room-peer-badge"
                              data-room={room.roomName}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-800/40 text-slate-500 border border-slate-700/30 shrink-0"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                              <span>checking...</span>
                            </span>
                          ) : (
                            <span
                              data-slot="room-peer-badge"
                              data-room={room.roomName}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-800/60 text-slate-400 border border-slate-700/40 shrink-0"
                              title="0 peer(s) active on tracker"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              <Users className="w-2.5 h-2.5" />
                              <span>0 online</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatTimestamp(room.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-slate-400">
                            <Layers className="w-3 h-3 text-slate-500" />
                            {`${room.width}×${room.height}`}
                          </span>
                          <span className="font-mono text-slate-400">
                            {`${room.pixelCount} px`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {/* Load / Open */}
                      <button
                        type="button"
                        onClick={() => onLoadRoom(room.roomName)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                          isCurrent
                            ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs'
                        }`}
                        title="Load room and reconcile with peers"
                        aria-label={`Load room ${room.roomName}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Reload' : 'Load'}</span>
                      </button>

                      {/* Copy to new save (Fork / Duplicate) */}
                      <button
                        type="button"
                        onClick={() => onCopyToNewSave(room.roomName)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1f2535] hover:bg-[#2c354a] text-slate-200 hover:text-white border border-[#2e374d] text-xs transition cursor-pointer"
                        title="Copy to new save with fresh ID (avoid peer collisions)"
                        aria-label={`Copy ${room.roomName} to new save`}
                      >
                        <CopyPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Copy to New</span>
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteRoom(room.roomName)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                        title="Delete snapshot"
                        aria-label={`Delete ${room.roomName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 px-4 text-center rounded-lg bg-[#0f121a]/60 border border-dashed border-[#242b3d] flex flex-col items-center justify-center gap-2">
              <FolderX className="w-9 h-9 text-slate-600 mb-1" />
              <p className="text-sm font-medium text-slate-200">No Saved Rooms Found</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Your canvas rooms are automatically saved when you draw, or when you snapshot your work with the New button.
              </p>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#212636] bg-[#0e1017]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              {`${savedRooms.length} ${savedRooms.length === 1 ? 'room' : 'rooms'} saved locally`}
            </span>
            {isLoading && (
              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                scraping...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#1f2535] hover:bg-[#283144] text-slate-200 hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
