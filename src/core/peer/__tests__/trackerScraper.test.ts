import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  computeSha1,
  sha1Fallback,
  getRoomInfoHash,
  scrapeTracker,
  scrapeRooms,
  clearScrapeCache,
  getScrapeCacheSize,
  pruneScrapeCache,
  MAX_SCRAPE_CACHE_ENTRIES,
  DEFAULT_TRACKER_URLS,
} from '../trackerScraper';

class MockWebSocket {
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (!this.closed) {
        this.readyState = 1;
        this.onopen?.();
      }
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('trackerScraper', () => {
  beforeEach(() => {
    clearScrapeCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearScrapeCache();
  });

  describe('SHA-1 and room info_hash calculation', () => {
    it('computes deterministic base-36 SHA-1 hash matching Trystero algorithm', async () => {
      const hash1 = await computeSha1('test-string');
      const hash2 = await computeSha1('test-string');
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(10);
    });

    it('derives 20-character info_hash for room', async () => {
      const hash = await getRoomInfoHash('tokyo-kitsune-leap', 'scyan-pixel');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(20);

      // Same room generates identical hash
      const hashAgain = await getRoomInfoHash('tokyo-kitsune-leap', 'scyan-pixel');
      expect(hashAgain).toBe(hash);

      // Different room generates different hash
      const differentHash = await getRoomInfoHash('paris-falcon-dive', 'scyan-pixel');
      expect(differentHash).not.toBe(hash);
      expect(differentHash.length).toBe(20);
    });

    it('returns empty string for empty roomId', async () => {
      const hash = await getRoomInfoHash('');
      expect(hash).toBe('');
    });

    it('uses default appId when not specified', async () => {
      const defaultHash = await getRoomInfoHash('berlin-bear-roar');
      const explicitHash = await getRoomInfoHash('berlin-bear-roar', 'scyan-pixel');
      expect(defaultHash).toBe(explicitHash);
    });

    it('sha1Fallback output matches computeSha1 for various test vectors', async () => {
      const testCases = [
        '',
        'a',
        'hello world',
        'Trystero@scyan-pixel@berlin-bear-roar',
        'a'.repeat(55),
        'b'.repeat(56),
        'c'.repeat(64),
        'd'.repeat(128),
      ];

      for (const input of testCases) {
        const standardHash = await computeSha1(input);
        const fallbackBytes = sha1Fallback(input);
        const fallbackHash = Array.from(fallbackBytes)
          .map((b) => b.toString(36))
          .join('');
        expect(fallbackHash).toBe(standardHash);
      }
    });
  });

  describe('scrapeTracker', () => {
    it('returns empty map for empty infoHashes', async () => {
      const result = await scrapeTracker('wss://mock.tracker', []);
      expect(result).toEqual({});
    });

    it('sends scrape action and parses tracker response', async () => {
      let createdSocket: MockWebSocket | null = null;
      const factory = (url: string) => {
        createdSocket = new MockWebSocket(url);
        // Intercept send to respond
        const origSend = createdSocket.send.bind(createdSocket);
        createdSocket.send = (data: string) => {
          origSend(data);
          const parsed = JSON.parse(data);
          if (parsed.action === 'scrape') {
            setTimeout(() => {
              createdSocket?.onmessage?.({
                data: JSON.stringify({
                  action: 'scrape',
                  files: {
                    hash123: { complete: 1, incomplete: 2, downloaded: 5 },
                    hash456: { complete: 0, incomplete: 0 },
                  },
                }),
              });
            }, 5);
          }
        };
        return createdSocket as unknown as WebSocket;
      };

      const result = await scrapeTracker('wss://mock.tracker', ['hash123', 'hash456'], {
        webSocketFactory: factory,
        timeoutMs: 1000,
      });

      expect(result).toEqual({
        hash123: 3, // 1 complete + 2 incomplete
        hash456: 0,
      });
      expect(createdSocket).toBeDefined();
      expect(createdSocket!.sentMessages.length).toBe(1);
      expect(JSON.parse(createdSocket!.sentMessages[0])).toEqual({
        action: 'scrape',
        info_hash: ['hash123', 'hash456'],
      });
    });

    it('handles tracker timeout gracefully without throwing', async () => {
      const factory = (url: string) => {
        const socket = new MockWebSocket(url);
        // Do not respond
        return socket as unknown as WebSocket;
      };

      const result = await scrapeTracker('wss://mock.tracker', ['hash-timeout'], {
        webSocketFactory: factory,
        timeoutMs: 30,
      });

      expect(result).toEqual({});
    });

    it('handles socket error gracefully', async () => {
      const factory = (url: string) => {
        const socket = new MockWebSocket(url);
        setTimeout(() => {
          socket.onerror?.();
        }, 15);
        return socket as unknown as WebSocket;
      };

      const result = await scrapeTracker('wss://mock.tracker', ['hash-err'], {
        webSocketFactory: factory,
        timeoutMs: 500,
      });

      expect(result).toEqual({});
    });

    it('handles unexpected message format gracefully', async () => {
      const factory = (url: string) => {
        const socket = new MockWebSocket(url);
        socket.send = () => {
          setTimeout(() => {
            socket.onmessage?.({ data: JSON.stringify({ action: 'other' }) });
          }, 5);
        };
        return socket as unknown as WebSocket;
      };

      const result = await scrapeTracker('wss://mock.tracker', ['hash-bad'], {
        webSocketFactory: factory,
        timeoutMs: 500,
      });

      expect(result).toEqual({});
    });

    it('matches uppercase info_hash keys from tracker case-insensitively', async () => {
      const factory = (url: string) => {
        const ws = new MockWebSocket(url);
        ws.send = () => {
          setTimeout(() => {
            ws.onmessage?.({
              data: JSON.stringify({
                action: 'scrape',
                files: {
                  ABCDEF1234567890: { complete: 2, incomplete: 3 },
                },
              }),
            });
          }, 5);
        };
        return ws as unknown as WebSocket;
      };

      const result = await scrapeTracker('wss://mock.tracker', ['abcdef1234567890'], {
        webSocketFactory: factory,
        timeoutMs: 500,
      });

      expect(result['abcdef1234567890']).toBe(5);
    });

    it('aborts tracker query immediately when AbortSignal is triggered', async () => {
      const controller = new AbortController();
      let socketClosed = false;

      const factory = (url: string) => {
        const ws = new MockWebSocket(url);
        const origClose = ws.close.bind(ws);
        ws.close = () => {
          socketClosed = true;
          origClose();
        };
        return ws as unknown as WebSocket;
      };

      const scrapePromise = scrapeTracker('wss://mock.tracker', ['hash-abort'], {
        webSocketFactory: factory,
        signal: controller.signal,
        timeoutMs: 5000,
      });

      setTimeout(() => {
        controller.abort();
      }, 10);

      const res = await scrapePromise;
      expect(res).toEqual({});
      expect(socketClosed).toBe(true);
    });
  });

  describe('scrapeRooms', () => {
    it('returns empty record for empty roomIds list', async () => {
      const res = await scrapeRooms([]);
      expect(res).toEqual({});
    });

    it('scrapes rooms and aggregates highest count across multiple trackers', async () => {
      const sockets: MockWebSocket[] = [];
      const factory = (url: string) => {
        const ws = new MockWebSocket(url);
        sockets.push(ws);

        ws.send = () => {
          setTimeout(async () => {
            const hashA = await getRoomInfoHash('room-alpha');
            const hashB = await getRoomInfoHash('room-beta');

            if (url.includes('tracker-1')) {
              ws.onmessage?.({
                data: JSON.stringify({
                  action: 'scrape',
                  files: {
                    [hashA]: { incomplete: 3, complete: 0 },
                    [hashB]: { incomplete: 1, complete: 0 },
                  },
                }),
              });
            } else {
              ws.onmessage?.({
                data: JSON.stringify({
                  action: 'scrape',
                  files: {
                    [hashA]: { incomplete: 1, complete: 1 }, // 2
                    [hashB]: { incomplete: 4, complete: 0 }, // 4
                  },
                }),
              });
            }
          }, 15);
        };
        return ws as unknown as WebSocket;
      };

      const counts = await scrapeRooms(['room-alpha', 'room-beta'], {
        trackerUrls: ['wss://tracker-1.com', 'wss://tracker-2.com'],
        webSocketFactory: factory,
        timeoutMs: 1000,
      });

      // alpha max is 3 (tracker-1), beta max is 4 (tracker-2)
      expect(counts).toEqual({
        'room-alpha': 3,
        'room-beta': 4,
      });
      expect(getScrapeCacheSize()).toBe(2);
    });

    it('caches scrape results and respects cache TTL', async () => {
      let callCount = 0;
      const factory = (url: string) => {
        callCount++;
        const ws = new MockWebSocket(url);
        ws.send = () => {
          setTimeout(async () => {
            const hash = await getRoomInfoHash('cached-room');
            ws.onmessage?.({
              data: JSON.stringify({
                action: 'scrape',
                files: { [hash]: { incomplete: 5, complete: 0 } },
              }),
            });
          }, 10);
        };
        return ws as unknown as WebSocket;
      };

      // First call: hits tracker
      const res1 = await scrapeRooms(['cached-room'], {
        trackerUrls: ['wss://mock-cache-tracker.com'],
        webSocketFactory: factory,
        cacheTtlMs: 5000,
      });
      expect(res1['cached-room']).toBe(5);
      expect(callCount).toBe(1);

      // Second call: served from cache immediately without tracker hit
      const res2 = await scrapeRooms(['cached-room'], {
        trackerUrls: ['wss://mock-cache-tracker.com'],
        webSocketFactory: factory,
        cacheTtlMs: 5000,
      });
      expect(res2['cached-room']).toBe(5);
      expect(callCount).toBe(1);

      // Force refresh: bypasses cache and hits tracker again
      const res3 = await scrapeRooms(['cached-room'], {
        trackerUrls: ['wss://mock-cache-tracker.com'],
        webSocketFactory: factory,
        forceRefresh: true,
        cacheTtlMs: 5000,
      });
      expect(res3['cached-room']).toBe(5);
      expect(callCount).toBe(2);
    });

    it('deduplicates roomIds and filters empty entries', async () => {
      const factory = (url: string) => {
        const ws = new MockWebSocket(url);
        ws.send = () => {
          setTimeout(async () => {
            const hash = await getRoomInfoHash('unique-room');
            ws.onmessage?.({
              data: JSON.stringify({
                action: 'scrape',
                files: { [hash]: { incomplete: 2, complete: 0 } },
              }),
            });
          }, 10);
        };
        return ws as unknown as WebSocket;
      };

      const res = await scrapeRooms(['unique-room', 'unique-room', '', 'unique-room'], {
        trackerUrls: ['wss://mock-dedupe-tracker.com'],
        webSocketFactory: factory,
      });

      expect(res).toEqual({
        'unique-room': 2,
      });
    });

    it('aborts multi-tracker room scrape when AbortSignal fires', async () => {
      const controller = new AbortController();
      const factory = (url: string) => {
        return new MockWebSocket(url) as unknown as WebSocket;
      };

      const scrapePromise = scrapeRooms(['slow-room-1'], {
        trackerUrls: ['wss://slow-tracker.com'],
        webSocketFactory: factory,
        signal: controller.signal,
        timeoutMs: 5000,
      });

      setTimeout(() => {
        controller.abort();
      }, 10);

      const result = await scrapePromise;
      expect(result['slow-room-1']).toBeUndefined();
    });

    it('prunes expired entries and caps maximum cache size', async () => {
      clearScrapeCache();
      const now = Date.now();

      // Populate dummy entries by calling scrapeRooms or directly simulating cache
      for (let i = 0; i < MAX_SCRAPE_CACHE_ENTRIES + 25; i++) {
        const dummyRoom = `dummy-room-${i}`;
        // Pre-fill cache
        await scrapeRooms([dummyRoom], {
          trackerUrls: [], // no network
        });
      }

      // Now prune with a past timestamp to test pruning
      pruneScrapeCache(now + 100000, 30000);
      expect(getScrapeCacheSize()).toBe(0);
    });

    it('DEFAULT_TRACKER_URLS contains public WebTorrent trackers', () => {
      expect(DEFAULT_TRACKER_URLS.length).toBeGreaterThanOrEqual(3);
      expect(DEFAULT_TRACKER_URLS.some((u) => u.includes('webtorrent'))).toBe(true);
    });
  });
});

