// Home: title, breathing orb that pulses with the music, PLAY and modes.

import { h, pad2 } from '../utils/dom.js';
import { btn, notesPill } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { audio } from '../audio/engine.js';
import { save } from '../utils/storage.js';
import { nextLevelId, totals, dailyRecord } from '../game/progress.js';
import { dateKey } from '../levels/index.js';
import { sfx } from '../audio/sound.js';
import { showHowTo } from '../components/howto.js';

export function create(app) {
  const next = nextLevelId();
  const { percent, done } = totals();
  const pill = notesPill();

  const orb = h('div', { class: 'orb', 'aria-hidden': 'true' }, h('div', { class: 'orb-halo' }), h('div', { class: 'orb-ring r1' }), h('div', { class: 'orb-ring r2' }), h('div', { class: 'orb-core' }));

  const play = btn({
    cls: 'play-btn glass',
    ico: 'play',
    label: 'PLAY',
    sound: 'select',
    icoSize: 22,
    onClick: () => app.go('game', { id: next }),
  });
  const progress = h('div', { class: 'home-progress' }, h('span', {}, `LEVEL ${pad2(next)}`), h('span', { class: 'dot' }, '·'), h('span', {}, `${percent}%`));
  const bar = h('div', { class: 'home-bar' }, h('div', { class: 'home-bar-fill', style: { width: `${Math.max(2, (done / 100) * 100)}%` } }));

  const dailyDone = !!dailyRecord(dateKey());
  const mode = (ico, label, sub, onClick, extra = '') => {
    const b = btn({ cls: `mode-card glass ${extra}`, ico, label, sub, onClick, icoSize: 20 });
    return b;
  };
  const modes = h(
    'div',
    { class: 'mode-grid' },
    mode('journey', 'Journey', `${done}/100`, () => app.go('journey')),
    mode('daily', 'Daily', dailyDone ? 'Complete' : 'New puzzle', () => app.go('daily'), dailyDone ? '' : 'has-dot'),
    mode('zen', 'Zen', 'Just play', () => app.go('zen')),
    mode('theme', 'Theme', 'Customise', () => app.go('theme')),
  );

  const muted = () => !save.data.settings.sound && !save.data.settings.music;
  const soundBtn = btn({
    cls: 'round-btn glass',
    ico: muted() ? 'soundOff' : 'sound',
    label: 'SOUND',
    onClick: () => {
      const m = !muted();
      save.update((d) => {
        d.settings.sound = !m;
        d.settings.music = !m;
      });
      app.applySettings();
      soundBtn.querySelector('svg').outerHTML = icon(m ? 'soundOff' : 'sound', 20);
      soundBtn.setAttribute('aria-pressed', String(!m));
      if (!m) sfx('select');
    },
  });
  const settingsBtn = btn({ cls: 'round-btn glass', ico: 'settings', label: 'SETTINGS', onClick: () => app.go('settings') });

  const helpBtn = btn({ cls: 'round-btn glass', ico: 'help', aria: 'How to play', icoSize: 22, onClick: () => showHowTo() });

  const el = h(
    'section',
    { class: 'home' },
    h('div', { class: 'home-top' }, btn({ cls: 'icon-btn', ico: 'sky', aria: 'Your sky', onClick: () => app.go('sky') }), pill),
    h('div', { class: 'home-title stagger' }, h('h1', { class: 'logo' }, 'LUMEN'), h('p', { class: 'tagline' }, 'A musical puzzle')),
    h('div', { class: 'orb-wrap stagger' }, orb),
    h('div', { class: 'home-play stagger' }, play, progress, bar),
    h('div', { class: 'stagger' }, modes),
    h('div', { class: 'home-bottom stagger' }, soundBtn, helpBtn, settingsBtn),
  );

  let raf = 0;
  let smooth = 0;
  const loop = (t) => {
    const lvl = audio.level();
    smooth += (lvl - smooth) * 0.12;
    const breath = 0.5 + 0.5 * Math.sin(t / 2400);
    orb.style.setProperty('--pulse', (smooth * 0.9 + breath * 0.25).toFixed(3));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    el,
    musicMode: 'menu',
    destroy() {
      cancelAnimationFrame(raf);
      pill._cleanup && pill._cleanup();
    },
  };
}
