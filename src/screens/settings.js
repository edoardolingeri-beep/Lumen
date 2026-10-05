// SETTINGS — audio, vibration, animations, colour mode, reset.

import { h } from '../utils/dom.js';
import { btn, topBar, confirmDialog, toast } from '../components/ui.js';
import { save } from '../utils/storage.js';
import { sfx, playNote } from '../audio/sound.js';
import { haptics } from '../utils/haptics.js';
import { showHowTo } from '../components/howto.js';

export function create(app) {
  const s = () => save.data.settings;

  const set = (key, value) => {
    save.update((d) => (d.settings[key] = value));
    app.applySettings();
  };

  const toggle = (key, label, desc, onLabel = 'ON', offLabel = 'OFF', values = [true, false]) => {
    const b = h('button', { class: 'switch', type: 'button', role: 'switch' });
    const render = () => {
      const on = s()[key] === values[0];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.innerHTML = `<span class="switch-label">${on ? onLabel : offLabel}</span><span class="switch-knob"></span>`;
    };
    render();
    b.addEventListener('click', () => {
      const on = s()[key] === values[0];
      set(key, on ? values[1] : values[0]);
      render();
      sfx('button');
      if (key === 'vibration' && !on) haptics.success();
    });
    return h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('span', { class: 'setting-name' }, label), desc ? h('span', { class: 'setting-desc' }, desc) : ''), b);
  };

  const volume = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s().volume), 'aria-label': 'Volume', class: 'slider' });
  let lastPreview = 0;
  volume.addEventListener('input', () => {
    set('volume', Number(volume.value));
    volume.style.setProperty('--v', `${Number(volume.value) * 100}%`);
    const now = performance.now();
    if (now - lastPreview > 160) {
      lastPreview = now;
      playNote(5, { vel: 0.5 });
    }
  });
  volume.style.setProperty('--v', `${s().volume * 100}%`);

  const resetBtn = btn({
    cls: 'danger small-btn',
    label: 'RESET',
    onClick: async () => {
      const ok = await confirmDialog({
        title: 'Reset progress?',
        text: 'Levels, stars, notes and unlocked themes will be erased. Settings are kept.',
        ok: 'Reset',
        cancel: 'Keep playing',
        danger: true,
      });
      if (ok) {
        save.reset();
        app.applyTheme();
        toast('Progress reset. A fresh sky awaits.');
      }
    },
  });

  const el = h(
    'section',
    { class: 'settings' },
    topBar({ left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => app.back() })], center: h('h2', { class: 'screen-title' }, 'SETTINGS') }),
    h(
      'div',
      { class: 'settings-list' },
      h('div', { class: 'group glass stagger' }, h('div', { class: 'group-title' }, 'Audio'), toggle('sound', 'Sound', 'Notes and effects'), toggle('music', 'Music', 'Ambient soundtrack'), h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('span', { class: 'setting-name' }, 'Volume')), volume)),
      h(
        'div',
        { class: 'group glass stagger' },
        h('div', { class: 'group-title' }, 'Comfort'),
        toggle('vibration', 'Vibration', 'Light haptics on supported phones'),
        toggle('animations', 'Animations', 'Reduce motion and particles', 'FULL', 'REDUCED', ['full', 'reduced']),
      ),
      h(
        'div',
        { class: 'group glass stagger' },
        h('div', { class: 'group-title' }, 'Accessibility'),
        toggle('colorMode', 'Color mode', 'Colour-blind friendly palette', 'NORMAL', 'COLOR BLIND', ['normal', 'colorblind']),
        toggle('noteNames', 'Note names', 'Solfège or letters', 'DO RE MI', 'C D E', ['solfege', 'letters']),
      ),
      h('div', { class: 'group glass stagger' }, h('div', { class: 'group-title' }, 'Help'), h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('span', { class: 'setting-name' }, 'How to play'), h('span', { class: 'setting-desc' }, 'Reading order and the basics')), btn({ cls: 'small-btn', label: 'OPEN', onClick: () => showHowTo() }))),
      h('div', { class: 'group glass stagger' }, h('div', { class: 'group-title' }, 'Progress'), h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('span', { class: 'setting-name' }, 'Reset progress'), h('span', { class: 'setting-desc' }, 'Start the journey again')), resetBtn)),
      h('p', { class: 'about stagger' }, 'LUMEN · a musical puzzle · v1.0', h('br'), 'Saved automatically on this device. Works offline.'),
    ),
  );
  return { el, musicMode: 'menu' };
}
