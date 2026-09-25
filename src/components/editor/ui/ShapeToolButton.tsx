import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ToolType } from '../types';
import { getContrastColor } from '../../../core/colorUtils';

export interface ToolVariant {
  tool: ToolType;
  icon: React.ReactNode;
  title: string;
  label: string;
}

export interface ShapeToolButtonProps {
  variants?: ToolVariant[];

  outlineTool?: ToolType;
  filledTool?: ToolType;
  outlineIcon?: React.ReactNode;
  filledIcon?: React.ReactNode;
  outlineTitle?: string;
  filledTitle?: string;
  outlineLabel?: string;
  filledLabel?: string;

  // Semantic aliases for non-outline/filled pairs (e.g. line/arrow)
  primaryTool?: ToolType;
  secondaryTool?: ToolType;
  primaryIcon?: React.ReactNode;
  secondaryIcon?: React.ReactNode;
  primaryTitle?: string;
  secondaryTitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;

  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeDrawColor?: string;
}

export const ShapeToolButton: React.FC<ShapeToolButtonProps> = ({
  variants,
  outlineTool,
  filledTool,
  outlineIcon,
  filledIcon,
  outlineTitle,
  filledTitle,
  outlineLabel,
  filledLabel,
  primaryTool,
  secondaryTool,
  primaryIcon,
  secondaryIcon,
  primaryTitle,
  secondaryTitle,
  primaryLabel,
  secondaryLabel,
  activeTool,
  setActiveTool,
  activeDrawColor = '#00e5a3',
}) => {
  const allVariants: ToolVariant[] = variants ?? [
    {
      tool: (primaryTool ?? outlineTool)!,
      icon: primaryIcon ?? outlineIcon,
      title: primaryTitle ?? outlineTitle ?? '',
      label: primaryLabel ?? outlineLabel ?? 'Outline',
    },
    {
      tool: (secondaryTool ?? filledTool)!,
      icon: secondaryIcon ?? filledIcon,
      title: secondaryTitle ?? filledTitle ?? '',
      label: secondaryLabel ?? filledLabel ?? 'Filled',
    },
  ];

  const activeVariantIndex = allVariants.findIndex((v) => v.tool === activeTool);
  const isActive = activeVariantIndex !== -1;

  const [lastVariantIndex, setLastVariantIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = isActive ? activeVariantIndex : lastVariantIndex;
  const currentVariant = allVariants[currentIndex] || allVariants[0];
  const altVariants = allVariants.filter((_, idx) => idx !== currentIndex);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const clampedY =
        typeof window !== 'undefined'
          ? Math.max(48, Math.min(window.innerHeight - 48, centerY))
          : centerY;
      setFlyoutPos({
        top: clampedY,
        left: rect.right + 8,
      });
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const handleFlyoutMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleFlyoutMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const handleMainClick = () => {
    if (!isActive) {
      setActiveTool(currentVariant.tool);
    } else {
      const nextIndex = (currentIndex + 1) % allVariants.length;
      const nextVariant = allVariants[nextIndex];
      setActiveTool(nextVariant.tool);
      setLastVariantIndex(nextIndex);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleMainClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`bwpx-tool-btn w-8 h-8 rounded flex items-center justify-center transition cursor-pointer relative ${
          isActive
            ? 'active shadow-md ring-1 ring-white/30'
            : 'text-slate-400 hover:bg-[#202530] hover:text-white'
        }`}
        style={{
          backgroundColor: isActive ? activeDrawColor : 'transparent',
          color: isActive ? getContrastColor(activeDrawColor) : undefined,
        }}
        title={currentVariant.title}
      >
        {currentVariant.icon}

        {/* Corner indicator showing multi-option shape */}
        <svg
          className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 pointer-events-none ${
            isActive ? 'opacity-80' : 'text-slate-500 opacity-60'
          }`}
          viewBox="0 0 6 6"
        >
          <polygon points="6,2 6,6 2,6" fill="currentColor" />
        </svg>
      </button>

      {isHovered && flyoutPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 flex items-center bg-[#161922] border border-[#2d3548] rounded-xl shadow-2xl p-3 gap-2.5 backdrop-blur-md"
            style={{
              top: flyoutPos.top,
              left: flyoutPos.left,
              transform: 'translateY(-50%)',
            }}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
          >
            {/* Invisible hover bridge to prevent premature mouseleave across the gap */}
            <div className="absolute -left-3 -top-2 -bottom-2 w-3 pointer-events-auto" />

            {altVariants.map((alt) => (
              <button
                key={alt.tool}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTool(alt.tool);
                  const newIdx = allVariants.findIndex((v) => v.tool === alt.tool);
                  if (newIdx !== -1) setLastVariantIndex(newIdx);
                  setIsHovered(false);
                }}
                className="group flex flex-col items-center justify-center min-w-[72px] px-3 py-2.5 rounded-lg bg-[#1e2330] hover:bg-[#282f42] active:bg-[#323b52] border border-[#2b3345] hover:border-[#3e4a64] text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm hover:shadow"
                title={alt.title}
                aria-label={alt.label || alt.title}
              >
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[#14161f] group-hover:bg-[#1b212f] text-slate-300 group-hover:text-white transition-colors mb-1.5 [&>svg]:w-5 [&>svg]:h-5">
                  {alt.icon}
                </div>
                <span className="font-mono text-[11px] font-medium text-slate-300 group-hover:text-white whitespace-nowrap">
                  {alt.label}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export const MultiVariantToolButton = ShapeToolButton;
