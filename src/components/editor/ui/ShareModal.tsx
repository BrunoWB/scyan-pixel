import React, { useState, useEffect } from 'react';
import {
  Share2,
  Users,
  Copy,
  Check,
  Dices,
  Sparkles,
  RefreshCw,
  X,
  Palette,
} from 'lucide-react';
import type { PeerProfile, ConnectedPeer } from '../../../core/peer/peerIdentity';
import {
  isValidPeerName,
  getPeerInitials,
  PEER_AVATAR_COLORS,
} from '../../../core/peer/peerIdentity';
import { PeerAvatar } from './PeerAvatar';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PeerProfile;
  onUpdateProfile: (patch: Partial<Omit<PeerProfile, 'id'>>) => void;
  onRandomizeName: () => void;
  onRandomizeColor: () => void;
  onRandomizeProfile: () => void;
  roomId: string;
  shareUrl: string;
  onGenerateNewRoom: () => string;
  connectedPeers: ConnectedPeer[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onRandomizeName,
  onRandomizeColor,
  onRandomizeProfile,
  roomId,
  shareUrl,
  onGenerateNewRoom,
  connectedPeers,
}) => {
  const [copied, setCopied] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const prevIsOpenRef = React.useRef(isOpen);
  const prevProfileNameRef = React.useRef(profile.name);

  // Sync external profile name or reset dirty input when modal opens
  useEffect(() => {
    if ((isOpen && !prevIsOpenRef.current) || profile.name !== prevProfileNameRef.current) {
      setNameInput(profile.name);
    }
    prevIsOpenRef.current = isOpen;
    prevProfileNameRef.current = profile.name;
  }, [isOpen, profile.name]);

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

  const isNameValid = isValidPeerName(nameInput);
  const computedInitials = getPeerInitials(nameInput) || '??';

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameInput(val);
    if (isValidPeerName(val.trim())) {
      onUpdateProfile({ name: val.trim() });
    }
  };

  const handleNameBlur = () => {
    const trimmed = nameInput.trim();
    if (!isValidPeerName(trimmed)) {
      // Revert if invalid
      setNameInput(profile.name);
    } else {
      setNameInput(trimmed);
      onUpdateProfile({ name: trimmed });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameBlur();
      e.currentTarget.blur();
    }
  };

  const handleDone = () => {
    const trimmed = nameInput.trim();
    if (isValidPeerName(trimmed)) {
      onUpdateProfile({ name: trimmed });
    }
    onClose();
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-[#12151d] border border-[#232938] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#212636] bg-[#0e1017]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="share-modal-title" className="font-bold text-sm text-white tracking-wide">
                Canvas Collaboration & Share
              </h3>
              <p className="text-[11px] text-slate-400">
                P2P serverless room • Room ID: <code className="text-cyan-300 font-mono">{roomId}</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-[#1f2433] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* SECTION 1: YOUR PEER PROFILE */}
          <div className="bg-[#161a24] border border-[#262c3d] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Your Peer Profile
              </span>
              <button
                type="button"
                onClick={onRandomizeProfile}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                title="Regenerate random name and color"
              >
                <Sparkles className="w-3 h-3" />
                Randomize All
              </button>
            </div>

            {/* Profile Avatar & Name Editor */}
            <div className="flex items-start gap-4">
              {/* Profile Bubble Preview */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <PeerAvatar
                  name={nameInput}
                  color={profile.color}
                  size="xl"
                  showOnlineDot
                />
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {`[${computedInitials}]`}
                </span>
              </div>

              {/* Name Input & Shuffle */}
              <div className="flex-1 space-y-1.5">
                <label htmlFor="peer-name-input" className="block text-xs font-medium text-slate-300">
                  Peer Name
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="peer-name-input"
                    type="text"
                    value={nameInput}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    onKeyDown={handleNameKeyDown}
                    placeholder="e.g. montreal-wolf"
                    className={`w-full px-3 py-1.5 text-xs bg-[#0f121a] border rounded-md font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 ${
                      isNameValid
                        ? 'border-[#2e374d] focus:border-cyan-500 focus:ring-cyan-500/50'
                        : 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={onRandomizeName}
                    className="p-1.5 rounded-md bg-[#1f2535] hover:bg-[#2a3348] border border-[#2e374d] text-slate-300 hover:text-white transition cursor-pointer"
                    title="Generate random city-animal name"
                    aria-label="Randomize peer name"
                  >
                    <Dices className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>

                {/* Validation and Initials feedback */}
                <div className="text-[11px] min-h-[16px]">
                  {!isNameValid ? (
                    <span className="text-rose-400">Name must have at least 2 letters.</span>
                  ) : (
                    <span className="text-slate-400">
                      Bubble initials: <strong className="text-slate-200">{computedInitials}</strong> (hyphen/space or 2-letter fallback)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Color Palette */}
            <div className="space-y-2 pt-1 border-t border-[#212636]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  Avatar Color
                </label>
                <button
                  type="button"
                  onClick={onRandomizeColor}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  title="Pick random color"
                >
                  <Dices className="w-3 h-3" />
                  Shuffle Color
                </button>
              </div>

              {/* Swatches & Custom Picker */}
              <div className="flex items-center flex-wrap gap-1.5">
                {PEER_AVATAR_COLORS.map((hex) => {
                  const isSelected = profile.color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onUpdateProfile({ color: hex })}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                        isSelected
                          ? 'ring-2 ring-white scale-110 border-transparent shadow-md'
                          : 'border-white/15 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={`Select color ${hex}`}
                    />
                  );
                })}

                {/* Custom Color Input */}
                <label
                  className="relative w-6 h-6 rounded-full border border-dashed border-slate-400 hover:border-white flex items-center justify-center cursor-pointer overflow-hidden transition"
                  title="Pick custom color"
                >
                  <input
                    type="color"
                    value={profile.color}
                    onChange={(e) => onUpdateProfile({ color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    aria-label="Custom color picker"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: profile.color }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: SHARE ROOM LINK */}
          <div className="bg-[#161a24] border border-[#262c3d] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                Share Room Link
              </span>
              <button
                type="button"
                onClick={onGenerateNewRoom}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Create a new room ID"
              >
                <RefreshCw className="w-3 h-3" />
                New Room
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-1.5 text-xs bg-[#0f121a] border border-[#2e374d] rounded-md font-mono text-slate-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Anyone with this link will connect directly via WebRTC to draw collaboratively in real time.
            </p>
          </div>

          {/* SECTION 3: CONNECTED PEERS (PRESENCE) */}
          <div className="bg-[#161a24] border border-[#262c3d] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Connected Peers
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1f2535] text-cyan-300 border border-[#2e374d]">
                {`${connectedPeers.length} online`}
              </span>
            </div>

            {connectedPeers.length > 0 ? (
              <div className="space-y-2">
                {connectedPeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f121a] border border-[#22293a]"
                  >
                    <div className="flex items-center gap-2.5">
                      <PeerAvatar name={peer.name} color={peer.color} size="sm" showOnlineDot />
                      <span className="text-xs font-medium text-slate-200 font-mono">{peer.name}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 px-4 text-center rounded-md bg-[#0f121a]/60 border border-dashed border-[#242b3d] flex flex-col items-center justify-center gap-1.5">
                <Users className="w-7 h-7 text-slate-600 mb-0.5" />
                <p className="text-xs font-medium text-slate-300">No peers connected yet</p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Copy and share your room link with teammates to start collaborating on this canvas.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#212636] bg-[#0e1017]">
          <button
            type="button"
            onClick={handleDone}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#1f2535] hover:bg-[#283144] text-slate-200 hover:text-white transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
