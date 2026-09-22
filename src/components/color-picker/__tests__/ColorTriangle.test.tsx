import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ColorTriangle } from '../ColorTriangle';

describe('ColorTriangle', () => {
  it('renders SVG with requested color fill and equilateral triangle points', () => {
    const html = renderToString(
      <ColorTriangle color="#12141a" title="Background Color" />
    );

    expect(html).toContain('fill="#12141a"');
    expect(html).toContain('points="32,55.5 0,0 64,0"');
    expect(html).toContain('title="Background Color"');
    expect(html).toContain('aria-label="Background Color"');
    expect(html).toContain('width:64px');
    expect(html).toContain('height:56px');
  });

  it('renders active cyan stroke and glow when isOpen is true', () => {
    const html = renderToString(
      <ColorTriangle color="#00f0ff" isOpen={true} />
    );

    expect(html).toContain('stroke="#00f0ff"');
    expect(html).toContain('rgba(0, 240, 255, 0.5)');
    expect(html).toContain('scale-105');
  });

  it('renders resting subtle border when isOpen is false', () => {
    const html = renderToString(
      <ColorTriangle color="#000000" isOpen={false} />
    );

    expect(html).toContain('stroke="rgba(255, 255, 255, 0.45)"');
    expect(html).toContain('hover:scale-105');
  });

  it('renders optional label when provided', () => {
    const html = renderToString(
      <ColorTriangle color="#334155" label="BG" />
    );

    expect(html).toContain('BG');
  });

  it('handles disabled state', () => {
    const html = renderToString(
      <ColorTriangle color="#ffffff" disabled={true} />
    );

    expect(html).toContain('disabled=""');
  });
});
