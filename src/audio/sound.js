// High-level sound API used by the UI: notes, sequences and interface sounds.

import { audio } from './engine.js';
import { INSTRUMENTS } from './instruments.js';
import { SFX } from './sfx.js';
import { noteFrequency } from '../data/notes.js';

let instrumentName = 'piano';

export function setInstrument(name) {
  if (INSTRUMENTS[name]) instrumentName = name;
}

export function getInstrument() {
  return instrumentName;
}

function canPlay() {
  return audio.running;
}

/** Play a single note (degree 1-7). Rests (0) are silent. */
export function playNote(deg, { when = 0, vel = 0.75, octave = 4, instrument = instrumentName, dest } = {}) {
  if (!deg || !canPlay()) return;
  const ctx = audio.ctx;
  INSTRUMENTS[instrument](ctx, dest || audio.notesBus, noteFrequency(deg, octave), Math.max(ctx.currentTime, when || ctx.currentTime), vel);
}

export function sfx(name, arg) {
  if (!canPlay() || !SFX[name]) return;
  SFX[name](audio.ctx, audio.sfxBus, audio.ctx.currentTime + 0.005, arg);
}

/**
 * Play a list of degrees in time, calling onStep(i) in sync with the sound.
 * Returns { cancel, duration } (duration in ms).
 */
export function playSequence(degs, { interval = 0.36, vel = 0.75, instrument = instrumentName, onStep, onEnd, delay = 0.08 } = {}) {
  const timers = [];
  let gate = null;
  const playing = canPlay();
  const base = playing ? audio.ctx.currentTime + delay : 0;
  if (playing) {
    gate = audio.ctx.createGain();
    gate.connect(audio.notesBus);
  }
  degs.forEach((deg, i) => {
    if (playing && deg) {
      INSTRUMENTS[instrument](audio.ctx, gate, noteFrequency(deg, 4), base + i * interval, vel);
    }
    if (onStep) timers.push(setTimeout(() => onStep(i), (delay + i * interval) * 1000));
  });
  const duration = (delay + degs.length * interval) * 1000;
  if (onEnd) timers.push(setTimeout(onEnd, duration));
  return {
    duration,
    cancel() {
      timers.forEach(clearTimeout);
      if (gate && audio.ctx) {
        const t = audio.ctx.currentTime;
        gate.gain.setTargetAtTime(0, t, 0.03);
        setTimeout(() => gate.disconnect(), 400);
      }
    },
  };
}
