// Adaptive ambient music.
//
// A warm pad drifts through a slow chord progression. More layers join as the
// player gets closer to the solution:
//   intensity 0     → pad only
//   intensity ≥ .5  → soft piano chord tones
//   intensity ≥ .75 → a small music-box arpeggio
// The full melody is played by the completion sequence itself.

import { audio } from './engine.js';
import { INSTRUMENTS } from './instruments.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chord voicings (MIDI) per world; index 0 is used for menus.
const PROGRESSIONS = [
  [[48, 55, 64, 71], [41, 48, 57, 64], [45, 52, 60, 67], [43, 50, 59, 64]],
  [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 60, 62]],
  [[41, 48, 57, 64], [40, 48, 55, 64], [38, 50, 57, 65], [43, 50, 60, 67]],
  [[45, 52, 60, 67], [41, 48, 57, 64], [48, 55, 64, 67], [43, 50, 59, 67]],
  [[40, 52, 59, 67], [41, 48, 57, 64], [45, 52, 60, 67], [43, 50, 59, 66 - 1]],
  [[36, 55, 64, 71], [38, 53, 60, 69], [41, 57, 64, 72], [40, 55, 62, 71]],
];

const AMBIENCES = ['drift', 'rain', 'ocean', 'space'];

class Music {
  constructor() {
    this.playing = false;
    this.intensity = 0;
    this.smooth = 0;
    this.world = 0;
    this.mode = 'menu';
    this.ambience = 'drift';
    this.step = 0;
    this.chordIdx = 0;
    this.timer = null;
  }

  _build() {
    const ctx = audio.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(audio.musicBus);

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 760;
    this.padFilter.Q.value = 0.6;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.16;
    this.padFilter.connect(this.padGain).connect(this.out);

    // Slow filter breathing.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.06;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 260;
    this.lfo.connect(lfoAmt).connect(this.padFilter.frequency);
    this.lfo.start();

    const chord = this._chord();
    this.voices = chord.map((m, i) => {
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.32 : 0.24;
      const a = ctx.createOscillator();
      a.type = 'triangle';
      a.frequency.value = mtof(m);
      a.detune.value = -6;
      const b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.value = mtof(m);
      b.detune.value = 7;
      a.connect(g);
      b.connect(g);
      g.connect(this.padFilter);
      a.start();
      b.start();
      return { a, b, g };
    });

    this.layerOut = ctx.createGain();
    this.layerOut.gain.value = 1;
    this.layerOut.connect(this.out);
    this._buildAmbience();
  }

  _buildAmbience() {
    const ctx = audio.ctx;
    if (this.amb) {
      try {
        this.amb.src.stop();
      } catch (e) {
        /* already stopped */
      }
      this.amb.out.disconnect();
      this.amb = null;
    }
    if (this.ambience === 'drift') return;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = this.ambience === 'ocean' ? b * 0.985 + w * 0.06 : w;
      d[i] = b;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const out = ctx.createGain();
    if (this.ambience === 'rain') {
      f.type = 'highpass';
      f.frequency.value = 2400;
      out.gain.value = 0.018;
    } else if (this.ambience === 'ocean') {
      f.type = 'lowpass';
      f.frequency.value = 700;
      out.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const amt = ctx.createGain();
      amt.gain.value = 0.045;
      lfo.connect(amt).connect(out.gain);
      lfo.start();
    } else {
      // space: a very low, slowly beating drone.
      f.type = 'lowpass';
      f.frequency.value = 180;
      out.gain.value = 0.06;
    }
    src.connect(f).connect(out).connect(this.out);
    src.start();
    this.amb = { src, out };
  }

  _chord() {
    const prog = PROGRESSIONS[this.world] || PROGRESSIONS[0];
    return prog[this.chordIdx % prog.length];
  }

