import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BackgroundPicker, DEFAULT_BG_PRESETS } from '../BackgroundPicker';

describe('BackgroundPicker', () => {
  it('renders trigger button as a big triangle with selector transition matching color picker', () => {
    const html = renderToString(
      <BackgroundPicker color="#0f1013" onChange={() => {}} />
    );

    // Trigger button properties: signature big triangle with color fill and 64x56 dimensions
    expect(html).toContain('Canvas Background Color');
    expect(html).toContain('fill="#0f1013"');
    expect(html).toContain('points="0,37 -32,-18.5 32,-18.5"');
    expect(html).toContain('width:64px');
    expect(html).toContain('height:56px');
  });

  it('renders frosted HUD structure with matched glassmorphism aesthetics', () => {
    const html = renderToString(
      <BackgroundPicker color="#000000" onChange={() => {}} />
    );

    // Frosted HUD container with 400x220 dimensions matching ColorPicker HUD
    expect(html).toContain('w-[400px]');
    expect(html).toContain('h-[220px]');
    expect(html).toContain('bg-[#131722]/95');
    expect(html).toContain('backdrop-blur-xl');
    expect(html).toContain('rounded-3xl');
  });

  it('renders the ColorInputs panel with RGB/HSV mode switcher and eyedropper', () => {
    const html = renderToString(
      <BackgroundPicker color="#000000" onChange={() => {}} />
    );

    // ColorInputs panel
    expect(html).toContain('RGB');
    expect(html).toContain('HSV');
    expect(html).toContain('Pick color from screen or canvas');
    expect(html).toContain('placeholder="RRGGBB"');
  });

  it('renders the circular hue wheel and chromatic triangle transition structure', () => {
    const html = renderToString(
      <BackgroundPicker color="#ff0000" onChange={() => {}} />
    );

    // Conic gradient hue wheel
    expect(html).toContain('conic-gradient');
    // SV gradient clip path
    expect(html).toContain('clipPath');
  });

  it('exports DEFAULT_BG_PRESETS for compatibility', () => {
    expect(DEFAULT_BG_PRESETS.length).toBeGreaterThan(0);
    expect(DEFAULT_BG_PRESETS[0].name).toBe('OLED Black');
  });
});
