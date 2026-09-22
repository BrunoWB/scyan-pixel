import React from 'react';
import type { ToolType } from '../types';
import type { BwpxGrid } from '../../../core/PixelGrid';
import type { SelectionOverlay } from '../../../core/gridRenderer';

export interface EditorStatusBarProps {
  activeTool: ToolType;
  activeDrawColor: string;
  isStrictMonochrome: boolean;
  hoverPos: { x: number; y: number } | null;
  grid: BwpxGrid;
  brushSize: number;
  selection: SelectionOverlay | null;
  zoom: number;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  activeTool,
  activeDrawColor,
  isStrictMonochrome,
  hoverPos,
  grid,
  brushSize,
  selection,
  zoom,
}) => {
  const hoverColor = hoverPos ? grid.getColor(hoverPos.x, hoverPos.y) : null;
  const countOn = grid.countOn();
  const bounds = countOn > 0 ? grid.getBounds() : null;

  return (
    <footer className="h-7 bg-[#12141a] border-t border-[#202530] px-4 flex items-center justify-between text-xs text-slate-400 z-20">
      <div className="flex items-center gap-4">
        <span className="font-bold uppercase" style={{ color: activeDrawColor }}>
          {activeTool}
        </span>
        {!isStrictMonochrome && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Color:</span>
            <div
              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
              style={{ backgroundColor: activeDrawColor }}
            />
            <strong className="text-slate-200 font-mono text-[11px]">
              {activeDrawColor.toUpperCase()}
            </strong>
          </div>
        )}
        <span>
          Pos:{' '}
          <strong className="text-slate-200">
            {hoverPos && grid.inBounds(hoverPos.x, hoverPos.y)
              ? `${hoverPos.x}, ${hoverPos.y}`
              : '--'}
          </strong>
        </span>
        {hoverColor && !isStrictMonochrome && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            Hover:{' '}
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/20"
              style={{ backgroundColor: hoverColor }}
            />
            <span className="font-mono text-slate-300">{hoverColor}</span>
          </span>
        )}
        <span>
          Brush: <strong className="text-slate-200">{brushSize}px</strong>
        </span>
        <span>
          Grid: <strong className="text-slate-200">Infinite</strong>
        </span>
        <span>
          Artwork Bounds:{' '}
          <strong className="text-slate-200">
            {bounds ? `${bounds.width}×${bounds.height}` : 'Empty'}
          </strong>
        </span>
        <span>
          Selection:{' '}
          <strong className="text-slate-200">
            {selection && selection.active ? `${selection.w}×${selection.h}` : 'None'}
          </strong>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span>
          Pixels On: <strong style={{ color: activeDrawColor }}>{countOn}</strong>
        </span>
        <span>
          Zoom: <strong className="text-slate-200">{zoom * 100}%</strong>
        </span>
      </div>
    </footer>
  );
};

