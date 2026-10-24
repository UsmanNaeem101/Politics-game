import { newGame, endWeek, resolveAudience, afterPlayerAction, nm, landsOf, type GameState } from './src/engine';
function passive(s: GameState) {
  let n = 0;
  while (s.audiences.length && n++ < 60) { const a = s.audiences[0]; resolveAudience(s, a.id, a.options[a.options.length - 1].id); afterPlayerAction(s); }
}
const tally: Record<string, number> = {};
let shown = 0;
for (let seed = 1; seed <= 250; seed++) {
  const s = newGame(seed);
  const sec = Object.values(s.secrets).find((x) => x.text.includes('rise, then kill'));
  if (!sec) continue;
  const p = s.plots[sec.plotId!];
  const victim = p.targets[0], owner = p.owner;
  let doneAt = -1;
  for (let w = 0; w < 104 && s.phase === 'playing'; w++) {
    passive(s); if (s.phase !== 'playing') break; s.ap = 0; endWeek(s);
    if (doneAt < 0 && p.status !== 'active') doneAt = s.turn;
    if (doneAt > 0 && s.turn >= doneAt + 12) break;
  }
  const key = `${p.status}${p.status === 'succeeded' ? (s.chars[victim].status === 'dead' ? ' victim dead' : ' victim alive') : ''} / owner ${s.chars[owner].status}`;
  tally[key] = (tally[key] ?? 0) + 1;
  if (p.status === 'succeeded' && shown < 3) {
    shown++;
    console.log(`\n== seed ${seed}: ${nm(s, owner)} vs ${nm(s, victim)}, done week ${doneAt}; owner now ${s.chars[owner].status}, holds ${landsOf(s, owner).map((l) => l.name).join(', ')}; secret text: "${sec.text}" kind=${sec.kind} evidence=${sec.evidence}`);
    for (const e of s.events.filter((e) => e.turn >= doneAt - 1 && (e.actors ?? []).some((a: string) => a === owner || a === victim))) console.log(`  w${e.turn} [${e.tone}] ${e.text}`);
  }
}
console.log(tally);
