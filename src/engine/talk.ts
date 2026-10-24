// Table talk. An hour in someone's company is the oldest way to learn things at
// court: a warning, a piece of gossip, a friend to meet, a grudge, an ambition
// spoken aloud or let slip. How much comes out depends on how warm they are to
// you, how far they trust you, and how loose their tongue is.

import { BITTER, GOSSIP_OPENERS, OPEN_AIMS, SLIPS, WARM, WARNING_OPENERS } from './content/talk';
import { chance, clamp, pick, roll, weighted } from './rng';
import { hearCredence } from './secrets';
import { first, he, him, his, names, nm } from './text';
import {
  acquaintance,
  ch,
  credence,
  effective,
  hasPerk,
  hearOf,
  insightOf,
  isFree,
  isServant,
  learn,
  log,
  opinion,
  trust,
} from './world';
import type { CharId, GameState, Secret } from './types';

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

function say(s: GameState, line: string, who: CharId, target?: CharId): string {
  return cap(
    line
      .replace(/\{He\}/g, cap(he(s, who)))
      .replace(/\{he\}/g, he(s, who))
      .replace(/\{his\}/g, his(s, who))
      .replace(/\{him\}/g, him(s, who))
      .replace(/\{first\}/g, first(s, who))
      .replace(/\{target\}/g, target ? nm(s, target) : 'someone'),
  );
}

/** The player has heard how `a` feels about `b`. */
export function learnFeeling(s: GameState, observer: CharId, a: CharId, b: CharId): void {
  const ins = insightOf(s, observer);
  ins.feelings ??= [];
  const key = `${a}>${b}`;
  if (!ins.feelings.includes(key)) ins.feelings.push(key);
}

export function heardFeeling(s: GameState, observer: CharId, a: CharId, b: CharId): boolean {
  return !!s.insight[observer]?.feelings?.includes(`${a}>${b}`);
}

/** Chance that an hour's talk gives anything away. */
export function talkChance(s: GameState, actor: CharId, target: CharId): number {
  const T = effective(s, target);
  const op = opinion(s, target, actor);
  const familiar = actor === s.player ? Math.min(4, s.company[target] ?? 0) * 3 : 0;
  const wine = hasPerk(s, actor, 'cellar') ? 10 : 0;
  const loose = (100 - T.cunning) * 0.2 + (T.wrath - 50) * 0.1;
  return clamp(Math.round(15 + op * 0.4 + (trust(s, target, actor) - 40) * 0.4 + loose + ch(s, actor).traits.charm * 0.15 + familiar + wine), 8, 85);
}

/**
 * What the target lets fall, if anything. Returns a line for the outcome, and
 * logs what the actor learned. NPCs gossip and warn each other; the player can
 * also meet friends, hear of grudges and ambitions, and put names to faces.
 */
export function tableTalk(s: GameState, actor: CharId, target: CharId): string | null {
  if (isServant(s, target)) return null;
  const P = s.player;
  const forPlayer = actor === P;
  if (!chance(s, forPlayer ? talkChance(s, actor, target) : talkChance(s, actor, target) / 2)) return null;
  const T = ch(s, target);
  const op = opinion(s, target, actor);

  // Secrets they would pass on: never their own, their spouse's or their kin's.
  const shields = (sec: Secret) => sec.guilty.some((g) => g === target || g === T.spouse || T.siblings.includes(g));
  const tellable = Object.entries(s.knowledge[target] ?? {})
    .filter(([sid, k]) => !k.lie && k.credence >= 50 && s.secrets[sid] && !shields(s.secrets[sid]) && credence(s, actor, sid) < 40)
    .map(([sid]) => s.secrets[sid])
    .filter((sec) => !sec.guilty.includes(actor) && sec.guilty.some((g) => isFree(s, g)) && (!sec.plotId || s.plots[sec.plotId]?.status === 'active' || sec.deed));
  const warnings = tellable.filter((sec) => sec.victims.includes(actor));

  const options: { kind: string; w: number }[] = [];
  if (warnings.length && op >= 10) options.push({ kind: 'warning', w: 40 });
  if (tellable.length) options.push({ kind: 'gossip', w: 35 * ((110 - T.traits.honor) / 60) });
  if (forPlayer) {
    options.push({ kind: 'aims', w: 15 }, { kind: 'feeling', w: 18 }, { kind: 'faces', w: 6 });
    if (op >= 20) options.push({ kind: 'friend', w: 20 });
  }
  const choice = weighted(s, options, (o) => o.w);
  if (!choice) return null;

  switch (choice.kind) {
    case 'warning':
    case 'gossip': {
      const sec = pick(s, choice.kind === 'warning' ? warnings : tellable);
      learn(s, actor, sec.id, hearCredence(s, actor, target, sec), target);
      const opener = say(s, pick(s, choice.kind === 'warning' ? WARNING_OPENERS : GOSSIP_OPENERS), target);
      const line = `${opener} “${sec.text}”`;
      log(s, line, [actor], 'secret', [target, ...sec.guilty]);
      return line;
    }
    case 'aims':
      return aims(s, actor, target);
    case 'feeling':
      return feeling(s, actor, target) ?? faces(s, actor, target);
    case 'friend':
      return friend(s, actor, target) ?? faces(s, actor, target);
    default:
      return faces(s, actor, target);
  }
}

