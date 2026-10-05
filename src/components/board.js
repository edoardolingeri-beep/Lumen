// Interactive puzzle board: renders cells and tiles, handles tap / drag /
// flick with pointer events (touch, pen and mouse), and plays the visual
// feedback for moves, notes and hints.

import { h } from '../utils/dom.js';
import { createTileEl, renderTileFace, spinRotor, tileColor } from './tile.js';
import { symbolSVG, setColorVars } from '../data/notes.js';
import { noteColor } from './tile.js';
import { chainMembers } from '../game/model.js';
import { prefs } from './prefs.js';

const PORTAL_COLORS = { A: '#8fd6f5', B: '#ffa9c9', C: '#f2df98' };
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const EASE_BACK = 'cubic-bezier(.34,1.45,.55,1)';

export class Board {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.el = h('div', { class: 'board' });
    root.append(this.el);
    this.enabled = true;
    this.drag = null;
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._cancel = this._cancel.bind(this);
    this.el.addEventListener('pointerdown', this._down);
    this.el.addEventListener('pointermove', this._move);
    this.el.addEventListener('pointerup', this._up);
    this.el.addEventListener('pointercancel', this._cancel);
    this.el.addEventListener('lostpointercapture', (e) => {
      if (this.drag && this.drag.id === e.pointerId) this._cancel(e);
    });
    this._onResize = () => this.layout();
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.el.remove();
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.classList.toggle('disabled', !on);
  }

  setLevel(L, S) {
    this.L = L;
    this.S = { pos: S.pos.slice(), rot: S.rot.slice() };
    this.el.innerHTML = '';
    this.el.classList.toggle('mirror', L.read === 'mirror');
    this.el.classList.toggle('reverse', L.read === 'reverse');
    this.cellLayer = h('div', { class: 'cells' });
    this.tileLayer = h('div', { class: 'tiles' });
    this.fxLayer = h('div', { class: 'board-fx' });
    this.el.append(this.cellLayer, this.tileLayer, this.fxLayer);

    this.cellEls = L.cells.map((c, i) => {
      const cls = ['cell'];
      if (c.void) cls.push('void');
      if (c.echo) cls.push('echo');
      if (c.portalId) cls.push('portal');
      const el = h('div', { class: cls.join(' '), 'data-cell': i });
      if (c.echo) el.append(h('span', { class: 'echo-ring' }), h('span', { class: 'echo-tag' }, '×2'));
      if (c.portalId) {
        el.style.setProperty('--pc', PORTAL_COLORS[c.portalId] || '#fff');
        el.append(h('span', { class: 'portal-swirl' }), h('span', { class: 'portal-tag' }, c.portalId));
      }
      this.cellLayer.append(el);
      return el;
    });

    this.tileEls = L.tiles.map((tile, t) => {
      const el = createTileEl(tile, this.S.rot[t]);
      el.dataset.tile = t;
      this.tileLayer.append(el);
      return el;
    });
    // Chain links: drawn on the first tile of each group, pointing to its partner.
    const seen = new Set();
    L.tiles.forEach((tile, t) => {
      if (tile.chain < 0 || seen.has(tile.chain)) return;
      seen.add(tile.chain);
      const members = chainMembers(L, t);
      for (let i = 1; i < members.length; i++) {
        const link = h('div', { class: 'chain-link' });
        link.dataset.from = members[0];
        link.dataset.to = members[i];
        this.tileEls[members[0]].append(link);
      }
      members.forEach((m) => this.tileEls[m].classList.add('chained'));
    });
    this.layout();
  }

  /** Recompute sizes to fit the container. */
  layout() {
    if (!this.L) return;
    const { w, h: hh } = this.L;
    const rect = this.root.getBoundingClientRect();
    const availW = Math.max(120, rect.width);
    const availH = Math.max(120, rect.height);
    let gap = Math.round(Math.max(4, Math.min(9, availW * 0.02)));
    let cs = Math.floor(Math.min((availW - gap * (w - 1)) / w, (availH - gap * (hh - 1)) / hh));
    cs = Math.max(28, Math.min(cs, 86));
    if (cs < 44) gap = 4;
    this.cs = cs;
    this.gap = gap;
    const bw = w * cs + (w - 1) * gap;
    const bh = hh * cs + (hh - 1) * gap;
    this.el.style.width = `${bw}px`;
    this.el.style.height = `${bh}px`;
    this.el.style.setProperty('--cs', `${cs}px`);
    this.el.classList.toggle('compact', cs < 46);
    this.cellEls.forEach((el, c) => {
      const [x, y] = this.cellXY(c);
      el.style.transform = `translate3d(${x}px,${y}px,0)`;
    });
    this.tileEls.forEach((el, t) => this._place(t, this.S.pos[t]));
    this._updateLinks();
  }

  cellXY(c) {
    const x = c % this.L.w;
    const y = Math.floor(c / this.L.w);
    return [x * (this.cs + this.gap), y * (this.cs + this.gap)];
  }

  /** Centre of a cell in viewport coordinates (for canvas effects). */
  cellCenter(c) {
    const r = this.el.getBoundingClientRect();
    const [x, y] = this.cellXY(c);
    return [r.left + x + this.cs / 2, r.top + y + this.cs / 2];
  }

  tileCenter(t) {
    return this.cellCenter(this.S.pos[t]);
  }

  _place(t, c) {
    const [x, y] = this.cellXY(c);
    this.tileEls[t].style.transform = `translate3d(${x}px,${y}px,0)`;
  }

  _updateLinks() {
    this.el.querySelectorAll('.chain-link').forEach((link) => {
      const a = this.S.pos[Number(link.dataset.from)];
      const b = this.S.pos[Number(link.dataset.to)];
      const [ax, ay] = this.cellXY(a);
      const [bx, by] = this.cellXY(b);
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      link.style.width = `${len}px`;
      link.style.transform = `rotate(${ang}rad)`;
    });
  }

  /** Update the board to a new state, animating the given changes. */
  sync(S, { changes = [], rotated = -1, prevRot = 0, dragged = -1 } = {}) {
    const prev = this.S;
    this.S = { pos: S.pos.slice(), rot: S.rot.slice() };
    if (rotated >= 0) spinRotor(this.tileEls[rotated], this.L.tiles[rotated], S.rot[rotated], prevRot);
    const moved = new Set(changes.map((c) => c.tile));
    for (let t = 0; t < this.tileEls.length; t++) {
      if (moved.has(t)) continue;
      if (prev.pos[t] !== S.pos[t]) this._animateTo(t, prev.pos[t], S.pos[t]);
      if (prev.rot[t] !== S.rot[t] && t !== rotated) renderTileFace(this.tileEls[t], this.L.tiles[t], S.rot[t]);
    }
    for (const ch of changes) {
      const el = this.tileEls[ch.tile];
      const fromPx = ch.tile === dragged && this.dropFrom ? this.dropFrom[ch.tile] : null;
      if (ch.via >= 0) this._animatePortal(ch.tile, fromPx, ch.from, ch.via, ch.to);
      else this._animateTo(ch.tile, ch.from, ch.to, fromPx);
      el.classList.remove('dragging');
    }
    this.dropFrom = null;
    this._updateLinks();
  }

  _animateTo(t, fromCell, toCell, fromPx = null) {
    const el = this.tileEls[t];
    const [fx, fy] = fromPx || this.cellXY(fromCell);
    const [tx, ty] = this.cellXY(toCell);
    const from = `translate3d(${fx}px,${fy}px,0)`;
    const to = `translate3d(${tx}px,${ty}px,0)`;
    el.style.transform = to;
    if (prefs.reduced) return;
    el.animate([{ transform: from }, { transform: to }], { duration: 280, easing: EASE_OUT });
  }

  _animatePortal(t, fromPx, fromCell, via, toCell) {
    const el = this.tileEls[t];
    const [fx, fy] = fromPx || this.cellXY(fromCell);
    const [vx, vy] = this.cellXY(via);
    const [tx, ty] = this.cellXY(toCell);
    el.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    this.cellEls[via].classList.add('portal-pulse');
    this.cellEls[toCell].classList.add('portal-pulse');
    setTimeout(() => {
      this.cellEls[via].classList.remove('portal-pulse');
      this.cellEls[toCell].classList.remove('portal-pulse');
    }, 700);
    if (prefs.reduced) return;
    el.animate(
      [
        { transform: `translate3d(${fx}px,${fy}px,0) scale(1)`, opacity: 1, offset: 0 },
        { transform: `translate3d(${vx}px,${vy}px,0) scale(0.2)`, opacity: 0.2, offset: 0.42 },
        { transform: `translate3d(${tx}px,${ty}px,0) scale(0.2)`, opacity: 0.2, offset: 0.5 },
        { transform: `translate3d(${tx}px,${ty}px,0) scale(1)`, opacity: 1, offset: 1 },
      ],
      { duration: 560, easing: 'ease-in-out' },
    );
  }

  // ----- pointer handling ---------------------------------------------------

  _tileFromEvent(e) {
    const el = e.target.closest && e.target.closest('.tile');
    if (!el || !this.el.contains(el)) return -1;
    return Number(el.dataset.tile);
  }

  _down(e) {
    if (!this.enabled || this.drag) return;
    const t = this._tileFromEvent(e);
    if (t < 0) {
      if (this.opts.onEmptyTap) this.opts.onEmptyTap(e);
      return;
    }
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    const members = chainMembers(this.L, t);
    this.drag = {
      id: e.pointerId,
      t,
      members,
      x0: e.clientX,
      y0: e.clientY,
      dragging: false,
      blocked: false,
      origin: members.map((m) => this.cellXY(this.S.pos[m])),
      samples: [[e.clientX, e.clientY, performance.now()]],
      hover: -1,
      lastTrail: 0,
    };
    this.tileEls[t].classList.add('pressed');
  }

  _move(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    d.samples.push([e.clientX, e.clientY, performance.now()]);
    if (d.samples.length > 6) d.samples.shift();
    if (!d.dragging) {
      if (Math.hypot(dx, dy) < 7) return;
      if (d.blocked) return;
      const canDrag = this.opts.canDrag ? this.opts.canDrag(d.t) : true;
      if (!canDrag) {
        d.blocked = true;
        this.shake(d.t);
        if (this.opts.onBlocked) this.opts.onBlocked(d.t);
        return;
      }
      d.dragging = true;
      d.members.forEach((m) => this.tileEls[m].classList.add('dragging'));
      if (this.opts.onDragStart) this.opts.onDragStart(d.t);
    }
    d.members.forEach((m, i) => {
      const [ox, oy] = d.origin[i];
      this.tileEls[m].style.transform = `translate3d(${ox + dx}px,${oy + dy}px,0) scale(1.08)`;
    });
    const cell = this._cellAt(d, dx, dy);
    if (cell !== d.hover) {
      if (d.hover >= 0) this.cellEls[d.hover].classList.remove('hover-ok', 'hover-bad');
      d.hover = cell;
      if (cell >= 0 && cell !== this.S.pos[d.t]) {
        const ok = this.opts.preview ? this.opts.preview(d.t, cell) : true;
        this.cellEls[cell].classList.add(ok ? 'hover-ok' : 'hover-bad');
      }
    }
    const now = performance.now();
    if (this.opts.onTrail && now - d.lastTrail > 45) {
      d.lastTrail = now;
      const r = this.tileEls[d.t].getBoundingClientRect();
      this.opts.onTrail(r.left + r.width / 2, r.top + r.height / 2, tileColor(this.L.tiles[d.t], this.S.rot[d.t]));
    }
  }

  /** Cell under the dragged tile's centre (or -1 when off the board). */
  _cellAt(d, dx, dy) {
    const [ox, oy] = d.origin[0];
    const cx = ox + dx + this.cs / 2;
    const cy = oy + dy + this.cs / 2;
    const step = this.cs + this.gap;
    const col = Math.round((cx - this.cs / 2) / step);
    const row = Math.round((cy - this.cs / 2) / step);
    if (col < 0 || row < 0 || col >= this.L.w || row >= this.L.h) return -1;
    // Must be reasonably inside the cell.
    const [x, y] = [col * step + this.cs / 2, row * step + this.cs / 2];
    if (Math.abs(cx - x) > this.cs * 0.75 || Math.abs(cy - y) > this.cs * 0.75) return -1;
    const c = row * this.L.w + col;
    return this.L.cells[c].void ? -1 : c;
  }

  _flickTarget(d) {
    const s = d.samples;
    if (s.length < 2) return -1;
    const [x1, y1, t1] = s[0];
    const [x2, y2, t2] = s[s.length - 1];
    const dt = Math.max(1, t2 - t1);
    const vx = (x2 - x1) / dt;
    const vy = (y2 - y1) / dt;
    if (Math.hypot(vx, vy) < 0.45) return -1;
    const c = this.S.pos[d.t];
    let x = c % this.L.w;
    let y = Math.floor(c / this.L.w);
    if (Math.abs(vx) > Math.abs(vy)) x += Math.sign(vx);
    else y += Math.sign(vy);
    if (x < 0 || y < 0 || x >= this.L.w || y >= this.L.h) return -1;
    const n = y * this.L.w + x;
    return this.L.cells[n].void ? -1 : n;
  }

  _up(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    this.tileEls[d.t].classList.remove('pressed');
    if (d.hover >= 0) this.cellEls[d.hover].classList.remove('hover-ok', 'hover-bad');
    if (!d.dragging) {
      if (!d.blocked && this.opts.onTap) this.opts.onTap(d.t);
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    let cell = this._cellAt(d, dx, dy);
    if (cell === this.S.pos[d.t] || cell < 0) {
      const flick = Math.hypot(dx, dy) < this.cs * 0.9 ? this._flickTarget(d) : -1;
      if (flick >= 0) cell = flick;
    }
    // Remember where the dragged tiles are so the commit animation starts there.
    this.dropFrom = {};
    d.members.forEach((m, i) => {
      this.dropFrom[m] = [d.origin[i][0] + dx, d.origin[i][1] + dy];
    });
    const accepted = cell >= 0 && cell !== this.S.pos[d.t] && this.opts.onDrop ? this.opts.onDrop(d.t, cell) : false;
    if (!accepted) {
      if (this.opts.onDropOutside && cell < 0 && this.opts.onDropOutside(d.t, e)) return;
      this._returnHome(d, dx, dy);
    }
  }

  _cancel(e) {
    const d = this.drag;
    if (!d || (e && d.id !== e.pointerId)) return;
    this.drag = null;
    this.tileEls[d.t].classList.remove('pressed');
    if (d.hover >= 0) this.cellEls[d.hover].classList.remove('hover-ok', 'hover-bad');
    if (d.dragging) this._returnHome(d, 0, 0, true);
  }

  _returnHome(d, dx, dy, instant = false) {
    d.members.forEach((m, i) => {
      const el = this.tileEls[m];
      el.classList.remove('dragging');
      const [ox, oy] = d.origin[i];
      const to = `translate3d(${ox}px,${oy}px,0)`;
      el.style.transform = to;
      if (!instant && !prefs.reduced) {
        el.animate([{ transform: `translate3d(${ox + dx}px,${oy + dy}px,0) scale(1.08)` }, { transform: to }], { duration: 360, easing: EASE_BACK });
      }
    });
    this.dropFrom = null;
    if (this.opts.onReturn) this.opts.onReturn(d.t);
  }

  // ----- feedback ----------------------------------------------------------

  /** Note animation: light up, grow, ring, settle back. Returns centre point. */
  sing(t, { strong = false, deg = null } = {}) {
    const el = this.tileEls[t];
    if (!el) return null;
    const body = el.querySelector('.tile-body');
    el.classList.remove('sing');
    void el.offsetWidth;
    el.classList.add('sing');
    clearTimeout(el._singT);
    el._singT = setTimeout(() => el.classList.remove('sing'), 620);
    if (!prefs.reduced) {
      body.animate(
        [{ transform: 'scale(1)' }, { transform: `scale(${strong ? 1.16 : 1.12})`, offset: 0.25 }, { transform: 'scale(1)' }],
        { duration: 560, easing: 'cubic-bezier(.2,.8,.3,1)' },
      );
      const ring = h('span', { class: 'tile-ring' });
      if (deg !== null) ring.style.borderColor = noteColor(deg);
      el.append(ring);
      setTimeout(() => ring.remove(), 700);
    }
    return this.tileCenter(t);
  }

  shake(t) {
    const el = this.tileEls[t];
    if (!el || prefs.reduced) return;
    el.querySelector('.tile-body').animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    );
  }

  setCorrect(flags) {
    this.tileEls.forEach((el, t) => el.classList.toggle('correct', !!flags[t]));
  }

  lightCell(c, ms = 340) {
    const el = this.cellEls[c];
    if (!el) return;
    el.classList.add('lit');
    setTimeout(() => el.classList.remove('lit'), ms);
  }

  clearHints() {
    this.fxLayer.innerHTML = '';
    this.tileEls.forEach((el) => el.classList.remove('hinted'));
    this.cellEls.forEach((el) => el.classList.remove('hint-cell'));
  }

  ghost(cell, deg, ms = 4000) {
    const [x, y] = this.cellXY(cell);
    const occupied = this.S.pos.includes(cell);
    const g = h('div', { class: `hint-ghost${occupied ? ' on-tile' : ''}`, html: symbolSVG(deg, 22) });
    // On an occupied cell the wanted note floats as a small bubble above it.
    g.style.transform = occupied
      ? `translate3d(${x + this.cs * 0.52}px,${y - this.cs * 0.2}px,0)`
      : `translate3d(${x}px,${y}px,0)`;
    g.style.color = noteColor(deg);
    setColorVars(g, noteColor(deg));
    this.fxLayer.append(g);
    this.cellEls[cell].classList.add('hint-cell');
    setTimeout(() => {
      g.classList.add('out');
      this.cellEls[cell].classList.remove('hint-cell');
      setTimeout(() => g.remove(), 500);
    }, ms);
  }

  arrow(fromCell, toCell, ms = 4000) {
    const [ax, ay] = this.cellXY(fromCell);
    const [bx, by] = this.cellXY(toCell);
    const half = this.cs / 2;
    const w = this.el.clientWidth;
    const hh = this.el.clientHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hint-arrow');
    svg.setAttribute('width', w);
    svg.setAttribute('height', hh);
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    const x1 = ax + half;
    const y1 = ay + half;
    const x2 = bx + half;
    const y2 = by + half;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const sx = x1 + ux * half * 0.7;
    const sy = y1 + uy * half * 0.7;
    const ex = x2 - ux * half * 0.75;
    const ey = y2 - uy * half * 0.75;
    const mx = (sx + ex) / 2 - uy * len * 0.15;
    const my = (sy + ey) / 2 + ux * len * 0.15;
    svg.innerHTML = `<path d="M${sx},${sy} Q${mx},${my} ${ex},${ey}" /><circle cx="${ex}" cy="${ey}" r="4" />`;
    this.fxLayer.append(svg);
    this.tileEls.forEach((el, t) => this.S.pos[t] === fromCell && el.classList.add('hinted'));
    setTimeout(() => {
      svg.classList.add('out');
      this.tileEls.forEach((el) => el.classList.remove('hinted'));
      setTimeout(() => svg.remove(), 500);
    }, ms);
  }
}
