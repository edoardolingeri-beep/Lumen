// The target melody, shown as a row of note symbols that light up as the
// player's arrangement matches them. Tap to listen.

import { h } from '../utils/dom.js';
import { symbolSVG, noteLabel, setColorVars } from '../data/notes.js';
import { noteColor } from './tile.js';
import { icon } from './icons.js';
import { prefs } from './prefs.js';

export class MelodyBar {
  constructor(container, { onListen } = {}) {
    this.el = h('button', { class: 'melody-bar glass', type: 'button', 'aria-label': 'Listen to the melody' });
    this.head = h('div', { class: 'melody-head' }, h('span', {}, 'MELODY'), h('span', { class: 'melody-listen', html: `${icon('listen', 14)} <span>tap to listen</span>` }));
    this.row = h('div', { class: 'melody-row' });
    this.el.append(this.head, this.row);
    this.el.addEventListener('click', () => onListen && onListen());
    container.append(this.el);
  }

  set(target) {
    this.target = target;
    this.row.innerHTML = '';
    const n = target.length;
    this.row.style.setProperty('--n', Math.min(n, 12));
    this.row.classList.toggle('wrap', n > 12);
    this.slots = target.map((deg) => {
      const s = h('span', { class: `slot${deg ? '' : ' rest'}`, html: symbolSVG(deg, 14), title: noteLabel(deg, prefs.noteNames) });
      setColorVars(s, noteColor(deg));
      this.row.append(s);
      return s;
    });
  }

  setMatches(matches) {
    this.slots.forEach((s, i) => s.classList.toggle('on', !!matches[i]));
  }

  pulse(i) {
    const s = this.slots[i];
    if (!s) return;
    s.classList.remove('pulse');
    void s.offsetWidth;
    s.classList.add('pulse');
  }

  setAll(on) {
    this.slots.forEach((s) => s.classList.toggle('on', on));
  }
}
