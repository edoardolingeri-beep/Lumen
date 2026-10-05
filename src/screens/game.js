// The puzzle screen: board, melody, controls, hints, playback, completion.

import { h, pad2, wait, formatDate } from '../utils/dom.js';
import { btn, topBar, overlay, toast, starsRow } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { Board } from '../components/board.js';
import { MelodyBar } from '../components/melodyBar.js';
import { noteColor, tileColor } from '../components/tile.js';
import { getLevel, getDailyLevel, TOTAL_LEVELS } from '../levels/index.js';
import { applyMove, cloneState, evaluate, readingOrder, resolveDrop, tileNotes } from '../game/model.js';
import { getHint } from '../game/hints.js';
import { starsFor, recordLevel, recordDaily, hintStatus, useHint, isWorldUnlocked } from '../game/progress.js';
import { MECHANICS } from '../data/mechanics.js';
import { WORLDS } from '../data/worlds.js';
import { playNote, playSequence, sfx } from '../audio/sound.js';
import { music } from '../audio/music.js';
import { haptics } from '../utils/haptics.js';
import { save } from '../utils/storage.js';
import { prefs } from '../components/prefs.js';
import { showWorldComplete } from './worldComplete.js';
import { showHowTo, orderGrid, ARROWS } from '../components/howto.js';

const FEEDBACK = {
  near: ['Almost there.', 'So close. Listen again.'],
  mid: ['Not quite.', 'Listen again.'],
  far: ['Try another arrangement.', 'Listen again.'],
};

