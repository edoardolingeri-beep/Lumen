// Level recipes for worlds 2-5 (levels 21-100).
// Each row is data, not code: tweak a number, re-run `npm run validate`, done.
//
// Fields: size, tiles, locked, doubles, chains, rests, echoes, portals,
//         rotors, read ('normal' | 'mirror' | 'reverse'), voids
//         ('none' | 'corners' | 'center' | 'cross' | 'diamond'),
//         scramble (moves used to shuffle), intro (mechanic introduced), tip.

const R = (size, tiles, scramble, extra = {}) => ({ size, tiles, scramble, ...extra });

export const WORLD2 = [
  R(5, 4, 2, { doubles: 1, intro: 'double' }),
  R(5, 4, 2, { doubles: 2 }),
  R(5, 5, 3, { doubles: 2, locked: 1 }),
  R(5, 5, 3, { doubles: 2, voids: 'corners' }),
  R(5, 6, 3, { doubles: 2, locked: 1 }),
  R(5, 6, 4, { doubles: 3 }),
  R(5, 6, 4, { doubles: 3, locked: 1, voids: 'center' }),
  R(5, 7, 4, { doubles: 3, locked: 1 }),
  R(5, 7, 5, { doubles: 3, locked: 2, voids: 'corners' }),
  R(5, 7, 5, { doubles: 4, locked: 1 }),
  R(5, 4, 2, { chains: 1, intro: 'chain' }),
  R(5, 5, 3, { chains: 1 }),
  R(5, 5, 3, { chains: 1, doubles: 1 }),
  R(5, 6, 3, { chains: 1, locked: 1 }),
  R(5, 6, 4, { chains: 2 }),
  R(5, 6, 4, { chains: 1, doubles: 2, voids: 'corners' }),
  R(5, 7, 4, { chains: 2, locked: 1 }),
  R(5, 7, 5, { chains: 2, doubles: 1 }),
  R(5, 7, 5, { chains: 2, doubles: 2, locked: 1, voids: 'center' }),
  R(5, 8, 6, { chains: 2, doubles: 2, locked: 1 }),
];

export const WORLD3 = [
  R(5, 5, 3, { rests: 1, intro: 'rest' }),
  R(5, 6, 3, { rests: 1 }),
  R(5, 6, 3, { rests: 2, locked: 1 }),
  R(6, 6, 4, { rests: 2 }),
  R(6, 7, 4, { rests: 2, locked: 1, voids: 'corners' }),
  R(6, 7, 4, { rests: 2, doubles: 1 }),
  R(6, 7, 4, { rests: 2, chains: 1 }),
  R(6, 8, 5, { rests: 2, locked: 1 }),
  R(6, 8, 5, { rests: 3, doubles: 1, voids: 'center' }),
  R(6, 8, 5, { rests: 2, locked: 2, chains: 1 }),
  R(6, 5, 3, { echoes: 1, intro: 'echo' }),
  R(6, 6, 3, { echoes: 1 }),
  R(6, 6, 4, { echoes: 2, locked: 1 }),
  R(6, 6, 4, { echoes: 1, rests: 1 }),
  R(6, 7, 4, { echoes: 2, voids: 'corners' }),
  R(6, 7, 5, { echoes: 1, rests: 1, doubles: 1 }),
  R(6, 7, 5, { echoes: 2, locked: 1, rests: 1 }),
  R(6, 8, 5, { echoes: 2, chains: 1 }),
  R(6, 8, 5, { echoes: 2, rests: 1, locked: 1, voids: 'cross' }),
  R(6, 8, 6, { echoes: 2, rests: 2, doubles: 1, locked: 1 }),
];

