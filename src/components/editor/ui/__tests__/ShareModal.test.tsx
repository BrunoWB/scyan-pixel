import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ShareModal, type ShareModalProps } from '../ShareModal';

describe('ShareModal component', () => {
  const defaultProps: ShareModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    profile: {
      id: 'test-id',
      name: 'montreal-wolf',
      color: '#06b6d4',
    },
    onUpdateProfile: vi.fn(),
    onRandomizeName: vi.fn(),
    onRandomizeColor: vi.fn(),
    onRandomizeProfile: vi.fn(),
    roomId: 'scyan-room-42',
    shareUrl: 'http://localhost:5173/#room=scyan-room-42',
    onGenerateNewRoom: vi.fn(() => 'new-room-123'),
    connectedPeers: [],
  };

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(<ShareModal {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('renders user profile with auto-generated city-animal name and initials', () => {
    const html = renderToString(<ShareModal {...defaultProps} />);

    expect(html).toContain('Canvas Collaboration &amp; Share');
    expect(html).toContain('montreal-wolf');
    expect(html).toContain('[MW]');
    expect(html).toContain('background-color:#06b6d4');
  });

  it('renders room ID and share link', () => {
    const html = renderToString(<ShareModal {...defaultProps} />);

    expect(html).toContain('scyan-room-42');
    expect(html).toContain('http://localhost:5173/#room=scyan-room-42');
    expect(html).toContain('Copy Link');
  });

  it('renders friendly empty state when no peers are connected yet', () => {
    const html = renderToString(<ShareModal {...defaultProps} connectedPeers={[]} />);

    expect(html).toContain('No peers connected yet');
    expect(html).toContain('0 online');
  });

  it('renders connected peers list when peers are present', () => {
    const peers = [
      { id: 'p1', name: 'tokyo-kitsune', color: '#f43f5e' },
      { id: 'p2', name: 'paris-renard', color: '#10b981' },
    ];
    const html = renderToString(<ShareModal {...defaultProps} connectedPeers={peers} />);

    expect(html).toContain('2 online');
    expect(html).toContain('tokyo-kitsune');
    expect(html).toContain('paris-renard');
    expect(html).toContain('TK');
    expect(html).toContain('PR');
    expect(html).not.toContain('No peers connected yet');
  });

  it('shows validation warning when peer name is less than 2 characters', () => {
    const html = renderToString(
      <ShareModal
        {...defaultProps}
        profile={{
          id: 'test-id',
          name: 'a',
          color: '#06b6d4',
        }}
      />
    );

    expect(html).toContain('Name must have at least 2 letters.');
  });
});
