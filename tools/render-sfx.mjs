// Bounces the synthesised interface sounds to .wav files in assets/audio/
// (button, select, move, success, hint, soft, star, coin). The game itself
// synthesises them live; the files are provided for reuse elsewhere.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChromium } from './pw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const p = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    res.writeHead(200, { 'Content-Type': extname(p) === '.js' ? 'text/javascript' : 'text/html' });
    res.end(await readFile(p.endsWith('/') ? join(p, 'index.html') : p));
  } catch (e) {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/manifest.json`);
const files = await page.evaluate(async () => {
  const { SFX } = await import('/src/audio/sfx.js');
  const out = {};
  for (const name of Object.keys(SFX)) {
    const rate = 44100;
    const ctx = new OfflineAudioContext(2, rate * 2.2, rate);
    const g = ctx.createGain();
    g.gain.value = 1.4;
    g.connect(ctx.destination);
    SFX[name](ctx, g, 0.01, 0);
    const buf = await ctx.startRendering();
    // Trim trailing silence.
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    let end = L.length - 1;
    while (end > 0 && Math.abs(L[end]) < 1e-4 && Math.abs(R[end]) < 1e-4) end--;
    end = Math.min(L.length, end + Math.floor(rate * 0.05));
    const pcm = new Int16Array(end * 2);
    for (let i = 0; i < end; i++) {
      pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767;
      pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
    }
    out[name] = Array.from(new Uint8Array(pcm.buffer));
  }
  return out;
});
mkdirSync(join(root, 'assets/audio'), { recursive: true });
for (const [name, bytes] of Object.entries(files)) {
  const data = Buffer.from(bytes);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(44100 * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(root, 'assets/audio', `${name}.wav`), Buffer.concat([header, data]));
  console.log(`assets/audio/${name}.wav  ${(data.length / 1024).toFixed(0)} KB`);
}
await browser.close();
server.close();
