import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPeerInitials,
  isValidPeerName,
  generateRandomCityAnimalName,
  getRandomPeerColor,
  createDefaultPeerProfile,
  loadStoredPeerProfile,
  saveStoredPeerProfile,
  PEER_AVATAR_COLORS,
  PEER_STORAGE_KEY,
} from '../peerIdentity';
import { PREBAKED_CITIES, PREBAKED_ANIMALS } from '../peerNames';

describe('peerIdentity core logic', () => {
  describe('getPeerInitials', () => {
    it('extracts first letter of city and animal when hyphen separated (e.g. montreal-wolf -> MW)', () => {
      expect(getPeerInitials('montreal-wolf')).toBe('MW');
      expect(getPeerInitials('tokyo-kitsune')).toBe('TK');
      expect(getPeerInitials('paris-renard')).toBe('PR');
      expect(getPeerInitials('oslo-elg')).toBe('OE');
    });

    it('extracts first letter of each word when space separated', () => {
      expect(getPeerInitials('montreal wolf')).toBe('MW');
      expect(getPeerInitials('tokyo kitsune')).toBe('TK');
      expect(getPeerInitials('Seoul Tiger')).toBe('ST');
    });

    it('handles multiple hyphens / words by taking first and last word initials', () => {
      expect(getPeerInitials('san-francisco-fox')).toBe('SF');
      expect(getPeerInitials('buenos-aires-jaguar')).toBe('BJ');
      expect(getPeerInitials('new york lynx')).toBe('NL');
    });

    it('uses first 2 letters when manual input has no hyphen or space', () => {
      expect(getPeerInitials('Scyan')).toBe('SC');
      expect(getPeerInitials('Wolf')).toBe('WO');
      expect(getPeerInitials('Pixel')).toBe('PI');
      expect(getPeerInitials('Jo')).toBe('JO');
    });

    it('handles unicode and multilingual names', () => {
      expect(getPeerInitials('kraków-orzeł')).toBe('KO');
      expect(getPeerInitials('élise')).toBe('ÉL');
      expect(getPeerInitials('münchen-bär')).toBe('MB');
    });

    it('handles short or empty edge cases', () => {
      expect(getPeerInitials('A')).toBe('A');
      expect(getPeerInitials('')).toBe('');
      expect(getPeerInitials('   ')).toBe('');
      expect(getPeerInitials(' - ')).toBe('');
    });

    it('trims leading/trailing whitespace and delimiters', () => {
      expect(getPeerInitials('  montreal-wolf  ')).toBe('MW');
      expect(getPeerInitials('-wolf-')).toBe('WO');
      expect(getPeerInitials('  scyan  ')).toBe('SC');
      expect(getPeerInitials('montreal - wolf')).toBe('MW');
    });
  });

  describe('isValidPeerName', () => {
    it('enforces minimum 2 letters requirement', () => {
      expect(isValidPeerName('ab')).toBe(true);
      expect(isValidPeerName('a')).toBe(false);
      expect(isValidPeerName('')).toBe(false);
      expect(isValidPeerName('   ')).toBe(false);
      expect(isValidPeerName('-')).toBe(false);
      expect(isValidPeerName('a-')).toBe(false);
    });

    it('rejects digits and symbols that lack 2 letters', () => {
      expect(isValidPeerName('12')).toBe(false);
      expect(isValidPeerName('!@#$')).toBe(false);
      expect(isValidPeerName('1-2')).toBe(false);
      expect(isValidPeerName('a1')).toBe(false);
    });

    it('validates city-animal, unicode, and custom manual names', () => {
      expect(isValidPeerName('montreal-wolf')).toBe(true);
      expect(isValidPeerName('Scyan')).toBe(true);
      expect(isValidPeerName('m-w')).toBe(true);
      expect(isValidPeerName('kraków-orzeł')).toBe(true);
      expect(isValidPeerName('élise')).toBe(true);
    });
  });

  describe('generateRandomCityAnimalName & colors', () => {
    it('ensures all prebaked cities and animals have no internal hyphens', () => {
      for (const city of PREBAKED_CITIES) {
        expect(city).not.toContain('-');
        expect(city).not.toContain(' ');
        expect(city.length).toBeGreaterThanOrEqual(2);
      }
      for (const animal of PREBAKED_ANIMALS) {
        expect(animal).not.toContain('-');
        expect(animal).not.toContain(' ');
        expect(animal.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('generates a hyphenated name with city and animal from prebaked lists', () => {
      const name = generateRandomCityAnimalName();
      expect(name).toContain('-');

      const [city, animal] = name.split('-');
      expect(PREBAKED_CITIES).toContain(city);
      expect(PREBAKED_ANIMALS).toContain(animal);
    });

    it('creates default peer profile with valid id, name, and color', () => {
      const profile = createDefaultPeerProfile();
      expect(profile.id).toBeDefined();
      expect(profile.name).toContain('-');
      expect(isValidPeerName(profile.name)).toBe(true);
      expect(PEER_AVATAR_COLORS).toContain(profile.color);
    });

    it('returns a color from PEER_AVATAR_COLORS palette', () => {
      const color = getRandomPeerColor();
      expect(PEER_AVATAR_COLORS).toContain(color);
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('localStorage profile persistence', () => {
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      const localStorageMock = {
        getItem: vi.fn((key: string) => mockStore[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStore[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStore[key];
        }),
        clear: vi.fn(() => {
          mockStore = {};
        }),
      };

      vi.stubGlobal('window', {
        localStorage: localStorageMock,
      });
    });

    it('creates and persists default profile when none exists in localStorage', () => {
      expect(mockStore[PEER_STORAGE_KEY]).toBeUndefined();

      const profile = loadStoredPeerProfile();
      expect(profile.id).toBeDefined();
      expect(profile.name).toContain('-');
      expect(isValidPeerName(profile.name)).toBe(true);
      expect(PEER_AVATAR_COLORS).toContain(profile.color);

      const saved = JSON.parse(mockStore[PEER_STORAGE_KEY] || '{}');
      expect(saved.id).toBe(profile.id);
      expect(saved.name).toBe(profile.name);
      expect(saved.color).toBe(profile.color);
    });

    it('loads previously stored peer profile', () => {
      const existing = {
        id: 'peer-12345',
        name: 'custom-peer',
        color: '#ff00aa',
      };
      saveStoredPeerProfile(existing);

      const loaded = loadStoredPeerProfile();
      expect(loaded).toEqual(existing);
    });

    it('regenerates default profile if stored data is corrupted or invalid', () => {
      mockStore[PEER_STORAGE_KEY] = JSON.stringify({ name: 'a', color: '' });

      const profile = loadStoredPeerProfile();
      expect(profile.name).not.toBe('a');
      expect(isValidPeerName(profile.name)).toBe(true);
    });
  });
});
