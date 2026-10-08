// Fresh trouble for an open-ended game. Each season the court holds a feast, and
// a few new tensions are applied to whoever fits them: a dormant ambition wakes,
// a feud starts at table, a lonely wife takes a lover, the King picks a favourite.

import { chance, pick, roll, shuffle, weighted } from './rng';
import { makeSecret } from './secrets';
import { first, nm } from './text';
import {
  SEASONS,
  WEEKS_PER_SEASON,
  acquaintance,
  addMod,
  ch,
  hearOf,
  isFree,
  isServant,
  learn,
  log,
  opinion,
  rel,
} from './world';
import type { Character, GameState } from './types';

const nobles = (s: GameState): Character[] =>
  s.order.map((id) => s.chars[id]).filter((c) => c.status === 'free' && !isServant(s, c.id) && c.rank !== 'clergy');

/** The seasonal feast: faces, introductions, and a quarrel or two. */
export function seasonalFeast(s: GameState): void {
  if (s.turn <= 1 || (s.turn - 1) % WEEKS_PER_SEASON !== 0) return;
  const season = SEASONS[Math.floor((s.turn - 1) / WEEKS_PER_SEASON) % 4];
  const host = s.king ? nm(s, s.king) : 'the lords of the Witan';
  log(s, `${host} held the ${season} feast. The whole court was there.`, 'all', 'court');
  const P = s.player;
  if (isFree(s, P)) {
    const seen = shuffle(
      s,
      nobles(s).filter((c) => c.id !== P && acquaintance(s, c.id) <= 1),
    ).slice(0, 3);
    for (const c of seen) hearOf(s, c.id, 2);
    const tablemate = shuffle(
      s,
      nobles(s).filter((c) => c.id !== P && acquaintance(s, c.id) === 2),
    )[0];
    if (tablemate) {
      hearOf(s, tablemate.id, 3);
      addMod(s, tablemate.id, P, 'feast', 'Shared a table', 5, 0.3);
      log(s, `At the feast you were seated beside ${nm(s, tablemate.id)}, and the two of you talked.`, [P, tablemate.id], 'good', [tablemate.id]);
    }
  }
  const n = roll(s, 1, 2);
  const kinds = shuffle(s, [feud, ambitionWakes, newAffair, newFavourite, slight, grudgeHardens]);
  let done = 0;
  for (const k of kinds) {
    if (done >= n) break;
    if (k(s)) done++;
  }
}

/** Two nobles quarrel over precedence at table. */
function feud(s: GameState): boolean {
  const pool = nobles(s).filter((c) => c.rank !== 'king' && c.rank !== 'queen' && c.gender === 'm');
  if (pool.length < 2) return false;
  const a = weighted(s, pool, (c) => c.traits.wrath + 10)!;
  const b = pick(s, pool.filter((c) => c.id !== a.id && c.spouse !== a.id && !a.siblings.includes(c.id)));
  if (!b) return false;
  addMod(s, a.id, b.id, `feud-${s.turn}`, 'Quarrelled at the feast', -25, 0, true);
  addMod(s, b.id, a.id, `feud-${s.turn}`, 'Quarrelled at the feast', -20, 0, true);
  log(s, `At the feast, ${nm(s, a.id)} and ${nm(s, b.id)} quarrelled over precedence. Swords were half-drawn before the King's men stepped in.`, 'all', 'bad', [a.id, b.id]);
  if (a.traits.wrath >= 60 && ['peace', 'rise'].includes(a.agenda.kind)) {
    a.agenda = { kind: 'destroy', targets: [b.id], summary: `Make ${b.short} pay for the insult at the feast.` };
    log(s, `${a.name} left the feast swearing that ${b.short} would pay.`, [], 'secret', [a.id, b.id]);
  }
  return true;
}

/** A man who had been content looks at the throne and wonders. */
function ambitionWakes(s: GameState): boolean {
  if (!s.king) return false;
  const pool = nobles(s).filter(
    (c) => c.id !== s.player && c.id !== s.king && c.canClaim && ['peace', 'rise'].includes(c.agenda.kind) && c.traits.ambition >= 55 && (c.prestige >= 35 || c.rank === 'great'),
  );
  const c = weighted(s, pool, (x) => x.traits.ambition + x.prestige);
  if (!c) return false;
  c.agenda = { kind: 'crown', targets: [s.king], summary: 'The King grows old. Someone must follow him; why not him?' };
  log(s, `${c.name} watched the old King at the feast, and began to think about the throne.`, [], 'secret', [c.id]);
  return true;
}

