// Interface sounds, synthesised on the fly. Each recipe is a pure function of
// (ctx, destination, time) so tools/render-sfx.html can bounce them to .wav.

import { chime } from './instruments.js';

function tone(ctx, dest, { type = 'sine', f0, f1 = f0, t, dur, peak, attack = 0.004 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export const SFX = {
  // Soft click for any button.
  button(ctx, dest, t) {
    tone(ctx, dest, { f0: 1320, f1: 880, t, dur: 0.07, peak: 0.06 });
    tone(ctx, dest, { type: 'triangle', f0: 440, f1: 330, t, dur: 0.05, peak: 0.03 });
  },
  // Picking up / selecting something.
  select(ctx, dest, t) {
    tone(ctx, dest, { f0: 1046.5, t, dur: 0.16, peak: 0.045 });
    tone(ctx, dest, { f0: 1568, t: t + 0.05, dur: 0.22, peak: 0.035 });
  },
  // Breathy whoosh when a note snaps into place.
  move(ctx, dest, t) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.3);
  },
  // Rising four-note bloom for success.
  success(ctx, dest, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => chime(ctx, dest, f, t + i * 0.09, 0.55 - i * 0.05));
  },
  // Little sparkle for hints.
  hint(ctx, dest, t) {
    chime(ctx, dest, 1567.98, t, 0.35);
    chime(ctx, dest, 2349.32, t + 0.12, 0.25);
  },
  // Gentle "not here" when a drop is refused.
  soft(ctx, dest, t) {
    tone(ctx, dest, { type: 'triangle', f0: 262, f1: 220, t, dur: 0.16, peak: 0.05 });
  },
  // Star pop on the completion screen (pitch set by caller via `step`).
  star(ctx, dest, t, step = 0) {
    chime(ctx, dest, [783.99, 987.77, 1174.66][step % 3], t, 0.4);
  },
  // Currency sparkle.
  coin(ctx, dest, t) {
    tone(ctx, dest, { f0: 1975.5, t, dur: 0.12, peak: 0.03 });
    tone(ctx, dest, { f0: 2637, t: t + 0.06, dur: 0.18, peak: 0.025 });
  },
};
