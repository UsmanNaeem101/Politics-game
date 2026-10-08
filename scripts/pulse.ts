// How lively is the court over time? Counts public dramatic events per season.
//   npx vite-node scripts/pulse.ts -- [n] [weeks]
import { autopilotSeason } from '../test/helpers';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 20);
const weeks = Number(args[1] ?? 104);
const buckets: number[] = [];
const plotsMade: number[] = [];
const alive: number[] = [];
for (let seed = 1; seed <= n; seed++) {
  const s = autopilotSeason(seed, weeks);
  for (let b = 0; b <= Math.floor((s.turn - 1) / 13); b++) alive[b] = (alive[b] ?? 0) + 1;
  for (const e of s.events) {
    const b = Math.floor((e.turn - 1) / 13);
    if (e.visibleTo === 'all' && (e.tone === 'dire' || e.tone === 'court')) buckets[b] = (buckets[b] ?? 0) + 1;
  }
  for (const p of Object.values(s.plots)) {
    const b = Math.floor(Math.max(0, p.createdTurn - 1) / 13);
    plotsMade[b] = (plotsMade[b] ?? 0) + 1;
  }
}
console.log('season: courts still running | public court/dire events per court | schemes begun per court');
alive.forEach((a, i) => console.log(`  ${i + 1}: ${a} | ${((buckets[i] ?? 0) / a).toFixed(1)} | ${((plotsMade[i] ?? 0) / a).toFixed(1)}`));
