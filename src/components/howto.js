// "How to play" guide: a short paged overlay + the animated reading-order grid.

import { h } from '../utils/dom.js';
import { btn, overlay } from './ui.js';
import { sfx } from '../audio/sound.js';

const ARROWS = { normal: '→ ↓', mirror: '← ↓', reverse: '← ↑' };

/** Cell indices (row-major) in the order the board is read. */
function order(read, w, hh) {
  const out = [];
  for (let yi = 0; yi < hh; yi++) {
    const y = read === 'reverse' ? hh - 1 - yi : yi;
    for (let xi = 0; xi < w; xi++) {
      const x = read === 'mirror' || read === 'reverse' ? w - 1 - xi : xi;
      out.push(y * w + x);
    }
  }
  return out;
}

/** Small grid whose cells light up 1, 2, 3… in reading order, on a loop. */
export function orderGrid(read = 'normal', w = 3, hh = 3) {
  const seq = order(read, w, hh);
  const rank = [];
  seq.forEach((c, i) => (rank[c] = i));
  const step = 0.32;
  const grid = h('div', { class: 'og' });
  grid.style.setProperty('--w', w);
  grid.style.setProperty('--dur', `${seq.length * step + 1.4}s`);
  for (let c = 0; c < w * hh; c++) {
    grid.append(h('span', { class: `og-cell${rank[c] === 0 ? ' first' : ''}`, style: { animationDelay: `${rank[c] * step}s` } }, String(rank[c] + 1)));
  }
  return grid;
}

const PAGES = [
  {
    title: 'THE GOAL',
    visual: () => {
      const bar = h('div', { class: 'ht-melody' }, ...[1, 3, 5, 3].map((d) => h('i', { class: `ht-dot d${d}` })));
      return h('div', { class: 'ht-visual col' }, bar, h('div', { class: 'ht-arrow' }, '↓'), orderGrid('normal', 2, 2));
    },
    text: 'The melody at the top is your target. Arrange the glowing notes on the board until they play that same melody.',
  },
  {
    title: 'READING ORDER',
    visual: () => h('div', { class: 'ht-visual' }, orderGrid('normal', 4, 3)),
    text: 'The board is read like a book: left to right, then the next row down. Empty cells are skipped. The first note you meet is the first note of the melody.',
  },
  {
    title: 'MOVE THE NOTES',
    visual: () => h('div', { class: 'ht-visual ht-drag' }, h('i', { class: 'ht-tile' }), h('i', { class: 'ht-hole' }), h('i', { class: 'ht-finger' })),
    text: 'Drag a note to an empty spot, or onto another note to swap them. Tap a note to hear it. PLAY sings your board in reading order, and the melody above lights up as notes match.',
  },
  {
    title: 'SOME SKIES ARE FLIPPED',
    visual: () =>
      h(
        'div',
        { class: 'ht-visual' },
        h('div', { class: 'ht-labeled' }, orderGrid('mirror', 3, 3), h('b', {}, 'MIRROR'), h('em', {}, 'right to left, top down')),
        h('div', { class: 'ht-labeled' }, orderGrid('reverse', 3, 3), h('b', {}, 'REVERSE'), h('em', {}, 'starts at the bottom')),
      ),
    text: 'In later worlds the reading direction changes. The tag under the title always tells you: → ↓ normal, ← ↓ mirror, ← ↑ reverse. Tap it to see the order on the board.',
  },
  {
    title: 'STARS & HINTS',
    visual: () => h('div', { class: 'ht-visual col' }, h('div', { class: 'ht-stars' }, '★ ★ ★'), h('div', { class: 'ht-bulb' }, 'HINT')),
    text: 'Fewer moves earn more stars, but there is no timer and no way to lose. Stuck? The hint button shows where a note belongs. Take your time.',
  },
];

export function showHowTo({ onClose } = {}) {
  let i = 0;
  const title = h('h2', { class: 'ht-title' });
  const body = h('div', { class: 'ht-body' });
  const text = h('p', { class: 'ht-text' });
  const dots = h('div', { class: 'ht-dots' }, ...PAGES.map(() => h('i')));
  const next = btn({ cls: 'primary wide', label: 'NEXT', sound: 'select', onClick: () => go(i + 1) });
  const skip = btn({ cls: 'ghost', label: 'Skip', onClick: () => o.close() });
  const o = overlay({ cls: 'howto', onClose, children: [h('div', { class: 'intro-new' }, 'HOW TO PLAY'), title, body, text, dots, next, skip] });

  function go(n) {
    if (n >= PAGES.length) {
      o.close();
      return;
    }
    i = n;
    const p = PAGES[n];
    title.textContent = p.title;
    body.replaceChildren(p.visual());
    text.textContent = p.text;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === n));
    next.querySelector('.btn-label').textContent = n === PAGES.length - 1 ? 'GOT IT' : 'NEXT';
    skip.style.visibility = n === PAGES.length - 1 ? 'hidden' : 'visible';
  }
  go(0);
  sfx('select');
  return o;
}

export { ARROWS };