/** An aim spoken aloud is a design uncovered; a hidden one only slips. */
function aims(s: GameState, actor: CharId, target: CharId): string | null {
  const T = ch(s, target);
  const open = OPEN_AIMS[T.agenda.kind];
  if (open) {
    const line = say(s, pick(s, open), target, T.agenda.targets[0]);
    const ins = insightOf(s, actor);
    if (!ins.agendas.includes(target)) ins.agendas.push(target);
    hearOf(s, target, 5);
    log(s, `${first(s, target)} spoke of what ${he(s, target)} wants. ${line}`, [actor], 'secret', [target]);
    return line;
  }
  const slips = SLIPS[T.agenda.kind];
  if (!slips) return null;
  const line = say(s, pick(s, slips), target, T.agenda.targets[0]);
  // A scheme of their own you may now half suspect.
  const own = Object.values(s.plots).find((p) => p.status === 'active' && p.owner === target);
  // A suspicion you formed yourself, not something you were told.
  if (own && credence(s, actor, own.secretId) < 25) learn(s, actor, own.secretId, roll(s, 20, 35), 'rumour');
  log(s, `${first(s, target)} let something slip. ${line}`, [actor], 'secret', [target]);
  return line;
}

/** Who they love, and whom they cannot abide. */
function feeling(s: GameState, actor: CharId, target: CharId): string | null {
  const T = ch(s, target);
  const strong = s.order
    .filter((o) => o !== target && o !== actor && o !== T.spouse && isFree(s, o) && !isServant(s, o))
    .map((o) => ({ o, v: opinion(s, target, o) }))
    .filter((x) => Math.abs(x.v) >= 20 && !heardFeeling(s, actor, target, x.o));
  if (!strong.length) return null;
  const { o, v } = pick(s, strong);
  learnFeeling(s, actor, target, o);
  hearOf(s, o, 1);
  const line = say(s, pick(s, v > 0 ? WARM : BITTER), target, o);
  log(s, line, [actor], 'secret', [target, o]);
  return line;
}

/** A friend of theirs, presented to you. */
function friend(s: GameState, actor: CharId, target: CharId): string | null {
  const friends = s.order.filter(
    (o) => o !== actor && o !== target && isFree(s, o) && !isServant(s, o) && o !== s.king && acquaintance(s, o) < 3 && opinion(s, target, o) >= 25,
  );
  if (!friends.length) return null;
  const f = pick(s, friends);
  hearOf(s, f, 3);
  const line = `${first(s, target)} introduced you to ${nm(s, f)}, a friend of ${his(s, target)}.`;
  log(s, line, [actor, f], 'good', [target, f]);
  return line;
}

/** Their household, or faces across the hall. */
function faces(s: GameState, actor: CharId, target: CharId): string | null {
  const home = s.houses[ch(s, target).householdId]?.members.filter((m) => m !== target && !isServant(s, m) && isFree(s, m) && acquaintance(s, m) < 2) ?? [];
  if (home.length) {
    for (const m of home) hearOf(s, m, 2);
    const line = `${first(s, target)} spoke of ${his(s, target)} household, and pointed out ${names(s, home)}.`;
    log(s, line, [actor], 'neutral', home);
    return line;
  }
  const strangers = s.order.filter((o) => o !== actor && isFree(s, o) && !isServant(s, o) && acquaintance(s, o) <= 1);
  if (!strangers.length) return null;
  const o = pick(s, strangers);
  hearOf(s, o, 2);
  const line = `${first(s, target)} pointed out ${nm(s, o)} across the hall.`;
  log(s, line, [actor], 'neutral', [o]);
  return line;
}
