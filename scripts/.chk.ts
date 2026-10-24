import { autopilotSeason } from '../test/helpers';
import { acquaintance, gone } from '../src/engine';
let unnamed = 0, orphans = 0, total = 0;
for (let seed = 1; seed <= 20; seed++) {
  const s = autopilotSeason(seed, 60);
  for (const [sid, k] of Object.entries(s.knowledge[s.player] ?? {})) {
    const sec = s.secrets[sid];
    if (!sec) continue;
    for (const id of [...sec.guilty, ...sec.victims]) {
      total++;
      if (acquaintance(s, id) < 1 && !gone(s, id)) { unnamed++; if (unnamed < 6) console.log('seed', seed, 'unnamed', s.chars[id].name, '|', sec.text.slice(0, 90)); }
    }
  }
  for (const c of Object.values(s.chars)) {
    if (gone(s, c.id)) continue;
    const h = s.houses[c.householdId];
    if (!h || !h.members.includes(c.id)) { orphans++; console.log('seed', seed, 'not in own house', c.name, c.householdId); }
  }
}
console.log({ unnamed, orphans, total });
