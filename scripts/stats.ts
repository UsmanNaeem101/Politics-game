// Aggregate outcomes over many generated courts:  npx vite-node scripts/stats.ts -- [n] [weeks]
import { autopilotSeason } from '../test/helpers';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 40);
const weeks = Number(args[1] ?? 40);
let deaths = 0;
let executions = 0;
let murders = 0;
let natural = 0;
let kingDied = 0;
let firstDeath = 0;
let firstCount = 0;
let playerDead = 0;
let playerKing = 0;
let arrivals = 0;
let people = 0;
const kingsBy: Record<string, number> = {};
let errors = 0;
const t0 = Date.now();
for (let seed = 1; seed <= n; seed++) {
  try {
    const s = autopilotSeason(seed, weeks);
    const firstKing = s.order.find((id) => s.chars[id].archetype === 'old-king')!;
    if (s.chars[firstKing].status === 'dead') kingDied++;
    if (s.king) kingsBy[s.chars[s.king].archetype ?? '?'] = (kingsBy[s.chars[s.king].archetype ?? '?'] ?? 0) + 1;
    if (s.chars[s.player].status === 'dead') playerDead++;
    if (s.king === s.player) playerKing++;
    arrivals += Object.values(s.houses).filter((h) => h.arrived > 0).length;
    people += s.order.length;
    let fd = 999;
    for (const id of s.order) {
      const c = s.chars[id];
      if (c.status !== 'dead') continue;
      deaths++;
      if (c.fate?.startsWith('Beheaded')) executions++;
      else if (c.fate?.startsWith('Murdered')) murders++;
      else natural++;
      fd = Math.min(fd, c.statusTurn ?? 999);
    }
    if (fd < 999) {
      firstDeath += fd;
      firstCount++;
    }
  } catch (e) {
    errors++;
    console.error('seed', seed, e);
  }
}
console.log(`${n} courts × ${weeks} weeks in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors ${errors}`);
console.log(`per court: deaths ${(deaths / n).toFixed(2)} (executed ${(executions / n).toFixed(2)}, murdered ${(murders / n).toFixed(2)}, natural ${(natural / n).toFixed(2)}); first death week ${(firstDeath / Math.max(1, firstCount)).toFixed(1)}`);
console.log(`old king dead in ${kingDied}/${n}; autopilot player dead ${playerDead}, crowned ${playerKing}; arrivals ${(arrivals / n).toFixed(1)}; people ${(people / n).toFixed(1)}`);
console.log('kings at the end, by archetype', kingsBy);
