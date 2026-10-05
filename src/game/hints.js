// Three-step hint system. Hints guide without solving the whole puzzle:
//   1. reveal one correct position (a ghost note on a cell)
//   2. show one note that should move, and where
//   3. show a possible full arrangement for a few seconds

import { chainMembers, occupancy, readingOrder, resolveDrop, tileNotes, tileSignature } from './model.js';
import { planMoves } from './planner.js';

function solutionMap(L) {
  const map = new Map(); // cell -> tile index in solution
  L.solution.pos.forEach((c, t) => map.set(c, t));
  return map;
}

function solDeg(L, t) {
  return tileNotes(L.tiles[t], L.solution.rot[t])[0];
}

export function hintOne(L, S) {
  const sol = solutionMap(L);
  const occ = occupancy(L, S);
  for (const c of readingOrder(L)) {
    if (!sol.has(c)) continue;
    const st = sol.get(c);
    const cur = occ[c];
    const same = cur >= 0 && tileSignature(L.tiles[cur]) === tileSignature(L.tiles[st]);
    if (!same) return { type: 'ghost', cells: [{ cell: c, deg: solDeg(L, st) }] };
    if (L.tiles[st].kind === 'rotor' && S.rot[cur] !== L.solution.rot[st]) return { type: 'rotate', tile: cur };
  }
  // Everything in place except stray tiles: point at a cell that should be empty.
  for (let c = 0; c < occ.length; c++) {
    if (occ[c] >= 0 && !sol.has(c)) return { type: 'move-out', tile: occ[c] };
  }
  return null;
}

export function hintTwo(L, S) {
  const plan = planMoves(L, S, L.solution, { maxSteps: 60 });
  if (plan && plan.length) {
    const a = plan[0];
    if (a.type === 'rotate') return { type: 'rotate', tile: a.tile };
    const r = resolveDrop(L, S, a.tile, a.cell);
    const dest = r.ok ? r.changes[0].to : a.cell;
    return { type: 'arrow', tile: a.tile, from: S.pos[a.tile], to: a.cell, dest };
  }
  // Fallback (chains): move any misplaced unit straight to its solution cell.
  const sol = solutionMap(L);
  const occ = occupancy(L, S);
  for (let t = 0; t < L.tiles.length; t++) {
    if (L.tiles[t].locked) continue;
    const target = L.solution.pos[t];
    if (S.pos[t] === target) continue;
    const r = resolveDrop(L, S, t, target);
    if (r.ok) return { type: 'arrow', tile: t, from: S.pos[t], to: target, dest: target };
  }
  for (let t = 0; t < L.tiles.length; t++) {
    if (L.tiles[t].locked || chainMembers(L, t).length > 1) continue;
    const c = S.pos[t];
    if (!sol.has(c) || tileSignature(L.tiles[sol.get(c)]) !== tileSignature(L.tiles[t])) {
      void occ;
      return { type: 'pulse', tile: t };
    }
  }
  return hintOne(L, S);
}

export function hintThree(L) {
  return {
    type: 'solution',
    cells: L.solution.pos.map((c, t) => ({ cell: c, deg: solDeg(L, t) })),
  };
}

export function getHint(L, S, step) {
  if (step <= 1) return hintOne(L, S) || hintTwo(L, S);
  if (step === 2) return hintTwo(L, S);
  return hintThree(L);
}
