import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  RoomStorageModal,
  RoomThumbnail,
  type RoomStorageModalProps,
} from '../RoomStorageModal';
import type { RoomMetadata } from '../../../../core/peer/peerRoomStorage';

describe('RoomStorageModal component', () => {
  const mockSavedRooms: RoomMetadata[] = [
    {
      roomId: 'uuid-1',
      roomName: 'montreal-wolf-roar',
      roomUuid: 'uuid-1',
      createdAt: 1700000000000,
      updatedAt: 1700000100000,
      width: 64,
      height: 64,
      pixelCount: 142,
    },
    {
      roomId: 'uuid-2',
      roomName: 'tokyo-kitsune-leap',
      roomUuid: 'uuid-2',
      createdAt: 1699990000000,
      updatedAt: 1699995000000,
      width: 32,
      height: 32,
      pixelCount: 50,
    },
  ];

  const defaultProps: RoomStorageModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    savedRooms: mockSavedRooms,
    currentRoomId: 'montreal-wolf-roar',
    onLoadRoom: vi.fn(),
    onCopyToNewSave: vi.fn(),
    onDeleteRoom: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('renders modal header, title, and room cards when open', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} />);

    expect(html).toContain('Saved Rooms &amp; Canvas Snapshots');
    expect(html).toContain('Load previous rooms, copy to fresh saves, or manage local files');
    expect(html).toContain('montreal-wolf-roar');
    expect(html).toContain('tokyo-kitsune-leap');
    expect(html).toContain('64×64');
    expect(html).toContain('142 px');
    expect(html).toContain('32×32');
    expect(html).toContain('50 px');
    expect(html).toContain('2 rooms saved locally');
  });

  it('renders "Active Room" badge for currently active room', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} currentRoomId="montreal-wolf-roar" />);

    expect(html).toContain('Active Room');
  });

  it('renders empty state when savedRooms is empty', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} savedRooms={[]} />);

    expect(html).toContain('No Saved Rooms Found');
    expect(html).toContain('Your canvas rooms are automatically saved when you draw');
    expect(html).toContain('0 rooms saved locally');
  });

  it('renders action buttons on each room card: Load, Copy to New, and Delete', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} />);

    // Load action button
    expect(html).toContain('aria-label="Load room tokyo-kitsune-leap"');
    expect(html).toContain('title="Load room and reconcile with peers"');

    // Copy to new save (Fork) action button
    expect(html).toContain('aria-label="Copy tokyo-kitsune-leap to new save"');
    expect(html).toContain('title="Copy to new save with fresh ID (avoid peer collisions)"');
    expect(html).toContain('Copy to New');

    // Delete action button
    expect(html).toContain('aria-label="Delete tokyo-kitsune-leap"');
    expect(html).toContain('title="Delete snapshot"');
  });

  it('renders RoomThumbnail canvas with correct data attributes and styling', () => {
    const html = renderToString(<RoomThumbnail roomName="test-room" width={52} height={52} />);

    expect(html).toContain('data-slot="room-thumbnail"');
    expect(html).toContain('data-room-name="test-room"');
    expect(html).toContain('width="52"');
    expect(html).toContain('height="52"');
    expect(html).toContain('image-rendering:pixelated');
    expect(html).toContain('object-fit:contain');
    expect(html).toContain('aria-label="Thumbnail preview for test-room"');
  });

  it('renders modal and connects all callback handlers', () => {
    const onLoadRoom = vi.fn();
    const onCopyToNewSave = vi.fn();
    const onDeleteRoom = vi.fn();
    const onClose = vi.fn();

    const html = renderToString(
      <RoomStorageModal
        {...defaultProps}
        onLoadRoom={onLoadRoom}
        onCopyToNewSave={onCopyToNewSave}
        onDeleteRoom={onDeleteRoom}
        onClose={onClose}
      />
    );

    expect(html).toContain('Saved Rooms &amp; Canvas Snapshots');
    expect(html).toContain('Load');
    expect(html).toContain('Copy to New');
    expect(html).toContain('aria-label="Delete montreal-wolf-roar"');
  });

  it('renders refresh button for tracker peer counts in modal header', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} />);

    expect(html).toContain('aria-label="Refresh peer counts"');
    expect(html).toMatch(/title="(?:Refresh peer counts|Checking tracker swarms\.\.\.)"/);
  });

  it('renders live connected peer count for currently active room', () => {
    const mockConnectedPeers = [
      { id: 'peer-1', name: 'Alice', color: '#ff0000', joinedAt: Date.now() },
      { id: 'peer-2', name: 'Bob', color: '#00ff00', joinedAt: Date.now() },
    ];

    const html = renderToString(
      <RoomStorageModal
        {...defaultProps}
        currentRoomId="montreal-wolf-roar"
        connectedPeers={mockConnectedPeers}
      />
    );

    expect(html).toContain('data-slot="room-peer-badge"');
    expect(html).toContain('2 online');
    expect(html).toContain('data-room="montreal-wolf-roar"');
  });

  it('renders checking indicator for other saved rooms when scrape is in flight', () => {
    const multiRooms = [
      ...mockSavedRooms,
      {
        roomId: 'room-remote',
        roomName: 'other-remote-room',
        roomUuid: 'uuid-remote',
        createdAt: 1000,
        updatedAt: 2000,
        width: 32,
        height: 32,
        pixelCount: 5,
      },
    ];

    const html = renderToString(
      <RoomStorageModal
        {...defaultProps}
        savedRooms={multiRooms}
        currentRoomId="montreal-wolf-roar"
      />
    );

    expect(html).toContain('data-room="other-remote-room"');
    expect(html).toContain('checking...');
  });

  it('renders scraping indicator in modal footer when loading', () => {
    const html = renderToString(<RoomStorageModal {...defaultProps} />);
    expect(html).toContain('scraping...');
  });
});
