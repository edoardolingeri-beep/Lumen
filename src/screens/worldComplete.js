// WORLD COMPLETE — notes fly up and become the world's constellation while a
// longer original theme plays. Ends with "THE SKY IS YOURS."

import { h } from '../utils/dom.js';
import { overlay, btn } from '../components/ui.js';
import { WORLDS } from '../data/worlds.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { generateTheme } from '../levels/melody.js';
import { createRng } from '../utils/rng.js';
import { playNote, sfx } from '../audio/sound.js';
import { music } from '../audio/music.js';
import { noteColor } from '../components/tile.js';
import { haptics } from '../utils/haptics.js';
import { markWorldCelebrated } from '../game/progress.js';
import { prefs } from '../components/prefs.js';
import { symbolSVG } from '../data/notes.js';

export function showWorldComplete(app, worldId, onDone) {
  const w = WORLDS[worldId - 1];
  const cons = CONSTELLATIONS[w.constellation];
  const canvas = h('canvas', { class: 'wc-canvas' });
  const title = h('div', { class: 'wc-title' }, 'WORLD COMPLETE');
  const sub = h('div', { class: 'wc-sub' }, 'THE SKY IS YOURS.');
  const name = h('div', { class: 'wc-name' }, cons.name);
  const actions = h('div', { class: 'wc-actions' });
  const o = overlay({ cls: 'world-complete', dismissable: false, children: [canvas, h('div', { class: 'wc-text' }, title, name, sub), actions] });
  o.el.classList.add('wc-overlay');
  const appEl = document.getElementById('app');
  appEl.classList.add('dimmed');
  markWorldCelebrated(worldId);
  app.sky.setPalette(WORLDS[4], 2500); // the screen becomes a deep starry sky
  music.duck(0.25, 9);
  haptics.world();

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const rng = createRng(`world-theme-${worldId}`);
  const theme = generateTheme(rng, 5).slice(0, 20);
  const size = Math.min(W * 0.86, H * 0.52);
  const ox = (W - size) / 2;
  const oy = H * 0.14;
  const target = (i) => [ox + (cons.points[i][0] / 100) * size, oy + (cons.points[i][1] / 100) * size];
  const interval = prefs.reduced ? 0.12 : 0.26;
  const flyDur = prefs.reduced ? 0.3 : 1.3;

  // Pre-render note symbols as images for the flying notes.
  const sprites = theme.map((deg) => {
    const img = new Image();
    const svg = symbolSVG(deg, 24).replace('class="sym"', 'xmlns="http://www.w3.org/2000/svg"').replace(/currentColor/g, noteColor(deg));
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return img;
  });

  const flyers = cons.points.map((_, i) => {
    const [tx, ty] = target(i);
    return {
      sx: W * (0.15 + rng.next() * 0.7),
      sy: H + 30,
      cx: W * rng.next(),
      cy: H * (0.3 + rng.next() * 0.5),
      tx,
      ty,
      start: 0.4 + i * interval,
      deg: theme[i % theme.length],
      arrived: false,
    };
  });

  // Theme playback, aligned with arrivals.
  flyers.forEach((f, i) => {
    setTimeout(() => {
      playNote(f.deg, { instrument: 'chime', vel: 0.55, octave: 5 });
      if (i % 4 === 0) playNote([1, 6, 4, 5][(i / 4) % 4], { instrument: 'warm', vel: 0.5, octave: 3 });
    }, (f.start + flyDur) * 1000);
  });

  let t0 = performance.now();
  let raf = 0;
  let edgesAt = 0;
  const total = flyers[flyers.length - 1].start + flyDur;
  const loop = (now) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    // Edges after all stars are lit.
    if (t > total) {
      if (!edgesAt) {
        edgesAt = t;
        title.classList.add('show');
        name.classList.add('show');
        sfx('success');
      }
      const k = Math.min(1, (t - edgesAt) / 2.2);
      ctx.strokeStyle = 'rgba(210,220,255,0.45)';
      ctx.lineWidth = 1.2;
      cons.edges.forEach(([a, b], i) => {
        const kk = Math.max(0, Math.min(1, k * cons.edges.length - i));
        if (!kk) return;
        const [x1, y1] = target(a);
        const [x2, y2] = target(b);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (x2 - x1) * kk, y1 + (y2 - y1) * kk);
        ctx.stroke();
      });
      if (k >= 1 && !sub.classList.contains('show')) {
        sub.classList.add('show');
        setTimeout(() => {
          actions.append(
            btn({
              cls: 'primary wide',
              label: 'CONTINUE',
              ico: 'chevron',
              onClick: () => {
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resize);
                o.close();
                appEl.classList.remove('dimmed');
                onDone && onDone();
              },
            }),
          );
        }, 900);
      }
    }
    for (const f of flyers) {
      const k = (t - f.start) / flyDur;
      if (k < 0) continue;
      if (k >= 1) {
        if (!f.arrived) {
          f.arrived = true;
          app.sky.ripple(f.tx, f.ty, noteColor(f.deg), { scale: 0.7 });
          app.sky.burst(f.tx, f.ty, noteColor(f.deg), 4, { speed: 40 });
        }
        const tw = 0.8 + 0.2 * Math.sin(t * 2 + f.tx);
        const g = ctx.createRadialGradient(f.tx, f.ty, 0, f.tx, f.ty, 14);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * tw})`);
        g.addColorStop(0.3, 'rgba(210,220,255,0.35)');
        g.addColorStop(1, 'rgba(210,220,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.tx, f.ty, 14, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const x = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * f.cx + e * e * f.tx;
      const y = (1 - e) * (1 - e) * f.sy + 2 * (1 - e) * e * f.cy + e * e * f.ty;
      ctx.globalAlpha = 0.5 + 0.5 * k;
      const s = 18 - k * 8;
      if (sprites[flyers.indexOf(f) % sprites.length].complete) ctx.drawImage(sprites[flyers.indexOf(f) % sprites.length], x - s / 2, y - s / 2, s, s);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.35) app.sky.trail(x, y, noteColor(f.deg));
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
