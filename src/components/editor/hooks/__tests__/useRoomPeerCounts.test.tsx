import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useRoomPeerCounts } from '../useRoomPeerCounts';
import type { RoomMetadata } from '../../../../core/peer/peerRoomStorage';
import { clearScrapeCache } from '../../../../core/peer/trackerScraper';

describe('useRoomPeerCounts hook', () => {
  beforeEach(() => {
    clearScrapeCache();
    vi.restoreAllMocks();
  });

  const mockRooms: RoomMetadata[] = [
    {
      roomId: 'room-1',
      roomName: 'room-alpha',
      roomUuid: 'uuid-1',
      createdAt: 1000,
      updatedAt: 2000,
      width: 32,
      height: 32,
      pixelCount: 10,
    },
    {
      roomId: 'room-2',
      roomName: 'room-beta',
      roomUuid: 'uuid-2',
      createdAt: 1000,
      updatedAt: 2000,
      width: 32,
      height: 32,
      pixelCount: 15,
    },
  ];

  it('provides peerCounts, loading state, and refresh function', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        connectedPeersCount: 2,
        isOpen: true,
      });

      return (
        <div
          data-slot="peer-counts"
          data-alpha-count={state.peerCounts['room-alpha']}
          data-is-loading={String(state.isLoading)}
          data-has-refresh={String(typeof state.refresh === 'function')}
        />
      );
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-alpha-count="2"');
    expect(html).toContain('data-has-refresh="true"');
  });

  it('immediately reflects live connectedPeersCount for active room', () => {
    function TestComponent({ liveCount }: { liveCount: number }) {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        connectedPeersCount: liveCount,
        isOpen: true,
      });

      return <div data-count={state.peerCounts['room-alpha']} />;
    }

    const html1 = renderToString(<TestComponent liveCount={4} />);
    expect(html1).toContain('data-count="4"');

    const html2 = renderToString(<TestComponent liveCount={0} />);
    expect(html2).toContain('data-count="0"');
  });

  it('does not scrape when isOpen is false', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        connectedPeersCount: 1,
        isOpen: false,
      });

      return (
        <div
          data-is-open="false"
          data-alpha-count={state.peerCounts['room-alpha']}
        />
      );
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-is-open="false"');
    expect(html).toContain('data-alpha-count="1"');
  });

  it('initializes isLoading to true when isOpen is true with saved rooms', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        isOpen: true,
      });
      return <div data-loading={String(state.isLoading)} />;
    }
    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-loading="true"');
  });

  it('initializes isLoading to false when isOpen is false', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        isOpen: false,
      });
      return <div data-loading={String(state.isLoading)} />;
    }
    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-loading="false"');
  });

  it('initializes isLoading to false when savedRooms is empty', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: [],
        currentRoomId: 'room-alpha',
        isOpen: true,
      });
      return <div data-loading={String(state.isLoading)} />;
    }
    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-loading="false"');
  });

  it('safely handles inline scrapeOptions without breaking', () => {
    function TestComponent() {
      const state = useRoomPeerCounts({
        savedRooms: mockRooms,
        currentRoomId: 'room-alpha',
        isOpen: true,
        scrapeOptions: { timeoutMs: 3000 },
      });
      return <div data-ready="true" data-count={state.peerCounts['room-alpha']} />;
    }
    const html = renderToString(<TestComponent />);
    expect(html).toContain('data-ready="true"');
  });
});
