// Core puzzle model: level parsing, board state, move rules and evaluation.
// Pure functions only (no DOM), so the same code runs in the browser and in
// the Node level validator (tools/validate-levels.mjs).

import { REST } from '../data/notes.js';

/*
  Cell token grammar (one token per cell, separated by spaces):

    .        empty floor              #        void (no cell)
    3        note tile (degree 1-7)   35       double tile (plays 3 then 5)
    -        rest tile (silence)      r351     rotor with faces 3,5,1 (face 0 up)
    r351:2   rotor with face 2 up (only in explicit start grids)

  Optional suffixes, in this order:
    !   locked tile            @   echo cell (tile plays twice)
    ^A  portal cell, pair A    ~1  chain group 1 (tiles in a group move together)

  Example: '3!@' = locked MI on an echo cell, '.^A' = empty portal A.
*/

const TOKEN = /^(#|\.|-|r[1-7]{2,4}(?::\d)?|[1-7]{1,2})(!)?(@)?(?:\^([A-Z]))?(?:~(\d))?$/;

export function parseToken(tok) {
  const m = TOKEN.exec(tok);
  if (!m) throw new Error(`Bad cell token "${tok}"`);
  const [, body, lock, echo, portal, chain] = m;
  const cell = { void: body === '#', echo: !!echo, portalId: portal || null };
  let tile = null;
  if (body === '-') tile = { kind: 'rest', notes: [REST] };
  else if (body[0] === 'r') {
    const [faces, rot] = body.slice(1).split(':');
    tile = { kind: 'rotor', faces: [...faces].map(Number), rot: rot ? Number(rot) : 0 };
  } else if (/^[1-7]{2}$/.test(body)) tile = { kind: 'double', notes: [...body].map(Number) };
  else if (/^[1-7]$/.test(body)) tile = { kind: 'note', notes: [Number(body)] };
  if (tile) {
    tile.locked = !!lock;
    tile.chain = chain ? Number(chain) : -1;
  }
  return { cell, tile };
}

function parseGrid(rows) {
  const grid = rows.map((r) => r.trim().split(/\s+/));
  const h = grid.length;
  const w = grid[0].length;
  const cells = [];
  const placed = [];
  grid.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Row ${y} has ${row.length} cells, expected ${w}`);
    row.forEach((tok, x) => {
      const { cell, tile } = parseToken(tok);
      cells.push(cell);
      if (tile) placed.push({ ...tile, cell: y * w + x });
    });
  });
  return { w, h, cells, placed };
}

export function tileSignature(t) {
  if (t.kind === 'rotor') return `r${t.faces.join('')}`;
  return `${t.kind}:${t.notes.join('')}`;
}

function linkPortals(cells) {
  const byId = {};
  cells.forEach((c, i) => {
    c.portal = -1;
    if (c.portalId) (byId[c.portalId] ||= []).push(i);
  });
  for (const [id, list] of Object.entries(byId)) {
    if (list.length !== 2) throw new Error(`Portal ${id} must have exactly 2 cells`);
    cells[list[0]].portal = list[1];
    cells[list[1]].portal = list[0];
  }
}

/**
 * Build a runtime level from a solution grid and either an explicit start
 * grid or a start state. Returns { w, h, cells, tiles, solution, start? }.
 */
export function buildBoard(solutionRows, startRows) {
  const sol = parseGrid(solutionRows);
  linkPortals(sol.cells);
  const tiles = sol.placed.map((p) => {
    const t = { kind: p.kind, locked: p.locked, chain: p.chain };
    if (p.kind === 'rotor') t.faces = p.faces;
    else t.notes = p.notes;
    return t;
  });
  const solution = {
    pos: sol.placed.map((p) => p.cell),
    rot: sol.placed.map((p) => (p.kind === 'rotor' ? p.rot : 0)),
  };
  const board = { w: sol.w, h: sol.h, cells: sol.cells, tiles, solution };
  if (startRows) {
    const st = parseGrid(startRows);
    if (st.w !== sol.w || st.h !== sol.h) throw new Error('Start grid size mismatch');
    const used = new Set();
    const pos = new Array(tiles.length).fill(-1);
    const rot = new Array(tiles.length).fill(0);
    // Locked tiles first: they must match exactly in place.
    const order = st.placed.slice().sort((a, b) => Number(b.locked) - Number(a.locked));
    for (const p of order) {
      const sig = tileSignature(p);
      let idx = -1;
      for (let i = 0; i < tiles.length; i++) {
        if (used.has(i)) continue;
        if (tileSignature(tiles[i]) !== sig || tiles[i].locked !== p.locked || tiles[i].chain !== p.chain) continue;
        if (p.locked && solution.pos[i] !== p.cell) continue;
        idx = i;
        break;
      }
      if (idx < 0) throw new Error(`Start tile ${sig} at ${p.cell} has no matching solution tile`);
      used.add(idx);
      pos[idx] = p.cell;
      rot[idx] = p.kind === 'rotor' ? p.rot : 0;
    }
    if (used.size !== tiles.length) throw new Error('Start grid is missing tiles');
    board.start = { pos, rot };
  }
  return board;
}

// ---------------------------------------------------------------------------
// State helpers

export const cloneState = (s) => ({ pos: s.pos.slice(), rot: s.rot.slice() });

export function occupancy(L, S) {
  const occ = new Array(L.w * L.h).fill(-1);
  S.pos.forEach((c, t) => {
    occ[c] = t;
  });
  return occ;
}

export function tileNotes(tile, rot) {
  if (tile.kind === 'rotor') return [tile.faces[rot % tile.faces.length]];
  return tile.notes;
}

export function readingOrder(L) {
  const { w, h } = L;
  const order = [];
  const mode = L.read || 'normal';
  for (let yi = 0; yi < h; yi++) {
    const y = mode === 'reverse' ? h - 1 - yi : yi;
    for (let xi = 0; xi < w; xi++) {
      const x = mode === 'mirror' || mode === 'reverse' ? w - 1 - xi : xi;
      const c = y * w + x;
      if (!L.cells[c].void) order.push(c);
    }
  }
  return order;
}

/** Sequence of notes produced by the board, with the source of each note. */
export function emission(L, S) {
  const occ = occupancy(L, S);
  const out = [];
  for (const c of readingOrder(L)) {
    const t = occ[c];
    if (t < 0) continue;
    const notes = tileNotes(L.tiles[t], S.rot[t]);
    const reps = L.cells[c].echo ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      for (const deg of notes) out.push({ deg, tile: t, cell: c, echo: r > 0 });
    }
  }
  return out;
}

export function evaluate(L, S) {
  const em = emission(L, S);
  const target = L.target;
  const matches = target.map((deg, i) => !!em[i] && em[i].deg === deg);
  const matched = matches.filter(Boolean).length;
  const solved = em.length === target.length && matched === target.length;
  // A tile is "correct" when every note it emits lands on a matching index.
  const tileOk = new Array(L.tiles.length).fill(true);
  const tileSeen = new Array(L.tiles.length).fill(false);
  em.forEach((e, i) => {
    tileSeen[e.tile] = true;
    if (!(i < target.length && target[i] === e.deg)) tileOk[e.tile] = false;
  });
  const correctTiles = tileOk.map((ok, t) => ok && tileSeen[t]);
  return { emission: em, matches, matched, ratio: target.length ? matched / target.length : 0, solved, correctTiles };
}

export const sequenceOf = (L, S) => emission(L, S).map((e) => e.deg);

// ---------------------------------------------------------------------------
// Moves

const xy = (L, c) => [c % L.w, Math.floor(c / L.w)];

export function chainMembers(L, t) {
  const g = L.tiles[t].chain;
  if (g < 0) return [t];
  const out = [];
  L.tiles.forEach((tile, i) => {
    if (tile.chain === g) out.push(i);
  });
  return out;
}

/**
 * Resolve dropping tile `t` on cell `cell`.
 * Returns { ok, changes: [{tile, from, to, via}] , reason }.
 * `via` is the portal cell the tile entered (or -1).
 */
export function resolveDrop(L, S, t, cell) {
  const tile = L.tiles[t];
  const origin = S.pos[t];
  const fail = (reason) => ({ ok: false, changes: [], reason });
  if (tile.locked) return fail('locked');
  if (cell < 0 || cell >= L.w * L.h || L.cells[cell].void) return fail('void');
  if (cell === origin) return fail('same');
  const occ = occupancy(L, S);

  if (tile.chain >= 0) {
    const members = chainMembers(L, t);
    const [ox, oy] = xy(L, origin);
    const [cx, cy] = xy(L, cell);
    const dx = cx - ox;
    const dy = cy - oy;
    const changes = [];
    for (const m of members) {
      const [mx, my] = xy(L, S.pos[m]);
      const nx = mx + dx;
      const ny = my + dy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) return fail('bounds');
      const nc = ny * L.w + nx;
      if (L.cells[nc].void) return fail('void');
      const o = occ[nc];
      if (o >= 0 && L.tiles[o].chain !== tile.chain) return fail('blocked');
      changes.push({ tile: m, from: S.pos[m], to: nc, via: -1 });
    }
    return { ok: true, changes };
  }

  let dest = cell;
  let via = -1;
  if (L.cells[cell].portal >= 0) {
    via = cell;
    dest = L.cells[cell].portal;
    if (dest === origin) return fail('same');
  }
  const o = occ[dest];
  if (o < 0) return { ok: true, changes: [{ tile: t, from: origin, to: dest, via }] };
  const other = L.tiles[o];
  if (other.locked || other.chain >= 0) return fail('blocked');
  return {
    ok: true,
    changes: [
      { tile: t, from: origin, to: dest, via },
      { tile: o, from: dest, to: origin, via: -1 },
    ],
  };
}

export function canRotate(L, t) {
  return L.tiles[t].kind === 'rotor';
}

/** Apply a move ({type:'drop',tile,cell} | {type:'rotate',tile}); returns {state, result} or null. */
export function applyMove(L, S, move) {
  if (move.type === 'rotate') {
    if (!canRotate(L, move.tile)) return null;
    const next = cloneState(S);
    const n = L.tiles[move.tile].faces.length;
    next.rot[move.tile] = (next.rot[move.tile] + 1) % n;
    return { state: next, result: { ok: true, changes: [], rotated: move.tile } };
  }
  const res = resolveDrop(L, S, move.tile, move.cell);
  if (!res.ok) return null;
  const next = cloneState(S);
  for (const ch of res.changes) next.pos[ch.tile] = ch.to;
  return { state: next, result: res };
}

export function applyPath(L, S, path) {
  let s = S;
  for (const mv of path) {
    const r = applyMove(L, s, mv);
    if (!r) return null;
    s = r.state;
  }
  return s;
}

export function isSolved(L, S) {
  return evaluate(L, S).solved;
}

export function sameState(a, b) {
  return a.pos.every((v, i) => v === b.pos[i]) && a.rot.every((v, i) => v === b.rot[i]);
}

/** Validate structural sanity of a state (no overlaps, only floor cells). */
export function checkState(L, S) {
  const seen = new Set();
  for (let t = 0; t < L.tiles.length; t++) {
    const c = S.pos[t];
    if (c < 0 || c >= L.w * L.h) return `tile ${t} out of bounds`;
    if (L.cells[c].void) return `tile ${t} on void`;
    if (seen.has(c)) return `overlap at ${c}`;
    seen.add(c);
  }
  return null;
}
