// Controlled procedural level generation.
//
// A recipe describes *what* a level contains (grid size, number of tiles and
// which mechanics). The generator builds a solved arrangement first, derives
// the target melody from it, then scrambles it using only legal moves while
// recording the inverse path. Every generated level is therefore solvable by
// construction, and the recorded path is re-verified before it is accepted.

import { createRng } from '../utils/rng.js';
import { generateMelody } from './melody.js';
import {
  applyMove, applyPath, buildBoard, cloneState, evaluate, resolveDrop, sameState, sequenceOf,
} from '../game/model.js';
import { planMoves } from '../game/planner.js';

const PORTAL_IDS = ['A', 'B', 'C'];

function voidMask(pattern, w, h) {
  const v = new Array(w * h).fill(false);
  const set = (x, y) => {
    if (x >= 0 && y >= 0 && x < w && y < h) v[y * w + x] = true;
  };
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  switch (pattern) {
    case 'corners':
      set(0, 0); set(w - 1, 0); set(0, h - 1); set(w - 1, h - 1);
      break;
    case 'center':
      for (let y = Math.floor(cy); y <= Math.ceil(cy); y++)
        for (let x = Math.floor(cx); x <= Math.ceil(cx); x++) set(x, y);
      break;
    case 'cross':
      set(Math.floor(cx), 0); set(Math.ceil(cx), h - 1); set(0, Math.ceil(cy)); set(w - 1, Math.floor(cy));
      break;
    case 'diamond':
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (Math.abs(x - cx) + Math.abs(y - cy) > Math.max(cx, cy) + 1.01) set(x, y);
      break;
    default:
      break;
  }
  return v;
}

function tokenFor(cell, tile) {
  let body = cell.void ? '#' : '.';
  if (tile) {
    if (tile.kind === 'rest') body = '-';
    else if (tile.kind === 'rotor') body = `r${tile.faces.join('')}`;
    else body = tile.notes.join('');
  }
  let tok = body;
  if (tile && tile.locked) tok += '!';
  if (cell.echo) tok += '@';
  if (cell.portal) tok += `^${cell.portal}`;
  if (tile && tile.chain >= 0) tok += `~${tile.chain}`;
  return tok;
}