/** A lonely wife and a charming guest. */
function newAffair(s: GameState): boolean {
  const wives = nobles(s).filter((c) => c.gender === 'f' && c.spouse && isFree(s, c.spouse) && opinion(s, c.id, c.spouse) < 15 && c.traits.honor < 55);
  const wife = wives.length ? pick(s, wives) : undefined;
  if (!wife) return false;
  if (Object.values(s.secrets).some((x) => x.kind === 'affair' && x.guilty[0] === wife.id)) return false;
  const lovers = nobles(s).filter((c) => c.gender === 'm' && c.id !== wife.spouse && c.householdId !== wife.householdId && c.traits.honor < 60 && c.rank !== 'king');
  const lover = weighted(s, lovers, (c) => c.traits.charm);
  if (!lover) return false;
  const husband = wife.spouse!;
  const sec = makeSecret(s, {
    kind: 'affair',
    guilty: [wife.id, lover.id],
    victims: [husband],
    truth: true,
    evidence: roll(s, 15, 30),
    treason: wife.rank === 'queen',
    text: `${wife.name} has taken ${lover.name} as her lover.`,
  });
  learn(s, wife.id, sec.id, 100, 'self');
  learn(s, lover.id, sec.id, 100, 'self');
  addMod(s, wife.id, lover.id, 'lover', 'Her lover', 45);
  addMod(s, lover.id, wife.id, 'lover', 'His lover', 35);
  rel(s, wife.id, lover.id).trust = 75;
  const maid = s.houses[wife.householdId]?.members.find((m) => ch(s, m).role === 'maid' && isFree(s, m));
  if (maid && chance(s, 60)) learn(s, maid, sec.id, 60, 'spies');
  log(s, `${wife.name} and ${lover.name} slipped away from the feast together.`, [], 'secret', [wife.id, lover.id]);
  return true;
}

/** The King takes a favourite, and the court resents it. */
function newFavourite(s: GameState): boolean {
  if (!s.king) return false;
  const fav = weighted(
    s,
    nobles(s).filter((c) => c.id !== s.king && c.rank !== 'queen'),
    (c) => c.traits.charm + Math.max(0, opinion(s, s.king!, c.id)),
  );
  if (!fav) return false;
  addMod(s, s.king, fav.id, `favour-${s.turn}`, 'The King’s new favourite', 20, 0.3, true);
  fav.prestige += 5;
  for (const c of nobles(s)) {
    if (c.id === fav.id || c.id === s.king || c.traits.ambition < 55) continue;
    addMod(s, c.id, fav.id, `envy-${s.turn}`, 'Envies the King’s favour', -10, 0.3);
  }
  log(s, `The King kept ${nm(s, fav.id)} at his side all evening. The court noticed.`, 'all', 'neutral', [fav.id]);
  return true;
}

/** An old hatred finally turns into a purpose. */
function grudgeHardens(s: GameState): boolean {
  const pairs: [Character, Character][] = [];
  for (const c of nobles(s)) {
    if (c.id === s.player || !['peace', 'rise'].includes(c.agenda.kind) || c.traits.wrath < 50) continue;
    for (const o of nobles(s)) if (o.id !== c.id && o.id !== s.king && opinion(s, c.id, o.id) <= -40) pairs.push([c, o]);
  }
  if (!pairs.length) return false;
  const [c, o] = pick(s, pairs);
  c.agenda = { kind: 'destroy', targets: [o.id], summary: `He has hated ${o.short} long enough. Now he means to do something about it.` };
  log(s, `${c.name} decided that ${o.name} had lived well for too long.`, [], 'secret', [c.id, o.id]);
  return true;
}

/** Someone is slighted in public, and does not forget it. */
function slight(s: GameState): boolean {
  if (!s.king) return false;
  const pool = nobles(s).filter((c) => c.id !== s.king && c.traits.wrath >= 50);
  const c = pool.length ? pick(s, pool) : undefined;
  if (!c) return false;
  addMod(s, c.id, s.king, `slight-${s.turn}`, 'Slighted me before the court', -20, 0.2, true);
  log(s, `The King mocked ${first(s, c.id)} before the whole hall. ${c.gender === 'f' ? 'She' : 'He'} laughed along, white-faced.`, 'all', 'bad', [c.id]);
  return true;
}
