// Level registry. Levels are built lazily from data:
//   - World 1: hand-designed grids (world1.js)
//   - Worlds 2-5: recipes (recipes.js) expanded by the deterministic generator
// To add levels, append entries to those data files (see README).

import { WORLD1 } from './world1.js';
import { WORLD2, WORLD3, WORLD4, WORLD5, DAILY_RECIPES } from './recipes.js';
import { generateLevel } from './generator.js';
import { PAR_TABLE } from './par-table.js';
import { applyPath, buildBoard, evaluate, sequenceOf } from '../game/model.js';
import { planMoves } from '../game/planner.js';
import { mechanicsOf } from '../data/mechanics.js';
import { createRng, hashString } from '../utils/rng.js';

export const LEVELS_PER_WORLD = 20;
const RECIPES = [null, null, WORLD2, WORLD3, WORLD4, WORLD5];
export const WORLD_COUNT = 5;
export const TOTAL_LEVELS = WORLD1.length + WORLD2.length + WORLD3.length + WORLD4.length + WORLD5.length;

const cache = new Map();

export function levelFingerprint(L) {
  return hashString(
    JSON.stringify([L.w, L.h, L.read, L.target, L.start.pos, L.start.rot, L.cells.map((c) => (c.void ? 0 : 1 + (c.echo ? 2 : 0) + (c.portal >= 0 ? 4 : 0)))]),
  ).toString(36);
}

function buildHandcrafted(spec) {
  const board = buildBoard(spec.solution, spec.start);
  const L = { ...board, read: spec.read || 'normal' };
  L.target = sequenceOf(L, L.solution);
  const path = planMoves(L, L.start, L.solution);
  if (!path) throw new Error('Handcrafted level has no plan');
  L.path = path;
  return L;
}

function finalize(L, meta) {
  Object.assign(L, meta);
  L.mechanics = mechanicsOf(L);
  if (L.cells.some((c) => c.void)) L.mechanics.push('void');
  L.fingerprint = levelFingerprint(L);
  const known = PAR_TABLE[L.id];
  L.par = known && known.fp === L.fingerprint ? Math.min(known.par, L.path.length) : L.path.length;
  L.par = Math.max(1, L.par);
  return L;
}

export function worldOf(id) {
  return Math.floor((id - 1) / LEVELS_PER_WORLD) + 1;
}

export function getLevel(id) {
  if (cache.has(id)) return cache.get(id);
  const world = worldOf(id);
  const index = id - (world - 1) * LEVELS_PER_WORLD;
  let L;
  let meta = {};
  if (world === 1) {
    const spec = WORLD1[index - 1];
    L = buildHandcrafted(spec);
    meta = { tip: spec.tip, intro: spec.intro, tutorial: spec.tutorial };
  } else {
    const recipe = RECIPES[world][index - 1];
    L = generateLevel(recipe, `lumen-level-${id}`);
    meta = { tip: recipe.tip, intro: recipe.intro };
  }
  finalize(L, { id, world, index, ...meta });
  cache.set(id, L);
  return L;
}

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The daily puzzle: identical for every player on the same calendar date. */
export function getDailyLevel(key = dateKey()) {
  const cacheKey = `daily-${key}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const rng = createRng(`lumen-daily-${key}`);
  const recipe = DAILY_RECIPES[Math.floor(rng.next() * DAILY_RECIPES.length)];
  const L = generateLevel(recipe, `lumen-daily-${key}`);
  finalize(L, { id: 0, daily: key, world: 1 + (hashString(key) % WORLD_COUNT), index: 0 });
  cache.set(cacheKey, L);
  return L;
}

/** Sanity check used by the in-game debug path and the Node validator. */
export function verifyLevel(L) {
  const errors = [];
  if (!evaluate(L, L.solution).solved) errors.push('solution does not produce target');
  if (evaluate(L, L.start).solved) errors.push('start is already solved');
  const end = applyPath(L, L.start, L.path);
  if (!end) errors.push('par path contains an illegal move');
  else if (!evaluate(L, end).solved) errors.push('par path does not solve the level');
  return errors;
}
