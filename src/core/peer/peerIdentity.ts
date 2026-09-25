import { PREBAKED_CITIES, PREBAKED_ANIMALS } from './peerNames';

export const PEER_STORAGE_KEY = 'scyan_pixel_peer_profile';

/**
 * Curated palette of high-contrast, vibrant avatar colors.
 */
export const PEER_AVATAR_COLORS: readonly string[] = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#0ea5e9', // Sky
  '#84cc16', // Lime
  '#22c55e', // Green
];

export interface PeerProfile {
  id: string;
  name: string;
  color: string;
}

export type { ConnectedPeer } from '../../components/editor/types';
export { getPeerInitials } from '../../components/editor/types';


/**
 * Validates that peer name has at least 2 letters minimum (Unicode letters supported).
 */
export function isValidPeerName(name: string): boolean {
  if (!name) return false;
  const letters = name.match(/\p{L}/gu);
  return Boolean(letters && letters.length >= 2);
}

/**
 * Generates random city-animal name, e.g. "montreal-wolf", "tokyo-kitsune".
 */
export function generateRandomCityAnimalName(): string {
  const city = PREBAKED_CITIES[Math.floor(Math.random() * PREBAKED_CITIES.length)];
  const animal = PREBAKED_ANIMALS[Math.floor(Math.random() * PREBAKED_ANIMALS.length)];
  return `${city}-${animal}`;
}

/**
 * Picks a random vibrant color from PEER_AVATAR_COLORS.
 */
export function getRandomPeerColor(): string {
  return PEER_AVATAR_COLORS[Math.floor(Math.random() * PEER_AVATAR_COLORS.length)];
}

/**
 * Generates random UUID or fallback random id.
 */
export function generatePeerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'peer_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Generates a default peer profile with city-animal name and random color.
 */
export function createDefaultPeerProfile(): PeerProfile {
  return {
    id: generatePeerId(),
    name: generateRandomCityAnimalName(),
    color: getRandomPeerColor(),
  };
}

/**
 * Loads stored peer profile from localStorage. If non-existent or invalid,
 * creates a new profile, persists it, and returns it.
 */
export function loadStoredPeerProfile(): PeerProfile {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(PEER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.id === 'string' &&
          parsed.id.trim() &&
          typeof parsed.name === 'string' &&
          isValidPeerName(parsed.name) &&
          typeof parsed.color === 'string' &&
          parsed.color.trim()
        ) {
          return {
            id: parsed.id.trim(),
            name: parsed.name.trim(),
            color: parsed.color.trim(),
          };
        }
      }
    } catch {
      // Fallback on read/parse error
    }
  }

  const defaultProfile = createDefaultPeerProfile();
  saveStoredPeerProfile(defaultProfile);
  return defaultProfile;
}

/**
 * Saves peer profile to localStorage.
 */
export function saveStoredPeerProfile(profile: PeerProfile): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage quota or privacy restriction fallback
    }
  }
}
