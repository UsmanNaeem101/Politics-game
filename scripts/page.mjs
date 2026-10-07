// Turn dist-single/index.html into a bare page fragment (no doctype/html/head/body
// wrappers) for hosts that supply their own document skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
const out = src
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="UTF-8" \/>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
writeFileSync('dist-single/crown-of-whispers.html', out.trim() + '\n');
console.log(`dist-single/crown-of-whispers.html ${(out.length / 1024).toFixed(1)} KiB`);
