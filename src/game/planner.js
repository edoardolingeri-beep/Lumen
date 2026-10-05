// Move planner: finds a short sequence of real moves that turns one board
// state into a goal arrangement. Used for par (3-star) values, the hint
// system and the level validator. Every plan is simulated through the real
// move rules, so a returned plan is always legal.

import { applyMove, occupancy, resolveDrop, tileSignature } from './model.js';

function sigAt(L, S) {
  const occ = occupancy(L, S);
  return occ.map((t) => (t < 0 ? '' : tileSignature(L.tiles[t])));
}

/** Convert "move tile t into cell d" into concrete drop actions (handles portals). */
function dropActionsFor(L, S, t, d) {
  const cell = L.cells[d];
  if (cell.portal < 0) return [[{ type: 'drop', tile: t, cell: d }]];
  const entry = cell.portal;
  const options = [[{ type: 'drop', tile: t, cell: entry }]];
  if (S.pos[t] === entry) {
    // Tile sits on the partner portal: step aside first, then enter.
    const occ = occupancy(L, S);
    for (let c = 0; c < occ.length; c++) {
      if (occ[c] < 0 && !L.cells[c].void && L.cells[c].portal < 0) {
        options.push([
          { type: 'drop', tile: t, cell: c },
          { type: 'drop', tile: t, cell: entry },
        ]);
        break;
      }
    }
  }
  return options;
}

function tryActions(L, S, actions) {
  let s = S;
  for (const a of actions) {
    const r = applyMove(L, s, a);
    if (!r) return null;
    s = r.state;
  }
  return s;
}

/**
 * Plan from state S to goal G (same level). Works for every mechanic except
 * chains (returns null when the level has chain groups).
 */
export function planMoves(L, S, G, { maxSteps = 120 } = {}) {
  if (L.tiles.some((t) => t.chain >= 0)) return null;
  const goalSig = sigAt(L, G);
  const goalRot = new Map();
  G.pos.forEach((c, t) => {
    if (L.tiles[t].kind === 'rotor') goalRot.set(c, G.rot[t]);
  });
  let s = { pos: S.pos.slice(), rot: S.rot.slice() };
  const path = [];

  for (let step = 0; step < maxSteps; step++) {
    const cur = sigAt(L, s);
    const occ = occupancy(L, s);
    const bad = [];
    for (let c = 0; c < cur.length; c++) if (!L.cells[c].void && cur[c] !== goalSig[c]) bad.push(c);
    if (!bad.length) break;

    // Candidate (source cell, dest cell) pairs, best first.
    const cands = [];
    for (const d of bad) {
      const want = goalSig[d];
      if (!want) continue;
      for (const o of bad) {
        if (o === d || cur[o] !== want) continue;
        const t = occ[o];
        if (L.tiles[t].locked) continue;
        let score = 0;
        if (!cur[d]) score += 2; // filling an empty slot
        if (cur[d] && cur[d] === goalSig[o]) score += 3; // perfect swap
        if (!goalSig[o]) score += 1; // source should end up empty
        cands.push({ t, o, d, score });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    let progressed = false;
    for (const cand of cands) {
      for (const acts of dropActionsFor(L, s, cand.t, cand.d)) {
        const ns = tryActions(L, s, acts);
        if (ns && ns.pos[cand.t] === cand.d) {
          s = ns;
          path.push(...acts);
          progressed = true;
          break;
        }
      }
      if (progressed) break;
    }
    if (!progressed) {
      // Park a misplaced tile on a free cell to break a deadlock.
      for (const o of bad) {
        const t = occ[o];
        if (t < 0 || L.tiles[t].locked) continue;
        for (let c = 0; c < occ.length && !progressed; c++) {
          if (occ[c] >= 0 || L.cells[c].void || c === o) continue;
          const r = resolveDrop(L, s, t, c);
          if (r.ok) {
            const ns = applyMove(L, s, { type: 'drop', tile: t, cell: c }).state;
            s = ns;
            path.push({ type: 'drop', tile: t, cell: c });
            progressed = true;
          }
        }
        if (progressed) break;
      }
    }
    if (!progressed) return null;
  }

  // Rotate rotors into place.
  s.pos.forEach((c, t) => {
    const tile = L.tiles[t];
    if (tile.kind !== 'rotor' || !goalRot.has(c)) return;
    const n = tile.faces.length;
    const want = goalRot.get(c);
    // Any rotor with the same faces is interchangeable; compare the face shown.
    const need = (want - s.rot[t] + n) % n;
    for (let i = 0; i < need; i++) path.push({ type: 'rotate', tile: t });
    s.rot[t] = want;
  });

  const final = sigAt(L, s);
  if (final.some((v, c) => v !== goalSig[c])) return null;
  return path;
}
