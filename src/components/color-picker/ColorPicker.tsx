import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  hexToHsv,
  hsvToHex,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  type HsvColor,
} from '../../core/colorUtils';
import { ColorInputs } from './ColorInputs';
import { ColorWheelTriangle } from './ColorWheelTriangle';

export interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  onChangeCommit?: (hex: string) => void;
  onOpenCanvasEyedropper?: () => void;
  disabled?: boolean;
  isHeaderHovered?: boolean;
  title?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  onChangeCommit,
  onOpenCanvasEyedropper,
  disabled = false,
  isHeaderHovered = false,
  title = 'Color Picker',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPickerHovered, setIsPickerHovered] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [colorMode, setColorMode] = useState<'rgb' | 'hsv'>('rgb');

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [lastEmittedHex, setLastEmittedHex] = useState<string | null>(null);

  // Internal HSV representation
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(color));
  const hsvRef = useRef<HsvColor>(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  const [hexInput, setHexInput] = useState<string>(color.toUpperCase());

  // Synchronize when external `color` prop changes from outside
  const [prevColor, setPrevColor] = useState<string>(color);
  if (color !== prevColor) {
    setPrevColor(color);
    if (color.toLowerCase() !== lastEmittedHex) {
      const nextHsv = hexToHsv(color);
      const rgb = hexToRgb(color);
      if (rgb && rgb.r === rgb.g && rgb.g === rgb.b) {
        setHsv((prev) => ({ ...nextHsv, h: prev.h }));
      } else {
        setHsv(nextHsv);
      }
      setHexInput(color.toUpperCase());
    }
  }

  const shouldBeOpen =
    (isHeaderHovered || isPickerHovered || isDragging || isInputFocused) && !isDismissed;

  // Reactively open or close with debounce
  useEffect(() => {
    if (shouldBeOpen) {
      if (isDragging || isInputFocused) {
        const timer = setTimeout(() => setIsOpen(true), 0);
        return () => clearTimeout(timer);
      }
      const enterTimer = setTimeout(() => {
        setIsOpen(true);
      }, 120);
      return () => clearTimeout(enterTimer);
    } else {
      const leaveTimer = setTimeout(() => {
        setIsOpen(false);
      }, 200);
      return () => clearTimeout(leaveTimer);
    }
  }, [shouldBeOpen, isDragging, isInputFocused]);

  // Click-outside and Escape listeners
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      const headerEl = containerRef.current?.closest('header');
      if (headerEl && headerEl.contains(e.target as Node)) {
        return;
      }
      setIsDismissed(true);
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDismissed(true);
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const updateHsv = useCallback(
    (nextHsv: HsvColor, commit = false) => {
      setHsv(nextHsv);
      hsvRef.current = nextHsv;
      const newHex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
      setLastEmittedHex(newHex.toLowerCase());
      setHexInput(newHex.toUpperCase());

      onChange(newHex);
      if (commit && onChangeCommit) {
        onChangeCommit(newHex);
      }
    },
    [onChange, onChangeCommit]
  );

  const handleMouseEnter = () => {
    if (disabled) return;
    setIsDismissed(false);
    setIsPickerHovered(true);
  };

  const handleMouseLeave = () => {
    setIsPickerHovered(false);
    if (!isHeaderHovered) {
      setIsDismissed(false);
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    const parsed = hexToRgb(val);
    if (parsed) {
      const newHsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
      if (parsed.r === parsed.g && parsed.g === parsed.b) {
        newHsv.h = hsvRef.current.h;
      }
      setHsv(newHsv);
      hsvRef.current = newHsv;
      const fullHex = rgbToHex(parsed.r, parsed.g, parsed.b);
      setLastEmittedHex(fullHex.toLowerCase());
      onChange(fullHex);
    }
  };

  const handleHexInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = hexToRgb(hexInput);
      if (parsed) {
        const fullHex = rgbToHex(parsed.r, parsed.g, parsed.b);
        if (onChangeCommit) onChangeCommit(fullHex);
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleNativeEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-expect-error EyeDropper is modern Web API
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          const parsed = hexToHsv(result.sRGBHex);
          updateHsv(parsed, true);
        }
      } catch {
        // User cancelled eyedropper
      }
    } else if (onOpenCanvasEyedropper) {
      setIsOpen(false);
      setIsPickerHovered(false);
      onOpenCanvasEyedropper();
    }
  };

  const handlePointerLeavePickerArea = (e: React.PointerEvent<HTMLDivElement>) => {
    if (popupRef.current || containerRef.current) {
      const pRect = popupRef.current?.getBoundingClientRect();
      const cRect = containerRef.current?.getBoundingClientRect();
      const isInside =
        (pRect &&
          e.clientX >= pRect.left &&
          e.clientX <= pRect.right &&
          e.clientY >= pRect.top &&
          e.clientY <= pRect.bottom) ||
        (cRect &&
          e.clientX >= cRect.left &&
          e.clientX <= cRect.right &&
          e.clientY >= cRect.top &&
          e.clientY <= cRect.bottom);
      setIsPickerHovered(!!isInside);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex items-start justify-center flex-shrink-0 ${
        isOpen ? 'z-[70]' : 'z-20'
      }`}
      style={{ width: '64px', height: '56px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 1. Frosted Background Window HUD */}
      <div
        ref={popupRef}
        className={`absolute -top-1 z-40 w-[400px] h-[220px] bg-[#131722]/95 backdrop-blur-xl border border-[#1e2538] rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.95)] px-4 py-3.5 flex items-center justify-between transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{ left: '-256px', transformOrigin: '288px 18px' }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <ColorInputs
          color={color}
          colorMode={colorMode}
          setColorMode={setColorMode}
          hexInput={hexInput}
          onHexInputChange={handleHexInputChange}
          onHexInputKeyDown={handleHexInputKeyDown}
          hsv={hsv}
          onHsvChange={updateHsv}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          onNativeEyedropper={handleNativeEyeDropper}
        />

        {/* Right Column Spacer: Reserved for Hue Wheel & Triangle (192px x 192px) */}
        <div style={{ width: '192px', height: '192px' }} className="flex-shrink-0 pointer-events-none" />
      </div>

      {/* 2. Visual & Interactive Layer: Hue Wheel & Triangle */}
      <ColorWheelTriangle
        color={color}
        hsv={hsv}
        isOpen={isOpen}
        onOpenImmediately={() => {
          setIsDismissed(false);
          setIsOpen(true);
        }}
        onUpdateHsv={updateHsv}
        onDragStateChange={setIsDragging}
        onPointerLeavePickerArea={handlePointerLeavePickerArea}
        title={title}
      />
    </div>
  );
};
