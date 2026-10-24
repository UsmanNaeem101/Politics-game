// Having someone followed. For a month a hired man keeps them in sight: where
// they go, whom they meet. Routine says who they are; the quiet places say what
// they hide. A careful mark may spot the tail, and a clever one trace it home.

import { HAUNTS, QUIET_PLACES, TRADE_HAUNTS } from './content/haunts';
import { BUSINESSES } from './content/businesses';
import { discoverAffair, loversOf } from './love';
import { chance, clamp, pick, roll } from './rng';
import { first, names, nm } from './text';
import {
  addMod,
  businessesOf,
  ch,
  credence,
  gone,
  hasPerk,
  hearOf,
  isChild,
  isFree,
  isServant,
  learn,
  log,
  officeOf,
  opinion,
  uid,
} from './world';
import type { CharId, GameState, Tail } from './types';

export const TAIL_COST = 8;

export function tailProblem(s: GameState, actor: CharId, target: CharId): string | null {
  if (ch(s, actor).gold < TAIL_COST) return `A man to follow them costs ${TAIL_COST} crowns.`;
  if (Object.values(s.tails ?? {}).some((t) => t.by === actor && t.target === target)) return 'You already have them followed this month.';
  return null;
}

/** Hire a man to follow them until the month turns. */
export function setTail(s: GameState, actor: CharId, target: CharId): Tail {
  ch(s, actor).gold -= TAIL_COST;
  const t: Tail = { id: uid(s, 't'), by: actor, target, since: s.turn };
  (s.tails ??= {})[t.id] = t;
  return t;
}

/** The chance a tail is spotted this month. */
export function spotChance(s: GameState, t: Tail): number {
  const T = ch(s, t.target);
  return clamp(Math.round(6 + T.traits.paranoia * 0.15 + T.traits.cunning * 0.1 - (hasPerk(s, t.by, 'informants') ? 6 : 0)), 3, 40);
}

/** Every month: each tail reports, or is spotted. */
export function runTails(s: GameState): void {
  for (const t of Object.values(s.tails ?? {})) {
    delete s.tails![t.id];
    if (gone(s, t.by) || !isFree(s, t.target)) continue;
    if (chance(s, spotChance(s, t))) spotted(s, t);
    else follow(s, t);
  }
}

function spotted(s: GameState, t: Tail): void {
  const T = ch(s, t.target);
  T.guard = Math.min(60, T.guard + 10);
  const traced = chance(s, 25 + T.traits.cunning * 0.4);
  if (traced) addMod(s, t.target, t.by, 'tailed', 'Had me followed', -20, 0.3);
  log(s, `${first(s, t.target)} noticed your man in the street and lost him in the crowd.${traced ? ` ${T.gender === 'f' ? 'She' : 'He'} knows who sent him.` : ''}`, [t.by], 'bad', [t.target]);
  if (traced) log(s, `You caught ${nm(s, t.by)}'s man following you.`, [t.target], 'bad', [t.by]);
}

