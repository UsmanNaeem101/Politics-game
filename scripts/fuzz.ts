// Random legal play for every character across many seeds, checking the court's
// invariants after every step:  npx vite-node scripts/fuzz.ts -- [seeds]
import { PLAYABLE, type GameState } from '../src/engine';
import { randomSeason } from '../test/helpers';

const n = Number(process.argv.slice(2).filter((a) => a !== '--')[0] ?? 30);
const problems: string[] = [];
const seen = new Set<string>();
function check(s: GameState, tag: string) {
  const bad = (m: string) => {
    if (seen.has(tag + m)) return;
    seen.add(tag + m);
    if (problems.length < 40) problems.push(`${tag} w${s.turn}: ${m}`);
  };
  if (s.king && s.chars[s.king].status === 'dead') bad(`dead king ${s.king}`);
  for (const [o, h] of Object.entries(s.offices)) if (h && !['free', 'imprisoned'].includes(s.chars[h].status)) bad(`${o} held by ${s.chars[h].status} ${h}`);
  for (const c of Object.values(s.chars)) {
    if (c.status === 'imprisoned' && !s.imprisoned[c.id]) bad(`${c.id} jailed without record`);
    if (c.gold < 0) bad(`${c.id} gold ${c.gold}`);
    if (c.rank === 'king' && c.status === 'free' && s.king !== c.id && c.id !== 'osric') bad(`${c.id} has rank king but is not king`);
  }
  for (const id of Object.keys(s.imprisoned)) if (s.chars[id].status !== 'imprisoned') bad(`${id} in prison map but ${s.chars[id].status}`);
  for (const p of Object.values(s.plots)) {
    if (p.status === 'active' && !['free', 'imprisoned'].includes(s.chars[p.owner].status)) bad(`active plot ${p.id} with ${s.chars[p.owner].status} owner`);
    if (p.status === 'active' && p.targets.some((t) => s.chars[t].status === 'dead')) bad(`active plot ${p.id} targets the dead`);
  }
  if (s.ap < 0) bad(`ap ${s.ap}`);
}
let games = 0;
const t0 = Date.now();
for (const who of PLAYABLE) {
  for (let seed = 1; seed <= n; seed++) {
    try {
      const s = randomSeason(seed, who, (x) => check(x, `${who}#${seed}`));
      if (s.phase !== 'ended') problems.push(`${who}#${seed} did not end`);
      games++;
    } catch (e) {
      problems.push(`${who}#${seed} threw: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
    }
  }
}
console.log(`${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${problems.length} problems`);
for (const p of problems) console.log(' -', p);
