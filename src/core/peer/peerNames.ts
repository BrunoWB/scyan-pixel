/**
 * Prebaked multilingual datasets of cities and animals for peer name generation.
 * Format is city-animal, e.g. "montreal-wolf", "tokyo-kitsune", "paris-renard".
 */

export const PREBAKED_CITIES: readonly string[] = [
  // Americas & Caribbean
  'montreal',
  'toronto',
  'vancouver',
  'halifax',
  'oaxaca',
  'cartagena',
  'bogota',
  'medellin',
  'lima',
  'cusco',
  'santiago',
  'valparaiso',
  'buenosaires',
  'montevideo',
  'havana',
  'honolulu',
  // Europe
  'paris',
  'lyon',
  'marseille',
  'berlin',
  'munich',
  'london',
  'edinburgh',
  'madrid',
  'barcelona',
  'sevilla',
  'valencia',
  'rome',
  'milano',
  'firenze',
  'napoli',
  'lisboa',
  'porto',
  'amsterdam',
  'utrecht',
  'copenhagen',
  'oslo',
  'bergen',
  'stockholm',
  'goteborg',
  'helsinki',
  'vienna',
  'graz',
  'prague',
  'warsaw',
  'krakow',
  'budapest',
  'athens',
  'thessaloniki',
  'reykjavik',
  'kyiv',
  'lviv',
  'geneva',
  'zurich',
  // Asia & Middle East
  'tokyo',
  'kyoto',
  'osaka',
  'seoul',
  'taipei',
  'tainan',
  'singapore',
  'bangkok',
  'chiangmai',
  'hanoi',
  'saigon',
  'almaty',
  'tbilisi',
  'istanbul',
  'ankara',
  // Africa
  'cairo',
  'alexandria',
  'nairobi',
  'lagos',
  'dakar',
  'casablanca',
  'marrakech',
  // Oceania
  'sydney',
  'melbourne',
  'auckland',
];

export const PREBAKED_ANIMALS: readonly string[] = [
  // English
  'wolf',
  'fox',
  'lynx',
  'bear',
  'owl',
  'otter',
  'falcon',
  'badger',
  'stag',
  'hare',
  'eagle',
  'raven',
  'seal',
  'beaver',
  'tiger',
  'leopard',
  'dolphin',
  'whale',
  'koala',
  'hedgehog',
  'chameleon',
  'hawk',
  'panther',
  'moose',
  // French
  'renard',
  'loup',
  'chouette',
  'herisson',
  'ours',
  'loutre',
  'cerf',
  'faucon',
  'aigle',
  'corbeau',
  'castor',
  'belette',
  'ecureuil',
  // Japanese (romaji)
  'kitsune',
  'ookami',
  'tanuki',
  'kuma',
  'fukuro',
  'tora',
  'tsuru',
  'neko',
  'inu',
  'shika',
  'usagi',
  'ryu',
  'kujira',
  // Spanish
  'zorro',
  'lobo',
  'buho',
  'oso',
  'nutria',
  'aguila',
  'jaguar',
  'colibri',
  'lince',
  'halcon',
  'puma',
  'flamenco',
  'condor',
  // German
  'fuchs',
  'eule',
  'baer',
  'dachs',
  'falke',
  'hirsch',
  'adler',
  'rabe',
  'igel',
  'biber',
  // Italian
  'volpe',
  'gufo',
  'falco',
  'cervo',
  'aquila',
  'tasso',
  'riccio',
  'lepre',
  'cigno',
  // Scandinavian
  'ulv',
  'rev',
  'bjorn',
  'oern',
  'elg',
  'gaupe',
  'hval',
];

export const PREBAKED_ACTIONS: readonly string[] = [
  'roar',
  'leap',
  'dash',
  'dance',
  'sleep',
  'hunt',
  'glide',
  'howl',
  'jump',
  'splash',
  'sprint',
  'wander',
  'dream',
  'shine',
  'soar',
  'stalk',
  'pounce',
  'swim',
  'climb',
  'bounce',
  'chase',
  'perch',
  'nest',
  'strike',
  'purr',
  'snarl',
  'flutter',
  'hover',
  'scurry',
  'prowl',
  'chant',
  'forge',
  'spark',
  'bloom',
  'drift',
  'breeze',
  'surge',
  'glow',
];

/**
 * Normalizes a string into a URL/room-safe slug.
 */
export function sanitizeRoomPart(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns a random action from PREBAKED_ACTIONS.
 */
export function getRandomAction(): string {
  return PREBAKED_ACTIONS[Math.floor(Math.random() * PREBAKED_ACTIONS.length)];
}

/**
 * Generates a room name following the pattern: `<user-name>-<action>`.
 * E.g. "montreal-lion-roar" or "scyan-dash".
 * If userName is empty or invalid, falls back to "canvas-<action>".
 */
export function generateRoomName(userName?: string): string {
  const cleanName = userName ? sanitizeRoomPart(userName) : '';
  const action = getRandomAction();
  if (!cleanName) {
    return `canvas-${action}`;
  }
  return `${cleanName}-${action}`;
}

