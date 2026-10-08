// Schemes: murder plots (a knife in the dark) and ruin plots (charges carried to
// the King). Members may be sincere, or may have joined only to betray.

import { kill, imprison } from './court';
import { chance, clamp, pick, roll, weighted } from './rng';
import { describe, makeSecret, publish, syncPlotSecret } from './secrets';
import { first, nm, vary } from './text';
import { OFFICE_NAMES, addMod, ch, credence, isAlive, isFree, isRemoved, knows, learn, log, officeOf, opinion, uid } from './world';
import type { CharId, GameState, Offer, Plot, PlotCondition, PlotKind, SecretId } from './types';

const ADJ = ['Silent', 'Red', 'Long', 'Crooked', 'Hollow', 'Winter', 'Last', 'Gilded', 'Black', 'Quiet'];
const NOUN = ['Cup', 'Feast', 'Stair', 'Glove', 'Bell', 'Hunt', 'Letter', 'Candle', 'Ledger', 'Bargain'];

export const isMember = (p: Plot, id: CharId) => p.owner === id || p.members.some((m) => m.id === id);

export function conditionMet(s: GameState, c: PlotCondition): boolean {
  switch (c.kind) {
    case 'office':
      return !!officeOf(s, c.who) || s.king === c.who;
    case 'favour':
      return !!s.king && opinion(s, s.king, c.who) >= c.min;
    case 'after':
      return s.turn >= c.turn;
  }
}

/** Ready to strike: everyone waited on is gone, and (if set) one trigger holds. */
export function waitCleared(s: GameState, p: Plot): boolean {
  if (!p.waitFor.every((w) => isRemoved(s, w))) return false;
  return !p.trigger?.length || p.trigger.some((c) => conditionMet(s, c));
}

/** Protection around the King: his guard, and its captain if he is loyal. */
export function royalGuard(s: GameState, target: CharId, plotOwner?: CharId): number {
  if (s.king !== target) return 0;
  const cap = s.offices.captain;
  let g = 20;
  if (cap && isFree(s, cap) && cap !== plotOwner && cap !== target) {
    const turned = Object.values(s.plots).some(
      (p) => p.status === 'active' && p.targets.includes(target) && p.members.some((m) => m.id === cap && m.sincere),
    );
    if (!turned) g += 20;
  }
  return g;
}

export function strikePower(s: GameState, p: Plot): number {
  const o = ch(s, p.owner);
  let power = p.progress * 0.55 + o.traits.martial * 0.15 + o.traits.cunning * 0.15;
  for (const m of p.members) {
    if (!m.sincere || !isFree(s, m.id)) continue;
    power += 6 + ch(s, m.id).traits.martial * 0.08;
  }
  power += p.hiredBlades * 5;
  if (officeOf(s, p.owner) === 'marshal') power += 10;
  return power;
}

export function strikeDefence(s: GameState, target: CharId, owner?: CharId): number {
  const t = ch(s, target);
  return t.guard + t.traits.paranoia * 0.15 + t.traits.martial * 0.1 + royalGuard(s, target, owner);
}

export function strikeChance(s: GameState, p: Plot): number {
  const target = p.targets[0];
  if (!target) return 0;
  return clamp(Math.round(strikePower(s, p) - strikeDefence(s, target, p.owner) + 20), 5, 92);
}

export function canStrike(s: GameState, p: Plot): { ok: boolean; reason?: string } {
  if (p.kind !== 'murder') return { ok: false, reason: 'Only a murder plot can strike.' };
  if (p.status !== 'active') return { ok: false, reason: 'The plot is no longer active.' };
  const t = p.targets[0];
  if (!t || !isFree(s, t)) return { ok: false, reason: 'The target is beyond your reach.' };
  if (p.progress < 30) return { ok: false, reason: 'Too little is prepared (needs 30).' };
  return { ok: true };
}

export function plotName(s: GameState): string {
  return `The ${pick(s, ADJ)} ${pick(s, NOUN)}`;
}

export function createPlot(s: GameState, owner: CharId, kind: PlotKind, targets: CharId[], charges: SecretId[] = []): Plot {
  const id = uid(s, 'p');
  let secretId: SecretId;
  if (kind === 'murder') {
    const sec = makeSecret(s, {
      kind: targets[0] === s.king ? 'regicide' : 'murder',
      guilty: [owner],
      victims: targets,
      truth: true,
      evidence: 5,
      plotId: id,
    });
    secretId = sec.id;
  } else {
    const forged = charges.some((c) => !s.secrets[c]?.truth);
    const sec = makeSecret(s, {
      kind: forged ? 'slander' : 'ruin',
      guilty: [owner],
      victims: targets,
      truth: true,
      evidence: 5,
      treason: false,
      plotId: id,
      text: forged
        ? `${nm(s, owner)} is forging charges to destroy ${targets.map((t) => nm(s, t)).join(' and ')}.`
        : describe(s, 'ruin', [owner], targets),
    });
    secretId = sec.id;
  }
  const p: Plot = {
    id,
    kind,
    name: plotName(s),
    owner,
    targets: targets.slice(),
    members: [],
    progress: 0,
    status: 'active',
    secretId,
    charges: charges.slice(),
    waitFor: [],
    createdTurn: s.turn,
    intent:
      kind === 'murder'
        ? `See ${targets.map((t) => first(s, t)).join(' and ')} dead.`
        : `Bring ${targets.map((t) => first(s, t)).join(' and ')} down before the King.`,
    hiredBlades: 0,
  };
  s.plots[id] = p;
  learn(s, owner, secretId, 100, 'self');
  return p;
}

