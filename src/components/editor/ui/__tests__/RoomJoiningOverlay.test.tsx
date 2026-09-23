import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RoomJoiningOverlay } from '../RoomJoiningOverlay';

describe('RoomJoiningOverlay', () => {
  it('renders nothing when status is idle or connected', () => {
    const idleHtml = renderToString(
      <RoomJoiningOverlay
        status="idle"
        roomName="alpha-room"
        onRetry={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );
    expect(idleHtml).toBe('');

    const connectedHtml = renderToString(
      <RoomJoiningOverlay
        status="connected"
        roomName="alpha-room"
        onRetry={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );
    expect(connectedHtml).toBe('');

    const checkingHtml = renderToString(
      <RoomJoiningOverlay
        status="checking_local"
        roomName="alpha-room"
        onRetry={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );
    expect(checkingHtml).toBe('');
  });

  it('renders connecting state with spinner and room name when status is connecting', () => {
    const html = renderToString(
      <RoomJoiningOverlay
        status="connecting"
        roomName="cyber-canvas"
        onRetry={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="room-joining-overlay"');
    expect(html).toContain('Connecting to Room');
    expect(html).toContain('cyber-canvas');
    expect(html).toContain('Waiting for peers on the network to synchronize the canvas');
  });

  it('renders timed_out state with Try Reconnect and New Canvas buttons', () => {
    const html = renderToString(
      <RoomJoiningOverlay
        status="timed_out"
        roomName="cyber-canvas"
        onRetry={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="room-joining-overlay"');
    expect(html).toContain('Room Unavailable');
    expect(html).toContain('cyber-canvas');
    expect(html).toContain('Try Reconnect');
    expect(html).toContain('New Canvas');
  });
});

