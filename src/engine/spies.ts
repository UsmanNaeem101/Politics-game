// Spies are people. You recruit someone who can get close to the person you
// want watched (a maid in their house, a brother, a lover, a friend) and you
// offer them something: a wage, silence about their own secret, or nothing at
// all if they love you or hate the mark. They report each week until they are
// caught, unpaid, or turned; a turned spy goes on reporting, and every word is
// a lie.

import { REPORT_OPENERS, SPY_HOOKS } from './content/spies';
import { chance, clamp, pick, roll, weighted } from './rng';
import { makeSecret, secretMatters } from './secrets';
import { first, he, him, nm } from './text';
import {
  acquaintance,
  addMod,
  ch,
  credence,
  effective,
  gone,
  hasPerk,
  hearOf,
  insightOf,
  isFree,
  isServant,
  learn,
  log,
  opinion,
  trust,
  uid,
} from './world';
import type { Audience, CharId, GameState, Secret, SecretId, Spy, SpyHook } from './types';

export type Access = 'household' | 'intimate';

/** Most spies one person can keep at once. */
export const MAX_SPIES = 3;

export const activeSpies = (s: GameState): Spy[] => Object.values(s.spies ?? {}).filter((x) => x.status === 'active');
export const spiesOf = (s: GameState, master: CharId): Spy[] => activeSpies(s).filter((x) => x.master === master);

/** How close the agent can get to the mark, if at all. */
export function accessTo(s: GameState, agent: CharId, mark: CharId): Access | null {
  if (agent === mark || !isFree(s, agent) || !isFree(s, mark)) return null;
  if (ch(s, agent).householdId === ch(s, mark).householdId) return 'household';
  // Lovers carry a mark on each other; it is cheaper to look there than through every secret.
  const lovers = s.relations[mark]?.[agent]?.mods.some((m) => m.key === 'lover');
  if (lovers || opinion(s, mark, agent) >= 30) return 'intimate';
  return null;
}

/** Whom this person could watch for a master: people they can get close to, not already watched for them. */
export function marksFor(s: GameState, master: CharId, agent: CharId): CharId[] {
  return s.order.filter(
    (m) =>
      m !== master &&
      !isServant(s, m) &&
      accessTo(s, agent, m) !== null &&
      (master !== s.player || acquaintance(s, m) >= 1) &&
      !spiesOf(s, master).some((x) => x.mark === m && x.agent === agent),
  );
}

/** Why this hook will not work here, or null if it can. */
export function hookProblem(s: GameState, master: CharId, agent: CharId, mark: CharId, hook: SpyHook, wage: number, secretId?: SecretId): string | null {
  switch (hook) {
    case 'gold':
      if (wage < 1) return 'Name a wage.';
      return ch(s, master).gold < wage * 2 ? `You need ${wage * 2} crowns: two weeks' wages in hand.` : null;
    case 'blackmail': {
      const sec = secretId ? s.secrets[secretId] : undefined;
      if (!sec || !sec.guilty.includes(agent) || !secretMatters(s, sec)) return 'You hold nothing over them.';
      const k = s.knowledge[master]?.[sec.id];
      if (!k || (!k.lie && k.credence < 40)) return 'You do not know it well enough to threaten them with it.';
      return null;
    }
    case 'devotion':
      return opinion(s, agent, master) >= 40 ? null : 'They are not devoted enough to you to do it for nothing.';
    case 'grudge':
      return opinion(s, agent, mark) <= -25 ? null : `They bear ${first(s, mark)} no grudge.`;
  }
}

/** The chance they agree. Loyalty to the mark works against you; your hook works for you. */
export function spyOdds(s: GameState, master: CharId, agent: CharId, mark: CharId, hook: SpyHook, wage: number, secretId?: SecretId): number {
  const A = effective(s, agent);
  let p = 20 + opinion(s, agent, master) * 0.4 + (trust(s, agent, master) - 40) * 0.3 - Math.max(0, opinion(s, agent, mark)) * 0.5 - A.honor * 0.15;
  if (hook === 'gold') p += A.greed * 0.3 + wage * 4;
  if (hook === 'blackmail' && secretId && s.secrets[secretId]) {
    const sec = s.secrets[secretId];
    p += sec.evidence * 0.4 + (sec.treason || sec.deed ? 25 : 10) - A.boldness * 0.2;
  }
  if (hook === 'devotion') p += 30;
  if (hook === 'grudge') p += 20 - opinion(s, agent, mark) * 0.3;
  if (hasPerk(s, master, 'debtors')) p += 8;
  return clamp(Math.round(p), 3, 95);
}

