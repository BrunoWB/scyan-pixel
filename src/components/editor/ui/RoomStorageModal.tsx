import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  CopyPlus,
  Trash2,
  X,
  Clock,
  Layers,
  FolderX,
  RefreshCw,
  Users,
  Upload,
  Download,
  Save,
  FileCode,
  FileJson,
  Image,
  Code2,
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
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    void loadRoomSnapshot(roomName).then((snapshot) => {
      if (isCancelled || !canvasRef.current) return;
      try {
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
    });

    return () => {
      isCancelled = true;
    };
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
  // Import & Export options
  onOpenImportModal?: () => void;
  onExportPNG?: (type: 'colored' | 'monochrome' | 'transparent') => void;
  onExportCArray?: () => void;
  onExportJSON?: () => void;
  onSaveJSONFile?: () => void;
  onDownloadCHeader?: () => void;
  selectionBounds?: { width: number; height: number } | null;
  canvasDimensions?: { width: number; height: number };
  initialTab?: 'rooms' | 'import' | 'export';
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
  onOpenImportModal,
  onExportPNG,
  onExportCArray,
  onExportJSON,
  onSaveJSONFile,
  onDownloadCHeader,
  selectionBounds,
  canvasDimensions,
  initialTab = 'rooms',
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'import' | 'export'>(initialTab);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }

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

  const hasSelection = Boolean(selectionBounds && selectionBounds.width > 0 && selectionBounds.height > 0);

  const handleAction = (callback?: () => void) => {
    if (callback) {
      callback();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-storage-modal-title"
    >
      <div
        className="bg-[#12151d] border border-[#232938] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150"
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
            {activeTab === 'rooms' && (
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
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md hover:bg-[#1f2433] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MODAL TABS */}
        <div className="flex items-center border-b border-[#212636] bg-[#0b0d13] px-5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'rooms'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Saved Rooms</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#1b202e] text-slate-300 border border-[#283146]">
              {savedRooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'import'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Save</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {/* TAB 1: SAVED ROOMS */}
          {activeTab === 'rooms' && (
            <div className="space-y-3">
              {/* Quick Jump Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e1118] border border-[#1e2434] text-xs">
                <span className="text-slate-400 text-[11px]">
                  Looking to import art or export your current canvas?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('import')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161c28] hover:bg-[#20293a] border border-[#263044] text-cyan-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    <Upload className="w-3 h-3 text-cyan-400" />
                    <span>Import Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('export')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161c28] hover:bg-[#20293a] border border-[#263044] text-emerald-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>Export Assets</span>
                  </button>
                </div>
              </div>

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

                            {/* Metadata */}
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {formatTimestamp(room.updatedAt || room.createdAt)}
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
          )}

          {/* TAB 2: IMPORT IMAGE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0f131c] border border-[#222a3d] flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Import Raster Art or Animation
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Import static images or multi-frame animations directly into your project. Includes interactive 8-handle crop box, automated color quantization to monochrome or active palette, and non-destructive ghost placement.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleAction(onOpenImportModal)}
                    disabled={!onOpenImportModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Image or GIF...</span>
                  </button>
                  <span className="text-[11px] font-mono text-slate-500">
                    PNG, JPG, BMP, WEBP, GIF
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0e1118]/80 border border-dashed border-[#1f2537] text-xs text-slate-400 flex items-center justify-between">
                <span>💡 You can also drag and drop images or .json project files directly onto the canvas at any time.</span>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT ASSETS */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Context / Dimensions header */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0e1118] border border-[#1e2434]">
                <span className="text-xs font-semibold text-slate-300">
                  Target Resolution
                </span>
                {hasSelection && selectionBounds ? (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30">
                    Selection: {selectionBounds.width}×{selectionBounds.height}
                  </span>
                ) : canvasDimensions ? (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#1e2538] text-slate-300 border border-[#2d3548]">
                    Canvas: {canvasDimensions.width}×{canvasDimensions.height}
                  </span>
                ) : null}
              </div>

              {/* Section 1: Project Save */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-1">
                  Save Project
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(onSaveJSONFile || onExportJSON)}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-emerald-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                        <Save className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 group-hover:text-emerald-300 transition-colors">
                          Save Project (.json)
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          Download full editable canvas
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538]">
                      Ctrl+S
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(onExportJSON)}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-emerald-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/80 group-hover:scale-105 transition-transform shrink-0">
                        <FileJson className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 group-hover:text-emerald-300 transition-colors">
                          View Project JSON
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          Inspect schema payload & copy
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538]">
                      Modal
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 2: Raster Images */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-1">
                  Download Images
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(() => onExportPNG?.('colored'))}
                    className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-cyan-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-1 rounded bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-[#00f0ff]">
                        <Image className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">.png</span>
                    </div>
                    <span className="text-xs font-medium text-slate-100 group-hover:text-[#00f0ff] transition-colors mt-1">
                      PNG (Full Color)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Pixel & bg colors
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(() => onExportPNG?.('monochrome'))}
                    className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-slate-400/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-1 rounded bg-slate-500/15 border border-slate-500/30 text-slate-300">
                        <Image className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">1bpp</span>
                    </div>
                    <span className="text-xs font-medium text-slate-100 group-hover:text-white transition-colors mt-1">
                      PNG (Monochrome)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      SSD1306 B&W
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(() => onExportPNG?.('transparent'))}
                    className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-purple-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-1 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400">
                        <Image className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Alpha</span>
                    </div>
                    <span className="text-xs font-medium text-slate-100 group-hover:text-purple-300 transition-colors mt-1">
                      PNG (Transparent)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      No background
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 3: Firmware & Code */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-1">
                  Export Firmware
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(onDownloadCHeader || onExportCArray)}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-amber-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 group-hover:text-amber-300 transition-colors">
                          Download C Header (.h)
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          SSD1306 Zephyr bitmap header
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538]">
                      .h
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(onExportCArray)}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#141822] hover:bg-[#1a2130] border border-[#222a3d] hover:border-amber-500/40 text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400/80 group-hover:scale-105 transition-transform shrink-0">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 group-hover:text-amber-300 transition-colors">
                          View C Array Code
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          1bpp byte array & ASCII preview
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538]">
                      Modal
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#212636] bg-[#0e1017]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              {activeTab === 'rooms'
                ? `${savedRooms.length} ${savedRooms.length === 1 ? 'room' : 'rooms'} saved locally`
                : activeTab === 'import'
                  ? 'Supported: PNG, JPG, BMP, WEBP, GIF, JSON'
                  : 'Formats: JSON, PNG, C Header (.h)'}
            </span>
            {activeTab === 'rooms' && isLoading && (
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
