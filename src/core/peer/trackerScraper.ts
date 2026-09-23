import { SCYAN_PIXEL_APP_ID } from './peerSessionManager';

export const DEFAULT_TRACKER_URLS: readonly string[] = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.btorrent.xyz',
  'wss://open.ftorrent.com',
];

export const DEFAULT_SCRAPE_TIMEOUT_MS = 3500;
export const DEFAULT_CACHE_TTL_MS = 25000;

export interface ScrapeTrackerOptions {
  timeoutMs?: number;
  webSocketFactory?: (url: string) => WebSocket;
  signal?: AbortSignal;
}

export interface ScrapeRoomsOptions {
  appId?: string;
  trackerUrls?: readonly string[] | string[];
  timeoutMs?: number;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
  webSocketFactory?: (url: string) => WebSocket;
  signal?: AbortSignal;
}

interface CacheEntry {
  count: number;
  timestamp: number;
}

export const MAX_SCRAPE_CACHE_ENTRIES = 200;
const scrapeCache = new Map<string, CacheEntry>();

/**
 * Prunes expired or excess entries from the in-memory scrape cache.
 */
export function pruneScrapeCache(now = Date.now(), cacheTtlMs = DEFAULT_CACHE_TTL_MS): void {
  for (const [key, entry] of scrapeCache.entries()) {
    if (now - entry.timestamp >= cacheTtlMs) {
      scrapeCache.delete(key);
    }
  }
  if (scrapeCache.size > MAX_SCRAPE_CACHE_ENTRIES) {
    const toRemove = scrapeCache.size - MAX_SCRAPE_CACHE_ENTRIES;
    let removed = 0;
    for (const key of scrapeCache.keys()) {
      scrapeCache.delete(key);
      removed++;
      if (removed >= toRemove) break;
    }
  }
}

/**
 * Clear the in-memory tracker scrape cache.
 */
export function clearScrapeCache(): void {
  scrapeCache.clear();
}

/**
 * Returns the current number of cached room scrape entries.
 */
export function getScrapeCacheSize(): number {
  return scrapeCache.size;
}

export function sha1Fallback(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const bitLen = bytes.length * 8;
  const withPadding = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  withPadding.set(bytes);
  withPadding[bytes.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 4, bitLen, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < withPadding.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 80; j++) {
      const v = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (v << 1) | (v >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f = 0;
      let k = 0;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  return out;
}

/**
 * Calculates SHA-1 digest matching Trystero's internal room topic algorithm.
 * Trystero maps each byte of the SHA-1 digest to base-36 string:
 * Array.from(digest).map(b => b.toString(36)).join('')
 */
export async function computeSha1(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(36))
      .join('');
  }

  // Pure JavaScript SHA-1 fallback for non-WebCrypto environments
  return Array.from(sha1Fallback(str))
    .map((b) => b.toString(36))
    .join('');
}

/**
 * Derives the WebTorrent info_hash (20-character base-36 string) for a given room.
 * Trystero derives this by:
 * 1. topic = "Trystero@" + appId + "@" + roomId
 * 2. rootTopic = sha1(topic)
 * 3. infoHash = sha1(rootTopic).slice(0, 20)
 */
export async function getRoomInfoHash(
  roomId: string,
  appId: string = SCYAN_PIXEL_APP_ID
): Promise<string> {
  if (!roomId) return '';
  const topic = `Trystero@${appId}@${roomId}`;
  const rootTopic = await computeSha1(topic);
  const infoHash = (await computeSha1(rootTopic)).slice(0, 20);
  return infoHash;
}

/**
 * Scrapes a single WebTorrent WebSocket tracker for given info_hashes.
 * Resolves with a map of infoHash -> active peer count (incomplete + complete).
 * Gracefully resolves with {} on network failure, tracker error, or timeout.
 */
