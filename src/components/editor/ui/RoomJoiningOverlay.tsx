import React from 'react';
import { Loader2, AlertCircle, RefreshCw, Plus, Wifi } from 'lucide-react';
import type { RoomJoinStatus } from '../hooks/usePeerSession';

export interface RoomJoiningOverlayProps {
  status: RoomJoinStatus;
  roomName: string;
  onRetry: () => void;
  onNewCanvas: () => void;
  accentColor?: string;
}

export const RoomJoiningOverlay: React.FC<RoomJoiningOverlayProps> = ({
  status,
  roomName,
  onRetry,
  onNewCanvas,
  accentColor = '#00e5a3',
}) => {
  if (status !== 'connecting' && status !== 'timed_out') {
    return null;
  }

  const isConnecting = status === 'connecting';

  return (
    <div
      data-testid="room-joining-overlay"
      className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-30 p-4 select-none animate-in fade-in duration-200"
      aria-live="polite"
      role="status"
    >
      <div className="bg-[#12151d] border border-[#212636] shadow-2xl rounded-2xl w-full max-w-md p-6 flex flex-col items-center text-center space-y-4">
        {isConnecting ? (
          <>
            {/* Animated Cyber Radar Icon */}
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
              <span
                className="absolute inset-0 rounded-2xl animate-ping opacity-25"
                style={{ backgroundColor: accentColor }}
              />
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                Connecting to Room
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide break-all font-mono">
                {roomName}
              </h3>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Waiting for peers on the network to synchronize the canvas. Please hold on...
            </p>

            {/* Cyber Scanning Progress Bar */}
            <div className="w-full bg-[#181d29] h-1.5 rounded-full overflow-hidden border border-[#262f44]">
              <div
                className="h-full rounded-full animate-pulse transition-all duration-300"
                style={{
                  width: '100%',
                  background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                }}
              />
            </div>
          </>
        ) : (
          <>
            {/* Timed Out Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-1">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
                Room Unavailable
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide break-all font-mono">
                {roomName}
              </h3>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Could not connect to peers for this room. The host may be offline or the link may have expired.
            </p>

            {/* Actions: Try Reconnect & New Canvas */}
            <div className="grid grid-cols-2 gap-3 w-full pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer text-black font-medium hover:brightness-110 active:scale-98 shadow-md"
                style={{ backgroundColor: accentColor }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Reconnect
              </button>

              <button
                type="button"
                onClick={onNewCanvas}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer bg-[#1e2333] hover:bg-[#282f44] text-slate-200 border border-[#2d354b] active:scale-98 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                New Canvas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
