// Progress, stars, currency and unlocks — all stored in the save game.

import { save } from '../utils/storage.js';
import { LEVELS_PER_WORLD, TOTAL_LEVELS, WORLD_COUNT } from '../levels/index.js';

export const HINT_COST = 20;
export const HINT_REFILL_MS = 8 * 60 * 1000;
export const HINT_MAX = 3;

/** Stars are generous: completing is always worth at least one. */
export function starsFor(moves, par, usedSolutionHint = false) {
  let s = 1;
  if (moves <= par) s = 3;
  else if (moves <= par + Math.max(2, Math.ceil(par * 0.6))) s = 2;
  if (usedSolutionHint) s = Math.min(s, 2);
  return s;
}

export function levelRecord(id) {
  return save.data.levels[id] || null;
}

export function isCompleted(id) {
  return !!save.data.levels[id];
}

export function isUnlocked(id) {
  if (id <= 1) return true;
  return isCompleted(id - 1) || isCompleted(id);
}

export function isWorldUnlocked(w) {
  if (w <= 1) return true;
  return isCompleted((w - 1) * LEVELS_PER_WORLD);
}

export function worldProgress(w) {
  let done = 0;
  let stars = 0;
  for (let i = 1; i <= LEVELS_PER_WORLD; i++) {
    const r = save.data.levels[(w - 1) * LEVELS_PER_WORLD + i];
    if (r) {
      done++;
      stars += r.stars;
    }
  }
  return { done, stars, total: LEVELS_PER_WORLD };
}

export function totals() {
  let done = 0;
  let stars = 0;
  for (const r of Object.values(save.data.levels)) {
    done++;
    stars += r.stars;
  }
  return { done, stars, percent: Math.round((done / TOTAL_LEVELS) * 100) };
}

/** Next level to play (first not completed), or the last one. */
export function nextLevelId() {
  for (let id = 1; id <= TOTAL_LEVELS; id++) if (!isCompleted(id)) return id;
  return TOTAL_LEVELS;
}

/** Record a finished level. Returns rewards for the completion screen. */
export function recordLevel(id, stars, moves) {
  const prev = save.data.levels[id];
  const prevStars = prev ? prev.stars : 0;
  const newStars = Math.max(0, stars - prevStars);
  const first = !prev;
  const earned = (first ? 5 : 0) + newStars * 5;
  const world = Math.ceil(id / LEVELS_PER_WORLD);
  const before = worldProgress(world).done;
  save.update((d) => {
    d.levels[id] = { stars: Math.max(prevStars, stars), best: prev ? Math.min(prev.best, moves) : moves };
    d.notes += earned;
  });
  const worldDone = before < LEVELS_PER_WORLD && worldProgress(world).done === LEVELS_PER_WORLD;
  return { first, earned, newStars, best: save.data.levels[id].best, worldDone, world };
}

export function markWorldCelebrated(w) {
  save.update((d) => {
    if (!d.worldsCelebrated.includes(w)) d.worldsCelebrated.push(w);
  });
}

// ---- hints -----------------------------------------------------------------

export function refreshHints() {
  const h = save.data.hints;
  const now = Date.now();
  if (h.charges >= HINT_MAX) return;
  const gained = Math.floor((now - h.last) / HINT_REFILL_MS);
  if (gained > 0) {
    save.update((d) => {
      d.hints.charges = Math.min(HINT_MAX, d.hints.charges + gained);
      d.hints.last = d.hints.charges >= HINT_MAX ? now : d.hints.last + gained * HINT_REFILL_MS;
    });
  }
}

export function hintStatus() {
  refreshHints();
  const h = save.data.hints;
  const next = h.charges >= HINT_MAX ? 0 : Math.max(0, HINT_REFILL_MS - (Date.now() - h.last));
  return { charges: h.charges, next, cost: HINT_COST, notes: save.data.notes };
}

/** Spend a free charge, or NOTES. Returns 'free' | 'notes' | null. */
export function useHint() {
  refreshHints();
  if (save.data.hints.charges > 0) {
    save.update((d) => {
      if (d.hints.charges >= HINT_MAX) d.hints.last = Date.now();
      d.hints.charges--;
    });
    return 'free';
  }
  if (save.data.notes >= HINT_COST) {
    save.update((d) => (d.notes -= HINT_COST));
    return 'notes';
  }
  return null;
}

// ---- daily -------------------------------------------------------------------

export function dailyRecord(key) {
  return save.data.daily.completed[key] || null;
}

export function recordDaily(key, stars) {
  const d0 = save.data.daily;
  const already = !!d0.completed[key];
  let earned = 0;
  save.update((d) => {
    if (!already) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      d.daily.streak = d.daily.lastDate === yKey ? d.daily.streak + 1 : 1;
      d.daily.lastDate = key;
      earned = 20 + stars * 5;
      d.notes += earned;
    }
    const prev = d.daily.completed[key];
    d.daily.completed[key] = { stars: Math.max(stars, prev ? prev.stars : 0) };
  });
  return { earned, first: !already, streak: save.data.daily.streak };
}

export function dailyCount() {
  return Object.keys(save.data.daily.completed).length;
}

export { WORLD_COUNT, LEVELS_PER_WORLD, TOTAL_LEVELS };
