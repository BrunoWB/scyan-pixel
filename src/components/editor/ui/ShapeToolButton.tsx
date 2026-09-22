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
  activeDrawColor: string;
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
  activeDrawColor,
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
      setFlyoutPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 6,
      });
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 160);
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
    }, 160);
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
        className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer relative ${
          isActive
            ? 'shadow-md ring-1 ring-white/30'
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
            className="fixed z-50 flex items-center bg-[#181b24] border border-[#2d3446] rounded-md shadow-xl p-1 gap-1.5 backdrop-blur-sm"
            style={{
              top: flyoutPos.top,
              left: flyoutPos.left,
              transform: 'translateY(-50%)',
            }}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
          >
            {/* Invisible hover bridge to prevent premature mouseleave */}
            <div className="absolute -left-2 top-0 bottom-0 w-2" />

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
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#202532] hover:bg-[#2b3242] text-slate-200 hover:text-white transition cursor-pointer text-xs font-mono"
                title={alt.title}
              >
                <span className="text-slate-300">{alt.icon}</span>
                <span className="font-medium text-[11px] whitespace-nowrap">{alt.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export const MultiVariantToolButton = ShapeToolButton;