export function joinPlot(s: GameState, p: Plot, who: CharId, sincere: boolean, offer?: Offer): void {
  if (isMember(p, who)) return;
  p.members.push({
    id: who,
    sincere,
    role: p.kind === 'murder' ? 'Sworn blade' : 'Witness before the King',
    joinedTurn: s.turn,
    offer,
  });
  syncPlotSecret(s, p);
  learn(s, who, p.secretId, 100, 'self');
  for (const c of p.charges) learn(s, who, c, s.secrets[c]?.truth ? 70 : 60, p.owner);
}

/** Work on a plot. Gold buys hired blades for murder plots. */
export function advancePlot(s: GameState, p: Plot, actor: CharId, gold = 0): number {
  const a = ch(s, actor);
  const gain = Math.round(8 + a.traits.cunning * 0.12 + p.members.length * 2 + roll(s, 0, 6));
  p.progress = clamp(p.progress + gain, 0, 100);
  if (gold > 0 && p.kind === 'murder') {
    const spend = Math.min(gold, a.gold);
    a.gold -= spend;
    p.hiredBlades = clamp(p.hiredBlades + Math.floor(spend / 20), 0, 4);
  }
  if (p.kind === 'ruin') {
    for (const cid of p.charges) {
      const sec = s.secrets[cid];
      if (!sec) continue;
      if (!sec.truth && sec.fabricatedBy === actor) sec.evidence = clamp(sec.evidence + 3 + a.traits.cunning * 0.05, 0, 85);
      else if (sec.truth) sec.evidence = clamp(sec.evidence + 3, 0, 95);
    }
  }
  syncPlotSecret(s, p);
  return gain;
}

export function abandonPlot(s: GameState, p: Plot): void {
  p.status = 'abandoned';
  log(s, `${nm(s, p.owner)} quietly let “${p.name}” die.`, [p.owner, ...p.members.map((m) => m.id)], 'secret', [p.owner]);
}

export interface StrikeOutcome {
  success: boolean;
  traced: boolean;
  text: string;
}

export function resolveStrike(s: GameState, p: Plot): StrikeOutcome {
  const target = p.targets[0];
  const owner = p.owner;
  const pct = strikeChance(s, p);
  const success = chance(s, pct);
  const sec = s.secrets[p.secretId];
  const insiders = [owner, ...p.members.map((m) => m.id)];
  const wasKing = s.king === target;

  if (success) {
    const traced = chance(s, clamp(55 - ch(s, owner).traits.cunning * 0.4 + p.members.length * 6 - p.progress * 0.15, 5, 85));
    p.status = 'succeeded';
    const how = vary(s, [
      'a crossbow bolt from the trees during the hunt',
      'poison in the evening wine',
      'a knife on the north stair',
      'a fall from the battlements that no one saw',
      'a pillow, in the small hours',
    ]);
    kill(s, target, `Murdered, week ${s.turn} — ${how}`, false);
    log(s, `You struck. ${nm(s, target)} is dead by ${how}.`, insiders, 'secret', insiders);
    if (traced) {
      sec.evidence = 90;
      publish(s, sec.id, 85, 'court');
      log(s, `${nm(s, target)} is dead — ${how}. The trail led straight to ${nm(s, owner)}.`, 'all', 'dire', [target, owner]);
      for (const id of s.order) {
        if (isAlive(s, id) && id !== owner) addMod(s, id, owner, `murderer-${target}`, `Murdered ${first(s, target)}`, -35, 0.5);
      }
      seize(s, owner, sec.id, wasKing);
    } else {
      log(s, `${nm(s, target)} was found dead — ${how}. No one has been named.`, 'all', 'dire', [target]);
      // Suspicion settles on whoever was already suspected.
      for (const id of s.order) {
        if (!isAlive(s, id) || insiders.includes(id)) continue;
        const k = knows(s, id, sec.id);
        if (k) learn(s, id, sec.id, k.credence + 25, 'rumour');
        else if (chance(s, 15)) learn(s, id, sec.id, roll(s, 15, 35), 'rumour');
      }
    }
    return { success, traced, text: traced ? 'The deed is done, but you were seen.' : 'The deed is done. No one saw.' };
  }

  p.status = 'foiled';
  const detected = chance(s, clamp(70 - ch(s, owner).traits.cunning * 0.3, 20, 90));
  ch(s, target).guard += 20;
  if (detected) {
    sec.evidence = clamp(sec.evidence + 30, 0, 100);
    learn(s, target, sec.id, 90, 'court');
    if (s.king && s.king !== owner) learn(s, s.king, sec.id, 85, 'court');
    addMod(s, target, owner, 'tried-kill', 'Tried to murder me', -80);
    log(s, `An attempt on the life of ${nm(s, target)} failed — and the assassins named ${nm(s, owner)}.`, 'all', 'dire', [target, owner]);
    if (s.king && s.king !== owner && s.king !== s.player) seize(s, owner, sec.id, false);
    return { success, traced: true, text: 'The attempt failed, and your name was spoken.' };
  }
  learn(s, target, sec.id, 30, 'rumour');
  log(s, `Someone tried to kill ${nm(s, target)}. The would-be killers fled into the night.`, 'all', 'bad', [target]);
  log(s, `The attempt on ${nm(s, target)} failed. No one knows it was you — yet.`, insiders, 'secret', insiders);
  return { success, traced: false, text: 'The attempt failed, but the trail is cold.' };
}