/** Build the solved board (as token rows) for a recipe. Returns null on failure. */
function buildSolution(recipe, rng) {
  const size = recipe.size;
  const w = size;
  const h = size;
  const voids = voidMask(recipe.voids || 'none', w, h);
  const cells = voids.map((v) => ({ void: v, echo: false, portal: null }));
  const floor = [];
  cells.forEach((c, i) => !c.void && floor.push(i));
  const n = recipe.tiles;
  if (floor.length < n + 4 + (recipe.portals || 0) * 2) return null;

  const tilesAt = new Map();
  const taken = new Set();
  // Chain pairs: horizontally adjacent, both tiles.
  const chainPairs = [];
  for (let g = 1; g <= (recipe.chains || 0); g++) {
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const a = rng.pick(floor);
      const x = a % w;
      if (x >= w - 1) continue;
      const b = a + 1;
      if (cells[b].void || taken.has(a) || taken.has(b)) continue;
      // Keep chains apart so they have room to move.
      if (taken.has(a - 1) || taken.has(b + 1)) continue;
      taken.add(a); taken.add(b);
      chainPairs.push([a, b, g]);
      placed = true;
    }
    if (!placed) return null;
  }
  const remaining = n - chainPairs.length * 2;
  const pool = rng.shuffle(floor.filter((c) => !taken.has(c)));
  // Spread tiles: avoid packing more than ceil(n/size)+1 tiles in one row.
  const rowCount = new Array(h).fill(0);
  for (const [a] of chainPairs) rowCount[Math.floor(a / w)] += 2;
  const rowCap = Math.ceil(n / h) + 2;
  const singles = [];
  for (const c of pool) {
    if (singles.length >= remaining) break;
    const y = Math.floor(c / w);
    if (rowCount[y] >= rowCap) continue;
    rowCount[y]++;
    singles.push(c);
  }
  if (singles.length < remaining) return null;
  singles.forEach((c) => taken.add(c));

  const solCells = [...taken].sort((a, b) => a - b);
  // Reading order position of each solution cell.
  const read = recipe.read || 'normal';
  const orderKey = (c) => {
    const x = c % w;
    const y = Math.floor(c / w);
    const xx = read === 'mirror' || read === 'reverse' ? w - 1 - x : x;
    const yy = read === 'reverse' ? h - 1 - y : y;
    return yy * w + xx;
  };
  const inOrder = solCells.slice().sort((a, b) => orderKey(a) - orderKey(b));

  // Decide tile kinds.
  const chainCells = new Map();
  for (const [a, b, g] of chainPairs) {
    chainCells.set(a, g);
    chainCells.set(b, g);
  }
  const free = inOrder.filter((c) => !chainCells.has(c));
  const kinds = new Map();
  const pickFree = (count, kind, filter = () => true) => {
    const opts = rng.shuffle(free.filter((c) => !kinds.has(c) && filter(c)));
    if (opts.length < count) return false;
    opts.slice(0, count).forEach((c) => kinds.set(c, kind));
    return true;
  };
  const first = inOrder[0];
  const last = inOrder[inOrder.length - 1];
  if (!pickFree(recipe.rests || 0, 'rest', (c) => c !== first && c !== last)) return null;
  if (!pickFree(recipe.doubles || 0, 'double')) return null;
  if (!pickFree(recipe.rotors || 0, 'rotor')) return null;
  // Avoid two rests in a row.
  const restIdx = inOrder.map((c, i) => (kinds.get(c) === 'rest' ? i : -1)).filter((i) => i >= 0);
  for (let i = 1; i < restIdx.length; i++) if (restIdx[i] === restIdx[i - 1] + 1) return null;

  // Notes along the reading order.
  let slots = 0;
  inOrder.forEach((c) => {
    const k = kinds.get(c);
    if (k === 'rest') return;
    slots += k === 'double' ? 2 : 1;
  });
  const melody = generateMelody(rng, slots);
  let mi = 0;
  inOrder.forEach((c) => {
    const k = kinds.get(c) || 'note';
    const tile = { kind: k, locked: false, chain: chainCells.has(c) ? chainCells.get(c) : -1 };
    if (k === 'rest') tile.notes = [0];
    else if (k === 'double') {
      tile.notes = [melody[mi], melody[mi + 1]];
      mi += 2;
      if (tile.notes[0] === tile.notes[1]) tile.notes[1] = tile.notes[1] < 7 ? tile.notes[1] + 1 : tile.notes[1] - 1;
    } else if (k === 'rotor') {
      const note = melody[mi++];
      const decoys = rng.shuffle([1, 2, 3, 4, 5, 6, 7].filter((d) => d !== note)).slice(0, rng.int(1, 2));
      const faces = rng.shuffle([note, ...decoys]);
      tile.faces = faces;
      tile.solRot = faces.indexOf(note);
    } else tile.notes = [melody[mi++]];
    tilesAt.set(c, tile);
  });

  // Locked tiles (never chained; rotors may be locked — they still turn).
  const lockable = rng.shuffle(inOrder.filter((c) => !chainCells.has(c) && c !== first));
  for (let i = 0; i < (recipe.locked || 0); i++) {
    if (!lockable[i]) return null;
    tilesAt.get(lockable[i]).locked = true;
  }

  // Echo cells on note tiles (not rests).
  const echoable = rng.shuffle(inOrder.filter((c) => tilesAt.get(c).kind !== 'rest' && !chainCells.has(c)));
  for (let i = 0; i < (recipe.echoes || 0); i++) {
    if (!echoable[i]) return null;
    cells[echoable[i]].echo = true;
  }
  // One spare echo ring on an empty cell keeps players thinking.
  if (recipe.echoes) {
    const empty = rng.shuffle(floor.filter((c) => !taken.has(c)));
    if (empty[0] !== undefined) cells[empty[0]].echo = true;
  }

  // Portals: one end on an unlocked solution tile, the other on an empty cell.
  for (let p = 0; p < (recipe.portals || 0); p++) {
    const ends = rng.shuffle(inOrder.filter((c) => {
      const t = tilesAt.get(c);
      return !t.locked && t.chain < 0 && !cells[c].portal && !cells[c].echo;
    }));
    const empties = rng.shuffle(floor.filter((c) => !taken.has(c) && !cells[c].portal && !cells[c].echo));
    if (!ends.length || !empties.length) return null;
    const id = PORTAL_IDS[p];
    cells[ends[0]].portal = id;
    cells[empties[0]].portal = id;
  }

  const rows = [];
  const rotByCell = new Map();
  for (let y = 0; y < h; y++) {
    const r = [];
    for (let x = 0; x < w; x++) {
      const c = y * w + x;
      const tile = tilesAt.get(c) || null;
      if (tile && tile.kind === 'rotor') rotByCell.set(c, tile.solRot);
      r.push(tokenFor(cells[c], tile));
    }
    rows.push(r.join(' '));
  }
  return { rows, rotByCell };
}

function inverseOf(L, before, move, result) {
  if (move.type === 'rotate') return null; // handled by caller
  const main = result.changes.find((c) => c.tile === move.tile);
  const o = main.from;
  if (L.tiles[move.tile].chain >= 0) return { type: 'drop', tile: move.tile, cell: o };
  const cell = L.cells[o].portal >= 0 ? L.cells[o].portal : o;
  return { type: 'drop', tile: move.tile, cell };
}

