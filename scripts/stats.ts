// Aggregate outcomes over many seeds:  npx vite-node scripts/stats.ts -- [n] [player]
import { endWeek, newGame, npcTurn, resolveAudience } from '../src/engine';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 40);
const player = args[1] ?? 'anselm';
let deaths = 0;
let firstDeath = 0;
let firstCount = 0;
const kings: Record<string, number> = {};
const dead: Record<string, number> = {};
const executed: Record<string, number> = {};
const murdered: Record<string, number> = {};
let errors = 0;
for (let seed = 1; seed <= n; seed++) {
  try {
    const s = newGame(seed, player);
    let g = 0;
    while (s.phase === 'playing' && g++ < 100) {
      while (s.audiences.length) resolveAudience(s, s.audiences[0].id, s.audiences[0].options[0].id);
      if (s.phase !== 'playing') break;
      npcTurn(s, s.player);
      s.ap = 0;
      endWeek(s);
    }
    kings[s.king ?? 'none'] = (kings[s.king ?? 'none'] ?? 0) + 1;
    let fd = 99;
    for (const id of s.order) {
      const c = s.chars[id];
      if (c.status === 'dead') {
        deaths++;
        dead[id] = (dead[id] ?? 0) + 1;
        if (c.fate?.startsWith('Beheaded')) executed[id] = (executed[id] ?? 0) + 1;
        if (c.fate?.startsWith('Murdered')) murdered[id] = (murdered[id] ?? 0) + 1;
        fd = Math.min(fd, c.statusTurn ?? 99);
      }
    }
    if (fd < 99) {
      firstDeath += fd;
      firstCount++;
    }
  } catch (e) {
    errors++;
    console.error('seed', seed, e);
  }
}
console.log(`games ${n}  errors ${errors}  avg deaths ${(deaths / n).toFixed(2)}  avg first death week ${(firstDeath / Math.max(1, firstCount)).toFixed(1)}`);
console.log('kings at end', kings);
console.log('died', dead);
console.log('executed', executed);
console.log('murdered', murdered);
