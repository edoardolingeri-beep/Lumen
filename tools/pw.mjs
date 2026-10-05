// Resolve Playwright from the project or the global install.
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export async function getChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (e) {
    const root = execSync('npm root -g').toString().trim();
    const require = createRequire(join(root, 'noop.js'));
    return require('playwright').chromium;
  }
}
