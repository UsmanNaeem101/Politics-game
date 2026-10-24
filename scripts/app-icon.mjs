// Renders the desktop app icon (build/icon.png, 1024×1024): the gold crown glyph
// on a lapis tile. electron-builder turns it into .ico and .icns.
// Run with `node scripts/app-icon.mjs`; needs Playwright's Chromium.

import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const gi = readFileSync(new URL('../src/ui/icons/gi.ts', import.meta.url), 'utf8');
const crown = JSON.parse(gi.match(/^ {2}"crown": (".*"),?$/m)[1]);

// macOS draws icons as an 824px tile inside a 1024px canvas; Windows uses the same image.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232838"/><stop offset="1" stop-color="#101219"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)"/>
  <rect x="124" y="124" width="776" height="776" rx="163" fill="none" stroke="#cfa64e" stroke-opacity=".55" stroke-width="10"/>
  <g transform="translate(232 222) scale(1.09375)" color="#cfa64e">${crown}</g>
</svg>`;

mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
await page.locator('svg').screenshot({ path: new URL('../build/icon.png', import.meta.url).pathname, omitBackground: true });
await browser.close();
console.log('build/icon.png');
