import React, { useState, useRef, useId } from 'react';
import type { HsvColor } from '../../core/colorUtils';
import {
  coordsToHueAngle,
  coordsToSvSimplex,
  svToTriangleLocalCoords,
} from '../../core/colorUtils';

export const RESTING_CX = 288;
export const RESTING_CY = 18.5;
export const ACTIVE_CX = 288;
export const ACTIVE_CY = 110;
export const ACTIVE_SCALE = 64 / 37; // ~1.7297
export const R_OUT = 96;
export const R_IN = 72;
export const R_MID = (R_OUT + R_IN) / 2; // 84px
export const R_DIVIDE = (R_IN + 64) / 2; // 68px

export interface ColorWheelTriangleProps {
  color: string;
  hsv: HsvColor;
  isOpen: boolean;
  onOpenImmediately: () => void;
  onUpdateHsv: (nextHsv: HsvColor, commit?: boolean) => void;
  onDragStateChange: (dragging: boolean) => void;
  onPointerLeavePickerArea: (e: React.PointerEvent<HTMLDivElement>) => void;
  title?: string;
}

export const ColorWheelTriangle: React.FC<ColorWheelTriangleProps> = ({
  color,
  hsv,
  isOpen,
  onOpenImmediately,
  onUpdateHsv,
  onDragStateChange,
  onPointerLeavePickerArea,
  title,
}) => {
  const interactiveLayerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'hue' | 'sv' | null>(null);

  // Unique SVG IDs
  const idPrefix = useId().replace(/:/g, '_');
  const clipId = `tri_clip_${idPrefix}`;
  const whiteGradId = `tri_white_${idPrefix}`;
  const blackGradId = `tri_black_${idPrefix}`;

  // Pointer Dispatcher for Wheel & Triangle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = interactiveLayerRef.current;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - ACTIVE_CX;
    const dy = y - ACTIVE_CY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > R_OUT + 15) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    onDragStateChange(true);

    if (dist >= R_DIVIDE) {
      dragModeRef.current = 'hue';
      const nextHue = coordsToHueAngle(dx, dy);
      onUpdateHsv({ ...hsv, h: nextHue });
    } else {
      dragModeRef.current = 'sv';
      const { s, v } = coordsToSvSimplex(dx, dy, hsv.h, ACTIVE_SCALE);
      onUpdateHsv({ ...hsv, s, v });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const target = interactiveLayerRef.current;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - ACTIVE_CX;
    const dy = y - ACTIVE_CY;

    if (dragModeRef.current === 'hue') {
      const nextHue = coordsToHueAngle(dx, dy);
      onUpdateHsv({ ...hsv, h: nextHue });
    } else if (dragModeRef.current === 'sv') {
      const { s, v } = coordsToSvSimplex(dx, dy, hsv.h, ACTIVE_SCALE);
      onUpdateHsv({ ...hsv, s, v });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer already released
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      onDragStateChange(false);
      dragModeRef.current = null;
      onUpdateHsv(hsv, true);
      onPointerLeavePickerArea(e);
    }
  };

  // Current orientation angles & positions
  const currentRotation = isOpen ? hsv.h - 180 : 0;
  const currentCenterX = isOpen ? ACTIVE_CX : RESTING_CX;
  const currentCenterY = isOpen ? ACTIVE_CY : RESTING_CY;
  const currentScale = isOpen ? ACTIVE_SCALE : 1.0;

  // Hue knob position on circular wheel around ACTIVE_CX, ACTIVE_CY
  const hueRad = (hsv.h * Math.PI) / 180;
  const hueKnobX = ACTIVE_CX + R_MID * Math.sin(hueRad);
  const hueKnobY = ACTIVE_CY - R_MID * Math.cos(hueRad);

  // Reticle handle position in local triangle space
  const reticle = svToTriangleLocalCoords(hsv.s, hsv.v);

  return (
    <div
      ref={interactiveLayerRef}
      className="absolute top-0 z-50 overflow-visible select-none pointer-events-none"
      style={{
        left: '-256px',
        width: '400px',
        height: isOpen ? '220px' : '56px',
      }}
    >
      {/* Interaction Zones */}
      {isOpen ? (
        /* Active Mode: Wheel & Triangle Interaction Zone (Right Column: x from 176px to 400px) */
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute cursor-pointer touch-none pointer-events-auto"
          style={{
            left: '176px',
            top: '0px',
            width: '224px',
            height: '220px',
          }}
        />
      ) : (
        /* Idle Mode: Resting Color Swatch / Triangle interaction zone */
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            onOpenImmediately();
          }}
          className="absolute cursor-pointer touch-none pointer-events-auto"
          title={title}
          aria-label={title}
          style={{
            left: '256px',
            top: '0px',
            width: '64px',
            height: '56px',
          }}
        />
      )}

      {/* Outer Circular Hue Wheel (Diameter = 192px) */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)"
        style={{
          left: `${ACTIVE_CX}px`,
          top: `${ACTIVE_CY}px`,
          width: `${R_OUT * 2}px`,
          height: `${R_OUT * 2}px`,
          marginLeft: `-${R_OUT}px`,
          marginTop: `-${R_OUT}px`,
          opacity: isOpen ? 1 : 0,
          transform: `scale(${isOpen ? 1 : 0.5})`,
          background:
            'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${
            R_OUT - R_IN
          }px), #fff calc(100% - ${R_OUT - R_IN - 0.5}px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${
            R_OUT - R_IN
          }px), #fff calc(100% - ${R_OUT - R_IN - 0.5}px))`,
        }}
      />

      {/* Interactive SVG: Hue knob & The Unified Equilateral Triangle */}
      <svg
        className="absolute overflow-visible pointer-events-none"
        style={{
          left: '0px',
          top: '0px',
          width: '400px',
          height: isOpen ? '220px' : '56px',
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points="0,37 -32,-18.5 32,-18.5" />
          </clipPath>
          <linearGradient
            id={whiteGradId}
            gradientUnits="userSpaceOnUse"
            x1="-32"
            y1="-18.5"
            x2="16"
            y2="9.25"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={blackGradId}
            gradientUnits="userSpaceOnUse"
            x1="-16"
            y1="9.25"
            x2="32"
            y2="-18.5"
          >
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Hue Knob indicator on the circular ring */}
        <g
          className="transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0 }}
        >
          <circle
            cx={hueKnobX}
            cy={hueKnobY}
            r="8"
            fill={`hsl(${hsv.h}, 100%, 50%)`}
            stroke="#ffffff"
            strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.7))' }}
          />
        </g>

        {/* THE UNIFIED TRIANGLE */}
        <g
          style={{
            transform: `translate(${currentCenterX}px, ${currentCenterY}px) rotate(${currentRotation}deg) scale(${currentScale})`,
            transition: isDragging
              ? 'none'
              : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Active Chromatic HSV Field */}
          <g clipPath={`url(#${clipId})`}>
            <rect
              x="-36"
              y="-24"
              width="72"
              height="64"
              fill={`hsl(${hsv.h}, 100%, 50%)`}
            />
            <rect
              x="-36"
              y="-24"
              width="72"
              height="64"
              fill={`url(#${whiteGradId})`}
            />
            <rect
              x="-36"
              y="-24"
              width="72"
              height="64"
              fill={`url(#${blackGradId})`}
            />
          </g>

          {/* Solid Active Color Overlay */}
          <polygon
            points="0,37 -32,-18.5 32,-18.5"
            fill={color}
            className="transition-opacity duration-300 ease-out"
            style={{ opacity: isOpen ? 0 : 1 }}
          >
            {title && <title>{title}</title>}
          </polygon>

          {/* Equilateral Triangle Border */}
          <polygon
            points="0,37 -32,-18.5 32,-18.5"
            fill="none"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' }}
          />

          {/* SV Reticle Handle inside the triangle */}
          <g
            transform={`translate(${reticle.x}, ${reticle.y})`}
            className="transition-opacity duration-200"
            style={{ opacity: isOpen ? 1 : 0 }}
          >
            <circle
              r="6"
              fill={color}
              stroke="#ffffff"
              strokeWidth="2.5"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
            />
            <circle r="4" fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="1.2" />
          </g>
        </g>
      </svg>
    </div>
  );
};
