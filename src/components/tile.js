// Visual representation of a note tile.

import { symbolSVG, noteLabel, setColorVars } from '../data/notes.js';
import { tileNotes } from '../game/model.js';
import { h } from '../utils/dom.js';
import { prefs } from './prefs.js';

export function noteColor(deg) {
  return prefs.palette[deg || 0];
}

export function tileColor(tile, rot = 0) {
  const notes = tileNotes(tile, rot);
  return noteColor(notes[0]);
}

function rotorRing(tile, rot) {
  const n = tile.faces.length;
  const ring = h('div', { class: 'rotor-ring' });
  ring.style.transform = `rotate(${-rot * (360 / n)}deg)`;
  tile.faces.forEach((deg, i) => {
    const a = (i * 360) / n;
    const pip = h('div', { class: 'rotor-pip', html: symbolSVG(deg, 10) });
    pip.style.transform = `rotate(${a}deg) translateY(calc(var(--cs) * -0.36)) rotate(${-a}deg)`;
    pip.style.color = noteColor(deg);
    ring.append(pip);
  });
  return ring;
}

export function createTileEl(tile, rot = 0) {
  const el = h('div', { class: `tile kind-${tile.kind}${tile.locked ? ' locked' : ''}` });
  const body = h('div', { class: 'tile-body' });
  el.append(body);
  renderTileFace(el, tile, rot);
  return el;
}

export function renderTileFace(el, tile, rot = 0) {
  const body = el.querySelector('.tile-body');
  body.innerHTML = '';
  const notes = tileNotes(tile, rot);
  const style = prefs.noteNames;
  setColorVars(el, noteColor(notes[0]));
  if (tile.kind === 'double') setColorVars(el, noteColor(notes[1]), '--c2');
  const label = tile.kind === 'double' ? notes.map((d) => noteLabel(d, style)).join(' ') : noteLabel(notes[0], style);
  let face;
  if (tile.kind === 'double') {
    face = h(
      'div',
      { class: 'tile-face double' },
      h('span', { class: 'half', style: { color: noteColor(notes[0]) }, html: symbolSVG(notes[0], 18) }),
      h('span', { class: 'half', style: { color: noteColor(notes[1]) }, html: symbolSVG(notes[1], 18) }),
    );
  } else {
    face = h('div', { class: 'tile-face', html: symbolSVG(notes[0], 22) });
  }
  body.append(h('div', { class: 'tile-sheen' }), face, h('div', { class: 'tile-label' }, label));
  if (tile.kind === 'rotor') body.append(rotorRing(tile, rot));
  if (tile.locked) body.append(h('div', { class: 'tile-pin' }));
  el.setAttribute('aria-label', `${label}${tile.locked ? ', locked' : ''}`);
}

/** Rotate a rotor tile with a soft spin before re-rendering the face. */
export function spinRotor(el, tile, rot, prevRot) {
  const ring = el.querySelector('.rotor-ring');
  const n = tile.faces.length;
  if (ring) {
    ring.style.transition = 'transform 260ms cubic-bezier(.3,.7,.3,1)';
    // Always turn forward by one step, even when wrapping back to face 0.
    ring.style.transform = `rotate(${-(prevRot + 1) * (360 / n)}deg)`;
  }
  setTimeout(() => renderTileFace(el, tile, rot), ring ? 240 : 0);
}
