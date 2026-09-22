import { describe, it, expect } from 'vitest';
import { PixelGrid } from '../../PixelGrid';
import {
  PixelTimestampTracker,
  applyPixelDeltas,
  reconcileGridSnapshots,
  diffGridPixels,
  type CanvasSnapshotMessage,
} from '../peerCanvasSync';

describe('Last-Write-Wins (LWW) Pixel Timestamp Reconciliation', () => {
  describe('PixelTimestampTracker', () => {
    it('initializes with default zero and records per-pixel timestamps', () => {
      const tracker = new PixelTimestampTracker();
      expect(tracker.get(5, 5)).toBe(0);

      tracker.set(5, 5, 12345);
      expect(tracker.get(5, 5)).toBe(12345);
      expect(tracker.get(6, 6)).toBe(0);
    });

    it('handles clear event updating clear timestamp', () => {
      const tracker = new PixelTimestampTracker();
      tracker.set(1, 1, 100);
      tracker.clear(500);

      expect(tracker.getClearTime()).toBe(500);
      expect(tracker.get(1, 1)).toBe(500);
    });
  });

  describe('applyPixelDeltas with LWW', () => {
    it('applies newer delta and updates tracker', () => {
      const grid = new PixelGrid(16, 16);
      const tracker = new PixelTimestampTracker();

      tracker.set(2, 2, 100);
      grid.set(2, 2, 1, '#111111');

      // Newer delta (ts: 200 > 100)
      applyPixelDeltas(grid, [[2, 2, '#222222', 200]], tracker);

      expect(grid.getColor(2, 2)).toBe('#222222');
      expect(tracker.get(2, 2)).toBe(200);
    });

    it('rejects older concurrent delta and preserves local newer pixel', () => {
      const grid = new PixelGrid(16, 16);
      const tracker = new PixelTimestampTracker();

      tracker.set(3, 3, 500);
      grid.set(3, 3, 1, '#new-color');

      // Older delta (ts: 400 < 500)
      applyPixelDeltas(grid, [[3, 3, '#old-color', 400]], tracker);

      expect(grid.getColor(3, 3)).toBe('#new-color');
      expect(tracker.get(3, 3)).toBe(500);
    });
  });

  describe('reconcileGridSnapshots for offline reconnect', () => {
    it('merges non-overlapping offline edits from both peers', () => {
      // Local peer drew a square at (1, 1) at t=100
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();
      localGrid.set(1, 1, 1, '#00ff00');
      localTracker.set(1, 1, 100);

      // Remote peer was offline and drew at (8, 8) at t=150
      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[8, 8, '#ff0000', 150]],
        timestamp: 150,
      };

      const result = reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      expect(result.appliedDeltas).toContainEqual([8, 8, '#ff0000', 150]);
      // Both pixels must exist in the merged canvas!
      expect(localGrid.get(1, 1)).toBe(1);
      expect(localGrid.getColor(1, 1)).toBe('#00ff00');
      expect(localGrid.get(8, 8)).toBe(1);
      expect(localGrid.getColor(8, 8)).toBe('#ff0000');
      expect(localGrid.countOn()).toBe(2);
    });

    it('resolves overlapping pixel edit to the higher timestamp (LWW)', () => {
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();

      // Local drew (4, 4) at t=100
      localGrid.set(4, 4, 1, '#local-color');
      localTracker.set(4, 4, 100);

      // Remote drew (4, 4) at t=200
      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[4, 4, '#remote-color', 200]],
      };

      reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      // Remote had t=200 > t=100 -> remote wins
      expect(localGrid.getColor(4, 4)).toBe('#remote-color');
      expect(localTracker.get(4, 4)).toBe(200);
    });

    it('preserves local edit when local timestamp is newer than remote', () => {
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();

      // Local drew (4, 4) at t=300
      localGrid.set(4, 4, 1, '#local-newer');
      localTracker.set(4, 4, 300);

      // Remote had (4, 4) at t=200
      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [[4, 4, '#remote-older', 200]],
      };

      reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      // Local had t=300 > t=200 -> local wins
      expect(localGrid.getColor(4, 4)).toBe('#local-newer');
      expect(localTracker.get(4, 4)).toBe(300);
    });

    it('handles remote clear if remote clear occurred after local pixel was set', () => {
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();

      localGrid.set(5, 5, 1, '#blue');
      localTracker.set(5, 5, 100);

      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [],
        clearTimestamp: 200,
      };

      reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      // Pixel placed at 100 was cleared by remote clear at 200
      expect(localGrid.get(5, 5)).toBe(0);
    });

    it('reconciles offline pixel deletions using deletedPixels tombstones', () => {
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();

      // Local had a pixel drawn at t=100
      localGrid.set(7, 7, 1, '#yellow');
      localTracker.set(7, 7, 100);

      // Remote peer was offline and erased (7, 7) at t=250
      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [],
        deletedPixels: [[7, 7, 250]],
      };

      const result = reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      // Pixel (7, 7) should be erased by remote tombstone
      expect(localGrid.get(7, 7)).toBe(0);
      expect(localTracker.get(7, 7)).toBe(250);
      expect(result.appliedDeltas).toContainEqual([7, 7, null, 250]);
    });

    it('preserves locally redrawn pixel if local redraw timestamp is newer than deletion tombstone', () => {
      const localGrid = new PixelGrid(16, 16);
      const localTracker = new PixelTimestampTracker();

      // Local drew (7, 7) at t=300 (newer than remote deletion at t=250)
      localGrid.set(7, 7, 1, '#newer-green');
      localTracker.set(7, 7, 300);

      const remoteSnapshot: CanvasSnapshotMessage = {
        type: 'snapshot',
        width: 16,
        height: 16,
        pixels: [],
        deletedPixels: [[7, 7, 250]],
      };

      reconcileGridSnapshots(localGrid, localTracker, remoteSnapshot);

      // Local redraw at 300 beats older deletion at 250
      expect(localGrid.get(7, 7)).toBe(1);
      expect(localGrid.getColor(7, 7)).toBe('#newer-green');
      expect(localTracker.get(7, 7)).toBe(300);
    });
  });

  describe('diffGridPixels with timestamps', () => {
    it('attaches supplied timestamp to pixel deltas', () => {
      const g1 = new PixelGrid(16, 16);
      const g2 = g1.clone();
      g2.set(2, 3, 1, '#ffffff');

      const diff = diffGridPixels(g1, g2, 9999);
      expect(diff).toEqual([[2, 3, '#ffffff', 9999]]);
    });
  });
});
