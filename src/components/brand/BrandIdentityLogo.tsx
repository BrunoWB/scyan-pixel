import React, { useState, useId } from 'react';

export const WOLF_BODY_PATH =
  'M6,0h2v1h-2zM25,0h2v1h-2zM5,1h4v1h-4zM24,1h4v1h-4zM4,2h5v1h-5zM24,2h5v1h-5zM4,3h2v1h-2zM7,3h3v1h-3zM12,3h1v1h-1zM17,3h1v1h-1zM23,3h3v1h-3zM27,3h2v1h-2zM3,4h2v1h-2zM8,4h3v1h-3zM13,4h1v1h-1zM17,4h2v1h-2zM22,4h3v1h-3zM28,4h2v1h-2zM3,5h2v1h-2zM8,5h3v1h-3zM12,5h9v1h-9zM22,5h3v1h-3zM28,5h2v1h-2zM3,6h2v1h-2zM9,6h9v1h-9zM20,6h4v1h-4zM28,6h2v1h-2zM3,7h2v1h-2zM10,7h1v1h-1zM12,7h8v1h-8zM21,7h2v1h-2zM28,7h2v1h-2zM3,8h2v1h-2zM10,8h1v1h-1zM13,8h7v1h-7zM21,8h2v1h-2zM28,8h2v1h-2zM4,9h2v1h-2zM7,9h4v1h-4zM12,9h4v1h-4zM17,9h2v1h-2zM21,9h5v1h-5zM27,9h2v1h-2zM5,10h12v1h-12zM19,10h9v1h-9zM2,11h5v1h-5zM8,11h4v1h-4zM13,11h1v1h-1zM15,11h5v1h-5zM21,11h4v1h-4zM26,11h5v1h-5zM3,12h3v1h-3zM7,12h6v1h-6zM15,12h3v1h-3zM20,12h6v1h-6zM27,12h3v1h-3zM5,13h1v1h-1zM7,13h1v1h-1zM13,13h7v1h-7zM25,13h1v1h-1zM27,13h1v1h-1zM3,14h6v1h-6zM12,14h1v1h-1zM14,14h5v1h-5zM20,14h1v1h-1zM24,14h6v1h-6zM2,15h6v1h-6zM9,15h1v1h-1zM12,15h1v1h-1zM14,15h5v1h-5zM20,15h1v1h-1zM23,15h1v1h-1zM25,15h6v1h-6zM1,16h3v1h-3zM5,16h2v1h-2zM9,16h2v1h-2zM14,16h5v1h-5zM22,16h2v1h-2zM26,16h2v1h-2zM29,16h2v1h-2zM3,17h2v1h-2zM6,17h2v1h-2zM10,17h3v1h-3zM14,17h5v1h-5zM20,17h3v1h-3zM25,17h2v1h-2zM28,17h2v1h-2zM2,18h2v1h-2zM6,18h3v1h-3zM12,18h9v1h-9zM24,18h3v1h-3zM29,18h2v1h-2zM2,19h5v1h-5zM8,19h17v1h-17zM26,19h5v1h-5zM1,20h5v1h-5zM7,20h2v1h-2zM10,20h16v1h-16zM27,20h4v1h-4zM3,21h3v1h-3zM7,21h3v1h-3zM11,21h9v1h-9zM21,21h5v1h-5zM27,21h3v1h-3zM5,22h2v1h-2zM8,22h6v1h-6zM19,22h2v1h-2zM22,22h3v1h-3zM26,22h2v1h-2zM5,23h6v1h-6zM12,23h2v1h-2zM19,23h2v1h-2zM22,23h6v1h-6zM5,24h1v1h-1zM9,24h2v1h-2zM12,24h3v1h-3zM18,24h3v1h-3zM22,24h2v1h-2zM27,24h1v1h-1zM10,25h2v1h-2zM13,25h3v1h-3zM17,25h3v1h-3zM21,25h2v1h-2zM12,26h1v1h-1zM20,26h1v1h-1zM13,27h7v1h-7zM13,28h7v1h-7z';

export const WOLF_EYES_PATH =
  'M8,13h5v1h-5zM9,14h3v1h-3zM10,15h2v1h-2zM20,13h5v1h-5zM21,14h3v1h-3zM21,15h2v1h-2z';

export const WOLF_PUPILS_PATH = 'M12,14h1v2h-1zM20,14h1v2h-1z';

export interface BrandWolfMascotProps {
  size?: number;
  isHovered?: boolean;
  className?: string;
}

