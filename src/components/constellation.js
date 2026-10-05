// Draws a constellation: stars light up for completed levels and lines join
// neighbours that are both lit. Supports a slow "reveal" animation.

import { CONSTELLATIONS } from '../data/constellations.js';
import { prefs } from './prefs.js';

export class ConstellationView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} name constellation id
   * @param {number[]} lit brightness per star: 0 = dim, 1..3 = stars earned
   */
  constructor(canvas, name, lit, { color = '#cfd8ff', animate = true, padding = 10 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.c = CONSTELLATIONS[name];
    this.lit = lit;
    this.color = color;
    this.padding = padding;
    this.reveal = 1;
    this.revealSpeed = 0;
    this.t = Math.random() * 10;
    this.animate = animate && !prefs.reduced;
    this.alive = true;
    this.idle = 1;
    this.resize();
    this._loop = this._loop.bind(this);
    this.last = performance.now();
    if (this.animate) requestAnimationFrame(this._loop);
    else {
      const once = () => {
        if (!this.canvas.isConnected) return void requestAnimationFrame(once);
        this.resize();
        this.draw();
      };
      requestAnimationFrame(once);
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || Number(this.canvas.getAttribute('width')) || 100;
    this.h = r.height || Number(this.canvas.getAttribute('height')) || 100;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setLit(lit) {
    this.lit = lit;
    if (!this.animate) this.draw();
  }

  /** Animate lines and stars appearing over `seconds`. */
  playReveal(seconds = 3) {
    this.reveal = 0;
    this.revealSpeed = 1 / seconds;
    if (!this.animate) {
      this.reveal = 1;
      this.draw();
    }
  }

  destroy() {
    this.alive = false;
  }

  _loop(now) {
    if (!this.alive) return;
    if (!this.canvas.isConnected) {
      // Not mounted yet (or removed): wait a little, then give up.
      if (++this.idle > 240) {
        this.alive = false;
        return;
      }
      requestAnimationFrame(this._loop);
      return;
    }
    if (this.idle !== 0) {
      this.idle = 0;
      this.resize();
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (this.reveal < 1) this.reveal = Math.min(1, this.reveal + dt * this.revealSpeed);
    if (!document.hidden) this.draw();
    requestAnimationFrame(this._loop);
  }

  _pt(p) {
    const pad = this.padding;
    const s = Math.min(this.w - pad * 2, this.h - pad * 2) / 100;
    const ox = (this.w - s * 100) / 2;
    const oy = (this.h - s * 100) / 2;
    return [ox + p[0] * s, oy + p[1] * s];
  }

  draw() {
    const { ctx, c } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    const n = c.points.length;
    const shown = this.reveal * n;
    // Lines.
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    // Faint dotted outline of the whole figure, so the goal is visible.
    ctx.setLineDash([1.5, 4]);
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    for (const [a, b] of c.edges) {
      if (this.lit[a] > 0 && this.lit[b] > 0) continue;
      const [x1, y1] = this._pt(c.points[a]);
      const [x2, y2] = this._pt(c.points[b]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [a, b] of c.edges) {
      const on = this.lit[a] > 0 && this.lit[b] > 0;
      if (!on) continue;
      const k = Math.max(0, Math.min(1, shown - Math.max(a, b)));
      if (k <= 0) continue;
      const [x1, y1] = this._pt(c.points[a]);
      const [x2, y2] = this._pt(c.points[b]);
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.35 * k;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k);
      ctx.stroke();
    }
    // Stars.
    for (let i = 0; i < n; i++) {
      const [x, y] = this._pt(c.points[i]);
      const v = this.lit[i] || 0;
      const appear = v > 0 ? Math.max(0, Math.min(1, shown - i)) : 1;
      if (v > 0) {
        const tw = 0.75 + 0.25 * Math.sin(this.t * 1.6 + i * 1.7);
        const r = (1.4 + v * 0.55) * (0.6 + 0.4 * appear);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * appear})`);
        g.addColorStop(0.25, `rgba(210,220,255,${0.35 * tw * appear})`);
        g.addColorStop(1, 'rgba(210,220,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = appear;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
