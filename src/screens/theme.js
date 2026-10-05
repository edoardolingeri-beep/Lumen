// THEME — customise sky, notes, particles, waves, instrument and ambience.

import { h } from '../utils/dom.js';
import { btn, topBar, notesPill, confirmDialog, toast } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { CATALOG } from '../data/themes.js';
import { save } from '../utils/storage.js';
import { playSequence, sfx } from '../audio/sound.js';
import { symbolSVG, setColorVars } from '../data/notes.js';
import { noteColor } from '../components/tile.js';

function preview(kind, item) {
  const p = h('div', { class: `swatch sw-${kind}` });
  if (kind === 'theme') {
    p.style.background = `radial-gradient(circle at 30% 30%, ${item.glow}66, transparent 60%), radial-gradient(circle at 80% 85%, ${item.glow2}44, transparent 60%), linear-gradient(160deg, ${item.sky[0]}, ${item.sky[1]} 55%, ${item.sky[2]})`;
    for (let i = 0; i < 7; i++) p.append(h('i', { style: { left: `${(i * 37) % 90 + 5}%`, top: `${(i * 53) % 80 + 8}%` } }));
  } else if (kind === 'skin') {
    p.dataset.skin = item.id;
    [1, 3, 5].forEach((d) => {
      const t = h('span', { class: 'mini-tile', html: symbolSVG(d, 12) });
      setColorVars(t, noteColor(d));
      p.append(t);
    });
  } else if (kind === 'particles') {
    p.dataset.p = item.id;
    for (let i = 0; i < 8; i++) p.append(h('i', { style: { left: `${(i * 29) % 88 + 6}%`, top: `${(i * 41) % 76 + 10}%`, animationDelay: `${i * 0.3}s` } }));
  } else if (kind === 'waves') {
    p.dataset.w = item.id;
    p.append(h('i'), h('i'), h('i'));
  } else {
    p.innerHTML = icon(kind === 'sound' ? 'music' : 'zen', 26);
  }
  return p;
}

export function create(app, params = {}) {
  let tab = params.tab || 'theme';
  const pill = notesPill();
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const grid = h('div', { class: 'shop-grid' });

  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const [key, cat] of Object.entries(CATALOG)) {
      const t = h('button', { class: `tab${key === tab ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(key === tab) }, cat.label);
      t.addEventListener('click', () => {
        if (tab === key) return;
        tab = key;
        params.tab = key;
        sfx('button');
        renderTabs();
        renderGrid();
      });
      tabs.append(t);
    }
  };

  const renderGrid = () => {
    grid.innerHTML = '';
    const { items } = CATALOG[tab];
    items.forEach((item, i) => {
      const owned = save.data.owned[tab].includes(item.id);
      const equipped = save.data.equipped[tab] === item.id;
      const status = equipped
        ? h('span', { class: 'item-status eq', html: `${icon('check', 13)} Equipped` })
        : owned
          ? h('span', { class: 'item-status' }, 'Owned')
          : h('span', { class: 'item-status price', html: `${icon('sparkle', 12)} ${item.price}` });
      const card = h('button', { class: `shop-item glass${equipped ? ' equipped' : ''}`, type: 'button', style: { animationDelay: `${i * 50}ms` } }, preview(tab, item), h('span', { class: 'item-name' }, item.name), item.desc ? h('span', { class: 'item-desc' }, item.desc) : '', status);
      card.addEventListener('click', () => choose(item, owned, equipped));
      grid.append(card);
    });
  };

  const equip = (item) => {
    save.update((d) => (d.equipped[tab] = item.id));
    app.applyTheme();
    sfx('select');
    renderGrid();
  };

  const choose = async (item, owned, equipped) => {
    if (tab === 'sound') playSequence([1, 3, 5, 3], { instrument: item.id, interval: 0.18, vel: 0.6 });
    if (equipped) return;
    if (owned) return equip(item);
    if (save.data.notes < item.price) {
      sfx('soft');
      toast(`Need ${item.price - save.data.notes} more ✨ — complete levels to earn notes`);
      return;
    }
    const ok = await confirmDialog({ title: item.name, text: `Unlock for ${item.price} ✨ notes?`, ok: 'Unlock', cancel: 'Not now' });
    if (!ok) return;
    save.update((d) => {
      d.notes -= item.price;
      d.owned[tab].push(item.id);
    });
    sfx('coin');
    equip(item);
  };

  renderTabs();
  renderGrid();

  const el = h(
    'section',
    { class: 'theme' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('h2', { class: 'screen-title' }, 'THEME'), right: [pill] }),
    tabs,
    grid,
    h('p', { class: 'about' }, 'Everything here is cosmetic. Earn ✨ by completing levels and daily puzzles.'),
  );
  return {
    el,
    musicMode: 'menu',
    destroy() {
      pill._cleanup && pill._cleanup();
    },
  };
}