  start({ mode = 'menu', world = 0 } = {}) {
    this.mode = mode;
    if (world !== this.world) {
      this.world = world;
      this.chordIdx = 0;
      if (this.playing) this._glide(2.5);
    }
    audio.onReady(() => {
      if (!audio.ctx) return;
      if (!this.out) this._build();
      if (!this.playing) {
        this.playing = true;
        const t = audio.ctx.currentTime;
        this.out.gain.cancelScheduledValues(t);
        this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), t);
        this.out.gain.linearRampToValueAtTime(1, t + 3);
        this.nextTime = t + 0.2;
        this.timer = setInterval(() => this._tick(), 40);
      }
    });
  }

  stop(fade = 1.2) {
    if (!this.playing || !audio.ctx) return;
    this.playing = false;
    clearInterval(this.timer);
    const t = audio.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0.0001, t + fade);
  }

  setMode(mode) {
    this.mode = mode;
  }

  setIntensity(x) {
    this.intensity = Math.max(0, Math.min(1, x));
  }

  setAmbience(name) {
    if (!AMBIENCES.includes(name) || name === this.ambience) return;
    this.ambience = name;
    if (this.out) this._buildAmbience();
  }

  /** Temporarily lower the music (e.g. while a melody plays). */
  duck(amount = 0.35, seconds = 3) {
    if (!this.out || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const g = this.layerOut.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(amount, t, 0.15);
    g.setTargetAtTime(1, t + seconds, 0.8);
    const p = this.padGain.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(0.16 * Math.max(amount, 0.5), t, 0.2);
    p.setTargetAtTime(0.16, t + seconds, 1);
  }

  _glide(tc = 1.4) {
    const t = audio.ctx.currentTime;
    this._chord().forEach((m, i) => {
      const v = this.voices[i];
      v.a.frequency.setTargetAtTime(mtof(m), t, tc);
      v.b.frequency.setTargetAtTime(mtof(m), t, tc);
    });
  }

  _tick() {
    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const bpm = 66;
    const eighth = 30 / bpm;
    // Smooth the intensity so layers fade in rather than switch.
    this.smooth += (this.intensity - this.smooth) * 0.03;
    // Never try to "catch up" after a stall: just continue from now.
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this._schedule(this.step, this.nextTime);
      this.nextTime += eighth;
      this.step++;
    }
  }

  _schedule(step, t) {
    const ctx = audio.ctx;
    if (step % 16 === 0 && step > 0) {
      this.chordIdx++;
      this._glide(this.mode === 'level' ? 1.2 : 1.8);
    }
    const chord = this._chord();
    const top = chord.slice(1).map((m) => m + 12);
    const lvl = this.smooth;
    const pianoLvl = this.mode === 'level' ? clamp((lvl - 0.4) / 0.2) : this.mode === 'zen' ? 0.6 : 0.35;
    const arpLvl = this.mode === 'level' ? clamp((lvl - 0.68) / 0.12) : 0;
    const rand = Math.random();

    if (pianoLvl > 0.02 && step % 4 === 0 && rand < 0.8) {
      const m = top[(step / 4 + Math.floor(rand * 3)) % top.length];
      INSTRUMENTS.piano(ctx, this.layerOut, mtof(m), t + Math.random() * 0.03, 0.22 * pianoLvl);
    }
    if (arpLvl > 0.02) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      const m = top[pattern[step % 8] % top.length] + 12;
      INSTRUMENTS.musicbox(ctx, this.layerOut, mtof(m) / 2, t, 0.16 * arpLvl);
    }
    if (this.mode === 'menu' && step % 12 === 6 && rand < 0.55) {
      // Occasional high glints.
      const m = top[Math.floor(rand * 10) % top.length] + 12;
      INSTRUMENTS.chime(ctx, this.layerOut, mtof(m), t, 0.18);
    }
    if (this.ambience === 'space' && step % 32 === 0) {
      INSTRUMENTS.warm(ctx, this.layerOut, mtof(chord[0] - 12), t, 0.35);
    }
  }
}

function clamp(x) {
  return Math.max(0, Math.min(1, x));
}

export const music = new Music();
