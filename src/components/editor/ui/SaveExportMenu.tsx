import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Save,
  FileCode,
  FileJson,
  Image,
  ChevronDown,
  Code2,
} from 'lucide-react';

export interface SaveExportMenuProps {
  onExportPNG: (type: 'colored' | 'monochrome' | 'transparent') => void;
  onExportCArray: () => void;
  onExportJSON: () => void;
  onSaveJSONFile?: () => void;
  onDownloadCHeader?: () => void;
  selectionBounds?: { width: number; height: number } | null;
  canvasDimensions?: { width: number; height: number };
}

export const SaveExportMenu: React.FC<SaveExportMenuProps> = ({
  onExportPNG,
  onExportCArray,
  onExportJSON,
  onSaveJSONFile,
  onDownloadCHeader,
  selectionBounds,
  canvasDimensions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  const hasSelection = Boolean(selectionBounds && selectionBounds.width > 0 && selectionBounds.height > 0);

  return (
    <div className="relative" ref={menuRef}>
      {/* Modern Unified Save / Download / Export Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs border ${
          isOpen
            ? 'bg-[#1e2536] border-[#00f0ff]/70 text-white ring-1 ring-[#00f0ff]/30'
            : 'bg-[#181c26] hover:bg-[#202838] border-[#2d3548] text-slate-200'
        }`}
        title="Save, Download, or Export project assets"
      >
        <Download className="w-3.5 h-3.5 text-[#00f0ff]" />
        <span className="font-medium tracking-wide">Export</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Sub-options Popover Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1.5 w-80 bg-[#10131b]/95 backdrop-blur-md border border-[#242c3f] rounded-xl shadow-2xl shadow-black/80 p-1.5 z-50 flex flex-col gap-1 text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header Context / Resolution Status */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1e2537] mb-0.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Export Assets
            </span>
            {hasSelection && selectionBounds ? (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                title="Active selection bounds for raster export"
              >
                Selection: {selectionBounds.width}×{selectionBounds.height}
              </span>
            ) : canvasDimensions ? (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e2538] text-slate-400 border border-[#2d3548]"
                title="Full canvas dimensions"
              >
                Canvas: {canvasDimensions.width}×{canvasDimensions.height}
              </span>
            ) : null}
          </div>

          {/* Section 1: Save & Project State */}
          <div className="flex flex-col gap-0.5">
            <div className="px-2 pt-1 text-[9px] font-semibold tracking-wider text-emerald-400/90 uppercase">
              Save Project
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onSaveJSONFile || onExportJSON)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Save className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-100 group-hover:text-emerald-300 transition-colors">
                    Save Project (.json)
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Download full editable canvas & colors
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                Ctrl+S
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onExportJSON)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/80 group-hover:scale-105 transition-transform flex-shrink-0">
                  <FileJson className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-emerald-300 transition-colors">
                    View Project JSON
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Inspect schema payload & copy
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                Modal
              </span>
            </button>
          </div>

          <div className="h-[1px] bg-[#1e2537] my-0.5" />

          {/* Section 2: Download Raster Images */}
          <div className="flex flex-col gap-0.5">
            <div className="px-2 pt-1 text-[9px] font-semibold tracking-wider text-[#00f0ff]/90 uppercase">
              Download Images
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(() => onExportPNG('colored'))}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-[#00f0ff] group-hover:scale-105 transition-transform flex-shrink-0">
                  <Image className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-100 group-hover:text-[#00f0ff] transition-colors">
                    PNG (Full Color)
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Current active pixel & background colors
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                .png
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(() => onExportPNG('monochrome'))}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-slate-500/15 border border-slate-500/30 text-slate-300 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Image className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                    PNG (1bpp Monochrome)
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    B&W OLED / SSD1306 display preview
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                1bpp
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(() => onExportPNG('transparent'))}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Image className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-purple-300 transition-colors">
                    PNG (Transparent)
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Alpha channel cutout without background
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                Alpha
              </span>
            </button>
          </div>

          <div className="h-[1px] bg-[#1e2537] my-0.5" />

          {/* Section 3: Export Firmware & Code */}
          <div className="flex flex-col gap-0.5">
            <div className="px-2 pt-1 text-[9px] font-semibold tracking-wider text-amber-400/90 uppercase">
              Export Firmware
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onDownloadCHeader || onExportCArray)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <FileCode className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-100 group-hover:text-amber-300 transition-colors">
                    Download C Header (.h)
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Ready-to-use Zephyr SSD1306 bitmap header
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                .h
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onExportCArray)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#18202f] transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400/80 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                    View C Array Code
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    SSD1306 1bpp byte array & ASCII preview
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1e2538] flex-shrink-0 ml-2">
                Modal
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
