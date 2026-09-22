import React from 'react';
import { ColorPicker } from './color-picker/ColorPicker';

export interface BgPreset {
  name: string;
  color: string;
}

// oxlint-disable-next-line react/only-export-components
export const DEFAULT_BG_PRESETS: BgPreset[] = [
  { name: 'OLED Black', color: '#000000' },
  { name: 'Dark Slate', color: '#0f1013' },
  { name: 'Studio Dark', color: '#12141a' },
  { name: 'Cyber Indigo', color: '#0e1322' },
  { name: 'Deep Navy', color: '#08101a' },
  { name: 'Matrix CRT', color: '#051a0e' },
  { name: 'Phosphor Dark', color: '#061206' },
  { name: 'Amber Dark', color: '#140d04' },
  { name: 'GameBoy Dark', color: '#0f380f' },
  { name: 'GameBoy Classic', color: '#9bbc0f' },
  { name: 'Charcoal', color: '#202530' },
  { name: 'Slate Gray', color: '#334155' },
  { name: 'Neutral Gray', color: '#52525b' },
  { name: 'Light Slate', color: '#e2e8f0' },
  { name: 'Pure White', color: '#ffffff' },
];

export interface BackgroundPickerProps {
  color: string;
  onChange: (hex: string) => void;
  onChangeCommit?: (hex: string) => void;
  onOpenCanvasEyedropper?: () => void;
  disabled?: boolean;
  presets?: BgPreset[];
  title?: string;
}

export const BackgroundPicker: React.FC<BackgroundPickerProps> = ({
  color,
  onChange,
  onChangeCommit,
  onOpenCanvasEyedropper,
  disabled = false,
  title = 'Canvas Background Color',
}) => {
  return (
    <ColorPicker
      color={color}
      onChange={onChange}
      onChangeCommit={onChangeCommit}
      onOpenCanvasEyedropper={onOpenCanvasEyedropper}
      disabled={disabled}
      title={title}
    />
  );
};
