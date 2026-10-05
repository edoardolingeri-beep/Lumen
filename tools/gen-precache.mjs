// Regenerates the precache list + version hash inside sw.js.
// Run after changing any file: `npm run precache`.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const include = ['index.html', 'manifest.json', 'src', 'assets'];
const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) readdirSync(p).sort().forEach((f) => walk(join(p, f)));
  else if (!/\.(md|txt|wav)$/.test(p)) files.push(p);
};
include.forEach((f) => walk(join(root, f)));
const hash = createHash('sha256');
files.forEach((f) => hash.update(readFileSync(f)));
const version = hash.digest('hex').slice(0, 10);
const list = ['./', ...files.map((f) => `./${relative(root, f).split('\\').join('/')}`)];
const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/\/\* PRECACHE:START \*\/[\s\S]*\/\* PRECACHE:END \*\//, `/* PRECACHE:START */\n${list.map((f) => `  '${f}',`).join('\n')}\n  /* PRECACHE:END */`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${list.length} files, version ${version}`);
