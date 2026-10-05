// ZEN MODE — no goals, no score. Touch, drag and listen.

import { h } from '../utils/dom.js';
import { btn, topBar } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { Board } from '../components/board.js';
import { noteColor } from '../components/tile.js';
import { symbolSVG, noteLabel, setColorVars } from '../data/notes.js';
import { applyMove, emission } from '../game/model.js';
import { playNote, playSequence, sfx } from '../audio/sound.js';
import { haptics } from '../utils/haptics.js';
import { save } from '../utils/storage.js';
import { prefs } from '../components/prefs.js';

const SIZE = 5;
const DEFAULT = [
  [6, 1], [7, 3], [8, 5], [12, 6], [16, 5], [17, 3], [18, 2],
];

export function create(app) {
  const stored = save.data.zen && Array.isArray(save.data.zen) ? save.data.zen : DEFAULT;
  let items = stored.filter(([c, d]) => c >= 0 && c < SIZE * SIZE && d >= 1 && d <= 7);
  let loop = null;
  let looping = false;

  const L = { w: SIZE, h: SIZE, read: 'normal', cells: [], tiles: [], target: [] };
  for (let i = 0; i < SIZE * SIZE; i++) L.cells.push({ void: false, echo: false, portal: -1, portalId: null });
  let S = { pos: [], rot: [] };

  const persist = () => save.update((d) => (d.zen = items.map((x) => x.slice())));

  const rebuild = () => {
    L.tiles = items.map(([, d]) => ({ kind: 'note', notes: [d], locked: false, chain: -1 }));
    S = { pos: items.map(([c]) => c), rot: items.map(() => 0) };
    board.setLevel(L, S);
  };

  const sing = (t, vel = 0.75) => {
    const d = L.tiles[t].notes[0];
    const pt = board.sing(t, { deg: d });
    playNote(d, { vel });
    haptics.note();
    if (pt) {
      app.sky.ripple(pt[0], pt[1], noteColor(d), { scale: 1.2 });
      app.sky.burst(pt[0], pt[1], noteColor(d), 4, { speed: 55 });
    }
  };

  const boardArea = h('div', { class: 'board-area' });
  const board = new Board(boardArea, {
    onTap: (t) => sing(t),
    preview: () => true,
    onDrop: (t, cell) => {
      const r = applyMove(L, S, { type: 'drop', tile: t, cell });
      if (!r) return false;
      S = r.state;
      items = items.map((it, i) => [S.pos[i], it[1]]);
      board.sync(S, { changes: r.result.changes, dragged: t });
      sfx('move');
      setTimeout(() => sing(t, 0.55), 110);
      persist();
      return true;
    },
    onDropOutside: (t) => {
      // Release a note into the sky.
      const d = L.tiles[t].notes[0];
      const r = board.tileEls[t].getBoundingClientRect();
      app.sky.burst(r.left + r.width / 2, r.top + r.height / 2, noteColor(d), 8, { speed: 80 });
      playNote(d, { vel: 0.35, octave: 5 });
      items.splice(t, 1);
      rebuild();
      persist();
      return true;
    },
    onTrail: (x, y, c) => app.sky.trail(x, y, c),
    onEmptyTap: (e) => {
      const rect = board.el.getBoundingClientRect();
      const step = board.cs + board.gap;
      const col = Math.floor((e.clientX - rect.left) / step);
      const row = Math.floor((e.clientY - rect.top) / step);
      if (col < 0 || row < 0 || col >= SIZE || row >= SIZE) return;
      const cell = row * SIZE + col;
      if (items.some(([c]) => c === cell)) return;
      // Tapping an empty cell plants the next note of a gentle scale.
      addNote(cell, ((row * 2 + col) % 7) + 1);
    },
  });

  function addNote(cell, deg) {
    items.push([cell, deg]);
    rebuild();
    sing(items.length - 1);
    persist();
  }

  // Palette: tap to add to the first free cell, or drag a note onto the board.
  const palette = h('div', { class: 'palette glass' });
  for (let d = 1; d <= 7; d++) {
    const p = h('button', { class: 'pal-note', type: 'button', 'aria-label': `Add ${noteLabel(d, prefs.noteNames)}`, html: symbolSVG(d, 18) });
    setColorVars(p, noteColor(d));
    p.append(h('span', { class: 'pal-label' }, noteLabel(d, prefs.noteNames)));
    let drag = null;
    p.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      p.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, ghost: null };
      playNote(d, { vel: 0.5 });
      p.classList.add('pressed');
    });
    p.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        drag.ghost = h('div', { class: 'pal-ghost', html: symbolSVG(d, 20) });
        setColorVars(drag.ghost, noteColor(d));
        document.body.append(drag.ghost);
      }
      if (drag.ghost) {
        drag.ghost.style.transform = `translate3d(${e.clientX - 26}px,${e.clientY - 26}px,0)`;
        app.sky.trail(e.clientX, e.clientY, noteColor(d));
      }
    });
    const end = (e, cancelled) => {
      if (!drag) return;
      p.classList.remove('pressed');
      const g = drag.ghost;
      drag = null;
      if (g) g.remove();
      if (cancelled) return;
      if (!g) {
        const free = [...Array(SIZE * SIZE).keys()].find((c) => !items.some(([ic]) => ic === c));
        if (free !== undefined) addNote(free, d);
        return;
      }
      const rect = board.el.getBoundingClientRect();
      const step = board.cs + board.gap;
      const col = Math.floor((e.clientX - rect.left) / step);
      const row = Math.floor((e.clientY - rect.top) / step);
      if (col < 0 || row < 0 || col >= SIZE || row >= SIZE) return;
      const cell = row * SIZE + col;
      const existing = items.findIndex(([c]) => c === cell);
      if (existing >= 0) {
        items[existing] = [cell, d];
        rebuild();
        sing(existing);
        persist();
      } else addNote(cell, d);
    };
    p.addEventListener('pointerup', (e) => end(e, false));
    p.addEventListener('pointercancel', (e) => end(e, true));
    palette.append(p);
  }

  const loopBtn = btn({
    cls: 'ctrl ctrl-play',
    ico: 'loop',
    label: 'LOOP',
    sound: null,
    onClick: () => (looping ? stopLoop() : startLoop()),
  });
  const clearBtn = btn({
    cls: 'ctrl',
    ico: 'trash',
    label: 'CLEAR',
    onClick: () => {
      stopLoop();
      items = [];
      rebuild();
      persist();
    },
  });

  function startLoop() {
    looping = true;
    loopBtn.classList.add('active');
    const run = () => {
      if (!looping) return;
      const em = emission(L, S);
      if (!em.length) {
        stopLoop();
        return;
      }
      loop = playSequence(
        em.map((e) => e.deg),
        {
          interval: 0.42,
          vel: 0.6,
          onStep: (i) => {
            const e = em[i];
            board.lightCell(e.cell, 380);
            const pt = board.sing(e.tile, { deg: e.deg });
            if (pt) app.sky.ripple(pt[0], pt[1], noteColor(e.deg), { scale: 1.1 });
          },
          onEnd: () => {
            if (looping) run();
          },
        },
      );
    };
    run();
  }

  function stopLoop() {
    looping = false;
    loopBtn.classList.remove('active');
    if (loop) loop.cancel();
    loop = null;
  }

  const el = h(
    'section',
    { class: 'zen' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('div', { class: 'tb-title' }, h('h2', { class: 'screen-title' }, 'ZEN'), h('span', { class: 'tb-sub' }, 'no goals · just sound')) }),
    h('p', { class: 'zen-hint' }, 'Tap, drag and listen. Drag a note off the board to let it go.'),
    h('div', { class: 'board-zone' }, boardArea),
    palette,
    h('nav', { class: 'controls glass zen-controls' }, clearBtn, loopBtn),
  );

  // Taps on the open sky also make gentle sounds.
  el.addEventListener('pointerdown', (e) => {
    if (e.target !== el && !e.target.classList.contains('board-zone') && !e.target.classList.contains('zen-hint')) return;
    const scale = [1, 2, 3, 5, 6];
    const d = scale[Math.floor((e.clientX / window.innerWidth) * scale.length)];
    playNote(d, { vel: 0.3, octave: 5, instrument: 'chime' });
    app.sky.ripple(e.clientX, e.clientY, noteColor(d), { scale: 1.5, dur: 1.4 });
  });

  return {
    el,
    musicMode: 'zen',
    onShow() {
      requestAnimationFrame(rebuild);
    },
    destroy() {
      stopLoop();
      board.destroy();
    },
  };
}
