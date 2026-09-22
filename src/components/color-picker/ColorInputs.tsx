import React, { useRef } from 'react';
import { Pipette } from 'lucide-react';
import { hexToRgb, type HsvColor } from '../../core/colorUtils';

export interface ColorInputsProps {
  color: string;
  colorMode: 'rgb' | 'hsv';
  setColorMode: (mode: 'rgb' | 'hsv') => void;
  hexInput: string;
  onHexInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHexInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  hsv: HsvColor;
  onHsvChange: (hsv: HsvColor, commit?: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
  onNativeEyedropper: () => void;
}

export const ColorInputs: React.FC<ColorInputsProps> = ({
  color,
  colorMode,
  setColorMode,
  hexInput,
  onHexInputChange,
  onHexInputKeyDown,
  hsv,
  onHsvChange,
  onFocus,
  onBlur,
  onNativeEyedropper,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-[160px] h-[192px] flex flex-col justify-between relative z-[60]">
      {/* Top Row: Segmented Mode Switcher & Eyedropper */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1 bg-[#0b0d13] p-1 rounded-xl border border-[#1e2538] text-xs font-mono select-none">
          <button
            type="button"
            onClick={() => setColorMode('rgb')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              colorMode === 'rgb'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#19202f]/50 border border-transparent'
            }`}
          >
            RGB
          </button>
          <button
            type="button"
            onClick={() => setColorMode('hsv')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              colorMode === 'hsv'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#19202f]/50 border border-transparent'
            }`}
          >
            HSV
          </button>
        </div>

        {/* Eyedropper Button */}
        <button
          type="button"
          onClick={onNativeEyedropper}
          className="size-8 rounded-xl bg-[#0b0d13] hover:bg-[#19202f] text-[#94a3b8] hover:text-white border border-[#1e2538] hover:border-[#00f0ff]/50 transition-all cursor-pointer flex items-center justify-center shadow-xs flex-shrink-0"
          title="Pick color from screen or canvas"
        >
          <Pipette className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Color Code Fields */}
      {colorMode === 'rgb' ? (
        /* RGB Hex Mode */
        <div className="flex flex-col gap-2.5 flex-1 justify-center">
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00f0ff] font-mono text-xs font-bold select-none pointer-events-none">
              #
            </span>
            <input
              ref={inputRef}
              type="text"
              value={hexInput.replace('#', '')}
              onChange={onHexInputChange}
              onKeyDown={onHexInputKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              className="w-full bg-[#0b0d13] border border-[#1e2538] focus:border-[#00f0ff] focus:shadow-[0_0_14px_rgba(0,240,255,0.3)] rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-semibold text-white tracking-widest text-center outline-hidden transition-all uppercase placeholder-[#555e6e]"
              placeholder="RRGGBB"
              maxLength={7}
            />
          </div>

          {/* RGB Channel Readout & Color Swatch */}
          {(() => {
            const rgb = hexToRgb(color) || { r: 0, g: 0, b: 0 };
            return (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#0b0d13] border border-[#1e2538] rounded-xl text-[11px] font-mono text-[#94a3b8]">
                <div
                  className="size-4 rounded-md border border-white/20 shadow-inner flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-center justify-between flex-1 text-[10px] text-slate-400">
                  <span>
                    <strong className="text-slate-200">{rgb.r}</strong>r
                  </span>
                  <span>
                    <strong className="text-slate-200">{rgb.g}</strong>g
                  </span>
                  <span>
                    <strong className="text-slate-200">{rgb.b}</strong>b
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* HSV Mode */
        <div className="flex flex-col gap-2 flex-1 justify-center">
          {/* Hue Card */}
          <div
            onClick={(e) => {
              (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus();
            }}
            className="relative bg-[#0b0d13] border border-[#1e2538] focus-within:border-[#00f0ff] focus-within:shadow-[0_0_12px_rgba(0,240,255,0.3)] rounded-xl px-2.5 py-1 flex items-center justify-between transition-all cursor-text"
          >
            <span className="text-[10px] font-mono font-bold text-[#00f0ff] select-none pointer-events-none">
              H
            </span>
            <input
              type="number"
              min={0}
              max={360}
              value={hsv.h}
              onChange={(e) => {
                const h = Math.max(0, Math.min(360, parseInt(e.target.value, 10) || 0));
                onHsvChange({ ...hsv, h });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onHsvChange(hsv, true);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onFocus={onFocus}
              onBlur={onBlur}
              className="w-16 bg-transparent text-xs font-mono font-semibold text-white text-center outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Hue (0-360°)"
            />
            <span className="text-[10px] font-mono text-[#94a3b8] select-none pointer-events-none">
              °
            </span>
          </div>

          {/* Saturation Card */}
          <div
            onClick={(e) => {
              (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus();
            }}
            className="relative bg-[#0b0d13] border border-[#1e2538] focus-within:border-[#00f0ff] focus-within:shadow-[0_0_12px_rgba(0,240,255,0.3)] rounded-xl px-2.5 py-1 flex items-center justify-between transition-all cursor-text"
          >
            <span className="text-[10px] font-mono font-bold text-[#00f0ff] select-none pointer-events-none">
              S
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={hsv.s}
              onChange={(e) => {
                const s = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                onHsvChange({ ...hsv, s });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onHsvChange(hsv, true);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onFocus={onFocus}
              onBlur={onBlur}
              className="w-16 bg-transparent text-xs font-mono font-semibold text-white text-center outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Saturation (0-100%)"
            />
            <span className="text-[10px] font-mono text-[#94a3b8] select-none pointer-events-none">
              %
            </span>
          </div>

          {/* Value Card */}
          <div
            onClick={(e) => {
              (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus();
            }}
            className="relative bg-[#0b0d13] border border-[#1e2538] focus-within:border-[#00f0ff] focus-within:shadow-[0_0_12px_rgba(0,240,255,0.3)] rounded-xl px-2.5 py-1 flex items-center justify-between transition-all cursor-text"
          >
            <span className="text-[10px] font-mono font-bold text-[#00f0ff] select-none pointer-events-none">
              V
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={hsv.v}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                onHsvChange({ ...hsv, v });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onHsvChange(hsv, true);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onFocus={onFocus}
              onBlur={onBlur}
              className="w-16 bg-transparent text-xs font-mono font-semibold text-white text-center outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Value / Brightness (0-100%)"
            />
            <span className="text-[10px] font-mono text-[#94a3b8] select-none pointer-events-none">
              %
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

