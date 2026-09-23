import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RoomMetadata } from '../../../core/peer/peerRoomStorage';
import { scrapeRooms, type ScrapeRoomsOptions } from '../../../core/peer/trackerScraper';

export interface UseRoomPeerCountsOptions {
  savedRooms: RoomMetadata[];
  currentRoomId?: string;
  connectedPeersCount?: number;
  isOpen?: boolean;
  scrapeOptions?: ScrapeRoomsOptions;
}

export interface UseRoomPeerCountsReturn {
  peerCounts: Record<string, number>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
}

/**
 * Hook to manage tracker scraping and live peer counts for saved rooms.
 * Automatically queries WebTorrent trackers when the modal opens,
 * incorporates live peer counts for the active room, and provides a refresh trigger.
 */
export function useRoomPeerCounts({
  savedRooms,
  currentRoomId,
  connectedPeersCount = 0,
  isOpen = true,
  scrapeOptions,
}: UseRoomPeerCountsOptions): UseRoomPeerCountsReturn {
  const [peerCounts, setPeerCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(isOpen && savedRooms.length > 0));
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const activeRequestIdRef = useRef<number>(0);
  const scrapeOptionsRef = useRef(scrapeOptions);
  scrapeOptionsRef.current = scrapeOptions;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const roomNamesKey = useMemo(() => {
    return savedRooms
      .map((r) => r.roomName)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [savedRooms]);

  const savedRoomsRef = useRef(savedRooms);
  savedRoomsRef.current = savedRooms;

  const fetchCounts = useCallback(
    async (forceRefresh = false, signal?: AbortSignal) => {
      const roomNames = savedRoomsRef.current.map((r) => r.roomName).filter(Boolean);
      if (roomNames.length === 0) {
        setPeerCounts({});
        setIsLoading(false);
        return;
      }

      const requestId = ++activeRequestIdRef.current;
      setIsLoading(true);

      try {
        const counts = await scrapeRooms(roomNames, {
          forceRefresh,
          signal,
          ...scrapeOptionsRef.current,
        });

        if (isMountedRef.current && activeRequestIdRef.current === requestId && !signal?.aborted) {
          setPeerCounts(counts);
          setLastUpdated(Date.now());
        }
      } catch (err) {
        console.warn('[useRoomPeerCounts] Error scraping tracker peer counts:', err);
        if (isMountedRef.current && activeRequestIdRef.current === requestId && !signal?.aborted) {
          // Gracefully default queried rooms to 0 if not already present
          setPeerCounts((prev) => {
            const fallback = { ...prev };
            for (const name of roomNames) {
              if (fallback[name] === undefined) {
                fallback[name] = 0;
              }
            }
            return fallback;
          });
        }
      } finally {
        if (isMountedRef.current && activeRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    // Stabilized dependencies: roomNamesKey ensures re-fetch when rooms change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomNamesKey]
  );

  // Trigger fetch when modal opens or rooms change, with AbortController lifecycle
  useEffect(() => {
    if (!isOpen) {
      activeRequestIdRef.current++;
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    void fetchCounts(false, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [isOpen, fetchCounts]);

  const refresh = useCallback(async () => {
    await fetchCounts(true);
  }, [fetchCounts]);

  // Merge live connected peers count for current active room
  const effectivePeerCounts = useMemo(() => {
    const combined = { ...peerCounts };
    if (currentRoomId) {
      combined[currentRoomId] = connectedPeersCount;
    }
    return combined;
  }, [peerCounts, currentRoomId, connectedPeersCount]);

  return {
    peerCounts: effectivePeerCounts,
    isLoading,
    refresh,
    lastUpdated,
  };
}
