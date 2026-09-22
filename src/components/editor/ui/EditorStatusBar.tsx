import React, { useState, useRef, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
import type { ToolType } from '../types';
import type { BwpxGrid } from '../../../core/PixelGrid';
import type { SelectionOverlay } from '../../../core/gridRenderer';

export interface EditorStatusBarProps {
  hoverPos: { x: number; y: number } | null;
  grid: BwpxGrid;
  selection: SelectionOverlay | null;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  onFitToScreen?: () => void;
  // Kept for backward compatibility
  activeTool?: ToolType;
  activeDrawColor?: string;
  isStrictMonochrome?: boolean;
  brushSize?: number;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  hoverPos,
  grid,
  selection,
  zoom,
  onZoomChange,
  onFitToScreen,
}) => {
  const countOn = grid.countOn();
  const bounds = countOn > 0 ? grid.getBounds() : null;

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