function scramble(L, sol, rng, k) {
  let s = cloneState(sol);
  const inverse = []; // inverse moves in application order (to be reversed)
  const movable = L.tiles.map((t, i) => i).filter((i) => !L.tiles[i].locked || L.tiles[i].kind === 'rotor');
  const touched = new Set();
  const floor = [];
  L.cells.forEach((c, i) => !c.void && floor.push(i));
  let moves = 0;
  let guard = 0;
  while (moves < k && guard++ < 800) {
    const fresh = movable.filter((t) => !touched.has(t));
    const t = fresh.length && rng.chance(0.85) ? rng.pick(fresh) : rng.pick(movable);
    const tile = L.tiles[t];
    if (tile.kind === 'rotor' && (tile.locked || rng.chance(0.5))) {
      const n = tile.faces.length;
      const r = rng.int(1, n - 1);
      for (let i = 0; i < r; i++) s = applyMove(L, s, { type: 'rotate', tile: t }).state;
      for (let i = 0; i < n - r; i++) inverse.push({ type: 'rotate', tile: t });
      touched.add(t);
      moves++;
      continue;
    }
    if (tile.locked) continue;
    const cell = rng.pick(floor);
    const res = resolveDrop(L, s, t, cell);
    if (!res.ok) continue;
    // Prefer moves that disturb the melody.
    const next = applyMove(L, s, { type: 'drop', tile: t, cell });
    const beforeSeq = sequenceOf(L, s).join();
    if (sequenceOf(L, next.state).join() === beforeSeq && rng.chance(0.8)) continue;
    inverse.push(inverseOf(L, s, { type: 'drop', tile: t, cell }, res));
    s = next.state;
    res.changes.forEach((c) => touched.add(c.tile));
    moves++;
  }
  return { start: s, path: inverse.reverse() };
}

function lcs(a, b) {
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** How far a state is from the melody: notes outside the longest common subsequence. */
export function disorder(L, S) {
  const seq = sequenceOf(L, S);
  return Math.max(seq.length, L.target.length) - lcs(seq, L.target);
}

/** True if a single move solves the level from S. */
function oneMoveAway(L, S) {
  for (let t = 0; t < L.tiles.length; t++) {
    if (L.tiles[t].kind === 'rotor' && evaluate(L, applyMove(L, S, { type: 'rotate', tile: t }).state).solved) return true;
    if (L.tiles[t].locked) continue;
    for (let c = 0; c < L.cells.length; c++) {
      if (L.cells[c].void || c === S.pos[t]) continue;
      const r = applyMove(L, S, { type: 'drop', tile: t, cell: c });
      if (r && evaluate(L, r.state).solved) return true;
    }
  }
  return false;
}

/**
 * Generate a complete level object from a recipe and a seed.
 * Several valid candidates are produced; the most scrambled one is kept.
 * Throws if no valid level could be produced (never expected).
 */
export function generateLevel(recipe, seed) {
  const k = recipe.scramble || 3;
  const wanted = Math.min(2 + k, 7);
  let best = null;
  let candidates = 0;
  for (let attempt = 0; attempt < 80 && candidates < 4; attempt++) {
    const rng = createRng(`${seed}#${attempt}`);
    const built = buildSolution(recipe, rng);
    if (!built) continue;
    const board = buildBoard(built.rows);
    board.solution.rot = board.solution.pos.map((c) => (built.rotByCell.has(c) ? built.rotByCell.get(c) : 0));
    const L = { ...board, read: recipe.read || 'normal' };
    L.target = sequenceOf(L, L.solution);
    if (L.target.length < 3) continue;

    const { start, path } = scramble(L, L.solution, rng, k);
    const ev = evaluate(L, start);
    if (ev.solved || ev.ratio > 0.6) continue;
    const back = applyPath(L, start, path);
    if (!back || !sameState(back, L.solution)) continue;
    if (k >= 2 && oneMoveAway(L, start)) continue;
    const dis = disorder(L, start);

    let route = path;
    const planned = planMoves(L, start, L.solution);
    if (planned && planned.length < route.length) {
      const end = applyPath(L, start, planned);
      if (end && evaluate(L, end).solved) route = planned;
    }
    L.start = start;
    L.path = route;
    L.rows = built.rows;
    candidates++;
    const score = Math.min(dis, wanted) * 10 + Math.min(route.length, k + 2);
    if (!best || score > best.score) best = { L, score };
  }
  if (best) return best.L;
  throw new Error(`Could not generate level for seed ${seed}`);
}
