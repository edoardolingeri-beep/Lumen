// Living background: soft gradient sky, twinkling stars, drifting particles,
// glows, and the ripples / bursts / trails triggered by notes.
// One canvas, one requestAnimationFrame loop, sprite-based glows for speed.

const hexToRgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const spriteCache = new Map();
function glowSprite(color, size = 64) {
  const key = `${color}|${size}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  if (spriteCache.size > 160) spriteCache.clear();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const [r, gg, b] = typeof color === 'string' ? hexToRgb(color) : color;
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

export class Sky {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.reduced = false;
    this.style = { particles: 'dust', waves: 'rings' };
    const base = { sky: ['#050a1e', '#0b1538', '#141d48'], glow: '#4a6fe0', glow2: '#6b5bd6', stars: 1 };
    this.from = this._pal(base);
    this.to = this._pal(base);
    this.blend = 1;
    this.blendDur = 1;
    this.ripples = [];
    this.parts = [];
    this.quality = 1;
    this.frameAvg = 16;
    this.time = 0;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this._seedStars();
    this._seedAmbient();
    this.running = true;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) {
        this.last = performance.now();
        requestAnimationFrame(this._loop);
      }
    });
  }

  _pal(p) {
    return { sky: p.sky.map(hexToRgb), glow: hexToRgb(p.glow), glow2: hexToRgb(p.glow2 || p.glow), stars: p.stars ?? 1 };
  }

  _current() {
    const k = easeInOut(Math.min(1, this.blend));
    return {
      sky: this.from.sky.map((c, i) => mix(c, this.to.sky[i], k)),
      glow: mix(this.from.glow, this.to.glow, k),
      glow2: mix(this.from.glow2, this.to.glow2, k),
      stars: this.from.stars + (this.to.stars - this.from.stars) * k,
    };
  }

  setPalette(p, ms = 1400) {
    const next = this._pal(p);
    const cur = this._current();
    this.from = cur;
    this.to = next;
    this.blend = ms <= 0 ? 1 : 0;
    this.blendDur = Math.max(1, ms) / 1000;
  }

  setStyle(style) {
    const changed = style.particles && style.particles !== this.style.particles;
    Object.assign(this.style, style);
    if (changed) this._seedAmbient();
  }

  setReduced(on) {
    this.reduced = on;
    this._seedAmbient();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.dpr = dpr;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.stars) this._seedStars();
  }

  _seedStars() {
    const area = (this.w * this.h) / (390 * 844);
    const n = Math.round(110 * Math.min(1.8, Math.max(0.6, area)));
    this.stars = [];
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: Math.random() < 0.08 ? 1.6 + Math.random() : 0.5 + Math.random() * 0.9,
        p: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 1.4,
        rank: Math.random(), // used for density: stars with rank < density are shown
      });
    }
  }

  _seedAmbient() {
    const kind = this.style.particles;
    const n = this.reduced ? 6 : { dust: 16, fireflies: 12, snow: 22, sparkle: 14 }[kind] || 14;
    this.ambient = [];
    for (let i = 0; i < n; i++) this.ambient.push(this._newAmbient(kind, true));
  }

  _newAmbient(kind, anywhere) {
    const w = this.w;
    const h = this.h;
    const a = {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : kind === 'snow' ? -10 : h + 10,
      vx: (Math.random() - 0.5) * 6,
      vy: kind === 'snow' ? 6 + Math.random() * 10 : -(3 + Math.random() * 7),
      size: kind === 'snow' ? 0.9 + Math.random() * 1.3 : 0.7 + Math.random() * 1.3,
      p: Math.random() * Math.PI * 2,
      a: 0.12 + Math.random() * 0.3,
    };
    if (kind === 'fireflies') {
      a.vy = (Math.random() - 0.5) * 8;
      a.vx = (Math.random() - 0.5) * 8;
    }
    return a;
  }

  // ----- effects -----------------------------------------------------------

  ripple(x, y, color, { scale = 1, dur = 0.9 } = {}) {
    const c = hexToRgb(color);
    const style = this.style.waves;
    const base = { x, y, c, t: 0, dur: this.reduced ? dur * 0.7 : dur, max: 70 * scale };
    if (style === 'double') {
      this.ripples.push({ ...base, kind: 'ring' }, { ...base, kind: 'ring', t: -0.16, max: base.max * 0.75 });
    } else if (style === 'bloom') {
      this.ripples.push({ ...base, kind: 'bloom', max: base.max * 0.9 });
    } else if (style === 'ripple') {
      for (let i = 0; i < 3; i++) this.ripples.push({ ...base, kind: 'thin', t: -i * 0.14, max: base.max * (1 - i * 0.12) });
    } else this.ripples.push({ ...base, kind: 'ring' });
    if (this.ripples.length > 40) this.ripples.splice(0, this.ripples.length - 40);
  }

  burst(x, y, color, count = 4, { speed = 60, life = 0.9, size = 2.2 } = {}) {
    if (this.reduced) count = Math.min(count, 2);
    count = Math.round(count * this.quality);
    const c = hexToRgb(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life, t: 0, c, size: size * (0.6 + Math.random() * 0.8) });
    }
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  }

  trail(x, y, color) {
    if (this.reduced) return;
    const c = hexToRgb(color);
    this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 10, vy: 6 + Math.random() * 8, life: 0.6, t: 0, c, size: 1.4 + Math.random() * 1.6 });
  }

  bigWave(x, y, color) {
    const c = hexToRgb(color);
    this.ripples.push({ x, y, c, t: 0, dur: 1.8, max: Math.hypot(this.w, this.h) * 0.75, kind: 'big' });
    this.ripples.push({ x, y, c, t: -0.25, dur: 1.8, max: Math.hypot(this.w, this.h) * 0.55, kind: 'ring' });
    this.burst(x, y, color, 36, { speed: 220, life: 1.6, size: 2.6 });
  }

  // ----- render -------------------------------------------------------------

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    // Adaptive quality: if frames are slow, thin out effects.
    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05;
    if (this.frameAvg > 26 && this.quality > 0.5) this.quality -= 0.01;
    else if (this.frameAvg < 18 && this.quality < 1) this.quality += 0.005;
    if (this.blend < 1) this.blend += dt / this.blendDur;
    this._draw(dt);
    requestAnimationFrame(this._loop);
  }

  _draw(dt) {
    const { ctx, w, h } = this;
    const pal = this._current();
    const t = this.time;

    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, rgb(pal.sky[0]));
    g.addColorStop(0.55, rgb(pal.sky[1]));
    g.addColorStop(1, rgb(pal.sky[2]));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Two large, slow glows.
    ctx.globalCompositeOperation = 'lighter';
    const drift = this.reduced ? 0 : t;
    this._glow(pal.glow, w * (0.25 + Math.sin(drift * 0.05) * 0.08), h * (0.22 + Math.cos(drift * 0.04) * 0.05), Math.max(w, h) * 0.7, 0.16);
    this._glow(pal.glow2, w * (0.8 + Math.cos(drift * 0.045) * 0.08), h * (0.78 + Math.sin(drift * 0.035) * 0.06), Math.max(w, h) * 0.65, 0.12);

    // Stars.
    const density = Math.min(1, pal.stars / 2.4) * 0.55 + 0.45 * Math.min(1, pal.stars);
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      if (s.rank > density) continue;
      const tw = this.reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * s.s + s.p);
      ctx.globalAlpha = (0.25 + 0.6 * tw) * (s.r > 1.4 ? 0.95 : 0.7);
      if (s.r > 1.4) {
        ctx.drawImage(glowSprite('#dfe6ff', 32), s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
      } else {
        ctx.fillRect(s.x, s.y, s.r * 1.4, s.r * 1.4);
      }
    }

    this._drawAmbient(dt, pal);
    this._drawRipples(dt);
    this._drawParts(dt);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  _glow(c, x, y, r, a) {
    const { ctx } = this;
    ctx.globalAlpha = a;
    ctx.drawImage(glowSprite(c.map((v) => Math.round(v / 6) * 6), 128), x - r, y - r, r * 2, r * 2);
  }

  _drawAmbient(dt, pal) {
    const { ctx, w, h } = this;
    const kind = this.style.particles;
    const t = this.time;
    const move = this.reduced ? 0.15 : 1;
    const warm = [255, 214, 140];
    const cool = mix(pal.glow, [255, 255, 255], 0.6).map((v) => Math.round(v / 8) * 8);
    for (let i = 0; i < this.ambient.length; i++) {
      const p = this.ambient[i];
      p.x += (p.vx + (kind === 'snow' ? Math.sin(t * 0.8 + p.p) * 6 : 0)) * dt * move;
      p.y += p.vy * dt * move;
      if (kind === 'fireflies') {
        p.vx += (Math.random() - 0.5) * 6 * dt;
        p.vy += (Math.random() - 0.5) * 6 * dt;
        p.vx = Math.max(-10, Math.min(10, p.vx));
        p.vy = Math.max(-10, Math.min(10, p.vy));
      }
      if (p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > w + 20) {
        this.ambient[i] = this._newAmbient(kind, false);
        if (kind === 'fireflies') this.ambient[i].y = Math.random() * h;
        continue;
      }
      let alpha = p.a;
      if (kind === 'fireflies') alpha *= 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.3 + p.p));
      if (kind === 'sparkle') alpha *= 0.3 + 0.7 * Math.abs(Math.sin(t * 0.9 + p.p));
      ctx.globalAlpha = alpha;
      if (kind === 'sparkle') {
        const s = p.size * 2.4;
        ctx.strokeStyle = rgb(cool, 1);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y);
        ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x, p.y + s);
        ctx.stroke();
      } else {
        const col = kind === 'fireflies' ? warm : kind === 'snow' ? [235, 240, 255] : cool;
        const s = p.size * (kind === 'snow' ? 2.4 : 3.4);
        ctx.drawImage(glowSprite(col.map((v) => v | 0), 32), p.x - s, p.y - s, s * 2, s * 2);
      }
    }
  }

  _drawRipples(dt) {
    const { ctx } = this;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.dur;
      if (k >= 1) {
        this.ripples.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const rad = 6 + r.max * e;
      const alpha = (1 - k) * (r.kind === 'big' ? 0.35 : 0.55);
      if (r.kind === 'bloom' || r.kind === 'big') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.drawImage(glowSprite(r.c, 128), r.x - rad, r.y - rad, rad * 2, rad * 2);
        if (r.kind === 'bloom') continue;
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rgb(r.c, 1);
      ctx.lineWidth = r.kind === 'thin' ? 0.8 : r.kind === 'big' ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawParts(dt) {
    const { ctx } = this;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vx *= 1 - 1.8 * dt;
      p.vy = p.vy * (1 - 1.8 * dt) - 8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.t / p.life;
      ctx.globalAlpha = (1 - k) * 0.9;
      const s = p.size * 4;
      ctx.drawImage(glowSprite(p.c, 32), p.x - s, p.y - s, s * 2, s * 2);
    }
  }
}
