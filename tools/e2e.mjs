// End-to-end test: plays the real game in headless Chromium at phone size.
// HOME → PLAY → LEVEL → MOVE → AUDIO → SOLVE → REWARD → NEXT LEVEL →
// WORLD MAP → SETTINGS → SAVE → RELOAD, then one level of every mechanic,
// the daily puzzle, zen mode and the theme shop.
//
// Usage: node tools/e2e.mjs [--shots=dir]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { getChromium } from './pw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shotsArg = process.argv.find((a) => a.startsWith('--shots='));
const SHOTS = shotsArg ? shotsArg.split('=')[1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) throw new Error('outside');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const chromium = await getChromium();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
const errors = [];
const log = (ok, msg) => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
};

async function newPage(storage) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  if (storage) await ctx.addInitScript((s) => localStorage.setItem('lumen.save.v1', s), JSON.stringify(storage));
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`));
  return { ctx, page };
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`) });
const screenName = (page) => page.evaluate(() => window.__lumen.current && window.__lumen.current.name);

async function waitScreen(page, name, timeout = 6000) {
  await page.waitForFunction((n) => window.__lumen.current && window.__lumen.current.name === n, name, { timeout });
  await page.waitForTimeout(450);
}

/** Perform one planned move through real pointer input. */
async function doMove(page, mv) {
  const pts = await page.evaluate((m) => {
    const t = window.__lumen.current.inst._test;
    const el = t.board.tileEls[m.tile].getBoundingClientRect();
    const from = [el.left + el.width / 2, el.top + el.height / 2];
    const to = m.type === 'drop' ? t.board.cellCenter(m.cell) : from;
    return { from, to };
  }, mv);
  if (mv.type === 'rotate') {
    await page.mouse.click(pts.from[0], pts.from[1]);
    await page.waitForTimeout(300);
    return;
  }
  await page.mouse.move(pts.from[0], pts.from[1]);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(pts.from[0] + ((pts.to[0] - pts.from[0]) * i) / steps, pts.from[1] + ((pts.to[1] - pts.from[1]) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(380);
}

async function solveCurrent(page) {
  const path = await page.evaluate(() => window.__lumen.current.inst._test.L.path);
  for (const mv of path) await doMove(page, mv);
  await page.waitForFunction(() => window.__lumen.current.inst._test.solved(), null, { timeout: 4000 });
  await page.waitForSelector('.overlay-panel.result .result-actions', { timeout: 15000 });
  await page.waitForTimeout(1800);
  return path.length;
}

// ---------------------------------------------------------------- main flow
{
  const { ctx, page } = await newPage();
  await page.goto(BASE);
  await waitScreen(page, 'home', 8000);
  log(true, 'loading → home');
  await shot(page, '01-home');

  await page.mouse.click(30, 300); // first gesture unlocks audio
  const audioState = await page.evaluate(async () => {
    const { audio } = await import('./src/audio/engine.js');
    return audio.ctx ? audio.ctx.state : 'none';
  });
  log(audioState === 'running', `audio context running (${audioState})`);
  await page.waitForTimeout(2500);
  const level = await page.evaluate(async () => {
    const { audio } = await import('./src/audio/engine.js');
    let max = 0;
    for (let i = 0; i < 20; i++) {
      max = Math.max(max, audio.level());
      await new Promise((r) => setTimeout(r, 50));
    }
    return max;
  });
  log(level > 0.001, `ambient music is producing sound (level ${level.toFixed(3)})`);

  await page.click('.play-btn');
  await waitScreen(page, 'game');
  log((await page.textContent('.screen-game .screen-title')) === 'LEVEL 01', 'PLAY opens LEVEL 01');
  await page.waitForTimeout(900);
  log(await page.isVisible('.coach.show'), 'tutorial coach visible ("Tap a note")');

  // Tap a note.
  const tile0 = await page.evaluate(() => {
    const r = window.__lumen.current.inst._test.board.tileEls[0].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.click(tile0[0], tile0[1]);
  await page.waitForTimeout(700);
  log((await page.textContent('.coach-text')) === 'Listen', 'tap advances tutorial to "Listen"');
  await page.click('.melody-bar');
  await page.waitForTimeout(1800);
  log((await page.textContent('.coach-text')) === 'Move it', 'listening advances tutorial to "Move it"');
  await shot(page, '02-level1-tutorial');

  // A refused drop returns home (locked/void are not in L1, so drop on itself region outside board).
  const moves = await solveCurrent(page);
  await shot(page, '03-level1-complete');
  const word = (await page.textContent('.result-word')).replace(/\s/g, '');
  log(word === 'PERFECT', `level 1 solved in ${moves} move(s) → ${word}`);
  const noOverlap = await page.evaluate(() => {
    const a = document.querySelector('.result-actions .btn.primary').getBoundingClientRect();
    const b = document.querySelector('.result-secondary .btn').getBoundingClientRect();
    return b.top >= a.bottom - 1;
  });
  log(noOverlap, 'result buttons laid out without overlap');
  const notes1 = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen.save.v1') || '{}').notes);
  log(notes1 > 30, `reward saved (notes = ${notes1})`);

  await page.click('.result-actions .btn.primary');
  await waitScreen(page, 'game');
  log((await page.textContent('.screen-game .screen-title')) === 'LEVEL 02', 'NEXT LEVEL → LEVEL 02');

  // Undo / redo / reset sanity on level 2.
  const path2 = await page.evaluate(() => window.__lumen.current.inst._test.L.path);
  await doMove(page, path2[0]);
  await page.click('.ctrl[aria-label="UNDO"]');
  await page.waitForTimeout(350);
  let mv = await page.textContent('.moves');
  log(mv === 'MOVES 0', 'undo restores the board');
  await page.click('.ctrl[aria-label="REDO"]');
  await page.waitForTimeout(350);
  mv = await page.textContent('.moves');
  log(mv === 'MOVES 1', 'redo replays the move');
  await page.click('.ctrl[aria-label="RESET"]');
  await page.waitForTimeout(350);
  log((await page.textContent('.moves')) === 'MOVES 0', 'reset returns to start');

  // PLAY current arrangement → gentle feedback, never "game over".
  await page.click('.ctrl-play');
  await page.waitForTimeout(3200);
  const fb = await page.textContent('.feedback');
  log(/Almost there|Not quite|Listen again|Try another/.test(fb), `PLAY feedback is gentle ("${fb}")`);

  // Hint.
  await page.click('.ctrl[aria-label="HINT"]');
  await page.waitForTimeout(400);
  log((await page.locator('.hint-ghost, .hint-arrow, .tile.hinted').count()) > 0, 'hint shows a visual clue');
  await shot(page, '04-level2-hint');

  await solveCurrent(page);
  log(true, 'level 2 solved');
  // Levels → world map.
  await page.click('.result-secondary .btn:nth-child(2)');
  await waitScreen(page, 'world');
  const doneCount = await page.locator('.level-btn.done').count();
  log(doneCount === 2, `world map shows 2 completed levels (${doneCount})`);
  await shot(page, '05-world');

  await page.click('.topbar .icon-btn[aria-label="Back"]');
  await page.waitForTimeout(600);
  const afterBack = await screenName(page);
  log(['home', 'journey'].includes(afterBack), `back from world → ${afterBack}`);
  await page.evaluate(() => window.__lumen.go('journey'));
  await waitScreen(page, 'journey');
  await shot(page, '06-journey');
  log((await page.locator('.world-card').count()) === 5, 'journey lists 5 worlds');
  log((await page.locator('.world-card.is-locked').count()) === 4, 'worlds 2-5 locked');

  // Settings → toggle vibration + reduced animations, then reload.
  await page.evaluate(() => window.__lumen.go('settings'));
  await waitScreen(page, 'settings');
  await page.click('.setting:has-text("Animations") .switch');
  await page.click('.setting:has-text("Color mode") .switch');
  await page.waitForTimeout(300);
  await shot(page, '07-settings');
  log(await page.evaluate(() => document.documentElement.classList.contains('reduced')), 'reduced animations applied');
  // Reset requires confirmation (cancel it).
  await page.click('.setting:has-text("Reset progress") .btn');
  await page.waitForSelector('.dialog');
  log(true, 'reset asks for confirmation');
  await page.click('.dialog .btn.ghost');
  await page.waitForTimeout(400);

  await page.goBack();
  await waitScreen(page, 'journey');
  log(true, 'browser/hardware back returns to the previous screen');
  await page.waitForTimeout(300);
  await page.reload();
  await waitScreen(page, 'home', 8000);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen.save.v1')));
  log(saved.levels[1] && saved.levels[2], 'progress persisted after reload');
  log(saved.settings.animations === 'reduced' && saved.settings.colorMode === 'colorblind', 'settings persisted after reload');
  log((await page.textContent('.home-progress')).includes('LEVEL 03'), 'home shows LEVEL 03 after reload');
  await ctx.close();
}

// ------------------------------------------------------- every mechanic
{
  const levels = {};
  for (let i = 1; i <= 100; i++) levels[i] = { stars: 3, best: 1 };
  delete levels[100];
  const { ctx, page } = await newPage({ levels, notes: 500, seen: { intros: ['locked', 'void', 'double', 'chain', 'rest', 'echo', 'reverse', 'mirror', 'portal', 'rotor'], tutorial: true } });
  await page.goto(BASE);
  await waitScreen(page, 'home', 8000);
  await page.mouse.click(30, 300);
  const sample = [6, 12, 21, 31, 41, 51, 61, 69, 81, 89, 97, 100];
  for (const id of sample) {
    await page.evaluate((i) => window.__lumen.go('game', { id: i }), id);
    await waitScreen(page, 'game');
    await page.waitForTimeout(300);
    const mech = await page.evaluate(() => window.__lumen.current.inst._test.L.mechanics.join(','));
    if (id === 81 || id === 89 || id === 100) await shot(page, `08-level${id}`);
    const n = await solveCurrent(page);
    log(true, `level ${id} [${mech}] solved through the UI in ${n} move(s)`);
    if (id === 100) {
      await shot(page, '09-level100-complete');
    }
    await page.evaluate(() => document.querySelectorAll('.overlay').forEach((o) => o.remove()));
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen.save.v1')));
  log(!!saved.levels[100], 'level 100 recorded');
  await ctx.close();
}

// ------------------------------------------- world complete + daily + zen + theme
{
  const levels = {};
  for (let i = 1; i <= 19; i++) levels[i] = { stars: 2, best: 3 };
  const { ctx, page } = await newPage({ levels, notes: 300, seen: { intros: [], tutorial: true } });
  await page.goto(BASE);
  await waitScreen(page, 'home', 8000);
  await page.mouse.click(30, 300);
  await page.click('.play-btn');
  await waitScreen(page, 'game');
  log((await page.textContent('.screen-game .screen-title')) === 'LEVEL 20', 'PLAY resumes at next level (20)');
  await solveCurrent(page);
  const label = await page.textContent('.result-actions .btn.primary');
  log(/CONTINUE/.test(label), 'finishing world 1 offers CONTINUE');
  await page.click('.result-actions .btn.primary');
  await page.waitForSelector('.world-complete', { timeout: 4000 });
  await page.waitForTimeout(4500);
  await shot(page, '10-world-complete');
  await page.waitForSelector('.wc-actions .btn', { timeout: 15000 });
  await page.waitForTimeout(800);
  log((await page.textContent('.wc-sub')) === 'THE SKY IS YOURS.', 'world complete scene shows "THE SKY IS YOURS."');
  await shot(page, '11-world-complete-end');
  await page.click('.wc-actions .btn');
  await waitScreen(page, 'world');
  log((await page.textContent('.screen-world .screen-title')) === 'HARMONY', 'continue opens WORLD 2 — HARMONY');
  await shot(page, '12-world2');

  // Daily
  await page.evaluate(() => window.__lumen.go('daily'));
  await waitScreen(page, 'daily');
  await shot(page, '13-daily');
  await page.click('.daily-card .btn');
  await waitScreen(page, 'game');
  log((await page.textContent('.screen-game .screen-title')) === 'DAILY PUZZLE', 'daily puzzle opens');
  await shot(page, '14-daily-game');
  await solveCurrent(page);
  log((await page.textContent('.result-word')).replace(/\s/g, '') === 'DAILYCOMPLETE', 'daily shows DAILY COMPLETE');
  await shot(page, '15-daily-complete');
  await page.evaluate(() => document.querySelectorAll('.overlay').forEach((o) => o.remove()));

  // Zen
  await page.evaluate(() => window.__lumen.go('zen'));
  await waitScreen(page, 'zen');
  await page.waitForTimeout(300);
  const before = await page.locator('.screen-zen .tile').count();
  await page.click('.pal-note >> nth=4');
  await page.waitForTimeout(300);
  const after = await page.locator('.screen-zen .tile').count();
  log(after === before + 1, `zen: palette adds a note (${before} → ${after})`);
  await page.click('.zen-controls .ctrl-play');
  await page.waitForTimeout(1200);
  await shot(page, '16-zen');
  await page.click('.zen-controls .ctrl-play');

  // Theme shop: buy & equip the Aurora sky.
  await page.evaluate(() => window.__lumen.go('theme'));
  await waitScreen(page, 'theme');
  await page.click('.shop-item:has-text("AURORA")');
  await page.waitForSelector('.dialog');
  await page.click('.dialog .btn.primary');
  await page.waitForTimeout(500);
  const eq = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen.save.v1') || '{}').equipped);
  log(eq && eq.theme === 'aurora', 'theme purchase equips AURORA');
  await shot(page, '17-theme');

  await page.evaluate(() => window.__lumen.go('sky'));
  await waitScreen(page, 'sky');
  await page.waitForTimeout(800);
  await shot(page, '18-sky');
  await ctx.close();
}

// ----------------------------------------------------- small + large screens
for (const [w, h] of [[360, 640], [1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('lumen.save.v1', JSON.stringify({ levels: Object.fromEntries(Array.from({ length: 88 }, (_, i) => [i + 1, { stars: 3, best: 1 }])) })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await waitScreen(page, 'home', 8000);
  await page.evaluate(() => window.__lumen.go('game', { id: 89 }));
  await waitScreen(page, 'game');
  await page.waitForTimeout(400);
  const fits = await page.evaluate(() => {
    const b = document.querySelector('.screen-game .board').getBoundingClientRect();
    const c = document.querySelector('.screen-game .controls').getBoundingClientRect();
    const m = document.querySelector('.screen-game .melody-bar').getBoundingClientRect();
    const tile = document.querySelector('.screen-game .tile').getBoundingClientRect();
    return { ok: b.top >= m.bottom - 1 && b.bottom <= c.top + 1 && b.left >= 0 && b.right <= innerWidth && c.bottom <= innerHeight, cell: Math.round(tile.width) };
  });
  log(fits.ok, `${w}x${h}: 7×7 board fits between melody and controls (cell ${fits.cell}px)`);
  await shot(page, `19-layout-${w}x${h}`);
  await ctx.close();
}

// ------------------------------------------------------------ offline (PWA)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload();
  await waitScreen(page, 'home', 8000);
  await page.click('.play-btn');
  await waitScreen(page, 'game');
  log(true, 'works offline after first visit (service worker)');
  const manifest = await page.evaluate(() => fetch('manifest.json').then((r) => r.json()));
  log(manifest.name === 'LUMEN' && manifest.short_name === 'LUMEN', 'manifest available offline (name LUMEN)');
  await ctx.close();
}

log(errors.length === 0, `no console errors${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
