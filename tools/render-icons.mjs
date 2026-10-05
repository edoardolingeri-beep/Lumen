// Renders assets/icons/icon.svg into the PNG sizes needed by the PWA.
import { readFileSync } from 'node:fs';
import { getChromium } from './pw.mjs';

const svg = readFileSync(new URL('../assets/icons/icon.svg', import.meta.url), 'utf8');
const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage();
const out = [
  ['icon-192.png', 192, 0.22],
  ['icon-512.png', 512, 0.22],
  ['maskable-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
];
for (const [name, size, radius] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../assets/icons/${name}`, import.meta.url).pathname, omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
