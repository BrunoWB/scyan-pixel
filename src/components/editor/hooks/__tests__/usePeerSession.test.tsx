import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { usePeerSession } from '../usePeerSession';

describe('usePeerSession hook', () => {
  it('provides complete collaborative session API and initialized profile', () => {
    function TestComponent() {
      const session = usePeerSession();
      const summary = {
        hasId: Boolean(session.profile.id),
        name: session.profile.name,
        hasColor: Boolean(session.profile.color),
        roomId: session.roomId,
        peersCount: session.connectedPeers.length,
        hasBroadcastPixels: typeof session.broadcastPixels === 'function',
        hasBroadcastClear: typeof session.broadcastClear === 'function',
        hasBroadcastSnapshot: typeof session.broadcastSnapshot === 'function',
        hasBroadcastMutation: typeof session.broadcastMutation === 'function',
        hasGenerateNewRoom: typeof session.generateNewRoom === 'function',
        hasGetShareUrl: typeof session.getShareUrl === 'function',
        hasUpdateProfile: typeof session.updateProfile === 'function',
      };
      return (
        <div id="session-summary" data-json={JSON.stringify(summary)}>
          {session.profile.name}
        </div>
      );
    }

    const html = renderToString(<TestComponent />);
    const match = html.match(/data-json="([^"]+)"/);
    expect(match).not.toBeNull();

    const summary = JSON.parse(match![1].replace(/&quot;/g, '"'));
    expect(summary.hasId).toBe(true);
    expect(summary.name).toBeTruthy();
    expect(summary.hasColor).toBe(true);
    expect(summary.roomId).toBeTruthy();
    expect(summary.peersCount).toBe(0);
    expect(summary.hasBroadcastPixels).toBe(true);
    expect(summary.hasBroadcastClear).toBe(true);
    expect(summary.hasBroadcastSnapshot).toBe(true);
    expect(summary.hasBroadcastMutation).toBe(true);
    expect(summary.hasGenerateNewRoom).toBe(true);
    expect(summary.hasGetShareUrl).toBe(true);
    expect(summary.hasUpdateProfile).toBe(true);
    expect(html).toContain(summary.name);
  });

  it('exposes methods to manipulate share modal state', () => {
    function TestComponent() {
      const session = usePeerSession();
      return <div>{session.isShareModalOpen ? 'open' : 'closed'}</div>;
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('closed');
  });

  it('wires roomFactory to broadcast mutations and handle callbacks', () => {
    const sentActions: { type: string; data: any }[] = [];
    const actionHandlers = new Map<string, (data: any, ctx: { peerId: string }) => void>();

    const mockFactory = () => {
      return {
        makeAction: (type: string) => {
          return {
            send: async (data: any) => {
              sentActions.push({ type, data });
            },
            set onMessage(handler: any) {
              actionHandlers.set(type, handler);
            },
            get onMessage() {
              return actionHandlers.get(type) || null;
            },
          };
        },
        leave: async () => {},
        onPeerJoin: null,
        onPeerLeave: null,
      } as any;
    };

    function TestComponent() {
      const session = usePeerSession({
        roomFactory: mockFactory,
      });

      // Invoke broadcasting within component
      session.broadcastPixels([[10, 12, '#3b82f6']]);
      session.broadcastClear();
      session.broadcastSnapshot({
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[1, 1, '#ff0000']],
      });

      return <div>session-active</div>;
    }

    const html = renderToString(<TestComponent />);
    expect(html).toContain('session-active');

    // Verify broadcastPixels sends mutation
    expect(sentActions.some((a) => a.type === 'mutation' && a.data.type === 'pixels')).toBe(true);

    // Verify broadcastClear sends clear mutation
    expect(sentActions.some((a) => a.type === 'mutation' && a.data.type === 'clear')).toBe(true);

    // Verify broadcastSnapshot sends snapshot
    expect(sentActions.some((a) => a.type === 'snapshot')).toBe(true);
  });

  it('exposes room snapshot storage and conflict resolution APIs', () => {
    function TestComponent() {
      const session = usePeerSession();
      const summary = {
        hasSaveRoom: typeof session.saveRoom === 'function',
        hasRestoreRoom: typeof session.restoreRoom === 'function',
        hasDeleteRoom: typeof session.deleteRoom === 'function',
        hasEnsureActiveRoom: typeof session.ensureActiveRoom === 'function',
        hasResolveDiscard: typeof session.resolveConflictDiscardLocalAndJoin === 'function',
        hasResolveKeep: typeof session.resolveConflictKeepLocal === 'function',
        isSavedRoomsArray: Array.isArray(session.savedRooms),
        isConflictModalOpen: session.isConflictModalOpen,
      };
      return <div id="session-storage-summary" data-json={JSON.stringify(summary)} />;
    }

    const html = renderToString(<TestComponent />);
    const match = html.match(/data-json="([^"]+)"/);
    expect(match).not.toBeNull();

    const summary = JSON.parse(match![1].replace(/&quot;/g, '"'));
    expect(summary.hasSaveRoom).toBe(true);
    expect(summary.hasRestoreRoom).toBe(true);
    expect(summary.hasDeleteRoom).toBe(true);
    expect(summary.hasEnsureActiveRoom).toBe(true);
    expect(summary.hasResolveDiscard).toBe(true);
    expect(summary.hasResolveKeep).toBe(true);
    expect(summary.isSavedRoomsArray).toBe(true);
    expect(summary.isConflictModalOpen).toBe(false);
  });
});

