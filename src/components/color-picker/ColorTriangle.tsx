import React from 'react';

export const TRIANGLE_POINTS = '32,55.5 0,0 64,0';
export const TRIANGLE_POINTS_CENTERED = '0,37 -32,-18.5 32,-18.5';

export interface ColorTriangleProps {
  color: string;
  isOpen?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  children?: React.ReactNode;
}

export const ColorTriangle: React.FC<ColorTriangleProps> = ({
  color,
  isOpen = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  title = 'Color Picker',
  disabled = false,
  className = '',
  label,
  children,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title}
      aria-label={title}
      className={`group relative flex items-start justify-center flex-shrink-0 cursor-pointer select-none bg-transparent border-none p-0 outline-none transition-transform duration-200 focus-visible:ring-1 focus-visible:ring-[#00f0ff] ${
        isOpen ? 'scale-105' : 'hover:scale-105'
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ width: '64px', height: '56px' }}
    >
      <svg
        className="w-full h-full overflow-visible pointer-events-none"
        viewBox="0 0 64 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Solid active color equilateral triangle */}
        <polygon
          points={TRIANGLE_POINTS}
          fill={color}
          className="transition-colors duration-200"
        />

        {/* Equilateral triangle border with drop shadow & cyan active glow */}
        <polygon
          points={TRIANGLE_POINTS}
          fill="none"
          stroke={isOpen ? '#00f0ff' : 'rgba(255, 255, 255, 0.45)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
          style={{
            filter: isOpen
              ? 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.5)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))'
              : 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))',
          }}
          className="transition-all duration-200 group-hover:stroke-white/70"
        />
      </svg>

      {label && (
        <span className="absolute top-2 text-[9px] font-mono font-bold tracking-widest pointer-events-none select-none uppercase opacity-80 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {label}
        </span>
      )}

      {children}
    </button>
  );
};

