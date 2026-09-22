import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PeerAvatar } from '../PeerAvatar';

describe('PeerAvatar component', () => {
  it('renders initials for hyphenated city-animal name', () => {
    const html = renderToString(<PeerAvatar name="montreal-wolf" color="#06b6d4" />);

    expect(html).toContain('MW');
    expect(html).toContain('background-color:#06b6d4');
  });

  it('renders initials for space separated name', () => {
    const html = renderToString(<PeerAvatar name="tokyo kitsune" color="#3b82f6" />);

    expect(html).toContain('TK');
    expect(html).toContain('background-color:#3b82f6');
  });

  it('uses 2 first letters when name has no hyphen or space', () => {
    const html = renderToString(<PeerAvatar name="Scyan" color="#10b981" />);

    expect(html).toContain('SC');
  });

  it('renders online dot when showOnlineDot is true', () => {
    const html = renderToString(
      <PeerAvatar name="paris-renard" color="#f43f5e" showOnlineDot={true} />
    );

    expect(html).toContain('bg-emerald-400');
  });

  it('displays tooltip when showTooltip is true', () => {
    const html = renderToString(
      <PeerAvatar name="berlin-baer" color="#eab308" showTooltip={true} />
    );

    expect(html).toContain('title="berlin-baer"');
  });
});