/** A month in their footsteps. */
function follow(s: GameState, t: Tail): void {
  const { by, target } = t;
  const T = ch(s, target);
  const she = T.gender === 'f' ? 'She' : 'He';
  const lines: string[] = [];
  const met = new Set<CharId>();
  const seen = (id: CharId, lvl: 1 | 2 = 2) => {
    met.add(id);
    if (by === s.player) hearOf(s, id, lvl);
  };

  // Routine.
  const routine: string[] = [];
  if (officeOf(s, target) || target === s.king) routine.push(HAUNTS.council);
  if (T.rank === 'clergy' || T.traits.honor >= 65) routine.push(chance(s, 50) ? HAUNTS.chapel : HAUNTS.priory);
  if (T.gender === 'f') routine.push(pick(s, [HAUNTS.gardens, HAUNTS.market, HAUNTS.chapel, HAUNTS.almshouse]));
  else if (!isServant(s, target)) routine.push(pick(s, [HAUNTS.butts, HAUNTS.mews, HAUNTS.tiltyard, HAUNTS.hall, HAUNTS.library]));
  else routine.push(HAUNTS.market);
  for (const b of businessesOf(s, target)) if (!BUSINESSES[b.kind].illicit) routine.push(TRADE_HAUNTS[b.kind]);
  lines.push(`${she} kept to ${list(Array.from(new Set(routine)))}.`);

  // Friends, in the open.
  const friends = s.order
    .filter((o) => o !== target && o !== by && isFree(s, o) && !isServant(s, o) && !isChild(s, o) && opinion(s, target, o) >= 35)
    .sort((a, b) => opinion(s, target, b) - opinion(s, target, a))
    .slice(0, 2);
  if (friends.length) {
    friends.forEach((f) => seen(f));
    lines.push(`${she} dined with ${names(s, friends)}.`);
  }

  // A racket, at night.
  for (const b of businessesOf(s, target)) {
    if (!BUSINESSES[b.kind].illicit || !chance(s, 70)) continue;
    lines.push(`After dark ${she.toLowerCase()} went to ${TRADE_HAUNTS[b.kind]}, and was greeted there like the master of the place.`);
    if (b.secretId && s.secrets[b.secretId]) learn(s, by, b.secretId, Math.max(credence(s, by, b.secretId), 55), 'spies');
  }

  // A lover.
  for (const lover of loversOf(s, target)) {
    if (lover === by || !isFree(s, lover) || !chance(s, 75)) continue;
    const sec = Object.values(s.secrets).find((x) => x.kind === 'affair' && x.truth && x.guilty.includes(target) && x.guilty.includes(lover));
    const place = pick(s, QUIET_PLACES);
    if (chance(s, 65)) {
      seen(lover);
      lines.push(`Twice ${she.toLowerCase()} slipped away to ${place}, and ${nm(s, lover)} came soon after. They left separately.`);
      if (sec) {
        if (sec.victims.includes(by)) discoverAffair(s, by, sec);
        else learn(s, by, sec.id, Math.max(credence(s, by, sec.id), 60), 'spies');
        sec.evidence = clamp(sec.evidence + 5, 0, 95);
      }
    } else {
      lines.push(`Twice ${she.toLowerCase()} slipped away to ${place} to meet someone in a hooded cloak. Your man could not get close enough to see the face.`);
    }
  }

  // Fellow plotters.
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active' || (p.owner !== target && !p.members.some((m) => m.id === target)) || !chance(s, 55)) continue;
    const others = [p.owner, ...p.members.map((m) => m.id)].filter((o) => o !== target && o !== by && isFree(s, o));
    if (!others.length) continue;
    const shown = others.slice(0, 3);
    shown.forEach((o) => seen(o));
    lines.push(`${she} met ${names(s, shown)} behind closed doors at ${pick(s, QUIET_PLACES)}, and they kept their voices low.`);
    learn(s, by, p.secretId, Math.max(credence(s, by, p.secretId), roll(s, 30, 45)), 'spies');
  }

  // A spy reporting to their master.
  for (const sp of Object.values(s.spies ?? {})) {
    if (sp.status !== 'active' || sp.affair || sp.agent !== target || sp.master === by || !chance(s, 45)) continue;
    seen(sp.master, 1);
    lines.push(
      sp.mark === by
        ? `${she} passed a letter to a servant of ${nm(s, sp.master)}. Whatever goes on in your house, ${first(s, sp.master)} hears of it.`
        : `${she} passed a letter to a servant of ${nm(s, sp.master)}.`,
    );
  }

  if (lines.length === 1) lines.push('Nothing out of the way: an honest month, or a careful one.');
  log(s, `Your man followed ${nm(s, target)} for a month. ${lines.join(' ')}`, [by], 'secret', [target, ...met]);
}

function list(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? 'home') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
