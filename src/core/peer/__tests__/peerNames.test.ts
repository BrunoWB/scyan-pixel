import { describe, it, expect } from 'vitest';
import {
  PREBAKED_ACTIONS,
  getRandomAction,
  sanitizeRoomPart,
  generateRoomName,
} from '../peerNames';

describe('peerNames room generation and actions', () => {
  describe('PREBAKED_ACTIONS', () => {
    it('contains a rich list of valid action strings', () => {
      expect(PREBAKED_ACTIONS.length).toBeGreaterThanOrEqual(20);
      for (const action of PREBAKED_ACTIONS) {
        expect(action).toMatch(/^[a-z]+$/);
        expect(action.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('returns a valid action from getRandomAction', () => {
      for (let i = 0; i < 50; i++) {
        const act = getRandomAction();
        expect(PREBAKED_ACTIONS).toContain(act);
      }
    });
  });

  describe('sanitizeRoomPart', () => {
    it('normalizes spaces and delimiters to hyphens', () => {
      expect(sanitizeRoomPart('Montreal Lion')).toBe('montreal-lion');
      expect(sanitizeRoomPart('Scyan_Pixel')).toBe('scyan-pixel');
      expect(sanitizeRoomPart('  hello---world  ')).toBe('hello-world');
    });

    it('strips diacritics and special characters', () => {
      expect(sanitizeRoomPart('Montréal!')).toBe('montreal');
      expect(sanitizeRoomPart('Kitsuné & Wolf')).toBe('kitsune-wolf');
    });

    it('handles empty or blank inputs', () => {
      expect(sanitizeRoomPart('')).toBe('');
      expect(sanitizeRoomPart('   ')).toBe('');
      expect(sanitizeRoomPart('---')).toBe('');
    });
  });

  describe('generateRoomName', () => {
    it('generates room name matching <user-name>-<action> format', () => {
      const room = generateRoomName('montreal-lion');
      expect(room).toMatch(/^montreal-lion-[a-z]+$/);
      const action = room.replace('montreal-lion-', '');
      expect(PREBAKED_ACTIONS).toContain(action);
    });

    it('cleanses raw usernames before combining with action', () => {
      const room = generateRoomName('Montreal Lion');
      expect(room).toMatch(/^montreal-lion-[a-z]+$/);
    });

    it('falls back to canvas-<action> if username is empty or invalid', () => {
      const room1 = generateRoomName('');
      expect(room1).toMatch(/^canvas-[a-z]+$/);

      const room2 = generateRoomName('   ');
      expect(room2).toMatch(/^canvas-[a-z]+$/);

      const room3 = generateRoomName(undefined);
      expect(room3).toMatch(/^canvas-[a-z]+$/);
    });
  });
});
