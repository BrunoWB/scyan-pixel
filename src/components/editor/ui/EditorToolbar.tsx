import React from 'react';
import type { ToolType } from '../types';
import { getContrastColor } from '../../../core/colorUtils';
import { ShapeToolButton } from './ShapeToolButton';
import {
  Pencil,
  Brush,
  Eraser,
  PaintBucket,
  MousePointer2,
  Move,
  Minus,
  Square,
  Circle,
  Triangle,
  Sparkles,
  ArrowRight,
  Plus,
  Pipette,
} from 'lucide-react';

export interface EditorToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeDrawColor: string;
  activePixelColor: string;
  isStrictMonochrome?: boolean;
}

const FilledArrowIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="12" x2="14" y2="12" />
    <polygon points="12 7 20 12 12 17" fill="currentColor" />
  </svg>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  setActiveTool,
  activeDrawColor,
  activePixelColor,
  isStrictMonochrome = false,
}) => {
  return (
    <aside className="w-13 bg-[#12141a] border-r border-[#202530] flex flex-col items-center py-2.5 gap-3 z-10 overflow-y-auto">
      {/* DRAW GROUP */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        <span className="text-[8px] font-bold tracking-wider text-slate-600 mb-0.5">DRAW</span>

        <ShapeToolButton
          variants={[
            {
              tool: 'round-pencil',
              icon: <Brush className="w-3.5 h-3.5" />,
              title: 'Round Brush (B/P) - Left click draws, Right click erases',
              label: 'Round',
            },
            {
              tool: 'pencil',
              icon: <Pencil className="w-3.5 h-3.5" />,
              title: 'Square Pencil (B/P) - Left click draws, Right click erases',
              label: 'Square',
            },
          ]}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
        />

        <button
          onClick={() => setActiveTool('eraser')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'eraser'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'eraser' ? activePixelColor : 'transparent',
            color: activeTool === 'eraser' ? getContrastColor(activePixelColor) : undefined,
          }}
          title="Eraser (E)"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setActiveTool('bucket')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'bucket'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'bucket' ? activeDrawColor : 'transparent',
            color: activeTool === 'bucket' ? getContrastColor(activeDrawColor) : undefined,
          }}
          title="Flood Fill Bucket (G)"
        >
          <PaintBucket className="w-3.5 h-3.5" />
        </button>

        {!isStrictMonochrome && (
          <button
            onClick={() => setActiveTool('eyedropper')}
            className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
              activeTool === 'eyedropper'
                ? 'shadow-md ring-1 ring-white/30'
                : 'text-slate-400 hover:bg-[#202530] hover:text-white'
            }`}
            style={{
              backgroundColor: activeTool === 'eyedropper' ? activeDrawColor : 'transparent',
              color: activeTool === 'eyedropper' ? getContrastColor(activeDrawColor) : undefined,
            }}
            title="Eyedropper (I) - Sample color from canvas"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => setActiveTool('select')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'select'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'select' ? activePixelColor : 'transparent',
            color: activeTool === 'select' ? getContrastColor(activePixelColor) : undefined,
          }}
          title="Marquee Selection (M) - (Ctrl+A to select all)"
        >
          <MousePointer2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setActiveTool('move')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'move'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'move' ? activePixelColor : 'transparent',
            color: activeTool === 'move' ? getContrastColor(activePixelColor) : undefined,
          }}
          title="Move Selection / Content (V)"
        >
          <Move className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-6 h-[1px] bg-[#202530]" />

      {/* SHAPES GROUP */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        <span className="text-[8px] font-bold tracking-wider text-slate-600 mb-0.5">SHAPES</span>

        <ShapeToolButton
          variants={[
            {
              tool: 'line',
              icon: <Minus className="w-3.5 h-3.5 transform -rotate-45" />,
              title: 'Line (L)',
              label: 'Line',
            },
            {
              tool: 'arrow',
              icon: <ArrowRight className="w-3.5 h-3.5" />,
              title: 'Arrow',
              label: 'Arrow',
            },
            {
              tool: 'filled-arrow',
              icon: <FilledArrowIcon className="w-3.5 h-3.5" />,
              title: 'Filled Arrow',
              label: 'Filled Arrow',
            },
          ]}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
        />


        <ShapeToolButton
          outlineTool="rect"
          filledTool="filled-rect"
          outlineIcon={<Square className="w-3.5 h-3.5" />}
          filledIcon={<Square className="w-3.5 h-3.5 fill-current" fill="currentColor" />}
          outlineTitle="Rectangle Outline (U)"
          filledTitle="Filled Rectangle"
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
        />

        <ShapeToolButton
          outlineTool="ellipse"
          filledTool="filled-ellipse"
          outlineIcon={<Circle className="w-3.5 h-3.5" />}
          filledIcon={<Circle className="w-3.5 h-3.5 fill-current" fill="currentColor" />}
          outlineTitle="Circle / Ellipse Outline"
          filledTitle="Filled Circle"
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
        />

        <ShapeToolButton
          outlineTool="triangle"
          filledTool="filled-triangle"
          outlineIcon={<Triangle className="w-3.5 h-3.5" />}
          filledIcon={<Triangle className="w-3.5 h-3.5 fill-current" fill="currentColor" />}
          outlineTitle="Triangle Outline"
          filledTitle="Filled Triangle"
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeDrawColor={activeDrawColor}
        />

        <button
          onClick={() => setActiveTool('star')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'star'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'star' ? activeDrawColor : 'transparent',
            color: activeTool === 'star' ? getContrastColor(activeDrawColor) : undefined,
          }}
          title="Star"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>


        <button
          onClick={() => setActiveTool('plus')}
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeTool === 'plus'
              ? 'shadow-md ring-1 ring-white/30'
              : 'text-slate-400 hover:bg-[#202530] hover:text-white'
          }`}
          style={{
            backgroundColor: activeTool === 'plus' ? activeDrawColor : 'transparent',
            color: activeTool === 'plus' ? getContrastColor(activeDrawColor) : undefined,
          }}
          title="Cross / Plus"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

