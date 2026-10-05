// Audio graph for LUMEN (Web Audio API, no dependencies).
//
//   notes ─┐
//   sfx  ──┼─> master ─> compressor ─> destination
//   music ─┘      ^
//      └──────> reverb (generated impulse) ─┘
//
// The context is created lazily and unlocked on the first user gesture
// (required by iOS / Chrome autoplay policies).

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.settings = { volume: 0.8, sound: true, music: true };
    this._listeners = [];
  }

  /** Create the graph if needed. Safe to call many times. */
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // iOS: play through the media channel so the silent switch does not mute the game.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) {}
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);

    const bus = (level, send) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master);
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
      return g;
    };
    this.notesBus = bus(this.settings.sound ? 1 : 0, 0.42);
    this.sfxBus = bus(this.settings.sound ? 0.9 : 0, 0.25);
    this.musicBus = bus(this.settings.music ? 0.6 : 0, 0.6);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.musicBus.connect(this.analyser);
    this.notesBus.connect(this.analyser);
    this._timeData = new Uint8Array(this.analyser.fftSize);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else if (this.ready) this.ctx.resume().catch(() => {});
    });
    return ctx;
  }

  /** Call from a user gesture. Resolves once audio can play. */
  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      // iOS: play a silent buffer inside the gesture.
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    }
    if (!this.ready) {
      this.ready = true;
      this._listeners.splice(0).forEach((fn) => fn());
    }
  }

  onReady(fn) {
    if (this.ready) fn();
    else this._listeners.push(fn);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  apply(settings) {
    Object.assign(this.settings, settings);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.volume, t, 0.05);
    this.notesBus.gain.setTargetAtTime(this.settings.sound ? 1 : 0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sound ? 0.9 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music ? 0.6 : 0, t, 0.3);
  }

  /** Current loudness 0..1 of music + notes (for visuals that pulse with sound). */
  level() {
    if (!this.analyser || !this.running) return 0;
    this.analyser.getByteTimeDomainData(this._timeData);
    let sum = 0;
    for (let i = 0; i < this._timeData.length; i++) {
      const v = (this._timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this._timeData.length) * 4);
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Low-passed noise with an exponential tail: soft, dark hall.
        lp += (Math.random() * 2 - 1 - lp) * 0.35;
        d[i] = lp * Math.pow(1 - t, decay) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
      }
    }
    return buf;
  }
}

export const audio = new AudioEngine();
