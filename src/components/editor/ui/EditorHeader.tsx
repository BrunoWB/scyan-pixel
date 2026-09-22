import React from 'react';
import { NumberField } from '@heroui/react';
import {
  Undo2,
  Redo2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Upload,
  Share2,
} from 'lucide-react';
import { BrandIdentityLogo, BrandWolfMascot } from '../../brand/BrandIdentityLogo';
import { ColorPicker } from '../../ColorPicker';
import { RecentPalette, type RecentPaletteHandle } from '../../RecentPalette';
import { BackgroundPicker } from '../../BackgroundPicker';
import { SaveExportMenu } from './SaveExportMenu';
import { PeerAvatar } from './PeerAvatar';
import type { ConnectedPeer } from '../../../core/peer/peerIdentity';

export interface EditorHeaderProps {
  title?: string;
  badgeText?: string;
  isHeaderHovered: boolean;
  setIsHeaderHovered: (hovered: boolean) => void;
  // History
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  // Brush
  brushSize: number;
  setBrushSize: (size: number) => void;
  // Transforms
  onRotate90: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  // Colors & Themes
  isStrictMonochrome: boolean;
  allowColorThemes: boolean;
  activePixelColor: string;
  activeDrawColor: string;
  setActiveDrawColor: (color: string) => void;
  recentPaletteRef: React.RefObject<RecentPaletteHandle | null>;
  activeBgColor: string;
  onBgColorChange: (color: string) => void;
  onOpenCanvasEyedropper: () => void;
  // File / Modal triggers
  onOpenImportModal: () => void;
  onExportPNG: (type: 'colored' | 'monochrome' | 'transparent') => void;
  onExportCArray: () => void;
  onExportJSON: () => void;
  onSaveJSONFile?: () => void;
  onDownloadCHeader?: () => void;
  selectionBounds?: { width: number; height: number } | null;
  canvasDimensions?: { width: number; height: number };
  // Share & Peer Collaboration
  onOpenShareModal?: () => void;
  connectedPeers?: ConnectedPeer[];
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title = 'SCYAN PIXEL EDITOR',
  badgeText,
  isHeaderHovered,
  setIsHeaderHovered,
  canUndo,
  canRedo,
  historyIndex,
  historyLength,
  onUndo,
  onRedo,
  brushSize,
  setBrushSize,
  onRotate90,
  onFlipH,
  onFlipV,
  isStrictMonochrome,
  allowColorThemes,
  activePixelColor,
  activeDrawColor,
  setActiveDrawColor,
  recentPaletteRef,
  activeBgColor,
  onBgColorChange,
  onOpenCanvasEyedropper,
  onOpenImportModal,
  onExportPNG,
  onExportCArray,
  onExportJSON,
  onSaveJSONFile,
  onDownloadCHeader,
  selectionBounds,
  canvasDimensions,
  onOpenShareModal,
  connectedPeers = [],
}) => {

  return (
    <header
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      className="relative flex items-center justify-between pl-6 sm:pl-8 pr-4 sm:pr-6 h-13 sm:h-12 bg-[#11141c]/95 backdrop-blur-xs border-b border-[#202534] z-20 gap-4 overflow-visible select-none shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]"
      style={{ paddingLeft: '1.75rem' }}
    >
      {/* Ambient header glow backdrop on hover, softly radiating across the header from the logo */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out ${
          isHeaderHovered ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 90px 50%, rgba(245, 148, 66, 0.09) 0%, rgba(169, 83, 246, 0.03) 45%, transparent 75%)',
        }}
      />

      {/* Left: Brand Mascot & Identity Logo (unclipped, breakout) + Tool Actions */}
      <div className="flex items-center min-w-0 h-full overflow-visible z-10">
        {/* Brand Mascot & Logo: generous spacing, unconstrained glow */}
        <div
          className="flex items-center shrink-0 relative overflow-visible py-0.5"
          style={{ marginRight: '1.75rem' }}
        >
          {!title || title === 'SCYAN PIXEL EDITOR' || title === 'BWPX PIXEL EDITOR' ? (
            <BrandIdentityLogo size={42} badgeText={badgeText} isHovered={isHeaderHovered} />
          ) : (
            <div className="flex items-center gap-3">
              <BrandWolfMascot size={42} isHovered={isHeaderHovered} />
              <span
                className="font-bold text-sm tracking-wider"
                style={{ color: activePixelColor }}
              >
                {title}
              </span>
            </div>
          )}
        </div>

        <div
          className="h-5 w-[1px] bg-gradient-to-b from-transparent via-[#2c3344] to-transparent shrink-0"
          style={{ marginRight: '1.5rem' }}
        />

        {/* Action Controls: Undo/Redo, Brush Size, Transforms (scrollable on narrow screens) */}
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto py-1">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 shrink-0 bg-[#090b10] border border-[#1e2332] rounded-md p-0.5">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded hover:bg-[#1c2230] transition cursor-pointer ${
                !canUndo ? 'opacity-30 cursor-not-allowed' : 'text-slate-300 hover:text-white'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded hover:bg-[#1c2230] transition cursor-pointer ${
                !canRedo ? 'opacity-30 cursor-not-allowed' : 'text-slate-300 hover:text-white'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-500 px-1 select-none">
              {historyIndex}/{Math.max(0, historyLength - 1)}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#222836] shrink-0" />

          {/* Brush Size Numerical Picker (HeroUI / Scyan Studio Design System) */}
          <div className="flex items-center gap-1.5 bg-[#090b10] px-2 py-0.5 rounded-md border border-[#1e2332] shrink-0">
            <span className="text-[10px] text-slate-400 font-medium select-none">
              Brush
            </span>
            <NumberField
              value={brushSize}
              onChange={(val) => {
                if (typeof val === 'number' && Number.isFinite(val) && val >= 1) {
                  setBrushSize(Math.min(64, Math.max(1, Math.round(val))));
                }
              }}
              minValue={1}
              maxValue={64}
              step={1}
              aria-label="Brush size in pixels"
              className="w-20 text-xs font-mono"
            >
              <NumberField.Group className="!h-6 !grid-cols-[18px_1fr_18px] !bg-[#0b0d13] !border-[#1e2538] rounded-md px-0.5 hover:border-[#2d3748] focus-within:!border-[#00f0ff]/70 transition-colors">
                <NumberField.DecrementButton
                  aria-label="Decrease brush size"
                  className="!size-4.5 text-[#94a3b8] hover:text-white hover:bg-[#19202f] rounded flex items-center justify-center cursor-pointer text-[10px] transition-colors"
                />
                <NumberField.Input className="text-center font-mono text-[11px] text-white !py-0 !px-1 focus:outline-none bg-transparent" />
                <NumberField.IncrementButton
                  aria-label="Increase brush size"
                  className="!size-4.5 text-[#94a3b8] hover:text-white hover:bg-[#19202f] rounded flex items-center justify-center cursor-pointer text-[10px] transition-colors"
                />
              </NumberField.Group>
            </NumberField>
            <span className="text-[10px] font-mono text-[#64748b] select-none">px</span>
            <div
              className="w-3.5 h-3.5 rounded-xs bg-[#0b0d13] border border-[#1e2538] flex items-center justify-center overflow-hidden shrink-0 ml-0.5"
              title={`Brush size preview (${brushSize}px)`}
            >
              <div
                className="rounded-[1px]"
                style={{
                  width: `${Math.min(10, Math.max(2, brushSize))}px`,
                  height: `${Math.min(10, Math.max(2, brushSize))}px`,
                  backgroundColor: activePixelColor,
                }}
              />
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[#222836] shrink-0" />

          {/* Canvas Transforms */}
          <div className="flex items-center gap-0.5 shrink-0 bg-[#090b10] border border-[#1e2332] rounded-md p-0.5">
            <button
              onClick={onRotate90}
              className="p-1.5 rounded hover:bg-[#1c2230] text-slate-400 hover:text-white transition cursor-pointer"
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFlipH}
              className="p-1.5 rounded hover:bg-[#1c2230] text-slate-400 hover:text-white transition cursor-pointer"
              title="Flip Horizontally"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFlipV}
              className="p-1.5 rounded hover:bg-[#1c2230] text-slate-400 hover:text-white transition cursor-pointer"
              title="Flip Vertically"
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Color Picker, Palettes, Themes, Import, Export */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 z-10">
        {!isStrictMonochrome && (
          <div className="flex items-center gap-2">
            <ColorPicker
              color={activeDrawColor}
              onChange={(hex) => setActiveDrawColor(hex)}
              onChangeCommit={(hex) => {
                setActiveDrawColor(hex);
                recentPaletteRef.current?.pushColor(hex);
              }}
              onOpenCanvasEyedropper={onOpenCanvasEyedropper}
              title="Active Draw Color"
            />
            <RecentPalette
              ref={recentPaletteRef}
              activeColor={activeDrawColor}
              onSelectColor={(hex) => setActiveDrawColor(hex)}
            />
          </div>
        )}

        {allowColorThemes && (
          <BackgroundPicker
            color={activeBgColor}
            onChange={onBgColorChange}
            onOpenCanvasEyedropper={onOpenCanvasEyedropper}
            title="Canvas Background Color"
          />
        )}

        <div className="h-5 w-[1px] bg-gradient-to-b from-transparent via-[#2c3344] to-transparent shrink-0" />

        {/* Image Import Button */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141822] hover:bg-[#1c2230] border border-[#242b3d] hover:border-[#354058] rounded-md text-xs text-slate-200 hover:text-white transition-all shadow-xs cursor-pointer active:scale-98"
          title="Import Image (PNG, JPG, BMP, GIF)"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline font-medium">Import</span>
        </button>

        {/* Modern Save / Download / Export Menu */}
        <SaveExportMenu
          onExportPNG={onExportPNG}
          onExportCArray={onExportCArray}
          onExportJSON={onExportJSON}
          onSaveJSONFile={onSaveJSONFile}
          onDownloadCHeader={onDownloadCHeader}
          selectionBounds={selectionBounds}
          canvasDimensions={canvasDimensions}
        />

        {/* Division next to Export */}
        <div className="h-5 w-[1px] bg-gradient-to-b from-transparent via-[#2c3344] to-transparent shrink-0" />

        {/* Share Button & Connected Peers next to it */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141822] hover:bg-[#1c2230] border border-[#242b3d] hover:border-[#354058] rounded-md text-xs text-slate-200 hover:text-white transition-all shadow-xs cursor-pointer active:scale-98"
            title="Share canvas & manage peer session"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-medium">Share</span>
            {connectedPeers.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {connectedPeers.length}
              </span>
            )}
          </button>

          {/* Connected peers next to it (if any yet) */}
          {connectedPeers.length > 0 && (
            <div
              className="flex items-center -space-x-1.5 pl-0.5 cursor-pointer"
              onClick={onOpenShareModal}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenShareModal?.();
                }
              }}
              title={`${connectedPeers.length} connected peer(s)`}
            >
              {connectedPeers.slice(0, 4).map((peer) => (
                <PeerAvatar
                  key={peer.id}
                  name={peer.name}
                  color={peer.color}
                  size="sm"
                  showTooltip
                />
              ))}
              {connectedPeers.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-[#1c2230] border border-[#2d374d] text-[10px] font-semibold text-slate-300 flex items-center justify-center shrink-0">
                  +{connectedPeers.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
