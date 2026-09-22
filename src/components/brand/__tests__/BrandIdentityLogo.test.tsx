import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BrandIdentityLogo, BrandWolfMascot } from '../BrandIdentityLogo';

describe('BrandWolfMascot', () => {
  it('renders rest state with hidden pupils and hidden background glow', () => {
    const html = renderToString(<BrandWolfMascot size={26} isHovered={false} />);
    expect(html).toContain('opacity-0');
    expect(html).not.toContain('animate-[pulseOrangeReverse');
  });

  it('renders awakened state with Warning Hover (#f59442) and reverse pulse animation', () => {
    const html = renderToString(<BrandWolfMascot size={26} isHovered={true} />);

    // Background glow uses Warning Hover rgba(245, 148, 66, ...) and pulseOrangeGlow
    expect(html).toContain('rgba(245, 148, 66, 0.65)');
    expect(html).toContain('animate-[pulseOrangeGlow_1.5s_ease-in-out_infinite]');

    // Orange pupils use Warning Hover fill and animate in reverse sense
    expect(html).toContain('fill="#f59442"');
    expect(html).toContain('animate-[pulseOrangeReverse_1.5s_ease-in-out_infinite]');
    expect(html).toContain('flood-color="#f59442"');
  });
});

describe('BrandIdentityLogo', () => {
  it('renders in rest mode with standard cyan highlights and smooth transition classes', () => {
    const html = renderToString(<BrandIdentityLogo size={26} isHovered={false} />);
    expect(html).toContain('SCYAN');
    expect(html).toContain('PIXEL');
    expect(html).toContain('text-[#00f0ff]');
    expect(html).toContain('linear-gradient(90deg, #00f0ff 0%, #a953f6 100%)');
    expect(html).toContain('transition-all duration-300 ease-out');
    expect(html).toContain('shadow-transparent');
  });

  it('renders in hovered mode with Warning Hover (#f59442) on badge and underline', () => {
    const html = renderToString(<BrandIdentityLogo size={26} isHovered={true} />);

    // PIXEL badge in Warning Hover
    expect(html).toContain('text-[#f59442]');
    expect(html).toContain('border-[#f59442]/50');

    // Horizon underline containing #f59442
    expect(html).toContain('#f59442 50%');
    expect(html).toContain('rgba(245,148,66,0.7)');

    // Mascot has reverse glow
    expect(html).toContain('animate-[pulseOrangeReverse_1.5s_ease-in-out_infinite]');
  });

  it('supports custom badgeText', () => {
    const html = renderToString(<BrandIdentityLogo size={26} badgeText="CUSTOM" />);
    expect(html).toContain('CUSTOM');
  });
});
