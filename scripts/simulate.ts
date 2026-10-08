// Run a generated court with the player on autopilot (the same AI as everyone
// else) and print what really happened:
//   npx vite-node scripts/simulate.ts -- [seed] [weeks] [--quiet]
import { evaluate, weekLabel } from '../src/engine';
import { autopilotSeason } from '../test/helpers';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seed = Number(args[0] ?? 1);
const weeks = Number(args[1] ?? 40);
const quiet = args.includes('--quiet');

const s = autopilotSeason(seed, weeks);
if (!quiet) {
  let turn = 0;
  for (const ev of s.events) {
    if (ev.turn !== turn) {
      turn = ev.turn;
      console.log(`\n── ${weekLabel(turn)} ──`);
    }
    const vis = ev.visibleTo === 'all' ? 'ALL' : ev.visibleTo.map((v) => s.chars[v]?.short ?? v).join(',') || 'nobody';
    console.log(`  [${ev.tone}] (${vis}) ${ev.text}`);
  }
}
console.log('\nCourt:');
for (const id of s.order) {
  const c = s.chars[id];
  const tag = id === s.player ? ' (PLAYER)' : '';
  console.log(`  ${(c.name + tag).padEnd(34)} ${c.status.padEnd(10)} ${c.rank.padEnd(8)} ${(c.archetype ?? '').padEnd(13)} ${c.firstAgenda?.kind ?? ''} ${c.fate ?? ''}`);
}
console.log('King:', s.king && s.chars[s.king].name, '| week', s.turn, '| ending', s.ending?.reason, JSON.stringify(evaluate(s)));
