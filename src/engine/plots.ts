// Schemes: murder plots (a knife in the dark) and ruin plots (charges carried to
// the King). Members may be sincere, or may have joined only to betray.

import { kill, imprison, markJudged } from './court';
import { chance, clamp, pick, roll, weighted } from './rng';
import { deedDone, describe, hearCredence, makeSecret, publish, syncPlotSecret } from './secrets';
import { first, nm, vary } from './text';
import {
  OFFICE_NAMES,
  addMod,
  ch,
  credence,
  dateLabel,
  hasPerk,
  isAlive,
  isChild,
  isFree,
  isRemoved,
  isServant,
  knows,
  learn,
  log,
  officeOf,
  opinion,
  uid,
} from './world';
import type { CharId, GameState, Offer, Plot, PlotCondition, PlotKind, Secret, SecretId } from './types';

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
  if (hasPerk(s, p.owner, 'cutthroats')) power += 10;
  if (hasPerk(s, p.owner, 'poisons')) power += 6;
  return power;
}

/** A lady goes unarmed and keeps no men-at-arms of her own (the Queen has the King's guard about her). */
export const unguardedLady = (s: GameState, id: CharId): boolean => ch(s, id).gender === 'f' && ch(s, id).rank !== 'queen';
export const LADY_EXPOSED = 10;

export function strikeDefence(s: GameState, target: CharId, owner?: CharId): number {
  const t = ch(s, target);
  const retainers = hasPerk(s, target, 'retainers') ? 10 : 0;
  const base = t.guard + t.traits.paranoia * 0.15 + t.traits.martial * 0.1 + royalGuard(s, target, owner) + retainers;
  return Math.max(0, base - (unguardedLady(s, target) ? LADY_EXPOSED : 0));
}

/** How much must be prepared before a strike: less for a lady, whose days are easily learned. */
export const strikeReady = (s: GameState, p: Plot): number => (p.targets[0] && unguardedLady(s, p.targets[0]) ? 20 : 30);

/** A killing the reigning King has given his leave for. */
export const sanctioned = (s: GameState, p: Plot): boolean => !!p.warrant && p.warrant === s.king;

/** Treason aimed at the King himself: what a loyal sword may offer to answer. */
export const againstTheKing = (s: GameState, sec: Secret): boolean =>
  !!s.king && sec.treason && (sec.victims.includes(s.king) || ['regicide', 'pact', 'usurpation'].includes(sec.kind));

/** Past this, each blade and each month of preparation buys less: a killing can be made near certain, never certain. */
export const STRIKE_SURE = 92;
export const STRIKE_MAX = 98;

export function strikeChance(s: GameState, p: Plot): number {
  const target = p.targets[0];
  if (!target) return 0;
  const raw = strikePower(s, p) - strikeDefence(s, target, p.owner) + 20;
  const pct = raw <= STRIKE_SURE ? raw : STRIKE_SURE + (raw - STRIKE_SURE) * 0.25;
  return clamp(Math.round(pct), 5, STRIKE_MAX);
}

/**
 * If the strike succeeds, the chance it is traced to the leader. Cunning and careful preparation hide
 * him; every sworn member is another mouth; hired blades do the work while he is seen elsewhere.
 */
export function traceChance(s: GameState, p: Plot): number {
  const quiet = hasPerk(s, p.owner, 'cutthroats') ? 12 : 0;
  return clamp(Math.round(55 - ch(s, p.owner).traits.cunning * 0.4 + p.members.length * 6 - p.progress * 0.15 - p.hiredBlades * 7 - quiet), 5, 85);
}

