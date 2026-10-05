// Persistent save game (localStorage). Everything autosaves; no login.

const KEY = 'lumen.save.v1';

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  volume: 0.8,
  vibration: true,
  animations: 'full', // 'full' | 'reduced'
  colorMode: 'normal', // 'normal' | 'colorblind'
  noteNames: 'solfege', // 'solfege' | 'letters'
};

function defaults() {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    levels: {}, // id -> { stars, best }
    notes: 30, // ✨ currency
    hints: { charges: 3, last: Date.now() },
    owned: { theme: ['midnight'], skin: ['pastel'], particles: ['dust'], waves: ['rings'], sound: ['piano'], ambience: ['drift'] },
    equipped: { theme: 'midnight', skin: 'pastel', particles: 'dust', waves: 'rings', sound: 'piano', ambience: 'drift' },
    settings: { ...DEFAULT_SETTINGS, animations: reduced ? 'reduced' : 'full' },
    daily: { completed: {}, streak: 0, lastDate: null },
    seen: { intros: [], tutorial: false },
    worldsCelebrated: [],
    created: Date.now(),
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else if (v !== undefined) out[k] = v;
  }
  return out;
}

let data = load();
const listeners = new Set();
let timer = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(defaults(), raw ? JSON.parse(raw) : null);
  } catch (e) {
    return defaults();
  }
}

export function persistNow() {
  clearTimeout(timer);
  timer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    /* storage full or blocked: keep playing in memory */
  }
}

export const save = {
  get data() {
    return data;
  },
  /** Mutate the save through a function, then autosave (debounced). */
  update(fn) {
    fn(data);
    clearTimeout(timer);
    timer = setTimeout(persistNow, 120);
    listeners.forEach((l) => l(data));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset() {
    const keepSettings = data.settings;
    data = defaults();
    data.settings = keepSettings;
    persistNow();
    listeners.forEach((l) => l(data));
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => document.hidden && persistNow());
}
