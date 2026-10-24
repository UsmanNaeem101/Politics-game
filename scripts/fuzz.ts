// Random legal play for every character across many seeds, checking the court's
// invariants after every step:  npx vite-node scripts/fuzz.ts -- [seeds]
import { type GameState } from '../src/engine';
import { randomSeason } from '../test/helpers';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 100);
const weeks = Number(args[1] ?? 40);
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
    if (c.rank === 'king' && c.status === 'free' && s.king !== c.id) bad(`${c.id} has rank king but is not king`);
    if (c.spouse && s.chars[c.spouse].spouse !== c.id) bad(`${c.id} one-sided marriage`);
  }
  for (const id of Object.keys(s.imprisoned)) if (s.chars[id].status !== 'imprisoned') bad(`${id} in prison map but ${s.chars[id].status}`);
  for (const p of Object.values(s.plots)) {
    if (p.status === 'active' && !['free', 'imprisoned'].includes(s.chars[p.owner].status)) bad(`active plot ${p.id} with ${s.chars[p.owner].status} owner`);
    if (p.status === 'active' && p.targets.some((t) => s.chars[t].status === 'dead')) bad(`active plot ${p.id} targets the dead`);
  }
  if (s.ap < 0) bad(`ap ${s.ap}`);
  for (const h of Object.values(s.houses)) if (h.head && !['free', 'imprisoned'].includes(s.chars[h.head].status)) bad(`house ${h.name} headed by ${s.chars[h.head].status}`);
  for (const b of Object.values(s.businesses)) {
    if (!s.chars[b.owner]) bad(`business ${b.id} with no owner`);
    if (b.secretId && !s.secrets[b.secretId]?.guilty.includes(b.owner)) bad(`racket ${b.id} whose secret does not name its owner`);
  }
  const counts: Record<string, number> = {};
  for (const b of Object.values(s.businesses)) counts[b.owner] = (counts[b.owner] ?? 0) + 1;
  for (const [o, n] of Object.entries(counts)) if (n > 2) bad(`${o} runs ${n} trades`);
  const spyCount: Record<string, number> = {};
  for (const sp of Object.values(s.spies)) {
    if (sp.status !== 'active') continue;
    if (sp.agent === sp.mark || sp.agent === sp.master) bad(`spy ${sp.id} watches itself`);
    // A lover who spies for love is not one of the three a master may recruit.
    if (!sp.affair) spyCount[sp.master] = (spyCount[sp.master] ?? 0) + 1;
  }
  for (const [m, n] of Object.entries(spyCount)) if (n > 3) bad(`${m} keeps ${n} recruited spies`);
  for (const c of Object.values(s.chars)) {
    if (c.rank === 'child' && c.age >= 17) bad(`${c.id} still a child at ${c.age}`);
    if (c.rank === 'child' && (c.spouse || Object.values(s.plots).some((p) => p.status === 'active' && (p.owner === c.id || p.targets.includes(c.id) || p.members.some((m) => m.id === c.id)))))
      bad(`child ${c.id} married or in a plot`);
    for (const p of c.parents ?? []) if (!s.chars[p]?.children?.includes(c.id)) bad(`${c.id} has a parent who does not own them`);
    if (c.status !== 'dead' && c.spouse && s.chars[c.spouse].status !== 'dead' && s.chars[c.spouse].spouse !== c.id) bad(`${c.id} married to someone married elsewhere`);
  }
  for (const sp of Object.values(s.spies)) if (sp.status === 'active' && (s.chars[sp.agent].rank === 'child' || s.chars[sp.mark].rank === 'child')) bad(`spy ${sp.id} involves a child`);
}
let games = 0;
const t0 = Date.now();
for (let seed = 1; seed <= n; seed++) {
  try {
    randomSeason(seed, weeks, (x) => check(x, `#${seed}`));
    games++;
  } catch (e) {
    problems.push(`#${seed} threw: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
  }
}
console.log(`${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${problems.length} problems`);
for (const p of problems) console.log(' -', p);
