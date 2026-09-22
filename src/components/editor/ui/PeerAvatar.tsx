import React from 'react';
import { getPeerInitials } from '../../../core/peer/peerIdentity';
import { getContrastColor } from '../../../core/colorUtils';

export type PeerAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface PeerAvatarProps {
  name: string;
  color: string;
  size?: PeerAvatarSize;
  showTooltip?: boolean;
  showOnlineDot?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<PeerAvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: 'w-5 h-5', text: 'text-[9px] font-bold', dot: 'w-1.5 h-1.5 bottom-0 right-0' },
  sm: { container: 'w-6 h-6', text: 'text-[10px] font-bold', dot: 'w-1.5 h-1.5 bottom-0 right-0' },
  md: { container: 'w-8 h-8', text: 'text-xs font-bold', dot: 'w-2 h-2 bottom-0 right-0' },
  lg: { container: 'w-11 h-11', text: 'text-sm font-bold', dot: 'w-2.5 h-2.5 bottom-0.5 right-0.5' },
  xl: { container: 'w-14 h-14', text: 'text-base font-extrabold', dot: 'w-3 h-3 bottom-0.5 right-0.5' },
};

export const PeerAvatar: React.FC<PeerAvatarProps> = ({
  name,
  color,
  size = 'md',
  showTooltip = false,
  showOnlineDot = false,
  className = '',
}) => {
  const initials = getPeerInitials(name) || '??';
  const textColor = getContrastColor(color);
  const sizeConfig = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none shadow-xs border border-white/20 transition-transform hover:scale-105 ${sizeConfig.container} ${className}`}
      style={{ backgroundColor: color, color: textColor }}
      title={showTooltip ? name : undefined}
      aria-label={name}
    >
      <span className={`tracking-wider uppercase leading-none ${sizeConfig.text}`}>
        {initials}
      </span>

      {showOnlineDot && (
        <span
          className={`absolute rounded-full bg-emerald-400 ring-2 ring-[#12141a] ${sizeConfig.dot}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
