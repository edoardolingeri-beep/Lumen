// Soft synthetic instruments. Each takes (ctx, destination, freq, time, vel)
// and works with both AudioContext and OfflineAudioContext.

function env(ctx, gainNode, t, peak, attack, decay, floor = 0.0001) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(floor, t + attack + decay);
}

function osc(ctx, type, freq, t, stop, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t);
  o.stop(stop);
  return o;
}

/** Soft felt piano: a few sine/triangle partials through a closing low-pass. */
export function piano(ctx, dest, freq, t, vel = 0.7) {
  const decay = Math.max(0.9, 2.2 - (freq - 260) / 500);
  const end = t + decay + 0.1;
  const out = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(Math.min(5200, freq * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.2), t + decay * 0.6);
  lp.connect(out).connect(dest);
  env(ctx, out, t, 0.32 * vel, 0.006, decay);
  const partials = [
    ['triangle', 1, 0.75, 0],
    ['sine', 1, 0.5, 4],
    ['sine', 2, 0.16, -3],
    ['sine', 3, 0.05, 2],
  ];
  for (const [type, mult, amp, det] of partials) {
    const g = ctx.createGain();
    g.gain.value = amp;
    osc(ctx, type, freq * mult, t, end, det).connect(g).connect(lp);
  }
  // Tiny hammer "thock" for presence.
  const thump = ctx.createGain();
  env(ctx, thump, t, 0.05 * vel, 0.002, 0.06);
  osc(ctx, 'sine', freq * 4.01, t, t + 0.1).connect(thump).connect(out);
}

/** Glass chime: two-operator FM bell with long gentle tail. */
export function chime(ctx, dest, freq, t, vel = 0.7) {
  const decay = 2.8;
  const end = t + decay + 0.1;
  const out = ctx.createGain();
  out.connect(dest);
  env(ctx, out, t, 0.2 * vel, 0.004, decay);
  const car = osc(ctx, 'sine', freq, t, end);
  const mod = osc(ctx, 'sine', freq * 3.5, t, end);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 1.6, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + 1.2);
  mod.connect(modGain).connect(car.frequency);
  car.connect(out);
  const shimmer = ctx.createGain();
  env(ctx, shimmer, t, 0.05 * vel, 0.004, 1.2);
  osc(ctx, 'sine', freq * 2, t, end, 3).connect(shimmer).connect(dest);
}

/** Warm pad pluck: detuned saws, slow-ish attack, rounded by a low-pass. */
export function warm(ctx, dest, freq, t, vel = 0.7) {
  const decay = 1.8;
  const end = t + decay + 0.2;
  const out = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(freq * 6, t);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + decay);
  lp.connect(out).connect(dest);
  env(ctx, out, t, 0.12 * vel, 0.03, decay);
  osc(ctx, 'sawtooth', freq, t, end, -8).connect(lp);
  osc(ctx, 'sawtooth', freq, t, end, 8).connect(lp);
  const sub = ctx.createGain();
  sub.gain.value = 0.9;
  osc(ctx, 'sine', freq / 2, t, end).connect(sub).connect(lp);
}

/** Music box / kalimba: bright tine with an inharmonic ping. */
export function musicbox(ctx, dest, freq, t, vel = 0.7) {
  const f = freq * 2;
  const decay = 1.6;
  const end = t + decay + 0.1;
  const out = ctx.createGain();
  out.connect(dest);
  env(ctx, out, t, 0.2 * vel, 0.002, decay);
  osc(ctx, 'sine', f, t, end).connect(out);
  const ping = ctx.createGain();
  env(ctx, ping, t, 0.08 * vel, 0.001, 0.18);
  osc(ctx, 'sine', f * 2.76, t, t + 0.3).connect(ping).connect(dest);
  const body = ctx.createGain();
  env(ctx, body, t, 0.05 * vel, 0.002, 0.6);
  osc(ctx, 'triangle', f / 2, t, end).connect(body).connect(dest);
}

export const INSTRUMENTS = { piano, chime, warm, musicbox };
