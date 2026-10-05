// DAILY PUZZLE — one puzzle per day, identical for everyone (date seed).

import { h, formatDate } from '../utils/dom.js';
import { btn, topBar, notesPill, starsRow } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { ConstellationView } from '../components/constellation.js';
import { dateKey, getDailyLevel } from '../levels/index.js';
import { dailyRecord, dailyCount } from '../game/progress.js';
import { save } from '../utils/storage.js';
import { MECHANICS } from '../data/mechanics.js';

export function create(app) {
  const key = dateKey();
  const rec = dailyRecord(key);
  const L = getDailyLevel(key);
  const pill = notesPill();
  const count = dailyCount();
  const lit = Array.from({ length: 20 }, (_, i) => (i < Math.min(20, count) ? 2 : 0));
  const canvas = h('canvas', { class: 'daily-flower' });

  const msToMidnight = () => {
    const n = new Date();
    const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return m - n;
  };
  const countdown = h('span', { class: 'countdown' });
  const tick = () => {
    const ms = msToMidnight();
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    countdown.textContent = `Next puzzle in ${hh}h ${String(mm).padStart(2, '0')}m`;
  };
  tick();
  const timer = setInterval(tick, 30000);

  const mech = L.mechanics.filter((m) => MECHANICS[m]).map((m) => MECHANICS[m].short);
  const card = h(
    'div',
    { class: 'daily-card glass stagger' },
    h('div', { class: 'daily-label' }, 'DAILY PUZZLE'),
    h('div', { class: 'daily-date' }, formatDate()),
    h('div', { class: 'daily-meta' }, `${L.w}×${L.h}  ·  ${L.target.length} notes${mech.length ? `  ·  ${mech.join(' · ')}` : ''}`),
    rec
      ? h('div', { class: 'daily-done' }, h('span', { class: 'daily-done-title' }, 'DAILY COMPLETE'), starsRow(rec.stars, 3, 18), countdown)
      : h('div', { class: 'daily-reward', html: `Reward &nbsp;${icon('sparkle', 13)} 20 + 5 per star` }),
    btn({ cls: rec ? 'glass wide' : 'primary wide', ico: rec ? 'reset' : 'play', label: rec ? 'PLAY AGAIN' : 'PLAY', sound: 'select', onClick: () => app.go('game', { daily: key }) }),
  );

  const el = h(
    'section',
    { class: 'daily' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('h2', { class: 'screen-title' }, 'DAILY'), right: [pill] }),
    card,
    h('div', { class: 'daily-flower-wrap stagger' }, canvas, h('div', { class: 'cons-name' }, 'The Flower'), h('div', { class: 'cons-meta' }, `${count} daily puzzle${count === 1 ? '' : 's'} solved · streak ${save.data.daily.streak || 0}`)),
    h('p', { class: 'about stagger' }, 'Every day a new puzzle, the same for every player. Each one lights a star of the flower.'),
  );
  const view = new ConstellationView(canvas, 'flower', lit, { padding: 10 });
  return {
    el,
    musicMode: 'menu',
    destroy() {
      clearInterval(timer);
      view.destroy();
      pill._cleanup && pill._cleanup();
    },
  };
}
