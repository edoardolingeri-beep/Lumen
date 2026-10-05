// Shared UI pieces: buttons with micro-interactions, overlays, dialogs, toasts.

import { h } from '../utils/dom.js';
import { icon } from './icons.js';
import { sfx } from '../audio/sound.js';
import { haptics } from '../utils/haptics.js';
import { save } from '../utils/storage.js';

/** Button with soft press-scale, click sound and light haptic. */
export function btn({ label = '', ico = null, cls = '', onClick, sound = 'button', aria, sub = null, icoSize = 20 } = {}) {
  const b = h('button', { class: `btn ${cls}`, type: 'button', 'aria-label': aria || label || ico });
  if (ico) b.insertAdjacentHTML('beforeend', icon(ico, icoSize));
  if (label) b.append(h('span', { class: 'btn-label' }, label));
  if (sub) b.append(h('span', { class: 'btn-sub' }, sub));
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    if (sound) sfx(sound);
    haptics.tap();
    if (onClick) onClick(e);
  });
  return b;
}

let overlayRoot = null;
const openOverlays = [];

export function initOverlays(root) {
  overlayRoot = root;
}

/** Translucent overlay. Returns { el, panel, close }. */
export function overlay({ cls = '', dismissable = true, onClose, children = [] } = {}) {
  const panel = h('div', { class: `overlay-panel ${cls}` }, ...children);
  const el = h('div', { class: 'overlay' }, panel);
  let closed = false;
  const api = {
    el,
    panel,
    close(result) {
      if (closed) return;
      closed = true;
      const i = openOverlays.indexOf(api);
      if (i >= 0) openOverlays.splice(i, 1);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
      if (onClose) onClose(result);
    },
    dismissable,
  };
  if (dismissable) {
    el.addEventListener('click', (e) => {
      if (e.target === el) api.close();
    });
  }
  overlayRoot.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  openOverlays.push(api);
  return api;
}

/** Close the top-most dismissable overlay (used by the back button). */
export function closeTopOverlay() {
  const top = openOverlays[openOverlays.length - 1];
  if (top && top.dismissable) {
    top.close();
    return true;
  }
  return !!top; // a non-dismissable overlay swallows back
}

export function hasOverlay() {
  return openOverlays.length > 0;
}

export function confirmDialog({ title, text, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const o = overlay({
      cls: 'dialog',
      onClose: () => resolve(result),
      children: [
        h('h2', { class: 'dialog-title' }, title),
        h('p', { class: 'dialog-text' }, text),
        h(
          'div',
          { class: 'dialog-actions' },
          btn({ label: cancel, cls: 'ghost', onClick: () => o.close() }),
          btn({
            label: ok,
            cls: danger ? 'danger' : 'primary',
            onClick: () => {
              result = true;
              o.close();
            },
          }),
        ),
      ],
    });
  });
}

let toastEl = null;
let toastTimer = null;
export function toast(msg, ms = 2200) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/** "✨ 120" currency pill that stays in sync with the save. */
export function notesPill() {
  const val = h('span', { class: 'pill-val' }, String(save.data.notes));
  const el = h('div', { class: 'pill notes-pill', 'aria-label': 'Notes' });
  el.insertAdjacentHTML('beforeend', icon('sparkle', 15));
  el.append(val);
  let last = save.data.notes;
  const unsub = save.subscribe((d) => {
    if (d.notes === last) return;
    last = d.notes;
    val.textContent = String(d.notes);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  });
  el._cleanup = unsub;
  return el;
}

export function starsRow(n, total = 3, size = 14) {
  const row = h('span', { class: 'stars-row' });
  for (let i = 0; i < total; i++) {
    row.insertAdjacentHTML('beforeend', `<span class="st${i < n ? ' on' : ''}">${icon(i < n ? 'starFill' : 'star', size)}</span>`);
  }
  return row;
}

export function topBar({ left = [], center = null, right = [] }) {
  return h('header', { class: 'topbar' }, h('div', { class: 'tb-left' }, ...left), h('div', { class: 'tb-center' }, center), h('div', { class: 'tb-right' }, ...right));
}
