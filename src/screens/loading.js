// Loading screen: logo, tagline, and a single particle crossing the sky.

import { h } from '../utils/dom.js';
import { getLevel } from '../levels/index.js';
import { nextLevelId } from '../game/progress.js';

export function create(app) {
  const el = h(
    'section',
    { class: 'loading', 'aria-label': 'Loading' },
    h('div', { class: 'traveler' }),
    h('div', { class: 'loading-center' }, h('h1', { class: 'logo' }, 'LUMEN'), h('p', { class: 'tagline' }, 'Listen. Think. Create.')),
  );
  let timer;
  return {
    el,
    musicMode: 'none',
    onShow() {
      const t0 = performance.now();
      // Warm up: fonts + the level the player will open first.
      const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
      try {
        getLevel(nextLevelId());
      } catch (e) {
        console.error(e);
      }
      fonts.then(() => {
        const wait = Math.max(0, 1900 - (performance.now() - t0));
        timer = setTimeout(() => app.go('home', {}, { replace: true }), wait);
      });
    },
    destroy() {
      clearTimeout(timer);
    },
  };
}
