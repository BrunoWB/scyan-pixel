import React, { useState } from 'react';
import { NumberField } from '@heroui/react';
import {
  Undo2,
  Redo2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { BrandIdentityLogo, BrandWolfMascot } from '../../brand/BrandIdentityLogo';
import { ColorPicker } from '../../ColorPicker';
import { RecentPalette, type RecentPaletteHandle } from '../../RecentPalette';
import { BackgroundPicker } from '../../BackgroundPicker';

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
  onFitToView: () => void;
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
  onFitToView,
}) => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  return (
    <header
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      className="flex items-center justify-between px-3 h-12 bg-[#12141a] border-b border-[#202530] z-20 gap-3"
    >
      {/* Left: Brand, History, Brush, Transforms */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          {!title || title === 'SCYAN PIXEL EDITOR' || title === 'BWPX PIXEL EDITOR' ? (
            <BrandIdentityLogo size={24} badgeText={badgeText} isHovered={isHeaderHovered} />
          ) : (
            <div className="flex items-center gap-2">
              <BrandWolfMascot size={24} isHovered={isHeaderHovered} />
              <span
                className="font-bold text-sm tracking-wider"
                style={{ color: activePixelColor }}
              >
                {title}
              </span>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#2d323d] flex-shrink-0" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded hover:bg-[#202530] transition cursor-pointer ${
              !canUndo ? 'opacity-30 cursor-not-allowed' : 'text-slate-300'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded hover:bg-[#202530] transition cursor-pointer ${
              !canRedo ? 'opacity-30 cursor-not-allowed' : 'text-slate-300'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-slate-500 ml-1">
            {historyIndex}/{Math.max(0, historyLength - 1)}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#2d323d] flex-shrink-0" />

        {/* Brush Size Numerical Picker (HeroUI / Scyan Studio Design System) */}
        <div className="flex items-center gap-1.5 bg-[#090b0e] px-2 py-0.5 rounded border border-[#202530] flex-shrink-0">
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

        <div className="h-4 w-[1px] bg-[#2d323d] flex-shrink-0" />

        {/* Canvas Transforms */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRotate90}
            className="p-1.5 rounded hover:bg-[#202530] text-slate-400 hover:text-white transition cursor-pointer"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={onFlipH}
            className="p-1.5 rounded hover:bg-[#202530] text-slate-400 hover:text-white transition cursor-pointer"
            title="Flip Horizontally"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onFlipV}
            className="p-1.5 rounded hover:bg-[#202530] text-slate-400 hover:text-white transition cursor-pointer"
            title="Flip Vertically"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Color Picker, Palettes, Themes, Import, Export, Fit */}
      <div className="flex items-center gap-3 flex-shrink-0">
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

        <div className="h-4 w-[1px] bg-[#2d323d]" />

        {/* Image Import Button */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#181c26] hover:bg-[#222838] border border-[#2d3548] rounded text-xs text-slate-200 transition shadow-xs cursor-pointer"
          title="Import Image (PNG, JPG, BMP, GIF)"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Export Group */}
        <div className="relative">
          <div className="flex items-center bg-[#181c26] border border-[#2d3548] rounded overflow-hidden">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="px-2 py-0.5 text-xs text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
            >
              <span>PNG</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            <button
              onClick={onExportCArray}
              className="px-2 py-0.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              C Array
            </button>
            <button
              onClick={onExportJSON}
              className="px-2 py-0.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              JSON
            </button>
          </div>

          {exportDropdownOpen && (
            <div
              className="absolute right-0 top-8 w-44 bg-[#14171e] border border-[#29303e] rounded-lg shadow-2xl p-1 z-50 flex flex-col gap-0.5"
              onClick={() => setExportDropdownOpen(false)}
            >
              <button
                onClick={() => onExportPNG('colored')}
                className="px-2.5 py-1.5 text-xs rounded hover:bg-[#202735] text-left text-slate-200 transition cursor-pointer"
              >
                PNG (Colored)
              </button>
              <button
                onClick={() => onExportPNG('monochrome')}
                className="px-2.5 py-1.5 text-xs rounded hover:bg-[#202735] text-left text-slate-200 transition cursor-pointer"
              >
                PNG (B&W 1bpp)
              </button>
              <button
                onClick={() => onExportPNG('transparent')}
                className="px-2.5 py-1.5 text-xs rounded hover:bg-[#202735] text-left text-slate-200 transition cursor-pointer"
              >
                PNG (Transparent)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onFitToView}
          className="p-1.5 rounded hover:bg-[#202530] text-slate-400 hover:text-white transition cursor-pointer"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