export function create(app, params) {
  const isDaily = !!params.daily;
  const L = isDaily ? getDailyLevel(params.daily) : getLevel(params.id);
  const world = WORLDS[(L.world || 1) - 1];
  const resume = params.resume;
  params.resume = null;

  let S = resume ? resume.S : cloneState(L.start);
  let history = resume ? resume.history : [];
  let future = resume ? resume.future : [];
  let hintStep = resume ? resume.hintStep : 0;
  let usedSolution = resume ? resume.usedSolution : false;
  let solved = false;
  let playback = null;
  let lastRatio = 0;
  let destroyed = false;
  const timers = [];
  const later = (fn, ms) => {
    const id = setTimeout(() => !destroyed && fn(), ms);
    timers.push(id);
    return id;
  };

  // ---------------------------------------------------------------- layout
  const title = isDaily ? 'DAILY PUZZLE' : `LEVEL ${pad2(L.id)}`;
  const subtitle = isDaily ? formatDate(new Date(`${params.daily}T12:00:00`)) : world.name;
  const musicBtn = btn({
    cls: 'icon-btn',
    ico: save.data.settings.music ? 'music' : 'musicOff',
    aria: 'Music',
    onClick: () => {
      save.update((d) => (d.settings.music = !d.settings.music));
      app.applySettings();
      musicBtn.innerHTML = icon(save.data.settings.music ? 'music' : 'musicOff', 20);
    },
  });
  const pauseBtn = btn({ cls: 'icon-btn', ico: 'pause', aria: 'Pause', onClick: () => openPause() });
  const header = topBar({
    left: [btn({ cls: 'icon-btn', ico: 'back', aria: 'Back', onClick: () => exit() })],
    center: h('div', { class: 'tb-title' }, h('h2', { class: 'screen-title' }, title), h('span', { class: 'tb-sub' }, subtitle)),
    right: [musicBtn, pauseBtn],
  });

  const melodyWrap = h('div', { class: 'melody-wrap' });
  const melody = new MelodyBar(melodyWrap, { onListen: () => listen() });
  melody.set(L.target);

  const chips = h('div', { class: 'chips' });
  const readMode = L.read || 'normal';
  const READ_TEXT = {
    normal: 'Read left to right, then the next row down.',
    mirror: 'Mirror: read right to left, then the next row down.',
    reverse: 'Reverse: start at the bottom right, read right to left, going up.',
  };
  const readLabel = { normal: 'Read order', mirror: 'Mirror', reverse: 'Reverse' }[readMode];
  const readChip = h('button', { class: `chip chip-read chip-${readMode}`, type: 'button' }, `${ARROWS[readMode]}  ${readLabel}`);
  readChip.addEventListener('click', () => {
    sfx('button');
    sweepOrder();
    toast(READ_TEXT[readMode], 3200);
  });
  chips.append(readChip);
  L.mechanics
    .filter((m) => MECHANICS[m] && m !== 'mirror' && m !== 'reverse')
    .forEach((m) => {
      const mech = MECHANICS[m];
      const c = h('button', { class: `chip chip-${m}`, type: 'button' }, mech.short);
      c.addEventListener('click', () => {
        sfx('button');
        toast(mech.text, 3200);
      });
      chips.append(c);
    });

  const boardArea = h('div', { class: 'board-area' });
  const coach = h('div', { class: 'coach', 'aria-live': 'polite' });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const movesEl = h('span', { class: 'moves' });
  const parEl = h('span', { class: 'par', html: `${icon('starFill', 11)}${icon('starFill', 11)}${icon('starFill', 11)} in ${L.par}` });
  const info = h('div', { class: 'info-row' }, movesEl, feedback, parEl);
  const tip = h('div', { class: 'tip' }, L.tip || '');

  const undoBtn = btn({ cls: 'ctrl', ico: 'undo', label: 'UNDO', onClick: () => undo() });
  const redoBtn = btn({ cls: 'ctrl', ico: 'redo', label: 'REDO', onClick: () => redo() });
  const hintBadge = h('span', { class: 'badge' });
  const hintBtn = btn({ cls: 'ctrl', ico: 'hint', label: 'HINT', sound: null, onClick: () => hint() });
  hintBtn.append(hintBadge);
  const playBtn = btn({ cls: 'ctrl ctrl-play', ico: 'play', label: 'PLAY', sound: null, onClick: () => playArrangement() });
  const resetBtn = btn({ cls: 'ctrl', ico: 'reset', label: 'RESET', onClick: () => reset() });
  const controls = h('nav', { class: 'controls glass' }, undoBtn, redoBtn, hintBtn, playBtn, resetBtn);

  const el = h(
    'section',
    { class: 'game', style: { '--glow': world.glow } },
    header,
    melodyWrap,
    chips,
    h('div', { class: 'board-zone' }, boardArea, coach),
    info,
    tip,
    controls,
  );

  // ----------------------------------------------------------------- board
  const board = new Board(boardArea, {
    canDrag: (t) => !L.tiles[t].locked && !solved,
    preview: (t, cell) => resolveDrop(L, S, t, cell).ok,
    onTap: (t) => tapTile(t),
    onDrop: (t, cell) => dropTile(t, cell),
    onBlocked: (t) => {
      sfx('soft');
      haptics.soft();
      if (!save.data.seen.intros.includes('locked-tip')) {
        toast('This note is locked in place.');
        save.update((d) => d.seen.intros.push('locked-tip'));
      }
      singTile(t, false);
    },
    onDragStart: (t) => {
      stopPlayback();
      sfx('select');
      board.clearHints();
      coachDragStarted(t);
    },
    onTrail: (x, y, color) => app.sky.trail(x, y, color),
    onReturn: () => sfx('soft'),
  });

  function singTile(t, play = true, { strong = false, deg = null, vel = 0.75 } = {}) {
    const notes = tileNotes(L.tiles[t], S.rot[t]);
    const d = deg !== null ? deg : notes[0];
    const pt = board.sing(t, { strong, deg: d || null });
    if (play && d) playNote(d, { vel });
    if (pt && d) {
      const c = noteColor(d);
      app.sky.ripple(pt[0], pt[1], c, { scale: strong ? 1.3 : 1 });
      app.sky.burst(pt[0], pt[1], c, strong ? 5 : 3, { speed: 50 });
    }
    if (play && d) haptics.note();
  }

  function tapTile(t) {
    if (solved) return;
    const tile = L.tiles[t];
    if (tile.kind === 'rotor') {
      commit({ type: 'rotate', tile: t });
      return;
    }
    stopPlayback();
    if (tile.kind === 'double') {
      singTile(t, true, { deg: tile.notes[0] });
      later(() => singTile(t, true, { deg: tile.notes[1] }), 220);
    } else singTile(t);
    coachTapped();
  }

  function dropTile(t, cell) {
    if (solved) return false;
    const ok = commit({ type: 'drop', tile: t, cell }, t);
    if (!ok) {
      sfx('soft');
      haptics.soft();
    }
    return ok;
  }

  function commit(move, dragged = -1) {
    const r = applyMove(L, S, move);
    if (!r) return false;
    stopPlayback();
    const prevRot = S.rot[move.tile];
    history.push(S);
    future = [];
    S = r.state;
    board.sync(S, { changes: r.result.changes, rotated: r.result.rotated ?? -1, prevRot, dragged });
    board.clearHints();
    if (move.type === 'drop') {
      sfx('move');
      haptics.drop();
      later(() => singTile(move.tile, true, { vel: 0.55 }), 120);
    } else {
      later(() => singTile(move.tile, true), 200);
    }
    coachMoved();
    update(true);
    return true;
  }

  function update(afterMove = false) {
    const ev = evaluate(L, S);
    melody.setMatches(ev.matches);
    board.setCorrect(ev.correctTiles);
    music.setIntensity(ev.ratio);
    if (afterMove && ev.ratio > lastRatio + 0.001 && !ev.solved) {
      // A gentle glimmer when the melody gets closer.
      ev.correctTiles.forEach((ok, t) => {
        if (!ok) return;
        const pt = board.tileCenter(t);
        if (pt) app.sky.burst(pt[0], pt[1], tileColor(L.tiles[t], S.rot[t]), 1, { speed: 30 });
      });
    }
    lastRatio = ev.ratio;
    movesEl.textContent = `MOVES ${history.length}`;
    undoBtn.disabled = !history.length || solved;
    redoBtn.disabled = !future.length || solved;
    resetBtn.disabled = !history.length || solved;
    const hs = hintStatus();
    hintBadge.textContent = hs.charges > 0 ? String(hs.charges) : `${hs.cost}✨`;
    hintBadge.classList.toggle('cost', hs.charges === 0);
    if (ev.solved && !solved) {
      solved = true;
      board.setEnabled(false);
      later(() => complete(), 380);
    }
  }

  // ------------------------------------------------------------- controls
  function undo() {
    if (!history.length || solved) return;
    stopPlayback();
    future.push(S);
    const prev = history.pop();
    animateTo(prev);
  }

  function redo() {
    if (!future.length || solved) return;
    stopPlayback();
    history.push(S);
    animateTo(future.pop());
  }

  function reset() {
    if (!history.length || solved) return;
    stopPlayback();
    future = [];
    history = [];
    animateTo(cloneState(L.start));
    setFeedback('');
  }

  function animateTo(next) {
    S = next;
    board.sync(S);
    board.clearHints();
    update();
  }

  function setFeedback(text) {
    feedback.classList.remove('show');
    if (!text) return;
    feedback.textContent = text;
    void feedback.offsetWidth;
    feedback.classList.add('show');
  }

  /** Light every cell once, in reading order. */
  function sweepOrder() {
    readingOrder(L).forEach((c, i) => later(() => board.lightCell(c, 300), i * 70));
  }

  function stopPlayback() {
    if (playback) {
      playback.cancel();
      playback = null;
      playBtn.classList.remove('active');
    }
  }

  function listen() {
    stopPlayback();
    music.duck(0.4, L.target.length * 0.36 + 0.6);
    playBtn.classList.remove('active');
    playback = playSequence(L.target, {
      interval: 0.36,
      onStep: (i) => melody.pulse(i),
      onEnd: () => (playback = null),
    });
    coachListened();
  }

  /** Play the board as it is now, lighting each note in reading order. */
  function playArrangement() {
    if (solved) return;
    if (playback) {
      stopPlayback();
      return;
    }
    const ev = evaluate(L, S);
    if (!ev.emission.length) {
      setFeedback('Place some notes first.');
      return;
    }
    sfx('select');
    playBtn.classList.add('active');
    music.duck(0.4, ev.emission.length * 0.34 + 0.6);
    playback = playSequence(
      ev.emission.map((e) => e.deg),
      {
        interval: 0.34,
        onStep: (i) => {
          const e = ev.emission[i];
          board.lightCell(e.cell);
          const pt = board.sing(e.tile, { deg: e.deg || null });
          if (e.deg && pt) app.sky.ripple(pt[0], pt[1], noteColor(e.deg));
          if (i < L.target.length) melody.pulse(i);
          if (!ev.matches[i]) later(() => board.shake(e.tile), 120);
          haptics.note();
        },
        onEnd: () => {
          playback = null;
          playBtn.classList.remove('active');
          const pool = ev.ratio >= 0.7 ? FEEDBACK.near : ev.ratio >= 0.35 ? FEEDBACK.mid : FEEDBACK.far;
          setFeedback(pool[Math.floor(Math.random() * pool.length)]);
        },
      },
    );
  }

  function hint() {
    if (solved) return;
    const kind = useHint();
    if (!kind) {
      const hs = hintStatus();
      const m = Math.ceil(hs.next / 60000);
      sfx('soft');
      toast(`Need ${hs.cost} ✨ — or a free hint in ${m} min`);
      return;
    }
    sfx('hint');
    hintStep = Math.min(3, hintStep + 1);
    board.clearHints();
    const hnt = getHint(L, S, hintStep);
    if (!hnt) return;
    if (hnt.type === 'ghost') {
      hnt.cells.forEach((c) => board.ghost(c.cell, c.deg, 4500));
      setFeedback('This place wants this note.');
    } else if (hnt.type === 'arrow') {
      board.arrow(hnt.from, hnt.dest, 4500);
      if (!S.pos.includes(hnt.dest)) board.ghost(hnt.dest, tileNotes(L.tiles[hnt.tile], S.rot[hnt.tile])[0], 4500);
      setFeedback(hnt.to !== hnt.dest ? 'Try the portal.' : 'Try moving this note.');
    } else if (hnt.type === 'rotate') {
      board.tileEls[hnt.tile].classList.add('hinted');
      later(() => board.tileEls[hnt.tile].classList.remove('hinted'), 4500);
      setFeedback('Turn this note.');
    } else if (hnt.type === 'move-out' || hnt.type === 'pulse') {
      board.tileEls[hnt.tile].classList.add('hinted');
      later(() => board.tileEls[hnt.tile].classList.remove('hinted'), 4500);
      setFeedback('This note wants to move.');
    } else if (hnt.type === 'solution') {
      usedSolution = true;
      hnt.cells.forEach((c, i) => later(() => board.ghost(c.cell, c.deg, 4200 - i * 60), i * 60));
      setFeedback('One possible melody.');
    }
    update();
  }

  // ------------------------------------------------------------ completion
  async function complete() {
    stopPlayback();
    board.clearHints();
    coach.classList.remove('show');
    const moves = history.length;
    const stars = starsFor(moves, L.par, usedSolution);
    const ev = evaluate(L, S);
    music.duck(0.3, ev.emission.length * 0.3 + 3);
    melody.setAll(false);
    // 1-3: each note lights in turn while the melody plays.
    await new Promise((resolve) => {
      playback = playSequence(
        ev.emission.map((e) => e.deg),
        {
          interval: 0.3,
          vel: 0.8,
          onStep: (i) => {
            const e = ev.emission[i];
            const pt = board.sing(e.tile, { strong: true, deg: e.deg || null });
            board.lightCell(e.cell, 500);
            melody.slots[i] && melody.slots[i].classList.add('on');
            melody.pulse(i);
            if (e.deg && pt) {
              app.sky.ripple(pt[0], pt[1], noteColor(e.deg), { scale: 1.2 });
              app.sky.burst(pt[0], pt[1], noteColor(e.deg), 4, { speed: 70 });
            }
          },
          onEnd: resolve,
        },
      );
    });
    playback = null;
    if (destroyed) return;
    // 4-6: everything glows, a great wave, particles.
    el.classList.add('celebrate');
    const r = boardArea.getBoundingClientRect();
    app.sky.bigWave(r.left + r.width / 2, r.top + r.height / 2, world.glow);
    sfx('success');
    haptics.success();
    // A soft final chord.
    [1, 3, 5].forEach((d, i) => playNote(d, { vel: 0.4, octave: i === 0 ? 3 : 4 }));
    await wait(prefs.reduced ? 300 : 900);
    if (destroyed) return;
    showResult(stars, moves);
  }

  function showResult(stars, moves) {
    let reward;
    if (isDaily) reward = recordDaily(params.daily, stars);
    else reward = recordLevel(L.id, stars, moves);
    if (!isDaily && L.id === 1 && !save.data.seen.tutorial) save.update((d) => (d.seen.tutorial = true));

    const word = isDaily ? 'DAILY COMPLETE' : stars === 3 ? 'PERFECT' : stars === 2 ? 'BEAUTIFUL' : 'COMPLETE';
    const starsEl = starsRow(0, 3, 30);
    const earnedEl = h('div', { class: 'reward', html: reward.earned ? `+${reward.earned} ${icon('sparkle', 15)}` : '&nbsp;' });
    const detail = h('div', { class: 'result-detail' }, isDaily ? (reward.streak > 1 ? `${reward.streak} day streak` : 'See you tomorrow') : `${moves} move${moves === 1 ? '' : 's'}  ·  best ${reward.best}  ·  par ${L.par}`);
    const isLast = !isDaily && L.id >= TOTAL_LEVELS;
    const celebrateWorld = !isDaily && reward.worldDone && !save.data.worldsCelebrated.includes(reward.world);

    const actions = h('div', { class: 'result-actions' });
    let o;
    if (isDaily) {
      actions.append(
        btn({ cls: 'primary wide', label: 'HOME', onClick: () => { o.close(); app.backTo('home'); } }),
        btn({ cls: 'ghost', label: 'Your flower', onClick: () => { o.close(); app.backTo('daily', { key: params.daily }); } }),
      );
    } else {
      const nextLabel = celebrateWorld ? 'CONTINUE' : isLast ? 'YOUR SKY' : 'NEXT LEVEL';
      actions.append(
        btn({
          cls: 'primary wide',
          label: nextLabel,
          ico: 'chevron',
          sound: 'select',
          onClick: () => {
            o.close();
            if (celebrateWorld) {
              showWorldComplete(app, reward.world, () => {
                const nw = reward.world + 1;
                if (nw <= WORLDS.length && isWorldUnlocked(nw)) app.go('world', { world: nw }, { replace: true });
                else app.go('sky', {}, { replace: true });
              });
            } else if (isLast) app.go('sky', {}, { replace: true });
            else app.go('game', { id: L.id + 1 }, { replace: true });
          },
        }),
        h(
          'div',
          { class: 'result-secondary' },
          btn({ cls: 'ghost', ico: 'reset', label: 'Replay', onClick: () => { o.close(); app.go('game', { id: L.id }, { replace: true }); } }),
          btn({ cls: 'ghost', ico: 'journey', label: 'Levels', onClick: () => { o.close(); app.backTo('world', { world: L.world }); } }),
        ),
      );
    }
    o = overlay({
      cls: 'result',
      dismissable: false,
      children: [resultWord(word), starsEl, detail, earnedEl, actions],
    });
    // Stars pop one by one.
    const starEls = starsEl.querySelectorAll('.st');
    for (let i = 0; i < stars; i++) {
      later(() => {
        starEls[i].classList.add('on', 'pop');
        starEls[i].innerHTML = icon('starFill', 30);
        sfx('star', i);
        const rr = starEls[i].getBoundingClientRect();
        app.sky.burst(rr.left + rr.width / 2, rr.top + rr.height / 2, '#f2df98', 6, { speed: 90 });
      }, 500 + i * 320);
    }
    if (reward.earned) later(() => sfx('coin'), 600 + stars * 320);
  }

  function resultWord(text) {
    let i = 0;
    const words = text.split(' ').map((w) => h('span', { class: 'word' }, ...[...w].map((ch) => h('span', { style: { animationDelay: `${i++ * 45}ms` } }, ch))));
    return h('div', { class: `result-word${text.length > 9 ? ' long' : ''}` }, ...words);
  }

  // --------------------------------------------------------------- pause
  function snapshot() {
    return { S, history, future, hintStep, usedSolution };
  }

  function openPause() {
    stopPlayback();
    let o;
    o = overlay({
      cls: 'pause',
      children: [
        h('h2', { class: 'pause-title' }, 'PAUSED'),
        btn({ cls: 'primary wide', ico: 'play', label: 'RESUME', onClick: () => o.close() }),
        btn({ cls: 'glass wide', ico: 'reset', label: 'RESTART', onClick: () => { o.close(); reset(); } }),
        btn({ cls: 'glass wide', ico: 'help', label: 'HOW TO PLAY', onClick: () => { o.close(); showHowTo(); } }),
        btn({
          cls: 'glass wide',
          ico: 'settings',
          label: 'SETTINGS',
          onClick: () => {
            o.close();
            app.current.params.resume = snapshot();
            app.go('settings');
          },
        }),
        btn({ cls: 'ghost wide', ico: 'back', label: 'EXIT', onClick: () => { o.close(); exit(); } }),
      ],
    });
  }

  function exit() {
    stopPlayback();
    app.back();
  }

  // ------------------------------------------------------- intro & tutorial
  let tutorialStep = -1;
  function showCoach(text, sub = '') {
    coach.innerHTML = '';
    coach.append(h('div', { class: 'coach-text' }, text), sub ? h('div', { class: 'coach-sub' }, sub) : '');
    coach.classList.remove('show');
    void coach.offsetWidth;
    coach.classList.add('show');
  }

  function startTutorial() {
    tutorialStep = 0;
    showCoach('Tap a note', 'Each light is a sound');
    board.tileEls.forEach((t) => t.classList.add('beckon'));
  }
  function coachTapped() {
    if (tutorialStep !== 0) return;
    tutorialStep = 1;
    board.tileEls.forEach((t) => t.classList.remove('beckon'));
    later(() => {
      showCoach('Listen', 'Tap the melody above');
      melodyWrap.classList.add('beckon');
    }, 500);
  }
  function coachListened() {
    if (tutorialStep !== 1) return;
    tutorialStep = 2;
    melodyWrap.classList.remove('beckon');
    later(() => {
      if (tutorialStep !== 2) return;
      showCoach('Move it', 'Drag the note to create the melody');
      const h2 = getHint(L, S, 2);
      if (h2 && h2.type === 'arrow') {
        board.arrow(h2.from, h2.dest, 60000);
        board.ghost(h2.dest, tileNotes(L.tiles[h2.tile], S.rot[h2.tile])[0], 60000);
      }
    }, L.target.length * 360 + 300);
  }
  function coachDragStarted() {
    if (tutorialStep === 2) coach.classList.remove('show');
  }
  function coachMoved() {
    if (tutorialStep === 0 || tutorialStep === 1) {
      tutorialStep = 3;
      melodyWrap.classList.remove('beckon');
      board.tileEls.forEach((t) => t.classList.remove('beckon'));
    }
    if (tutorialStep >= 2) {
      tutorialStep = 3;
      if (!evaluate(L, S).solved) showCoach('Create the melody', 'Match the notes above');
      else coach.classList.remove('show');
    }
  }

  function showIntro(mech) {
    const m = MECHANICS[mech];
    if (!m) return;
    let o;
    o = overlay({
      cls: 'intro',
      children: [
        h('div', { class: 'intro-new' }, 'NEW'),
        mech === 'mirror' || mech === 'reverse' ? orderGrid(mech, 3, 3) : h('div', { class: `intro-visual iv-${mech}` }, h('span'), h('span'), h('span')),
        h('h2', { class: 'intro-title' }, m.name.toUpperCase()),
        h('p', { class: 'intro-text' }, m.text),
        btn({ cls: 'primary wide', label: 'GOT IT', sound: 'select', onClick: () => o.close() }),
      ],
      onClose: () => (mech === 'mirror' || mech === 'reverse') && later(sweepOrder, 250),
    });
    save.update((d) => d.seen.intros.push(mech));
  }

  function openHowToFirst() {
    save.update((d) => d.seen.intros.push('howto'));
    showHowTo({ onClose: () => later(startTutorial, 300) });
  }

  // ------------------------------------------------------------- lifecycle
  return {
    el,
    world: L.world || 1,
    musicMode: 'level',
    onShow() {
      requestAnimationFrame(() => {
        board.setLevel(L, S);
        update();
        lastRatio = evaluate(L, S).ratio;
        if (!resume) {
          if (L.tutorial === 'first') later(save.data.seen.intros.includes('howto') ? startTutorial : openHowToFirst, 700);
          else if (L.intro && !save.data.seen.intros.includes(L.intro)) later(() => showIntro(L.intro), 500);
          else if (L.tutorial === 'reading') {
            later(() => {
              const order = [];
              for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) order.push(y * L.w + x);
              order.forEach((c, i) => later(() => board.lightCell(c, 260), i * 55));
            }, 600);
          }
        }
      });
    },
    onBack() {
      exit();
      return true;
    },
    // Hooks for automated tests (tools/e2e.mjs).
    _test: { board, L, state: () => S, solved: () => solved },
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      stopPlayback();
      music.setIntensity(0);
      board.destroy();
    },
  };
}
