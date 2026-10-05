// A single world: its constellation and the 20 levels. Swipe to change world.

import { h, pad2 } from '../utils/dom.js';
import { btn, notesPill, topBar, starsRow, toast } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { WORLDS } from '../data/worlds.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { ConstellationView } from '../components/constellation.js';
import { isUnlocked, isWorldUnlocked, levelRecord, worldProgress, nextLevelId, LEVELS_PER_WORLD } from '../game/progress.js';
import { litFor } from './journey.js';
import { sfx } from '../audio/sound.js';

export function create(app, { world = 1 }) {
  const w = WORLDS[world - 1];
  const p = worldProgress(world);
  const pill = notesPill();
  const next = nextLevelId();

  const canvas = h('canvas', { class: 'world-constellation' });
  const cons = CONSTELLATIONS[w.constellation];
  const grid = h('div', { class: 'level-grid' });
  for (let i = 1; i <= LEVELS_PER_WORLD; i++) {
    const id = (world - 1) * LEVELS_PER_WORLD + i;
    const rec = levelRecord(id);
    const open = isUnlocked(id);
    const cls = ['level-btn', 'glass'];
    if (!open) cls.push('is-locked');
    if (rec) cls.push('done');
    if (id === next) cls.push('current');
    const b = h(
      'button',
      { class: cls.join(' '), type: 'button', 'aria-label': `Level ${id}${open ? '' : ', locked'}`, style: { animationDelay: `${80 + i * 22}ms` } },
      h('span', { class: 'lv-num' }, open ? pad2(id) : ''),
      open ? starsRow(rec ? rec.stars : 0, 3, 10) : h('span', { class: 'lv-lock', html: icon('lock', 16) }),
    );
    b.addEventListener('click', () => {
      if (!open) {
        sfx('soft');
        toast('Complete the previous level first');
        return;
      }
      sfx('select');
      app.go('game', { id });
    });
    grid.append(b);
  }

  const canGo = (d) => world + d >= 1 && world + d <= WORLDS.length && isWorldUnlocked(world + d);
  const switchWorld = (d) => {
    if (!canGo(d)) return;
    sfx('select');
    app.go('world', { world: world + d }, { replace: true });
  };
  const prevBtn = btn({ cls: `icon-btn small${canGo(-1) ? '' : ' hidden'}`, ico: 'back', aria: 'Previous world', onClick: () => switchWorld(-1) });
  const nextBtn = btn({ cls: `icon-btn small flip${canGo(1) ? '' : ' hidden'}`, ico: 'back', aria: 'Next world', onClick: () => switchWorld(1) });

  const el = h(
    'section',
    { class: 'world', style: { '--glow': w.glow } },
    topBar({
      left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })],
      center: h('div', { class: 'tb-title' }, h('span', { class: 'tb-sub' }, `WORLD ${world}`), h('h2', { class: 'screen-title' }, w.name)),
      right: [pill],
    }),
    h(
      'div',
      { class: 'world-hero stagger' },
      prevBtn,
      h('div', { class: 'world-cons' }, canvas, h('div', { class: 'cons-name' }, cons.name), h('div', { class: 'cons-meta', html: `${p.done}/20 &nbsp;·&nbsp; ${icon('starFill', 11)} ${p.stars}/60` })),
      nextBtn,
    ),
    h('p', { class: 'world-subtitle stagger' }, w.subtitle),
    grid,
  );

  // Swipe between worlds.
  let sx = null;
  let sy = 0;
  el.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) switchWorld(dx < 0 ? 1 : -1);
  });

  const view = new ConstellationView(canvas, w.constellation, litFor(world), { padding: 12 });
  return {
    el,
    world,
    musicMode: 'menu',
    destroy() {
      view.destroy();
      pill._cleanup && pill._cleanup();
    },
  };
}
