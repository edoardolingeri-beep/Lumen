// YOUR SKY — every constellation you are building, in one night sky.

import { h } from '../utils/dom.js';
import { btn, topBar } from '../components/ui.js';
import { ConstellationView } from '../components/constellation.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { WORLDS } from '../data/worlds.js';
import { worldProgress, dailyCount, totals } from '../game/progress.js';
import { litFor } from './journey.js';

export function create(app) {
  const views = [];
  const grid = h('div', { class: 'sky-grid' });
  const add = (id, lit, label, meta, i) => {
    const canvas = h('canvas', { class: 'sky-canvas' });
    const complete = lit.every((v) => v > 0);
    grid.append(h('div', { class: `sky-item${complete ? ' complete' : ''}`, style: { animationDelay: `${100 + i * 90}ms` } }, canvas, h('div', { class: 'cons-name' }, CONSTELLATIONS[id].name), h('div', { class: 'cons-meta' }, `${label} · ${meta}`)));
    views.push([canvas, id, lit]);
  };
  WORLDS.forEach((w, i) => {
    const p = worldProgress(w.id);
    add(w.constellation, litFor(w.id), w.name, `${p.done}/20`, i);
  });
  const dc = dailyCount();
  add('flower', Array.from({ length: 20 }, (_, i) => (i < Math.min(20, dc) ? 2 : 0)), 'DAILY', `${Math.min(20, dc)}/20`, 5);

  const t = totals();
  const allDone = t.done >= 100;
  const el = h(
    'section',
    { class: 'skyview' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('h2', { class: 'screen-title' }, 'YOUR SKY') }),
    h('p', { class: 'sky-intro stagger' }, allDone ? 'Every star is lit. The sky is yours.' : 'Each level you complete lights a star. Finish a world to complete its constellation.'),
    grid,
  );
  const inst = views.map(([c, id, lit]) => new ConstellationView(c, id, lit, { padding: 6 }));
  return {
    el,
    world: allDone ? 5 : 0,
    musicMode: 'menu',
    destroy() {
      inst.forEach((v) => v.destroy());
    },
  };
}