export const BrandWolfMascot: React.FC<BrandWolfMascotProps> = ({
  size = 26,
  isHovered = false,
  className = '',
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const gradId = `brandWolfGrad_${uniqueId}`;
  const glowFilterId = `brandEyeGlow_${uniqueId}`;

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Background glow layer: container smoothly transitions opacity & scale in both directions */}
      <div
        className={`absolute -inset-3.5 rounded-full blur-md pointer-events-none transition-all duration-500 ease-out ${
          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
        aria-hidden="true"
      >
        <div
          className="w-full h-full rounded-full animate-[pulseOrangeGlow_1.5s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(245, 148, 66, 0.65) 0%, rgba(245, 148, 66, 0.22) 50%, transparent 75%)',
          }}
        />
      </div>

      <svg
        viewBox="0 0 31 29"
        width={size}
        height={Math.round((size * 29) / 31)}
        className="relative z-10 transition-transform duration-300"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradId} cx="100%" cy="100%" r="140%" gradientUnits="userSpaceOnUse" fx="31" fy="29">
            <stop offset="0%" stopColor="#a953f6" />
            <stop offset="100%" stopColor="#00f0ff" />
          </radialGradient>

          <filter id={glowFilterId} x="-200%" y="-200%" width="500%" height="500%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.5" floodColor="#f59442" floodOpacity="1" />
          </filter>
        </defs>

        {/* Wolf Body (filled with reversed radial gradient: violet at bottom-right → cyan at top-left) */}
        <path d={WOLF_BODY_PATH} fill={`url(#${gradId})`} />

        {/* Orange pupils on hover with reverse-pulsing glow, smoothly fading out on hover leave */}
        <g
          className={`transition-opacity duration-300 ease-out pointer-events-none ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <path
            d={WOLF_PUPILS_PATH}
            className={
              isHovered
                ? 'animate-[pulseOrangeReverse_1.5s_ease-in-out_infinite]'
                : ''
            }
            fill="#f59442"
            style={{
              filter: `url(#${glowFilterId})`,
            }}
          />
        </g>
      </svg>
    </div>
  );
};

export interface BrandIdentityLogoProps {
  size?: number;
  isHovered?: boolean;
  className?: string;
  badgeText?: string;
  showSubtitle?: boolean;
  subtitleText?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const BrandIdentityLogo: React.FC<BrandIdentityLogoProps> = ({
  size = 26,
  isHovered: controlledHover,
  className = '',
  badgeText = 'PIXEL',
  showSubtitle = false,
  subtitleText = '',
  onClick,
  onContextMenu,
}) => {
  const [internalHover, setInternalHover] = useState(false);
  const activeHover = controlledHover !== undefined ? controlledHover : internalHover;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      className={`inline-flex items-center gap-2.5 group cursor-pointer select-none ${className}`}
    >
      {/* Wolf Mascot */}
      <BrandWolfMascot size={size} isHovered={activeHover} />

      {/* Name and Underline Container */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span
            className="font-extrabold tracking-widest text-white text-sm transition-colors duration-200 group-hover:text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            SCYAN
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all duration-300 ${
              activeHover
                ? 'bg-[#f59442]/15 text-[#f59442] border-[#f59442]/50 shadow-[0_0_8px_rgba(245,148,66,0.3)]'
                : 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 shadow-transparent'
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {badgeText}
          </span>
        </div>

        {/* Subtitle if specified */}
        {showSubtitle && subtitleText && (
          <span
            className="text-[10px] text-[#94a3b8] leading-none mt-0.5 mb-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {subtitleText}
          </span>
        )}

        {/* The line strictly positioned UNDER the name */}
        <div className="relative mt-1 h-[2px] w-full">
          {/* Ambient warm orange glow below and above line */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ease-out pointer-events-none ${
              activeHover
                ? 'opacity-100 shadow-[0_0_8px_rgba(245,148,66,0.7)]'
                : 'opacity-0 shadow-transparent'
            }`}
          />

          {/* Clipped line track */}
          <div className="relative h-full w-full overflow-hidden rounded-full">
            {/* Base resting line: continuous cyan-to-violet gradient */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, #00f0ff 0%, #a953f6 100%)',
              }}
            />

            {/* Active animated line with shifting orange accent */}
            <div
              className={`absolute inset-0 rounded-full overflow-hidden transition-all duration-300 ease-out pointer-events-none ${
                activeHover ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex w-[200%] h-full animate-[brandLineSlide_2.5s_linear_infinite]">
                <div
                  className="w-1/2 h-full shrink-0"
                  style={{
                    background:
                      'linear-gradient(90deg, #00f0ff 0%, #a953f6 35%, #f59442 50%, #a953f6 65%, #00f0ff 100%)',
                  }}
                />
                <div
                  className="w-1/2 h-full shrink-0"
                  style={{
                    background:
                      'linear-gradient(90deg, #00f0ff 0%, #a953f6 35%, #f59442 50%, #a953f6 65%, #00f0ff 100%)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandIdentityLogo;