export const WORLD4 = [
  R(6, 5, 3, { read: 'reverse', intro: 'reverse' }),
  R(6, 6, 3, { read: 'reverse' }),
  R(6, 6, 4, { read: 'reverse', locked: 1 }),
  R(6, 6, 4, { read: 'reverse', echoes: 1 }),
  R(6, 7, 4, { read: 'reverse', rests: 1 }),
  R(6, 7, 5, { read: 'reverse', locked: 1, voids: 'corners' }),
  R(6, 7, 5, { read: 'reverse', echoes: 1, rests: 1 }),
  R(6, 8, 5, { read: 'reverse', locked: 1, echoes: 1 }),
  R(6, 5, 3, { read: 'mirror', intro: 'mirror' }),
  R(6, 6, 3, { read: 'mirror' }),
  R(6, 6, 4, { read: 'mirror', locked: 1 }),
  R(6, 7, 4, { read: 'mirror', echoes: 1 }),
  R(6, 7, 4, { read: 'mirror', rests: 1, voids: 'center' }),
  R(6, 7, 5, { read: 'mirror', echoes: 1, locked: 1 }),
  R(6, 8, 5, { read: 'mirror', locked: 1, rests: 1 }),
  R(6, 8, 5, { read: 'mirror', chains: 1 }),
  R(7, 8, 5, { read: 'reverse', echoes: 2, locked: 1 }),
  R(7, 8, 5, { read: 'mirror', rests: 2, locked: 1, voids: 'diamond' }),
  R(7, 9, 6, { read: 'reverse', echoes: 1, chains: 1 }),
  R(7, 9, 6, { read: 'mirror', echoes: 2, rests: 1, locked: 1 }),
];

export const WORLD5 = [
  R(7, 5, 3, { portals: 1, intro: 'portal' }),
  R(7, 6, 3, { portals: 1 }),
  R(7, 6, 4, { portals: 1, locked: 1 }),
  R(7, 7, 4, { portals: 2 }),
  R(7, 7, 4, { portals: 1, echoes: 1, voids: 'diamond' }),
  R(7, 7, 5, { portals: 2, locked: 1 }),
  R(7, 8, 5, { portals: 1, rests: 1, doubles: 1 }),
  R(7, 8, 5, { portals: 2, locked: 1, echoes: 1 }),
  R(7, 6, 3, { rotors: 1, intro: 'rotor' }),
  R(7, 6, 3, { rotors: 2 }),
  R(7, 7, 4, { rotors: 2, locked: 1 }),
  R(7, 7, 4, { rotors: 2, portals: 1 }),
  R(7, 7, 5, { rotors: 2, echoes: 1, voids: 'diamond' }),
  R(7, 8, 5, { rotors: 3, locked: 1 }),
  R(7, 8, 5, { rotors: 2, rests: 1, doubles: 1 }),
  R(7, 8, 5, { rotors: 2, portals: 1, read: 'mirror' }),
  R(7, 9, 6, { rotors: 2, echoes: 1, locked: 1, chains: 1 }),
  R(7, 9, 6, { portals: 2, rotors: 1, rests: 1, read: 'reverse' }),
  R(7, 9, 6, { rotors: 2, doubles: 1, echoes: 1, locked: 1, voids: 'diamond' }),
  R(7, 10, 7, { rotors: 2, portals: 1, echoes: 1, locked: 1, rests: 1 }),
];

// Daily puzzles pick one of these mid-difficulty recipes from the date seed.
export const DAILY_RECIPES = [
  R(5, 6, 4, { doubles: 2, locked: 1 }),
  R(5, 6, 4, { chains: 1, locked: 1 }),
  R(6, 7, 4, { rests: 2, locked: 1 }),
  R(6, 7, 4, { echoes: 2, locked: 1 }),
  R(6, 7, 5, { read: 'mirror', locked: 1 }),
  R(6, 7, 5, { read: 'reverse', echoes: 1 }),
  R(7, 7, 5, { portals: 1, locked: 1 }),
  R(7, 7, 5, { rotors: 2, rests: 1 }),
  R(6, 7, 5, { doubles: 1, rests: 1, voids: 'corners' }),
  R(7, 8, 5, { rotors: 1, portals: 1, echoes: 1, voids: 'diamond' }),
];