export function canStrike(s: GameState, p: Plot): { ok: boolean; reason?: string } {
  if (p.kind !== 'murder') return { ok: false, reason: 'Only a murder plot can strike.' };
  if (p.status !== 'active') return { ok: false, reason: 'The plot is no longer active.' };
  const t = p.targets[0];
  if (!t || !isFree(s, t)) return { ok: false, reason: 'The target is beyond your reach.' };
  if (p.progress < strikeReady(s, p)) return { ok: false, reason: `Too little is prepared (needs ${strikeReady(s, p)}).` };
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
/** Blades for hire: what each costs, and how many one scheme can use. */
export const BLADE_COST = 20;
export const MAX_BLADES = 10;

export function advancePlot(s: GameState, p: Plot, actor: CharId, gold = 0): number {
  const a = ch(s, actor);
  const poisons = p.kind === 'murder' && hasPerk(s, actor, 'poisons') ? 4 : 0;
  const gain = Math.round(8 + a.traits.cunning * 0.12 + p.members.length * 2 + roll(s, 0, 6) + poisons);
  p.progress = clamp(p.progress + gain, 0, 100);
  if (gold > 0 && p.kind === 'murder') {
    // Only the blades actually hired are paid for.
    const hire = Math.max(0, Math.min(Math.floor(Math.min(gold, a.gold) / BLADE_COST), MAX_BLADES - p.hiredBlades));
    a.gold -= hire * BLADE_COST;
    p.hiredBlades += hire;
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

/** A plot this person was sworn into by someone else, and could betray to the King. */
export function betrayable(s: GameState, actor: CharId, sec: Secret): Plot | undefined {
  const p = sec.plotId ? s.plots[sec.plotId] : undefined;
  // A sworn member may give it up; so may the man who leads it, having drawn others in to hand them over.
  return p && p.status === 'active' && (p.owner === actor || p.members.some((m) => m.id === actor)) ? p : undefined;
}

/** A plot this person was sworn into by someone else, and one it is aimed at: telling them is a warning. */
export function warnable(s: GameState, actor: CharId, target: CharId, sec: Secret): Plot | undefined {
  const p = betrayable(s, actor, sec);
  return p && p.owner !== actor && p.targets.includes(target) ? p : undefined;
}

/** How far the quarry believes a warning. One who was sworn to it knows its names and its means. */
export function warnCredence(s: GameState, actor: CharId, target: CharId, sec: Secret): number {
  return Math.max(70, hearCredence(s, target, actor, sec));
}

export function leavePlot(s: GameState, p: Plot, who: CharId): void {
  p.members = p.members.filter((m) => m.id !== who);
  syncPlotSecret(s, p);
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

/** `hearing`: a traced killer is summoned to answer before the King rather than seized (the player's own deeds). */
export function resolveStrike(s: GameState, p: Plot, hearing = false): StrikeOutcome {
  const target = p.targets[0];
  const owner = p.owner;
  const pct = strikeChance(s, p);
  const success = chance(s, pct);
  const sec = s.secrets[p.secretId];
  const insiders = [owner, ...p.members.map((m) => m.id)];
  const wasKing = s.king === target;

  if (success && sanctioned(s, p)) {
    // The King's leave: no crime, no inquiry, and his favour.
    const K = s.king!;
    p.status = 'succeeded';
    const how = vary(s, ['a knife in the dark', 'poison in the evening wine', 'a fall from the battlements that no one saw', 'an ambush on the road']);
    kill(s, target, `Killed, ${dateLabel(s.turn)} — ${how}`, false);
    deedDone(s, sec);
    for (const g of insiders) markJudged(s, sec, g);
    learn(s, K, sec.id, 100, owner);
    addMod(s, K, owner, 'kings-sword', 'Rid me of a traitor', 35, 0.15);
    ch(s, owner).prestige += 5;
    log(s, `You struck. ${nm(s, target)} is dead by ${how}, and the King will not ask how.`, insiders, 'secret', insiders);
    log(s, `${nm(s, target)} is dead — ${how}. It is said the King is not sorry.`, 'all', 'dire', [target]);
    // His kin may guess whose hand it was, and hate it; the King's leave does not stop that.
    if (chance(s, traceChance(s, p))) murdererShunned(s, owner, target);
    return { success, traced: false, text: 'The deed is done, and the King is in your debt.' };
  }

  if (success) {
    const trail = traceChance(s, p);
    const traced = chance(s, trail);
    p.status = 'succeeded';
    const how = vary(s, [
      'a crossbow bolt from the trees during the hunt',
      'poison in the evening wine',
      'a knife on the north stair',
      'a fall from the battlements that no one saw',
      'a pillow, in the small hours',
    ]);
    kill(s, target, `Murdered, ${dateLabel(s.turn)} — ${how}`, false);
    deedDone(s, sec);
    log(s, `You struck. ${nm(s, target)} is dead by ${how}.`, insiders, 'secret', insiders);
    if (traced) {
      sec.evidence = 90;
      publish(s, sec.id, 85, 'court');
      log(s, `${nm(s, target)} is dead — ${how}. The trail led straight to ${nm(s, owner)}.`, 'all', 'dire', [target, owner]);
      murdererShunned(s, owner, target);
      if (!hearing) seize(s, owner, sec.id, wasKing);
    } else {
      log(s, `${nm(s, target)} was found dead — ${how}. No one has been named.`, 'all', 'dire', [target]);
      // A murdered lord is the King's business: his people start asking questions, and find what was left to find.
      if (!wasKing && s.king) sec.inquiry = s.turn;
      sec.trail = trail;
      // No one saw. Those who had heard of the plot know what this was; the dead man's kin and friends suspect
      // whoever he was known to quarrel with, faintly. No one else has a name to give.
      const T = ch(s, target);
      const quarrel = opinion(s, target, owner) <= -25;
      for (const id of s.order) {
        if (!isAlive(s, id) || insiders.includes(id)) continue;
        const k = knows(s, id, sec.id);
        if (k) {
          learn(s, id, sec.id, k.credence + 25, 'rumour');
          continue;
        }
        const close = T.spouse === id || T.siblings.includes(id) || !!T.parents?.includes(id) || !!T.children?.includes(id) || opinion(s, id, target) >= 30;
        if (quarrel && close && !isChild(s, id) && chance(s, 50)) learn(s, id, sec.id, roll(s, 10, 25), 'rumour');
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
    if (s.king && s.king !== owner && s.king !== s.player && !hearing && !sanctioned(s, p)) seize(s, owner, sec.id, false);
    return { success, traced: true, text: 'The attempt failed, and your name was spoken.' };
  }
  learn(s, target, sec.id, 30, 'rumour');
  log(s, `Someone tried to kill ${nm(s, target)}. The would-be killers fled into the night.`, 'all', 'bad', [target]);
  log(s, `The attempt on ${nm(s, target)} failed. No one knows it was you — yet.`, insiders, 'secret', insiders);
  return { success, traced: false, text: 'The attempt failed, but the trail is cold.' };
}

/**
 * How the court takes a known murder: as it felt about the dead. Kin and friends hate the killer;
 * strangers think a little less of him; those who hated the victim shed no tears.
 */
export function murdererShunned(s: GameState, killer: CharId, victim: CharId): void {
  const V = ch(s, victim);
  for (const id of s.order) {
    if (!isAlive(s, id) || id === killer || isChild(s, id)) continue;
    const c = ch(s, id);
    const kin = V.spouse === id || V.siblings.includes(id) || !!V.parents?.includes(id) || !!V.children?.includes(id);
    const regard = opinion(s, id, victim);
    let v = kin ? -60 : regard <= -30 ? 0 : -(8 + Math.max(0, regard) * 0.5 + Math.max(0, c.traits.honor - 50) * 0.2);
    if (regard <= -50 && !kin) v = 5;
    v = Math.round(v);
    if (v) addMod(s, id, killer, `murderer-${victim}`, v > 0 ? `Rid us of ${first(s, victim)}` : `Murdered ${first(s, victim)}`, v, 0.5);
  }
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

/** Every month, crowded or sloppy plots leak: one of its people, or someone under their roof, says too much. */
export function leakPlots(s: GameState): void {
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active' || !isFree(s, p.owner)) continue;
    const insincere = p.members.filter((m) => !m.sincere).length;
    const pct = clamp(3 + p.members.length * 4 + insincere * 5 + p.progress / 12 - ch(s, p.owner).traits.cunning / 10, 1, 40);
    if (!chance(s, pct)) continue;
    // Whose people talked: the careless, and those who swore falsely, most of all.
    const insiders = [p.owner, ...p.members.map((m) => m.id)].filter((id) => isFree(s, id));
    const source = weighted(s, insiders, (id) => (p.members.some((m) => m.id === id && !m.sincere) ? 3 : 1) * (1.5 - ch(s, id).traits.cunning / 100));
    if (!source) continue;
    // The plotter himself, or a wife, a servant, a brother under his roof who overheard.
    const roof = (s.houses[ch(s, source).householdId]?.members ?? []).filter((id) => id !== source && isFree(s, id) && !isChild(s, id) && !isMember(p, id));
    const mouth = roof.length && chance(s, 60) ? pick(s, roof) : source;
    // It goes to those close to the mouth; the Master of Whispers has ears everywhere, and the quarry listens hardest.
    const pool = s.order.filter((id) => isFree(s, id) && id !== mouth && !isMember(p, id) && !isChild(s, id) && credence(s, id, p.secretId) < 40);
    const heard = weighted(s, pool, (id) => {
      if (s.offices.spymaster === id) return 3;
      if (ch(s, id).householdId === ch(s, mouth).householdId || opinion(s, mouth, id) >= 20) return 3;
      if (p.targets.includes(id) || s.offices.captain === id) return 2;
      return 0.3;
    });
    if (!heard) continue;
    const sec = s.secrets[p.secretId];
    if (mouth !== source) learn(s, mouth, p.secretId, roll(s, 40, 60), source);
    learn(s, heard, p.secretId, roll(s, 35, 60), mouth);
    log(s, `${loose(s, mouth, source)} said too much in your hearing: ${sec.text}`, [heard], 'secret', [mouth, heard]);
    // The leader may come to hear of it, and whose tongue it was.
    if (chance(s, clamp(30 + ch(s, p.owner).traits.cunning * 0.5, 20, 85))) {
      const who = mouth === p.owner ? (p.owner === s.player ? 'You yourself' : nm(s, mouth)) : loose(s, mouth, source);
      log(s, `“${p.name}” is being talked of. ${who} said too much, and ${nm(s, heard)} heard it.`, [p.owner], 'bad', [mouth, heard]);
    }
  }
}

/** Who let it slip, by their place in the plotter's house. */
function loose(s: GameState, mouth: CharId, source: CharId): string {
  if (mouth === source) return nm(s, mouth);
  const M = ch(s, mouth);
  const whose = source === s.player ? 'your' : `${first(s, source)}’s`;
  if (ch(s, source).spouse === mouth) return `${nm(s, mouth)}, ${whose} ${M.gender === 'f' ? 'wife' : 'husband'},`;
  if (isServant(s, mouth)) return `${first(s, mouth)}, a servant of ${whose} household,`;
  return `${nm(s, mouth)}, of ${whose} household,`;
}

/** The Master of Whispers hears things. */
export function spymasterHears(s: GameState): void {
  const spy = s.offices.spymaster;
  if (!spy || !isFree(s, spy)) return;
  if (!chance(s, ch(s, spy).traits.cunning / 4)) return;
  // His informers hear what is already being whispered: a secret no one has let slip is safe from them.
  const talked = (sec: Secret) => s.order.some((id) => id !== spy && !sec.guilty.includes(id) && credence(s, id, sec.id) >= 20);
  const unknown = Object.values(s.secrets).filter(
    (sec) =>
      sec.truth &&
      credence(s, spy, sec.id) < 30 &&
      !sec.guilty.includes(spy) &&
      sec.guilty.some((g) => isFree(s, g)) &&
      (!sec.plotId || s.plots[sec.plotId]?.status === 'active') &&
      talked(sec),
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