type Result = { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' };

export function recruitSpy(s: GameState, master: CharId, agent: CharId, mark: CharId, hook: SpyHook, wage: number, secretId?: SecretId): Result {
  const P = s.player;
  if (!chance(s, spyOdds(s, master, agent, mark, hook, wage, secretId))) {
    addMod(s, agent, master, 'asked-spy', 'Asked me to betray my own', -5, 0.3);
    const A = effective(s, agent);
    if (chance(s, clamp(opinion(s, agent, mark) * 0.8 + A.honor * 0.3 + 10, 5, 90))) {
      addMod(s, mark, master, 'suborn', 'Tried to buy my people', -25, 0.3);
      log(s, `${nm(s, agent)} told you that ${nm(s, master)} tried to make ${him(s, agent)} a spy.`, [mark], 'secret', [agent, master]);
    }
    return {
      ok: false,
      text: `${first(s, agent)} would not do it. Whether ${he(s, agent)} will tell ${first(s, mark)}, you cannot say.`,
      tone: 'bad',
    };
  }
  const spy: Spy = { id: uid(s, 'sp'), agent, master, mark, hook, wage: hook === 'gold' ? wage : 0, since: s.turn, status: 'active', reports: 0 };
  if (hook === 'gold') {
    ch(s, master).gold -= wage * 2;
    ch(s, agent).gold += wage * 2;
  }
  if (hook === 'blackmail') addMod(s, agent, master, 'blackmailed', 'Made me a spy with a threat', -35, 0.1);
  s.spies[spy.id] = spy;
  if (master === P) hearOf(s, mark, 2);
  log(s, `${nm(s, agent)} agreed to watch ${nm(s, mark)} for ${nm(s, master)}.`, [master, agent], 'secret', [agent, mark]);
  return {
    ok: true,
    text: `${first(s, agent)} will watch ${first(s, mark)} for you${hook === 'gold' ? `, for ${wage} crowns a week` : ''}. Reports will come at dawn.`,
    tone: 'good',
  };
}

export function endSpy(s: GameState, spy: Spy, why?: string): void {
  spy.status = 'ended';
  if (why) log(s, why, [spy.master], 'neutral', [spy.agent]);
}

/** Every week: wages, reports, lies from the turned, and the risk of being caught. */
export function runSpies(s: GameState): void {
  for (const spy of activeSpies(s)) {
    const { agent, master, mark } = spy;
    if (gone(s, master) || ch(s, master).status !== 'free') {
      endSpy(s, spy);
      continue;
    }
    if (gone(s, agent) || !isFree(s, agent)) {
      endSpy(s, spy, `${nm(s, agent)} can watch ${nm(s, mark)} for you no longer.`);
      continue;
    }
    if (gone(s, mark) || !accessTo(s, agent, mark)) {
      endSpy(s, spy, `${nm(s, agent)} can no longer get close to ${nm(s, mark)}. ${first(s, agent)}'s service is over.`);
      continue;
    }
    if (spy.hook === 'gold') {
      if (ch(s, master).gold < spy.wage) {
        addMod(s, agent, master, 'unpaid', 'Left me unpaid', -15, 0.3);
        endSpy(s, spy, `You could not pay ${nm(s, agent)}, and ${he(s, agent)} has stopped reporting.`);
        continue;
      }
      ch(s, master).gold -= spy.wage;
      ch(s, agent).gold += spy.wage;
    }
    if (!spy.turnedBy) {
      const M = effective(s, mark);
      const A = effective(s, agent);
      const pct = clamp(3 + M.paranoia * 0.08 + M.cunning * 0.05 - A.cunning * 0.06 + (s.offices.spymaster === mark ? 6 : 0), 1, 20);
      if (chance(s, pct)) {
        caught(s, spy);
        continue;
      }
      const reportPct = (accessTo(s, agent, mark) === 'household' ? 50 : 35) + A.cunning * 0.2;
      if (chance(s, reportPct)) report(s, spy);
    } else if (chance(s, 40)) {
      feedLie(s, spy);
    }
  }
}

function opener(s: GameState, spy: Spy): string {
  return pick(s, REPORT_OPENERS).replace('{agent}', first(s, spy.agent)).replace('{mark}', first(s, spy.mark));
}

/** What a spy brings back. Their mark's own schemes first, then guilt, gossip, designs and faces. */
function report(s: GameState, spy: Spy): void {
  const { agent, master, mark } = spy;
  const A = effective(s, agent);
  const quality = clamp(Math.round(55 + (accessTo(s, agent, mark) === 'household' ? 15 : 0) + A.cunning * 0.1 + roll(s, -5, 5)), 40, 88);
  const fresh = (sec: Secret, below: number) => secretMatters(s, sec) && credence(s, master, sec.id) < below && !s.knowledge[master]?.[sec.id]?.lie;
  const plots = Object.values(s.plots)
    .filter((p) => p.status === 'active' && (p.owner === mark || p.members.some((m) => m.id === mark)))
    .map((p) => s.secrets[p.secretId])
    .filter((sec) => sec && fresh(sec, quality));
  const guilt = Object.values(s.secrets).filter((sec) => sec.truth && sec.guilty.includes(mark) && !sec.plotId && fresh(sec, 50));
  const gossip = Object.entries(s.knowledge[mark] ?? {})
    .filter(([sid, k]) => !k.lie && k.credence >= 60 && s.secrets[sid] && !s.secrets[sid].guilty.includes(master) && !s.secrets[sid].guilty.includes(agent))
    .map(([sid]) => s.secrets[sid])
    .filter((sec) => fresh(sec, 40));
  const knowsDesign = insightOf(s, master).agendas.includes(mark);
  const household =
    master === s.player
      ? (s.houses[ch(s, mark).householdId]?.members ?? []).filter((m) => !gone(s, m) && acquaintance(s, m) < 2)
      : [];
  const options: { kind: string; w: number }[] = [];
  if (plots.length) options.push({ kind: 'plot', w: 40 });
  if (guilt.length) options.push({ kind: 'guilt', w: 30 });
  if (gossip.length) options.push({ kind: 'gossip', w: 20 });
  if (!knowsDesign) options.push({ kind: 'design', w: 15 });
  if (household.length) options.push({ kind: 'household', w: 8 });
  const choice = weighted(s, options, (o) => o.w);
  if (!choice) return;
  spy.reports++;
  const head = opener(s, spy);
  if (choice.kind === 'design') {
    insightOf(s, master).agendas.push(mark);
    if (master === s.player) hearOf(s, mark, 5);
    log(s, `${head} “${ch(s, mark).agenda.summary}”`, [master], 'secret', [mark]);
    return;
  }
  if (choice.kind === 'household') {
    for (const m of household) hearOf(s, m, 2);
    log(s, `${head} who lives in ${first(s, mark)}'s house, and who comes and goes.`, [master], 'secret', household);
    return;
  }
  const sec = pick(s, choice.kind === 'plot' ? plots : choice.kind === 'guilt' ? guilt : gossip);
  learn(s, master, sec.id, quality, agent);
  log(s, `${head} “${sec.text}”`, [master], 'secret', [mark, ...sec.guilty]);
}

/** A turned spy carries the turner's lies, in the same hand and the same voice as before. */
function feedLie(s: GameState, spy: Spy): void {
  const T = spy.turnedBy!;
  const { master, agent } = spy;
  const forged = Object.entries(s.knowledge[T] ?? {})
    .filter(([sid, k]) => k.lie && s.secrets[sid] && !s.secrets[sid].guilty.includes(master) && secretMatters(s, s.secrets[sid]) && credence(s, master, sid) < 40)
    .map(([sid]) => s.secrets[sid]);
  let sec = forged.length ? pick(s, forged) : undefined;
  if (!sec && T !== s.player) {
    // An NPC turner forges what will do the most harm: a knife meant for the master, in an enemy's hand.
    const enemies = s.order
      .filter((x) => x !== T && x !== master && x !== agent && isFree(s, x) && !isServant(s, x) && x !== s.king)
      .sort((a, b) => opinion(s, T, a) - opinion(s, T, b));
    const enemy = enemies[0];
    if (!enemy) return;
    sec = makeSecret(s, {
      kind: 'murder',
      guilty: [enemy],
      victims: [master],
      truth: false,
      fabricatedBy: T,
      evidence: roll(s, 20, 35) + ch(s, T).traits.cunning * 0.2,
    });
    learn(s, T, sec.id, 0, 'self', true);
  }
  if (!sec) return;
  spy.reports++;
  learn(s, master, sec.id, clamp(60 + roll(s, -5, 10), 0, 90), agent);
  log(s, `${opener(s, spy)} “${sec.text}”`, [master], 'secret', [spy.mark, ...sec.guilty]);
  log(s, `${first(s, agent)} carried your lie to ${nm(s, master)}: “${sec.text}”`, [T], 'secret', [agent, master]);
}

/** The mark catches the spy. A cunning mark may turn them instead of sending them away. */
export function caught(s: GameState, spy: Spy): void {
  const { agent, master, mark } = spy;
  const def = SPY_HOOKS[spy.hook];
  const named = chance(s, def.names);
  if (mark === s.player) {
    s.audiences.push(caughtAudience(s, spy, named));
    hearOf(s, agent, 3);
    if (named) hearOf(s, master, 1);
    return;
  }
  if (effective(s, mark).cunning >= 55 && chance(s, def.turns)) {
    spy.turnedBy = mark;
    log(s, `You caught ${nm(s, agent)} spying for ${nm(s, master)}, and turned ${him(s, agent)}. From now on ${he(s, agent)} carries what you choose.`, [mark], 'secret', [agent, master]);
    return;
  }
  endSpy(s, spy);
  addMod(s, mark, agent, 'spied', 'Spied on me', -50);
  if (named) addMod(s, mark, master, 'spied', 'Set spies on me', -40);
  log(s, `${nm(s, mark)} caught ${nm(s, agent)} spying${named ? ` for ${nm(s, master)}` : ''}.`, [mark], 'secret', [agent]);
  log(s, `${nm(s, agent)} was caught watching ${nm(s, mark)}, ${named ? 'and named you' : 'and held their tongue'}.`, [master], 'bad', [agent, mark]);
}

function caughtAudience(s: GameState, spy: Spy, named: boolean): Audience {
  const { agent, master } = spy;
  return {
    id: uid(s, 'a'),
    kind: 'caught-spy',
    from: agent,
    turn: s.turn,
    title: 'A spy in your house',
    text: `${nm(s, agent)} was caught where ${he(s, agent)} should not have been, among your letters. ${
      named ? `Pressed, ${he(s, agent)} named ${nm(s, master)}.` : `${he(s, agent)[0].toUpperCase() + he(s, agent).slice(1)} will not say who sent ${him(s, agent)}.`
    }`,
    options: [
      { id: 'turn', label: `Keep ${him(s, agent)}, and let ${him(s, agent)} carry back what you choose`, hint: 'Forge a lie, and it will reach them through this spy.', tone: 'good' },
      { id: 'dismiss', label: `Send ${him(s, agent)} away`, tone: 'neutral' },
    ],
    data: { spyId: spy.id, named },
  };
}

export function answerCaughtSpy(s: GameState, spyId: string, named: boolean, optionId: string): Result {
  const spy = s.spies[spyId];
  if (!spy || spy.status !== 'active') return { ok: false, text: 'It no longer matters.', tone: 'neutral' };
  const P = s.player;
  if (optionId === 'turn') {
    spy.turnedBy = P;
    return {
      ok: true,
      text: `${first(s, spy.agent)} is yours now. ${named ? `${first(s, spy.master)} will hear only what you let them hear.` : 'Whoever sent them will hear only what you let them hear.'} Forge a lie, and it will travel.`,
      tone: 'good',
    };
  }
  endSpy(s, spy);
  addMod(s, P, spy.agent, 'spied', 'Spied on me', -50);
  if (named) addMod(s, P, spy.master, 'spied', 'Set spies on me', -40);
  return { ok: true, text: `${first(s, spy.agent)} is gone from your house.`, tone: 'neutral' };
}

/** Search your own household for someone else's spy. */
export function sweepHousehold(s: GameState, actor: CharId): Result {
  const home = ch(s, actor).householdId;
  const A = effective(s, actor);
  const found = activeSpies(s).filter(
    (sp) =>
      sp.master !== actor &&
      sp.agent !== actor &&
      sp.turnedBy !== actor &&
      ch(s, sp.agent).householdId === home &&
      chance(s, clamp(40 + A.cunning * 0.3 - effective(s, sp.agent).cunning * 0.3, 10, 90)),
  );
  for (const sp of found) {
    // A spy in the house watches the head; whoever they were set on, they answer to the head now.
    sp.mark = actor;
    caught(s, sp);
  }
  if (!found.length) return { ok: true, text: 'You find nothing amiss. That proves nothing.', tone: 'neutral' };
  return { ok: true, text: actor === s.player ? 'You found something.' : '', tone: 'good' };
}

/** A forgery came to light: if it reached its victim through a turned spy, the spy is unmasked too. */
export function unmaskTurned(s: GameState, sec: Secret): void {
  for (const spy of activeSpies(s)) {
    if (!spy.turnedBy || spy.turnedBy !== sec.fabricatedBy || s.knowledge[spy.master]?.[sec.id]?.source !== spy.agent) continue;
    endSpy(s, spy, `The letters were forged, and they came to you through ${nm(s, spy.agent)}. Your spy had been turned.`);
  }
}
