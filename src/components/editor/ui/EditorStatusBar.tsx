import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Users, WifiOff, Activity, Trash2, X, Share2 } from 'lucide-react';
import type { BwpxGrid } from '../../../core/PixelGrid';
import type { SelectionOverlay } from '../../../core/gridRenderer';
import type { ToolType, PeerStatusEvent } from '../types';

export interface EditorStatusBarProps {
  hoverPos: { x: number; y: number } | null;
  grid: BwpxGrid;
  selection: SelectionOverlay | null;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  onFitToScreen?: () => void;
  // P2P Status
  isRoomActive?: boolean;
  roomId?: string;
  peerCount?: number;
  statusEvents?: PeerStatusEvent[];
  defaultHistoryOpen?: boolean;
  onClearStatusEvents?: () => void;
  onOpenInvite?: () => void;
  // Kept for backward compatibility
  activeTool?: ToolType;
  activeDrawColor?: string;
  isStrictMonochrome?: boolean;
  brushSize?: number;
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  hoverPos,
  grid,
  selection,
  zoom,
  onZoomChange,
  onFitToScreen,
  isRoomActive = false,
  roomId,
  peerCount = 0,
  statusEvents = [],
  defaultHistoryOpen = false,
  onClearStatusEvents,
  onOpenInvite,
}) => {
  const countOn = grid.countOn();
  const bounds = countOn > 0 ? grid.getBounds() : null;

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(defaultHistoryOpen);
  const statusContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isHistoryOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (statusContainerRef.current && !statusContainerRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHistoryOpen]);

  // Zoom input and hover slider state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      hideTimeoutRef.current = null;
    }, 150);
  };

  const commitZoom = (text: string) => {
    const clean = text.trim().replace(/[%xX]/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      let targetZoom: number;
      if (num <= 48) {
        targetZoom = Math.round(num);
      } else {
        targetZoom = Math.round(num / 100);
      }
      targetZoom = Math.max(1, Math.min(48, targetZoom));
      onZoomChange?.(targetZoom);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitZoom(editValue);
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const displayZoomPercent = String(Math.round(zoom * 100));
  const showSlider = isHovered || isEditing || isDragging;

  return (
    <footer
      className="h-7 bg-[#12141a] border-t border-[#202530] px-6 sm:px-8 flex items-center justify-between text-xs text-slate-400 z-20 select-none"
      style={{ paddingLeft: '1.75rem', paddingRight: '1.75rem' }}
    >
      {/* Left side: Selection info and Position at the end of the section */}
      <div className="flex items-center gap-3.5">
        <span>
          Selection:{' '}
          <strong className="text-slate-200 font-mono">
            {selection && selection.active ? `${selection.w}×${selection.h}` : 'None'}
          </strong>
        </span>

        <div className="h-3 w-px bg-[#202530]" />

        {/* Position placed at the end of the left section so changing coordinates never shifts other elements */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400">Pos:</span>
          <strong className="text-slate-200 font-mono text-left min-w-[56px] inline-block">
            {hoverPos && grid.inBounds(hoverPos.x, hoverPos.y)
              ? `${hoverPos.x}, ${hoverPos.y}`
              : '--'}
          </strong>
        </div>
      </div>

      {/* Center: P2P Collaborative Session Status */}
      <div className="relative flex items-center" ref={statusContainerRef}>
        <button
          type="button"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          title="Click to view P2P status history & connection timeline"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer hover:bg-[#181b24] border border-transparent hover:border-[#252b3b]"
          data-slot="p2p-status"
          aria-label="P2P connection status"
          aria-expanded={isHistoryOpen}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !isRoomActive
                ? 'bg-slate-600'
                : peerCount > 0
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
                  : 'bg-cyan-400/90 shadow-[0_0_6px_rgba(34,211,238,0.4)]'
            }`}
          />
          {!isRoomActive ? (
            <>
              <WifiOff className="w-3 h-3 text-slate-500" />
              <span>solo mode</span>
            </>
          ) : (
            <>
              <Users className="w-3 h-3 text-slate-400" />
              <span className={peerCount > 0 ? 'text-emerald-300 font-medium' : 'text-slate-300'}>
                {peerCount > 0 ? `${peerCount} ${peerCount === 1 ? 'peer' : 'peers'}` : 'waiting for peers'}
              </span>
              {roomId && (
                <span className="hidden md:inline text-slate-500 max-w-[140px] truncate">
                  {`(${roomId})`}
                </span>
              )}
            </>
          )}
        </button>

        {/* Dropup Popover: P2P Status History with Timestamps */}
        {isHistoryOpen && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-80 sm:w-96 bg-[#12141a] border border-[#252b3b] rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden text-slate-300"
            data-slot="p2p-status-history"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#202530] bg-[#161a22]">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>P2P Status & Activity Log</span>
              </div>
              <div className="flex items-center gap-1">
                {onClearStatusEvents && statusEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearStatusEvents}
                    title="Clear status log"
                    className="p-1 hover:bg-[#252b3b] rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    aria-label="Clear status log"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  title="Close status history"
                  className="p-1 hover:bg-[#252b3b] rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  aria-label="Close status history"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Room Info Row */}
            <div className="px-3 py-1.5 bg-[#181c26] border-b border-[#202530] flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                <span className="text-slate-400">Room:</span>
                <span className="font-mono text-cyan-300 truncate">
                  {isRoomActive ? roomId || 'active' : 'solo mode'}
                </span>
                <span className="text-slate-500 text-[10px]">
                  ({peerCount} {peerCount === 1 ? 'peer' : 'peers'})
                </span>
              </div>
              {onOpenInvite && (
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    onOpenInvite();
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/50 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Share2 className="w-2.5 h-2.5" />
                  <span>Invite</span>
                </button>
              )}
            </div>

            {/* Scrollable event list with timestamps */}
            <div className="max-h-56 overflow-y-auto p-2 flex flex-col gap-1.5 text-[11px] font-mono divide-y divide-[#1e2330]/50">
              {statusEvents.length === 0 ? (
                <div className="py-4 text-center text-slate-500 text-xs">
                  No status events recorded yet
                </div>
              ) : (
                statusEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="pt-1.5 first:pt-0 flex items-start gap-2"
                    data-slot="status-event-item"
                  >
                    <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">
                      {formatTimestamp(evt.timestamp)}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                        evt.type === 'peer_join'
                          ? 'bg-emerald-400'
                          : evt.type === 'peer_leave'
                            ? 'bg-rose-400'
                            : evt.type === 'sync'
                              ? 'bg-cyan-400'
                              : evt.type === 'save'
                                ? 'bg-amber-400'
                                : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-300 leading-snug break-words flex-1">
                      {evt.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right side: Artwork, Fit button, and Zoom with slider */}
      <div className="flex items-center gap-3.5">
        {/* Artwork bounds and pixel count */}
        <div className="flex items-center gap-1.5">
          <span>
            Artwork:{' '}
            <strong className="text-slate-200">
              {bounds ? `${bounds.width}×${bounds.height}` : 'Empty'}
            </strong>{' '}
            <span className="text-slate-400 font-mono">{`(${countOn} px)`}</span>
          </span>
          <button
            type="button"
            onClick={onFitToScreen}
            title="Fit artwork to screen"
            aria-label="Fit artwork to screen"
            className="p-1 text-slate-400 hover:text-white hover:bg-[#202530] rounded transition cursor-pointer flex items-center justify-center"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-3 w-px bg-[#202530]" />

        {/* Zoom input with hover slider */}
        <div
          className="relative flex items-center gap-1.5"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {showSlider && (
            <div
              className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 pb-1.5 z-30"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="bg-[#181b24] border border-[#2a303f] rounded-lg px-3 py-2 shadow-2xl flex items-center gap-2.5">
                <span className="text-[10px] text-slate-400 font-mono select-none">100%</span>
                <input
                  type="range"
                  min={1}
                  max={48}
                  step={1}
                  value={zoom}
                  onChange={(e) => onZoomChange?.(Number(e.target.value))}
                  onPointerDown={() => setIsDragging(true)}
                  className="w-28 h-1.5 bg-[#252b3b] rounded-lg appearance-none cursor-pointer accent-[#00e5a3]"
                  aria-label="Zoom slider"
                />
                <span className="text-[10px] text-slate-400 font-mono select-none">4800%</span>
              </div>
            </div>
          )}

          <span className="text-slate-400">Zoom:</span>
          <div className="flex items-center bg-[#181b24] border border-[#252b3b] rounded px-1.5 py-0.5 focus-within:border-[#00e5a3] focus-within:ring-1 focus-within:ring-[#00e5a3]/30">
            <input
              type="text"
              value={isEditing ? editValue : displayZoomPercent}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={() => {
                setIsEditing(true);
                setEditValue(displayZoomPercent);
              }}
              onBlur={() => {
                commitZoom(editValue);
                setIsEditing(false);
              }}
              onKeyDown={handleKeyDown}
              className="w-10 text-right bg-transparent text-slate-200 font-mono text-[11px] outline-none"
              aria-label="Zoom percentage"
            />
            <span className="text-slate-400 font-mono text-[11px] select-none ml-0.5">%</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
