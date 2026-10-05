// Application shell: screen router, settings/theme application, back button.

import { Sky } from './components/sky.js';
import { audio } from './audio/engine.js';
import { music } from './audio/music.js';
import { setInstrument } from './audio/sound.js';
import { save } from './utils/storage.js';
import { applyPrefs } from './components/prefs.js';
import { initOverlays, closeTopOverlay, hasOverlay } from './components/ui.js';
import { findTheme } from './data/themes.js';
import { WORLDS } from './data/worlds.js';
import { h } from './utils/dom.js';

import * as loading from './screens/loading.js';
import * as home from './screens/home.js';
import * as journey from './screens/journey.js';
import * as world from './screens/world.js';
import * as game from './screens/game.js';
import * as settings from './screens/settings.js';
import * as theme from './screens/theme.js';
import * as zen from './screens/zen.js';
import * as daily from './screens/daily.js';
import * as skyScreen from './screens/sky.js';

const SCREENS = { loading, home, journey, world, game, settings, theme, zen, daily, sky: skyScreen };

function hexMix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

export const app = {
  stack: [],
  current: null,

  init() {
    this.root = document.getElementById('app');
    initOverlays(document.getElementById('overlays'));
    this.sky = new Sky(document.getElementById('sky'));
    this.applySettings();
    this.applyTheme();

    const unlock = () => {
      audio.unlock();
      this.applySettings();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);

    // Hardware / browser back button support.
    history.replaceState({ lumen: 'base' }, '');
    history.pushState({ lumen: 'trap' }, '');
    window.addEventListener('popstate', () => {
      const atHome = this.current && this.current.name === 'home' && !hasOverlay();
      if (atHome) return; // let the browser leave
      this.handleBack();
      if (!history.state || history.state.lumen !== 'trap') history.pushState({ lumen: 'trap' }, '');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.handleBack();
    });

    this.go('loading');
  },

  handleBack() {
    if (hasOverlay()) {
      closeTopOverlay();
      return;
    }
    const cur = this.current;
    if (cur && cur.inst.onBack && cur.inst.onBack()) return;
    this.back();
  },

  /** Navigate to a screen. `replace` swaps the current entry instead of stacking. */
  go(name, params = {}, { replace = false, reset = false } = {}) {
    const mod = SCREENS[name];
    if (!mod) throw new Error(`Unknown screen ${name}`);
    if (reset) this.stack = [];
    else if (this.current && !replace && this.current.name !== 'loading') this.stack.push({ name: this.current.name, params: this.current.params });
    this._show(name, params);
  },

  back() {
    const prev = this.stack.pop();
    if (prev) this._show(prev.name, prev.params, true);
    else if (!this.current || this.current.name !== 'home') this._show('home', {}, true);
  },

  /** Return to a screen already in the stack (or show it fresh). */
  backTo(name, params) {
    const i = this.stack.map((s) => s.name).lastIndexOf(name);
    if (i >= 0) {
      const target = this.stack[i];
      this.stack = this.stack.slice(0, i);
      this._show(name, params || target.params, true);
    } else {
      this.stack = name === 'home' ? [] : [{ name: 'home', params: {} }];
      this._show(name, params || {}, true);
    }
  },

  _show(name, params, isBack = false) {
    // Keep one history entry above the base so the hardware back button stays ours.
    if (!history.state || history.state.lumen !== 'trap') history.pushState({ lumen: 'trap' }, '');
    const old = this.current;
    const inst = SCREENS[name].create(this, params);
    const el = inst.el;
    el.classList.add('screen', `screen-${name}`, isBack ? 'enter-back' : 'enter');
    this.root.append(el);
    this.current = { name, params, inst };
    if (old) {
      old.inst.el.classList.add(isBack ? 'leave-back' : 'leave');
      old.inst.el.classList.remove('enter', 'enter-back');
      if (old.inst.destroy) old.inst.destroy();
      setTimeout(() => old.inst.el.remove(), 420);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shown')));
    // Atmosphere for this screen.
    this.setAtmosphere(inst.world || 0, inst.musicMode || 'menu');
    if (inst.onShow) inst.onShow();
  },

  setAtmosphere(worldId, mode) {
    this.sky.setPalette(this.paletteFor(worldId), 1600);
    if (mode === 'none') music.stop();
    else music.start({ mode, world: worldId });
  },

  paletteFor(worldId) {
    const th = findTheme(save.data.equipped.theme);
    if (!worldId) return th;
    const w = WORLDS[worldId - 1];
    if (th.id === 'midnight') return w;
    return {
      sky: w.sky.map((c, i) => hexMix(c, th.sky[i], 0.5)),
      glow: hexMix(w.glow, th.glow, 0.5),
      glow2: hexMix(w.glow2, th.glow2, 0.5),
      stars: (w.stars + th.stars) / 2,
    };
  },

  applySettings() {
    const s = save.data.settings;
    audio.apply({ volume: s.volume, sound: s.sound, music: s.music });
    applyPrefs(s);
    const root = document.documentElement;
    root.classList.toggle('reduced', s.animations === 'reduced');
    root.classList.toggle('colorblind', s.colorMode === 'colorblind');
    if (this.sky) this.sky.setReduced(s.animations === 'reduced');
  },

  applyTheme() {
    const eq = save.data.equipped;
    this.sky.setStyle({ particles: eq.particles, waves: eq.waves });
    setInstrument(eq.sound);
    music.setAmbience(eq.ambience);
    document.body.dataset.skin = eq.skin;
    if (this.current) this.sky.setPalette(this.paletteFor(this.current.inst.world || 0), 900);
  },

  el: h,
};