/** The Guard lays hands on a known murderer. */
function seize(s: GameState, killer: CharId, secretId: SecretId, victimWasKing: boolean): void {
  if (!isFree(s, killer)) return;
  const cap = s.offices.captain;
  const loyalCaptain = cap && isFree(s, cap) && cap !== killer;
  if (victimWasKing && !loyalCaptain) {
    log(s, `With no loyal captain to seize ${nm(s, killer)}, the regicide walks the halls unpunished — for now.`, 'all', 'dire', [killer]);
    return;
  }
  imprison(s, killer, [secretId], cap ?? undefined);
  log(s, `${loyalCaptain ? nm(s, cap!) : 'The Guard'} seized ${nm(s, killer)} and dragged ${ch(s, killer).gender === 'f' ? 'her' : 'him'} to the Tower.`, 'all', 'court', [killer]);
}

// ── Secrecy ─────────────────────────────────────────────────────────────────

/** Every week, crowded or sloppy plots leak. */
export function leakPlots(s: GameState): void {
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active' || !isFree(s, p.owner)) continue;
    const insincere = p.members.filter((m) => !m.sincere).length;
    const pct = clamp(3 + p.members.length * 4 + insincere * 5 + p.progress / 12 - ch(s, p.owner).traits.cunning / 10, 1, 40);
    if (!chance(s, pct)) continue;
    const pool = s.order.filter((id) => isFree(s, id) && !isMember(p, id) && credence(s, id, p.secretId) < 40);
    const who = weighted(s, pool, (id) => {
      if (s.offices.spymaster === id) return 3;
      if (p.targets.includes(id)) return 2;
      if (s.offices.captain === id) return 2;
      return 1;
    });
    if (!who) continue;
    const sec = s.secrets[p.secretId];
    learn(s, who, p.secretId, roll(s, 35, 60), 'rumour');
    log(s, `${vary(s, ['A servant’s gossip', 'A half-burned letter', 'A drunk groom', 'Your own sharp ears'])} gave you a thread: ${sec.text}`, [who], 'secret', [who]);
  }
}

/** The Master of Whispers hears things. */
export function spymasterHears(s: GameState): void {
  const spy = s.offices.spymaster;
  if (!spy || !isFree(s, spy)) return;
  if (!chance(s, ch(s, spy).traits.cunning / 4)) return;
  const unknown = Object.values(s.secrets).filter(
    (sec) => sec.truth && credence(s, spy, sec.id) < 30 && !sec.guilty.includes(spy) && sec.guilty.some((g) => isFree(s, g)) && (!sec.plotId || s.plots[sec.plotId]?.status === 'active'),
  );
  if (!unknown.length) return;
  const sec = pick(s, unknown);
  learn(s, spy, sec.id, roll(s, 50, 70), 'spies');
  log(s, `Your informers bring word, as Master of Whispers: ${sec.text}`, [spy], 'secret', [spy]);
}

export function pledgeText(s: GameState, from: CharId, to: CharId, offer: Offer): string {
  switch (offer.kind) {
    case 'office':
      return `${first(s, from)} swore ${first(s, to)} would be ${OFFICE_NAMES[offer.office!]}.`;
    case 'restitution':
    case 'land':
      return `${first(s, from)} promised ${first(s, to)} the lands of ${s.lands[offer.landId!]?.name ?? 'a manor'}.`;
    case 'gold':
      return `${first(s, from)} paid ${first(s, to)} ${offer.amount} crowns.`;
    default:
      return `${first(s, from)} offered ${first(s, to)} a shared enemy.`;
  }
}

export function activePlots(s: GameState): Plot[] {
  return Object.values(s.plots).filter((p) => p.status === 'active');
}

export function plotsOwnedBy(s: GameState, id: CharId): Plot[] {
  return activePlots(s).filter((p) => p.owner === id);
}

/** Plots this character can see: their own, those they joined, and those whose secret they believe. */
export function plotsKnownTo(s: GameState, id: CharId, minCred = 25): Plot[] {
  return Object.values(s.plots).filter(
    (p) => isMember(p, id) || credence(s, id, p.secretId) >= minCred || !!knows(s, id, p.secretId)?.lie,
  );
}

export const plotAlive = (s: GameState, p: Plot) => p.status === 'active' && isAlive(s, p.owner);
