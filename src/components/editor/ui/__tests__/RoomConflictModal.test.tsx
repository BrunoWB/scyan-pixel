import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RoomConflictModal } from '../RoomConflictModal';
import type { RoomConflictEvent } from '../../../../core/peer/peerSessionManager';

describe('RoomConflictModal', () => {
  const mockConflict: RoomConflictEvent = {
    roomName: 'montreal-lion-roar',
    localUuid: 'uuid-local-1111-2222-3333',
    remoteUuid: 'uuid-remote-4444-5555-6666',
    remotePeerId: 'peer-bob',
  };

  it('renders nothing when not open or no conflict', () => {
    const html1 = renderToString(
      <RoomConflictModal
        isOpen={false}
        conflict={mockConflict}
        onDiscardLocalAndJoin={vi.fn()}
        onKeepLocal={vi.fn()}
      />
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <RoomConflictModal
        isOpen={true}
        conflict={null}
        onDiscardLocalAndJoin={vi.fn()}
        onKeepLocal={vi.fn()}
      />
    );
    expect(html2).toBe('');
  });

  it('renders conflict details, room name, UUIDs, and actions when open', () => {
    const html = renderToString(
      <RoomConflictModal
        isOpen={true}
        conflict={mockConflict}
        onDiscardLocalAndJoin={vi.fn()}
        onKeepLocal={vi.fn()}
      />
    );

    expect(html).toContain('Room ID Mismatch');
    expect(html).toContain('montreal-lion-roar');
    expect(html).toContain('Discard local and join peers');
    expect(html).toContain('Keep local');
    expect(html).toContain('uuid-local-1111-2');
    expect(html).toContain('uuid-remote-4444-');
  });
});
