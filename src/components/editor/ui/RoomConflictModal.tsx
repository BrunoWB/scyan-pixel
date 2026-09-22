import React, { useEffect } from 'react';
import { AlertTriangle, Users, GitFork, Trash2 } from 'lucide-react';
import type { RoomConflictEvent } from '../../../core/peer/peerSessionManager';

export interface RoomConflictModalProps {
  isOpen: boolean;
  conflict: RoomConflictEvent | null;
  onDiscardLocalAndJoin: () => void;
  onKeepLocal: () => void;
}

export const RoomConflictModal: React.FC<RoomConflictModalProps> = ({
  isOpen,
  conflict,
  onDiscardLocalAndJoin,
  onKeepLocal,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Default to keeping local on escape to avoid accidental data loss
        onKeepLocal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onKeepLocal]);

  if (!isOpen || !conflict) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="bg-[#12151d] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#212636] bg-[#181512]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 id="conflict-modal-title" className="font-bold text-sm text-white tracking-wide">
              Room ID Mismatch
            </h3>
            <p className="text-[11px] text-amber-300/80">
              Multiple rooms started with the name{' '}
              <code className="font-mono text-cyan-300">{conflict.roomName}</code>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            Connected peers are in a different canvas room session sharing this room name.
            Connecting without resolving would cross-wire two separate drawings.
          </p>

          <div className="bg-[#0b0e14] border border-[#212738] rounded-lg p-3 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Local Room UUID:</span>
              <span className="text-slate-200 truncate max-w-[190px]" title={conflict.localUuid}>
                {conflict.localUuid.slice(0, 18)}...
              </span>
            </div>
            <div className="flex justify-between items-center text-cyan-400">
              <span>Peer Room UUID:</span>
              <span className="text-cyan-300 truncate max-w-[190px]" title={conflict.remoteUuid}>
                {conflict.remoteUuid.slice(0, 18)}...
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <p className="font-medium text-slate-200">How would you like to proceed?</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onDiscardLocalAndJoin}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-left transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-cyan-500/20 text-cyan-300 group-hover:text-white">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Discard local and join peers</div>
                    <div className="text-[11px] text-slate-400">
                      Adopt peer room UUID and load remote canvas drawings
                    </div>
                  </div>
                </div>
                <Users className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={onKeepLocal}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#181c28] hover:bg-[#202738] border border-[#2d374d] hover:border-slate-400 text-left transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-slate-700/50 text-slate-300 group-hover:text-white">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Keep local</div>
                    <div className="text-[11px] text-slate-400">
                      Generate a new room name and keep your local drawing
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
