// Run whole seasons with the player character on autopilot (the same AI as
// everyone else) and print what really happened. Useful for tuning.
//   npx vite-node scripts/simulate.ts -- [seed] [player] [--quiet]
import { endWeek, newGame, npcTurn, resolveAudience, evaluate } from '../src/engine';
import type { GameState } from '../src/engine';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seed = Number(args[0] ?? 1);
const player = args[1] ?? 'anselm';
const quiet = args.includes('--quiet');

export function autoplay(s: GameState): void {
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 200) {
    while (s.audiences.length) {
      const a = s.audiences[0];
      resolveAudience(s, a.id, a.options[0].id);
    }
    if (s.phase !== 'playing') break;
    npcTurn(s, s.player);
    s.ap = 0;
    endWeek(s);
  }
}

const s = newGame(seed, player);
autoplay(s);
if (!quiet) {
  let turn = 0;
  for (const ev of s.events) {
    if (ev.turn !== turn) {
      turn = ev.turn;
      console.log(`\n── Week ${turn} ──`);
    }
    const vis = ev.visibleTo === 'all' ? 'ALL' : ev.visibleTo.join(',') || 'nobody';
    console.log(`  [${ev.tone}] (${vis}) ${ev.text}`);
  }
}
console.log('\nFates:');
for (const id of s.order) {
  const c = s.chars[id];
  console.log(`  ${c.name.padEnd(24)} ${c.status.padEnd(10)} ${c.rank.padEnd(7)} ${c.fate ?? ''}`);
}
console.log('King:', s.king, ' Ending:', s.ending?.reason, JSON.stringify(evaluate(s)));