export function scrapeTracker(
  trackerUrl: string,
  infoHashes: string[],
  options?: ScrapeTrackerOptions
): Promise<Record<string, number>> {
  if (!infoHashes || infoHashes.length === 0) {
    return Promise.resolve({});
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.resolve({});
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_SCRAPE_TIMEOUT_MS;
  const webSocketFactory = options?.webSocketFactory;

  // Determine if WebSocket is available
  const hasWebSocket = Boolean(webSocketFactory || typeof WebSocket !== 'undefined');
  if (!hasWebSocket) {
    return Promise.resolve({});
  }

  return new Promise<Record<string, number>>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const onAbort = () => {
      finish({});
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {
          // Ignore close errors
        }
        ws = null;
      }
    };

    const finish = (result: Record<string, number>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    if (signal) {
      if (signal.aborted) {
        finish({});
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      finish({});
    }, timeoutMs);

    try {
      ws = webSocketFactory ? webSocketFactory(trackerUrl) : new WebSocket(trackerUrl);

      ws.onopen = () => {
        if (settled || !ws) return;
        try {
          const uniqueHashes = Array.from(new Set(infoHashes.filter(Boolean)));
          const payload = JSON.stringify({
            action: 'scrape',
            info_hash: uniqueHashes,
          });
          ws.send(payload);
        } catch {
          finish({});
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (settled) return;
        try {
          const rawData = typeof event.data === 'string' ? event.data : '';
          if (!rawData) {
            finish({});
            return;
          }
          const parsed = JSON.parse(rawData);
          if (!parsed || parsed.action !== 'scrape') {
            finish({});
            return;
          }

          const counts: Record<string, number> = {};
          const files = parsed.files;
          if (files && typeof files === 'object') {
            const filesRecord = files as Record<
              string,
              { complete?: number; incomplete?: number; downloaded?: number }
            >;

            // Build lowercase lookup table for robust case-insensitive matching
            const lowerFilesRecord: Record<
              string,
              { complete?: number; incomplete?: number; downloaded?: number }
            > = {};
            for (const [key, val] of Object.entries(filesRecord)) {
              if (val && typeof val === 'object') {
                lowerFilesRecord[key.toLowerCase()] = val;
              }
            }

            for (const hash of infoHashes) {
              const fileData = filesRecord[hash] ?? lowerFilesRecord[hash.toLowerCase()];
              if (fileData && typeof fileData === 'object') {
                const incomplete = typeof fileData.incomplete === 'number' ? fileData.incomplete : 0;
                const complete = typeof fileData.complete === 'number' ? fileData.complete : 0;
                counts[hash] = incomplete + complete;
              } else {
                counts[hash] = 0;
              }
            }
          }
          finish(counts);
        } catch {
          finish({});
        }
      };

      ws.onerror = () => {
        finish({});
      };

      ws.onclose = () => {
        finish({});
      };
    } catch {
      finish({});
    }
  });
}

/**
 * Scrapes peer counts for a list of room IDs across multiple trackers.
 * Handles info_hash calculation, concurrent tracker queries, peer count aggregation,
 * and caching with a short TTL.
 *
 * @returns Map of roomId -> peer count
 */
export async function scrapeRooms(
  roomIds: string[],
  options?: ScrapeRoomsOptions
): Promise<Record<string, number>> {
  const appId = options?.appId || SCYAN_PIXEL_APP_ID;
  const trackerUrls = options?.trackerUrls || DEFAULT_TRACKER_URLS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SCRAPE_TIMEOUT_MS;
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const forceRefresh = Boolean(options?.forceRefresh);
  const signal = options?.signal;

  const uniqueRoomIds = Array.from(new Set(roomIds.filter((id): id is string => Boolean(id))));
  if (uniqueRoomIds.length === 0) {
    return {};
  }

  const now = Date.now();
  pruneScrapeCache(now, cacheTtlMs);

  const finalCounts: Record<string, number> = {};
  const roomsToFetch: string[] = [];

  for (const id of uniqueRoomIds) {
    const cacheKey = `${appId}:${id}`;
    const cached = scrapeCache.get(cacheKey);
    if (!forceRefresh && cached && now - cached.timestamp < cacheTtlMs) {
      finalCounts[id] = cached.count;
    } else {
      roomsToFetch.push(id);
    }
  }

  if (roomsToFetch.length === 0 || signal?.aborted) {
    return finalCounts;
  }

  // Calculate info_hash for each room to fetch with resilient error handling
  const roomHashPairs: { roomId: string; infoHash: string }[] = [];
  for (const roomId of roomsToFetch) {
    try {
      const infoHash = await getRoomInfoHash(roomId, appId);
      roomHashPairs.push({ roomId, infoHash });
    } catch {
      finalCounts[roomId] = 0;
    }
  }

  const infoHashes = roomHashPairs.map((p) => p.infoHash).filter(Boolean);
  if (signal?.aborted) {
    return finalCounts;
  }
  if (infoHashes.length === 0) {
    for (const id of roomsToFetch) {
      if (finalCounts[id] === undefined) {
        finalCounts[id] = 0;
      }
    }
    return finalCounts;
  }

  // Scrape trackers concurrently with AbortSignal
  const trackerPromises = trackerUrls.map((url) =>
    scrapeTracker(url, infoHashes, {
      timeoutMs,
      webSocketFactory: options?.webSocketFactory,
      signal,
    }).catch(() => ({}))
  );

  const settledResults = await Promise.allSettled(trackerPromises);

  if (signal?.aborted) {
    return finalCounts;
  }

  // Aggregate max peer count across trackers for each info_hash
  const maxCountsByHash: Record<string, number> = {};
  for (const hash of infoHashes) {
    maxCountsByHash[hash] = 0;
  }

  for (const res of settledResults) {
    if (res.status === 'fulfilled' && res.value) {
      for (const [hash, count] of Object.entries(res.value)) {
        const lowerHash = hash.toLowerCase();
        for (const targetHash of infoHashes) {
          if (targetHash === hash || targetHash.toLowerCase() === lowerHash) {
            maxCountsByHash[targetHash] = Math.max(maxCountsByHash[targetHash] ?? 0, count);
          }
        }
      }
    }
  }

  // Populate cache and return record
  const scrapeTimestamp = Date.now();
  for (const { roomId, infoHash } of roomHashPairs) {
    const count = maxCountsByHash[infoHash] ?? 0;
    scrapeCache.set(`${appId}:${roomId}`, { count, timestamp: scrapeTimestamp });
    finalCounts[roomId] = count;
  }

  pruneScrapeCache(scrapeTimestamp, cacheTtlMs);

  return finalCounts;
}
