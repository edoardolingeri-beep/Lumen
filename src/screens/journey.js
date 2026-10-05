// YOUR JOURNEY — the five worlds, each with its living constellation.

import { h } from '../utils/dom.js';
import { btn, notesPill, topBar, toast } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { WORLDS } from '../data/worlds.js';
import { ConstellationView } from '../components/constellation.js';
import { isWorldUnlocked, worldProgress, totals, LEVELS_PER_WORLD } from '../game/progress.js';
import { save } from '../utils/storage.js';
import { sfx } from '../audio/sound.js';

export function litFor(world) {
  const lit = [];
  for (let i = 1; i <= LEVELS_PER_WORLD; i++) {
    const r = save.data.levels[(world - 1) * LEVELS_PER_WORLD + i];
    lit.push(r ? r.stars : 0);
  }
  return lit;
}

export function create(app) {
  const views = [];
  const pill = notesPill();
  const t = totals();
  const list = h('div', { class: 'world-list' });

  WORLDS.forEach((w, i) => {
    const unlocked = isWorldUnlocked(w.id);
    const p = worldProgress(w.id);
    const canvas = h('canvas', { class: 'world-thumb-canvas', width: 84, height: 84 });
    const thumb = h('div', { class: 'world-thumb', style: { background: `radial-gradient(circle at 30% 25%, ${w.glow}55, transparent 70%), linear-gradient(160deg, ${w.sky[0]}, ${w.sky[2]})` } }, canvas);
    const info = h(
      'div',
      { class: 'world-info' },
      h('span', { class: 'world-num' }, `WORLD ${w.id}`),
      h('span', { class: 'world-name' }, w.name),
      unlocked
        ? h('span', { class: 'world-meta', html: `${p.done}/${p.total} &nbsp;·&nbsp; ${icon('starFill', 12)} ${p.stars}` })
        : h('span', { class: 'world-meta locked', html: `${icon('lock', 12)} Complete ${WORLDS[i - 1].name} to unlock` }),
    );
    const card = h('button', { class: `world-card glass${unlocked ? '' : ' is-locked'}`, type: 'button', style: { '--glow': w.glow, animationDelay: `${120 + i * 70}ms` } }, thumb, info, h('span', { class: 'chev', html: icon(unlocked ? 'chevron' : 'lock', 18) }));
    card.addEventListener('click', () => {
      if (!unlocked) {
        sfx('soft');
        card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 300 });
        toast(`Complete ${WORLDS[i - 1].name} to open this sky`);
        return;
      }
      sfx('select');
      app.go('world', { world: w.id });
    });
    list.append(card);
    views.push(() => new ConstellationView(canvas, w.constellation, litFor(w.id), { padding: 8 }));
  });

  const el = h(
    'section',
    { class: 'journey' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('h2', { class: 'screen-title' }, 'YOUR JOURNEY'), right: [pill] }),
    h('div', { class: 'journey-summary stagger', html: `${icon('starFill', 14)} ${t.stars} / 300 &nbsp;&nbsp;·&nbsp;&nbsp; ${t.done} levels` }),
    list,
    h('div', { class: 'journey-foot stagger' }, btn({ cls: 'ghost-btn', ico: 'sky', label: 'View your sky', onClick: () => app.go('sky') })),
  );

  const instances = views.map((make) => make());
  return {
    el,
    musicMode: 'menu',
    destroy() {
      instances.forEach((v) => v.destroy());
      pill._cleanup && pill._cleanup();
    },
  };
}
