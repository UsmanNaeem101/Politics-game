// Every deed a courtier can do in a month. The player and the AI share this code:
// what the AI may do, the player may do, and with the same odds.

import {
  alreadyJudged,
  applyJudgments,
  chargesFor,
  crimeName,
  disgrace,
  markJudged,
  execute,
  exposeForgery,
  forgeryDetection,
  imprison,
  officeEligible,
  appoint,
  capital,
  CRIME_GUILTY,
  TREASON_EXECUTE,
  TREASON_IMPRISON,
  questionFree,
  readCase,
  release,
  rollJudgments,
  shields,
  succeedHouse,
  vacate,
} from './court';
import {
  betrayable,
  abandonPlot,
  advancePlot,
  canStrike,
  createPlot,
  isMember,
  joinPlot,
  againstTheKing,
  leavePlot,
  pledgeText,
  sanctioned,
  resolveStrike,
  warnCredence,
  warnable,
} from './plots';
import { chance, clamp, rand, roll } from './rng';
import { hearCredence, kindLabel, makeSecret, secretMatters, syncPlotSecret } from './secrets';
import { BUSINESSES } from './content/businesses';
import { investProblem, openBusiness, sellPrice } from './economy';
import { tableTalk } from './talk';
import { acknowledge, acknowledgeProblem, betroth, betrothProblem, marriageable, matchProblem, propose, tryForChild, tryProblem, unwed } from './family';
import { killInTheNight, mistressProblem, nightProblem, seduce, seduceProblem, takeMistress } from './love';
import { TAIL_COST, setTail, tailProblem } from './tails';
import { dineProblem, sendToDine } from './wives';
import { feastProblem, holdFeast } from './renown';
import { RENOWN } from './content/renown';
import { MAX_SPIES, endSpy, hookProblem, marksFor, recruitSpy, recruitedSpies, sweepHousehold } from './spies';
import { PLACES, first, he, him, his, names, nm, vary } from './text';
import {
  OFFICE_NAMES,
  acquaintance,
  SUSPICION_FADES,
  addMod,
  befriend,
  adjustTrust,
  ch,
  credence,
  dateLabel,
  effective,
  gone,
  hasPerk,
  hearOf,
  insightOf,
  isAlive,
  isChild,
  isFree,
  isServant,
  knows,
  learn,
  log,
  mendMarriage,
  officeOf,
  opinion,
  removeMod,
  trust,
  uid,
} from './world';
import type {
  BusinessKind,
  SpyHook,
  Audience,
  CharId,
  Directive,
  GameState,
  LandId,
  Offer,
  OfficeId,
  Plot,
  PlotId,
  PlotKind,
  Secret,
  SecretId,
} from './types';

export type FabricateKind = 'regicide' | 'pact' | 'murder';
export type SpyFocus = 'motive' | 'secrets' | 'schemes' | 'household';

export type Intent =
  | { type: 'converse'; target: CharId }
  | { type: 'introduce'; target: CharId }
  | { type: 'gift'; target: CharId; amount: number }
  | { type: 'whisper'; target: CharId; secretId: SecretId }
  | { type: 'fabricate'; kind: FabricateKind; guilty: CharId[]; victim: CharId }
  | { type: 'spy'; target: CharId; focus: SpyFocus }
  | { type: 'scheme'; kind: PlotKind; targets: CharId[]; charges: SecretId[] }
  | { type: 'advance'; plotId: PlotId; gold: number }
  | { type: 'recruit'; target: CharId; plotId: PlotId; offer: Offer }
  | { type: 'denounce'; secretId?: SecretId; plotId?: PlotId; only?: CharId[] }
  | { type: 'strike'; plotId: PlotId }
  | { type: 'blackmail'; target: CharId; secretId: SecretId; demand: 'gold' | 'restitution' | 'join'; plotId?: PlotId }
  | { type: 'petition'; kind: 'restitution' | 'office' | 'mercy'; secretId?: SecretId; office?: OfficeId; target?: CharId }
  | { type: 'counsel'; target: CharId; mode: 'goad' | 'restrain' | 'demand'; directive?: DirectiveSpec }
  | { type: 'guard' }
  | { type: 'grant'; target: CharId; landId: LandId }
  | { type: 'abandon'; plotId: PlotId }
  | { type: 'flee' }
  | { type: 'escape' }
  | { type: 'arrest'; target: CharId }
  | { type: 'question'; target: CharId }
  | { type: 'execute'; target: CharId }
  | { type: 'release'; target: CharId }
  | { type: 'appoint'; target: CharId; office: OfficeId }
  | { type: 'invest'; kind: BusinessKind }
  | { type: 'divest'; businessId: string }
  | { type: 'plant'; target: CharId; mark: CharId; hook: SpyHook; wage: number; secretId?: SecretId }
  | { type: 'dismiss-spy'; spyId: string }
  | { type: 'sweep' }
  | { type: 'propose'; target?: CharId }
  | { type: 'plead'; target: CharId }
  | { type: 'seduce'; target: CharId; gift?: number }
  | { type: 'track'; target: CharId }
  | { type: 'night-kill'; target: CharId }
  | { type: 'dine'; target: CharId }
  | { type: 'try-child'; target: CharId }
  | { type: 'take-mistress'; target: CharId }
  | { type: 'acknowledge'; target: CharId }
  | { type: 'betroth'; target: CharId; partner?: CharId; dowry?: number }
  | { type: 'offer-blade'; target: CharId; secretId: SecretId }
  | { type: 'feast' };

export type IntentType = Intent['type'];
export type DirectiveSpec = Pick<Directive, 'kind' | 'plotId' | 'secretId' | 'target'>;

export interface Outcome {
  ok: boolean;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'dire';
}

export const COST: Record<IntentType, number> = {
  converse: 1,
  introduce: 1,
  gift: 1,
  whisper: 1,
  fabricate: 1,
  spy: 1,
  scheme: 1,
  advance: 1,
  recruit: 1,
  denounce: 2,
  strike: 2,
  blackmail: 1,
  petition: 1,
  counsel: 1,
  guard: 1,
  grant: 1,
  abandon: 0,
  flee: 1,
  escape: 2,
  arrest: 1,
  question: 1,
  execute: 1,
  release: 1,
  appoint: 0,
  invest: 1,
  divest: 1,
  plant: 1,
  'dismiss-spy': 0,
  sweep: 1,
  propose: 1,
  plead: 1,
  seduce: 1,
  track: 1,
  'night-kill': 2,
  dine: 1,
  'try-child': 1,
  'take-mistress': 1,
  acknowledge: 1,
  betroth: 1,
  'offer-blade': 1,
  feast: 1,
};

export const ACTION_INFO: Record<IntentType, { name: string; desc: string }> = {
  converse: { name: 'Keep company', desc: 'Spend an hour together. Warms them to you, and you may read something in their face. Servants gossip.' },
  introduce: { name: 'Seek an introduction', desc: 'Find someone to present you, or present yourself. You cannot deal with a stranger.' },
  gift: { name: 'Give a gift', desc: 'Gold buys goodwill, especially from the greedy.' },
  whisper: { name: 'Whisper a secret', desc: 'Tell them something you know, or something you have invented. They decide whether to believe it.' },
  fabricate: { name: 'Forge a lie', desc: 'Invent a treason and the letters to prove it. Lies can be spread, and laid before the King.' },
  spy: { name: 'Have them watched', desc: 'Pay a stable boy or a tavern girl to watch them for a month: one look, no more. A recruited spy does better, and keeps at it.' },
  scheme: { name: 'Begin a scheme', desc: 'Start a murder plot, or gather charges to destroy someone before the King.' },
  advance: { name: 'Work on a scheme', desc: 'Prepare. Murder plots strike harder; ruin plots carry more proof.' },
  recruit: { name: 'Draw into a scheme', desc: 'Offer a carrot. They may join sincerely, join only to betray you, or refuse and know everything.' },
  denounce: { name: 'Denounce before the King', desc: 'Lay charges before the throne. The King weighs proof, witnesses, and who he trusts.' },
  strike: { name: 'Strike', desc: 'Spring a murder plot. Success is not the same as escaping notice.' },
  blackmail: { name: 'Blackmail', desc: 'Threaten to reveal what you know unless they pay, return what they took, or join you.' },
  petition: { name: 'Petition the King', desc: 'Ask for justice over stolen land, for a vacant office, or for mercy for a prisoner.' },
  counsel: { name: 'Counsel your spouse', desc: 'Goad, restrain, or demand a deed. A strong will can move a man where he would not go alone.' },
  guard: { name: 'Hire guards', desc: '20 crowns for a stronger guard about you this fortnight.' },
  grant: { name: 'Grant land', desc: 'Give a manor away. Returning a stolen inheritance heals a great deal.' },
  abandon: { name: 'Abandon scheme', desc: 'Walk away from a plot.' },
  flee: { name: 'Flee the court', desc: 'Ride for the coast tonight. You live, but you leave the game.' },
  escape: { name: 'Attempt escape', desc: 'Bribe a gaoler and run.' },
  arrest: { name: 'Arrest', desc: 'Have the Guard seize them. Without proof, the court will call it tyranny.' },
  question: { name: 'Summon and question', desc: 'Make them answer to your face. The guilty sometimes stumble.' },
  execute: { name: 'Execute prisoner', desc: 'Send a prisoner to the block.' },
  release: { name: 'Release prisoner', desc: 'Let a prisoner go.' },
  appoint: { name: 'Appoint to office', desc: 'Fill a vacant great office.' },
  invest: { name: 'Set up a trade', desc: 'Put money into a business, or a racket. What you run decides how the court sees you.' },
  divest: { name: 'Sell a trade', desc: 'Sell up for half what it cost. The court soon forgets an honest trade; a scandal lingers.' },
  plant: { name: 'Recruit as a spy', desc: 'Have them watch someone they can get close to. Offer a wage, use what you know, or ask a favour.' },
  'dismiss-spy': { name: 'Dismiss a spy', desc: 'End their service.' },
  sweep: { name: 'Search your household', desc: 'Look for someone else’s spy among your people.' },
  propose: { name: 'Seek a match', desc: 'Ask for someone’s hand, or have a match found for you in the provinces.' },
  plead: { name: 'Ask them to petition for you', desc: 'A letter from the Tower: ask them to go to the King and beg mercy for you. Friends are likelier to risk it.' },
  seduce: { name: 'Woo as a lover', desc: 'Not marriage: make her your lover. A married lover will tell you what her husband says at home. A refusal may reach him.' },
  track: { name: 'Track their movements', desc: `Pay a man ${TAIL_COST} crowns to follow them for a month: where they go, and whom they meet.` },
  'offer-blade': {
    name: 'Offer to kill them for the King',
    desc: 'Go to the King with what you know of their treason, and offer your sword. If he believes you, he gives you his leave: the killing is no crime, and wins his favour.',
  },
  feast: {
    name: 'Hold a feast',
    desc: `Keep a table for the court: ${RENOWN.feast.cost} crowns, once every ${RENOWN.feast.every} months. Your guests warm to you, the King comes if he likes you, and your name rises.`,
  },
  betroth: { name: 'Arrange a match', desc: 'Find your son or daughter a husband or wife. Grown, they wed at once; young, they are promised, and wed when both are grown. Either way the two houses are bound.' },
  acknowledge: { name: 'Acknowledge as your own', desc: 'Own your natural child before the world: into your house, under your name. A son becomes your heir. No secret after that.' },
  'take-mistress': { name: 'Bring her into your household', desc: 'Your lover comes to live under your roof as your mistress, for all the court to see. Your wife will not forgive it.' },
  'try-child': { name: 'Try for a child', desc: 'With your wife, or your lover. She is drawn closer to you for it; a child, if one comes, binds her to you as its father.' },
  dine: { name: 'Send your wife to dine with her', desc: 'Your wife dines with this lady and brings home what was said: gossip, what her husband wants, who sits in that house.' },
  'night-kill': { name: 'Kill them in the night', desc: 'Under your own roof, at night, with no one on the stair. Easy to do, harder to explain.' },
};

const KING_ONLY: IntentType[] = ['arrest', 'question', 'execute', 'release', 'appoint'];
const PRISON_OK: IntentType[] = ['whisper', 'escape', 'counsel', 'plead'];

/** Someone wants an answer from the player. Being approached is an introduction. */
export function pushAudience(s: GameState, a: Audience): void {
  hearOf(s, a.from, 3);
  s.audiences.push(a);
}

// ── Validation ──────────────────────────────────────────────────────────────

export function check(s: GameState, actor: CharId, it: Intent): string | null {
  const a = ch(s, actor);
  if (s.phase !== 'playing') return 'The game is over.';
  if (a.status === 'dead' || a.status === 'fled') return 'You are beyond the court.';
  if (a.status === 'imprisoned' && !PRISON_OK.includes(it.type)) return 'You are in the Tower.';
  if (a.status === 'free' && it.type === 'escape') return 'You are not imprisoned.';
  if (KING_ONLY.includes(it.type) && s.king !== actor) return 'Only the King may do that.';
  if (actor === s.player && COST[it.type] > s.ap) return 'Not enough time left this month.';
  const target = 'target' in it ? it.target : undefined;
  if (actor === s.player) {
    const fog = fogProblem(s, it);
    if (fog) return fog;
  }
  if (target !== undefined) {
    if (target === actor) return 'You cannot do that to yourself.';
    if (!s.chars[target]) return 'No such person.';
    if (isChild(s, target) && it.type !== 'acknowledge' && it.type !== 'betroth') return 'A child is no part of this.';
    const needsPrisoner = it.type === 'execute' || it.type === 'release';
    if (needsPrisoner && ch(s, target).status !== 'imprisoned') return 'They are not in the Tower.';
    if (!needsPrisoner && it.type !== 'petition' && !isFree(s, target)) return 'They are not at court.';
  }
  switch (it.type) {
    case 'gift':
      if (it.amount <= 0 || a.gold < it.amount) return 'You do not have the gold.';
      return null;
    case 'whisper': {
      const k = knows(s, actor, it.secretId);
      if (!k) return 'You do not know that.';
      if (s.secrets[it.secretId].guilty.includes(actor) && !warnable(s, actor, it.target, s.secrets[it.secretId])) return 'That would be confessing your own guilt.';
      if (!secretMatters(s, s.secrets[it.secretId])) return 'That is old news: those it concerns are dead or gone.';
      if (a.status === 'imprisoned' && !isFree(s, it.target)) return 'Your letter cannot reach them.';
      return null;
    }
    case 'fabricate':
      if (!it.guilty.length) return 'Name the guilty.';
      if (it.guilty.includes(actor)) return 'You would not accuse yourself.';
      if (it.guilty.includes(it.victim)) return 'The victim cannot be the plotter.';
      if ([...it.guilty, it.victim].some((g) => isChild(s, g))) return 'A child is no part of this.';
      if (it.kind === 'pact' && it.guilty.length < 2) return 'A pact needs at least two conspirators.';
      if (it.guilty.some((g) => !isAlive(s, g)) || !isAlive(s, it.victim)) return 'They must be living.';
      if ((it.kind === 'regicide' || it.kind === 'pact') && it.victim !== s.king) return 'There is no King to plot against.';
      return null;
    case 'scheme': {
      if (!it.targets.length) return 'Choose a target.';
      if (it.targets.some((t) => t === actor || !isFree(s, t))) return 'Targets must be free and not yourself.';
      if (it.targets.some((t) => isChild(s, t))) return 'A child is no part of this.';
      if (it.kind === 'murder' && it.targets.length !== 1) return 'A murder plot has one victim.';
      if (it.kind === 'ruin') {
        if (!it.charges.length) return 'A ruin scheme needs at least one charge.';
        const usable = it.charges.every((c) => usableCharge(s, actor, c));
        if (!usable) return 'You must know (or have forged) every charge.';
        if (!it.targets.every((t) => it.charges.some((c) => s.secrets[c].guilty.includes(t)))) return 'Every target needs a charge against them.';
      }
      return null;
    }
    case 'advance': {
      const p = s.plots[it.plotId];
      if (!p || p.status !== 'active') return 'No such scheme.';
      if (!isMember(p, actor)) return 'It is not your scheme.';
      if (it.gold > a.gold) return 'You do not have the gold.';
      return null;
    }
    case 'recruit': {
      const p = s.plots[it.plotId];
      if (!p || p.status !== 'active' || p.owner !== actor) return 'You do not lead that scheme.';
      if (isMember(p, it.target)) return 'They are already part of it.';
      if (p.targets.includes(it.target)) return 'They are its target.';
      return offerProblem(s, actor, it.target, it.offer);
    }
    case 'denounce': {
      if (!s.king) return 'There is no King to hear you.';
      if (s.king === actor) return 'You are the King.';
      const charges = denounceCharges(s, it);
      if (!charges.length) return 'Nothing to denounce.';
      // A ruin scheme may be laid before the King by its leader, or by any man sworn to it.
      if (it.plotId && (!s.plots[it.plotId] || !isMember(s.plots[it.plotId], actor))) return 'You are not sworn to that scheme.';
      if (it.secretId && !usableCharge(s, actor, it.secretId)) return 'You do not believe that yourself.';
      if (!chargesFor(s, actor, charges, it.only).length) {
        const judged = charges.some((c) => s.secrets[c]?.guilty.some((g) => g !== actor && alreadyJudged(s, s.secrets[c], g)));
        return judged ? 'The King has already judged that charge. No one is tried twice for the same crime.' : 'No one named in it stands free to be accused.';
      }
      return null;
    }
    case 'strike': {
      const p = s.plots[it.plotId];
      if (!p || p.owner !== actor) return 'You do not lead that scheme.';
      return canStrike(s, p).reason ?? null;
    }
    case 'blackmail': {
      const sec = s.secrets[it.secretId];
      if (!sec || !sec.guilty.includes(it.target)) return 'That secret does not touch them.';
      if (!secretMatters(s, sec)) return 'That is old news.';
      if (!usableCharge(s, actor, it.secretId)) return 'You do not know that well enough.';
      if (it.demand === 'restitution' && !Object.values(s.lands).some((l) => l.holder === it.target && l.rightful === actor)) return 'They hold nothing that is rightfully yours.';
      if (it.demand === 'join') {
        const p = it.plotId ? s.plots[it.plotId] : undefined;
        if (!p || p.owner !== actor || p.status !== 'active') return 'Choose one of your schemes.';
        if (p.targets.includes(it.target)) return 'They are its target.';
      }
      return null;
    }
    case 'petition': {
      if (!s.king) return 'There is no King.';
      if (s.king === actor) return 'You are the King.';
      if (it.kind === 'restitution') {
        const lands = Object.values(s.lands).filter((l) => l.rightful === actor && l.holder !== actor);
        if (!lands.length) return 'Nothing of yours is held by another.';
      }
      if (it.kind === 'office') {
        if (!it.office || s.offices[it.office]) return 'That office is not vacant.';
        if (!officeEligible(s, actor, it.office)) return 'You cannot hold that office.';
      }
      if (it.kind === 'mercy') {
        if (!it.target || ch(s, it.target).status !== 'imprisoned') return 'Choose a prisoner.';
      }
      return null;
    }
    case 'counsel':
      if (a.spouse !== it.target) return 'You can only counsel your spouse.';
      if (it.mode === 'demand' && !it.directive) return 'Say what you demand.';
      return null;
    case 'guard':
      if (a.gold < 20) return 'You need 20 crowns.';
      return null;
    case 'grant':
      if (s.lands[it.landId]?.holder !== actor && !(s.lands[it.landId]?.holder === null && s.king === actor)) return 'That land is not yours to give.';
      return null;
    case 'abandon': {
      const p = s.plots[it.plotId];
      if (!p || p.status !== 'active' || !isMember(p, actor)) return 'Not your scheme.';
      return null;
    }
    case 'arrest':
      return null;
    case 'question':
      return null;
    case 'appoint':
      if (s.offices[it.office]) return 'That office is filled.';
      if (!officeEligible(s, it.target, it.office)) return 'They cannot hold that office.';
      return null;
    case 'invest':
      return investProblem(s, actor, it.kind);
    case 'plant': {
      if (recruitedSpies(s, actor).length >= MAX_SPIES) return `You can keep no more than ${MAX_SPIES} spies.`;
      if (isServant(s, it.mark) || !marksFor(s, actor, it.target).includes(it.mark)) return 'They cannot get close enough to watch them.';
      return hookProblem(s, actor, it.target, it.mark, it.hook, it.wage, it.secretId);
    }
    case 'propose': {
      const late = a.spouse ? s.chars[a.spouse] : undefined;
      if (late && gone(s, late.id) && s.turn - (late.statusTurn ?? 0) < 1) return 'It is too soon after the funeral.';
      if (!it.target) return marriageable(s, actor) ? null : unwed(s, actor) ? 'You are not free to marry.' : 'You are married.';
      return matchProblem(s, actor, it.target);
    }
    case 'seduce':
      if ((it.gift ?? 0) < 0 || (it.gift ?? 0) > a.gold) return 'You do not have the gold.';
      return seduceProblem(s, actor, it.target);
    case 'track':
      return tailProblem(s, actor, it.target);
    case 'night-kill':
      return nightProblem(s, actor, it.target);
    case 'dine':
      return dineProblem(s, actor, it.target);
    case 'try-child':
      return tryProblem(s, actor, it.target);
    case 'take-mistress':
      return mistressProblem(s, actor, it.target);
    case 'acknowledge':
      return acknowledgeProblem(s, actor, it.target);
    case 'offer-blade': {
      if (!s.king || s.king === actor) return 'There is no King to serve.';
      if (it.target === s.king) return 'That is the King.';
      const sec = s.secrets[it.secretId];
      if (!sec || !sec.guilty.includes(it.target)) return 'That does not touch them.';
      if (!againstTheKing(s, sec)) return 'That is no treason against the King.';
      if (sec.guilty.includes(actor)) return 'You are part of it yourself.';
      if (!usableCharge(s, actor, it.secretId)) return 'You do not know that well enough.';
      if (alreadyJudged(s, sec, it.target)) return 'The King has already judged that.';
      if (Object.values(s.plots).some((p) => p.status === 'active' && p.owner === actor && p.targets.includes(it.target) && sanctioned(s, p))) return 'You have his leave already.';
      return null;
    }
    case 'feast':
      return feastProblem(s, actor);
    case 'betroth':
      if ((it.dowry ?? 0) < 0 || (it.dowry ?? 0) > a.gold) return 'You do not have the gold.';
      if (it.partner && !s.chars[it.partner]) return 'No such person.';
      return betrothProblem(s, actor, it.target, it.partner);
    case 'plead':
      if (a.status !== 'imprisoned') return 'You are not in the Tower.';
      if (!s.king || it.target === s.king) return 'Write to someone who can reach the King.';
      return null;
    case 'dismiss-spy': {
      const sp = s.spies?.[it.spyId];
      return sp && sp.status === 'active' && sp.master === actor ? null : 'They are not your spy.';
    }
    case 'divest':
      return s.businesses?.[it.businessId]?.owner === actor ? null : 'That is not yours to sell.';
    default:
      return null;
  }
}

/** Deeds that need you to have been introduced (servants need only be seen). */
export const CONTACT: IntentType[] = ['converse', 'gift', 'whisper', 'recruit', 'blackmail', 'grant', 'plant', 'propose', 'plead', 'seduce'];

/** The player cannot deal with people they do not know. */
function fogProblem(s: GameState, it: Intent): string | null {
  const target = 'target' in it ? it.target : undefined;
  if (target && s.chars[target]) {
    const lvl = acquaintance(s, target);
    const need = isServant(s, target) ? 2 : 3;
    if (CONTACT.includes(it.type) && lvl < need) {
      return lvl < 2 ? 'You have only heard of them. Find them first.' : 'You have not been introduced.';
    }
    if (it.type === 'introduce') {
      if (lvl >= 3) return 'You already know them.';
      if (lvl < 2) return 'You have only heard of them. Spy on their household, or wait to see them at court.';
      if (isServant(s, target)) return 'Servants need no introduction.';
    }
    if ((it.type === 'spy' || it.type === 'track' || it.type === 'dine') && lvl < 1) return 'You know nothing of them.';
  }
  if (it.type === 'betroth' && it.partner && acquaintance(s, it.partner) < 2) return 'You must at least have seen them at court.';
  if (it.type === 'fabricate' && [...it.guilty, it.victim].some((g) => acquaintance(s, g) < 1)) return 'You cannot name someone you have never heard of.';
  if (it.type === 'scheme' && it.targets.some((g) => acquaintance(s, g) < (it.kind === 'murder' ? 2 : 1))) return 'You do not know your target well enough.';
  return null;
}

function usableCharge(s: GameState, actor: CharId, secretId: SecretId): boolean {
  const k = knows(s, actor, secretId);
  return !!k && (k.lie || k.credence >= 40);
}

export function denounceCharges(s: GameState, it: Extract<Intent, { type: 'denounce' }>): SecretId[] {
  if (it.plotId) return s.plots[it.plotId]?.charges.filter((c) => s.secrets[c]) ?? [];
  return it.secretId ? [it.secretId] : [];
}

function offerProblem(s: GameState, actor: CharId, target: CharId, o: Offer): string | null {
  const a = ch(s, actor);
  switch (o.kind) {
    case 'gold':
      if (!o.amount || o.amount > a.gold) return 'You do not have that much gold.';
      return null;
    case 'land':
    case 'restitution':
      if (!o.landId || s.lands[o.landId]?.holder !== actor) return 'That land is not yours to offer.';
      if (o.kind === 'restitution' && s.lands[o.landId].rightful !== target) return 'That land was never theirs.';
      return null;
    case 'office':
      if (!o.office) return 'Choose an office.';
      return null;
    default:
      return null;
  }
}

// ── Perform ─────────────────────────────────────────────────────────────────

/** Do a deed. For the player, spends time; for NPCs the AI budgets its own. */
export function perform(s: GameState, actor: CharId, it: Intent, opts: { free?: boolean } = {}): Outcome {
  const problem = check(s, actor, { ...it } as Intent);
  if (problem && !(opts.free && problem.startsWith('Not enough time'))) return { ok: false, text: problem, tone: 'bad' };
  if (actor === s.player && !opts.free) s.ap -= COST[it.type];
  switch (it.type) {
    case 'converse':
      return converse(s, actor, it.target);
    case 'introduce':
      return introduce(s, actor, it.target);
    case 'gift':
      return gift(s, actor, it.target, it.amount);
    case 'whisper':
      return whisper(s, actor, it.target, it.secretId);
    case 'fabricate':
      return fabricate(s, actor, it.kind, it.guilty, it.victim);
    case 'spy':
      return spy(s, actor, it.target, it.focus);
    case 'scheme':
      return scheme(s, actor, it.kind, it.targets, it.charges);
    case 'advance': {
      const p = s.plots[it.plotId];
      const gain = advancePlot(s, p, actor, it.gold);
      log(s, `${first(s, actor)} worked on “${p.name}” (+${gain}${it.gold ? `, ${it.gold} crowns for hired blades` : ''}).`, [actor], 'secret', [actor]);
      return { ok: true, text: `“${p.name}” is ${p.progress}% prepared.`, tone: 'neutral' };
    }
    case 'recruit':
      return recruit(s, actor, it.target, it.plotId, it.offer);
    case 'denounce':
      return denounce(s, actor, it);
    case 'strike': {
      const p = s.plots[it.plotId];
      const victim = p.targets[0];
      // Your own killing, traced: you answer for it before the King, rather than being taken in the night.
      const accuser = actor === s.player && s.king && s.king !== actor && victim !== s.king && !sanctioned(s, p) ? hearingAccuser(s, actor, victim) : undefined;
      const r = resolveStrike(s, p, !!accuser);
      if (accuser && r.traced && isFree(s, actor)) {
        pushAudience(s, accusedAudience(s, accuser, [p.secretId]));
        return { ok: r.success, text: `${r.text} The Guard is at your door: you are to answer for it before the King.`, tone: 'dire' };
      }
      return { ok: r.success, text: r.text, tone: r.success ? (r.traced ? 'dire' : 'good') : 'bad' };
    }
    case 'blackmail':
      return blackmail(s, actor, it);
    case 'petition':
      return petition(s, actor, it);
    case 'counsel':
      return counsel(s, actor, it.target, it.mode, it.directive);
    case 'guard': {
      const a = ch(s, actor);
      a.gold -= 20;
      a.guard = clamp(a.guard + 15, 0, 40);
      log(s, `${first(s, actor)} hired swords to watch ${his(s, actor)} door.`, [actor], 'neutral', [actor]);
      return { ok: true, text: 'Hired swords now stand at your door.', tone: 'good' };
    }
    case 'grant':
      return grant(s, actor, it.target, it.landId);
    case 'abandon': {
      const p = s.plots[it.plotId];
      if (p.owner === actor) abandonPlot(s, p);
      else {
        p.members = p.members.filter((m) => m.id !== actor);
        addMod(s, p.owner, actor, 'deserted', 'Deserted my cause', -20, 0.5);
        log(s, `${nm(s, actor)} withdrew from “${p.name}”.`, [actor, p.owner], 'secret', [actor]);
      }
      return { ok: true, text: `You have walked away from “${p.name}”.`, tone: 'neutral' };
    }
    case 'flee':
      exile(s, actor);
      return { ok: true, text: 'You ride for the coast under a borrowed name.', tone: 'dire' };
    case 'escape':
      return escape(s, actor);
    case 'arrest':
      return arrest(s, actor, it.target);
    case 'question': {
      const r = questionFree(s, it.target);
      log(s, `${nm(s, it.target)} was summoned before the King to answer questions.`, 'all', 'court', [it.target]);
      log(s, r.text, [actor], r.slipped ? 'secret' : 'neutral', [it.target]);
      return { ok: r.slipped, text: r.text, tone: r.slipped ? 'good' : 'neutral' };
    }
    case 'execute':
      return kingExecute(s, actor, it.target);
    case 'release':
      release(s, it.target, 'by the King’s mercy');
      return { ok: true, text: `${nm(s, it.target)} is released.`, tone: 'neutral' };
    case 'appoint':
      appoint(s, it.target, it.office);
      return { ok: true, text: `${nm(s, it.target)} is now ${OFFICE_NAMES[it.office]}.`, tone: 'good' };
    case 'invest':
      return invest(s, actor, it.kind);
    case 'divest':
      return divest(s, actor, it.businessId);
    case 'plant':
      return recruitSpy(s, actor, it.target, it.mark, it.hook, it.wage, it.secretId);
    case 'dismiss-spy': {
      const sp = s.spies[it.spyId];
      endSpy(s, sp);
      return { ok: true, text: `${first(s, sp.agent)} watches ${first(s, sp.mark)} for you no longer.`, tone: 'neutral' };
    }
    case 'sweep':
      return sweepHousehold(s, actor);
    case 'propose':
      return propose(s, actor, it.target);
    case 'plead':
      return plead(s, actor, it.target);
    case 'seduce':
      return seduce(s, actor, it.target, it.gift ?? 0);
    case 'track': {
      setTail(s, actor, it.target);
      return { ok: true, text: `Your man will keep ${first(s, it.target)} in sight until the month turns.`, tone: 'neutral' };
    }
    case 'night-kill':
      return killInTheNight(s, actor, it.target);
    case 'dine':
      return sendToDine(s, actor, it.target);
    case 'try-child':
      return tryForChild(s, actor, it.target);
    case 'take-mistress':
      return takeMistress(s, actor, it.target);
    case 'acknowledge':
      return acknowledge(s, actor, it.target);
    case 'betroth':
      return betroth(s, actor, it.target, it.partner, it.dowry ?? 0);
    case 'offer-blade':
      return offerBlade(s, actor, it.target, it.secretId);
    case 'feast':
      return holdFeast(s, actor);
  }
}

/** Will they risk the King's anger to beg for a prisoner? Love and blood make it likelier; a charge the King believes, less. */
export function pleadWillingness(s: GameState, prisoner: CharId, friend: CharId): number {
  const F = ch(s, friend);
  const charges = s.imprisoned[prisoner]?.charges ?? [];
  const belief = s.king ? charges.reduce((m, c) => Math.max(m, credence(s, s.king!, c)), 0) : 0;
  const close = F.spouse === prisoner ? 30 : F.siblings.includes(prisoner) || F.parents?.includes(prisoner) || F.children?.includes(prisoner) ? 20 : 0;
  return clamp(Math.round(20 + opinion(s, friend, prisoner) * 0.7 + close + (trust(s, friend, prisoner) - 40) * 0.2 - belief * 0.12 - F.traits.paranoia * 0.1), 3, 95);
}

function plead(s: GameState, actor: CharId, friend: CharId): Outcome {
  if (!chance(s, pleadWillingness(s, actor, friend))) {
    addMod(s, actor, friend, 'deserted', 'Would not plead for me', -15, 0.3);
    return { ok: false, text: `${first(s, friend)} will not risk the King's anger for you.`, tone: 'bad' };
  }
  const it: Extract<Intent, { type: 'petition' }> = { type: 'petition', kind: 'mercy', target: actor };
  const granted = chance(s, petitionOdds(s, friend, it));
  log(s, `${nm(s, friend)} went before the King to beg mercy for ${nm(s, actor)}.`, 'all', 'court', [friend, actor]);
  applyPetition(s, friend, it, granted);
  addMod(s, actor, friend, 'pleaded', 'Pleaded for me', 20, 0.2);
  if (!granted) return { ok: false, text: `${first(s, friend)} knelt before the King for you, and the King would not hear it.`, tone: 'bad' };
  return { ok: true, text: `${first(s, friend)} knelt before the King for you, and the King relented. You are free.`, tone: 'good' };
}

// ── Trade ───────────────────────────────────────────────────────────────────

function invest(s: GameState, actor: CharId, kind: BusinessKind): Outcome {
  const def = BUSINESSES[kind];
  ch(s, actor).gold -= def.cost;
  openBusiness(s, actor, kind);
  if (def.illicit) {
    log(s, `${nm(s, actor)} quietly set up ${def.secretly}.`, [actor], 'secret', [actor]);
    return { ok: true, text: `Your ${def.name.toLowerCase()} is open for business, and no one must know whose it is.`, tone: 'neutral' };
  }
  log(s, `${nm(s, actor)} has gone into the ${def.name.toLowerCase()}.`, 'all', 'neutral', [actor]);
  return { ok: true, text: `You are in the ${def.name.toLowerCase()}. It should bring in ${def.income} crowns a month.`, tone: 'good' };
}

function divest(s: GameState, actor: CharId, businessId: string): Outcome {
  const b = s.businesses[businessId];
  const def = BUSINESSES[b.kind];
  const price = sellPrice(b);
  ch(s, actor).gold += price;
  delete s.businesses[businessId];
  log(s, `${nm(s, actor)} sold ${his(s, actor)} ${def.name.toLowerCase()}.`, def.illicit ? [actor] : 'all', 'neutral', [actor]);
  return { ok: true, text: `Sold, for ${price} crowns.`, tone: 'neutral' };
}

// ── Individual deeds ────────────────────────────────────────────────────────

function converse(s: GameState, actor: CharId, target: CharId): Outcome {
  const A = ch(s, actor);
  const r = s.relations[target]?.[actor]?.mods.find((m) => m.key === 'company');
  const gain = Math.round(4 + A.traits.charm * 0.1 + roll(s, 0, 4));
  const room = 25 - (r?.value ?? 0);
  addMod(s, target, actor, 'company', 'Pleasant company', Math.max(0, Math.min(gain, room)), 1);
  addMod(s, actor, target, 'company', 'Pleasant company', 3, 1);
  // Good company kept up becomes friendship, and friendship lasts: it outlives a season apart, or in the Tower.
  befriend(s, target, actor);
  befriend(s, actor, target);
  adjustTrust(s, target, actor, 3);
  adjustTrust(s, actor, target, 2);
  const mended = (A.spouse === target || ch(s, target).spouse === actor) && mendMarriage(s, actor, target, 6);
  const place = vary(s, PLACES);
  log(s, `${nm(s, actor)} and ${nm(s, target)} talked ${place}.`, [actor, target], 'neutral', [actor, target]);
  let extra = mended ? ' The chill between you eases a little.' : '';
  if (actor === s.player) {
    s.company[target] = (s.company[target] ?? 0) + 1;
    if (s.company[target] >= 3 && hearOf(s, target, 4)) extra += ` You feel you know ${him(s, target)} now.`;
  }
  if (isServant(s, target)) {
    const told = servantGossip(s, actor, target);
    if (told) extra += ` ${told}`;
  } else {
    const talk = tableTalk(s, actor, target);
    if (talk) extra += ` ${talk}`;
  }

  let read = '';
  if (chance(s, 15 + A.traits.cunning * 0.35)) {
    const hiding = Object.values(s.plots).some((p) => p.status === 'active' && p.owner === target);
    const feared = Object.values(s.plots).some((p) => p.status === 'active' && p.targets.includes(target) && credence(s, target, p.secretId) >= 40);
    const op = opinion(s, target, actor);
    if (hiding) read = `${cap(he(s, target))} is hiding something — a scheme of ${his(s, target)} own, you would wager.`;
    else if (feared) read = `${cap(he(s, target))} is afraid, and glances at doorways.`;
    else if (op <= -20) read = `${cap(he(s, target))} smiles with ${his(s, target)} mouth only. ${cap(he(s, target))} does not like you.`;
    else read = `${cap(he(s, target))} seems at ease with you.`;
    log(s, `You read ${first(s, target)}: ${read}`, [actor], 'secret', [target]);
  }
  return { ok: true, text: `You spent an hour with ${first(s, target)} ${place}.${read ? ' ' + read : ''}${extra}`, tone: 'good' };
}

/** A servant who likes you lets something slip. Returns the line to show, if any. */
export function servantGossip(s: GameState, actor: CharId, servant: CharId): string | null {
  const S = ch(s, servant);
  const pool = Object.entries(s.knowledge[servant] ?? {})
    .filter(([sid, k]) => !k.lie && k.credence >= 30 && s.secrets[sid] && !s.secrets[sid].guilty.includes(actor) && credence(s, actor, sid) < 40 && secretMatters(s, s.secrets[sid]))
    .map(([sid, k]) => ({ sec: s.secrets[sid], k }));
  if (!pool.length) return null;
  const pct = clamp(15 + opinion(s, servant, actor) * 0.6 + ch(s, actor).traits.charm * 0.2 + (S.traits.greed >= 55 ? 5 : 0), 5, 85);
  if (!chance(s, pct)) return null;
  const { sec, k } = pool[Math.floor(rand(s) * pool.length)];
  learn(s, actor, sec.id, Math.round(k.credence * 0.85), servant);
  log(s, `${first(s, servant)} let something slip: “${sec.text}”`, [actor], 'secret', [servant, ...sec.guilty]);
  return `${first(s, servant)} lowers ${his(s, servant)} voice: “${sec.text}”`;
}

const RANK_STEP: Record<string, number> = { servant: 0, knight: 1, lady: 1, lord: 2, clergy: 2, great: 3, queen: 4, king: 4 };

/** The best person to present the actor, and the chance it works. */
export function introductionOdds(s: GameState, actor: CharId, target: CharId): { pct: number; via?: CharId } {
  const A = ch(s, actor);
  const gap = Math.max(0, (RANK_STEP[ch(s, target).rank] ?? 2) - (RANK_STEP[A.rank] ?? 2));
  let best = { pct: 15 + A.traits.charm * 0.3 - gap * 8, via: undefined as CharId | undefined };
  for (const via of s.order) {
    if (via === actor || via === target || !isFree(s, via) || isServant(s, via)) continue;
    if (actor === s.player && acquaintance(s, via) < 3) continue;
    if (opinion(s, via, actor) < 0) continue;
    const pct = 35 + opinion(s, via, actor) * 0.5 + opinion(s, target, via) * 0.3 + A.traits.charm * 0.15 - gap * 4;
    if (pct > best.pct) best = { pct, via };
  }
  if (target === s.king) best.pct -= 15;
  if (hasPerk(s, actor, 'cellar')) best.pct += 10;
  return { pct: clamp(Math.round(best.pct), 5, 92), via: best.via };
}

function introduce(s: GameState, actor: CharId, target: CharId): Outcome {
  const { pct, via } = introductionOdds(s, actor, target);
  if (!chance(s, pct)) {
    if (!via) addMod(s, target, actor, 'presumptuous', 'Presumptuous', -4, 0.5);
    return {
      ok: false,
      text: via ? `${first(s, via)} tried to present you, but ${first(s, target)} had no time for you.` : `${first(s, target)} looked through you as if you were not there.`,
      tone: 'bad',
    };
  }
  if (actor === s.player) hearOf(s, target, 3);
  addMod(s, target, actor, 'newly-met', 'Newly met', 3, 0.5);
  log(
    s,
    via ? `${nm(s, via)} presented ${nm(s, actor)} to ${nm(s, target)}.` : `${nm(s, actor)} presented ${him(s, actor)}self to ${nm(s, target)}.`,
    [actor, target, ...(via ? [via] : [])],
    'good',
    [actor, target],
  );
  return { ok: true, text: `You have been introduced to ${nm(s, target)}.`, tone: 'good' };
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

function gift(s: GameState, actor: CharId, target: CharId, amount: number): Outcome {
  const T = ch(s, target);
  ch(s, actor).gold -= amount;
  T.gold += amount;
  const v = Math.min(30, Math.round(amount * (0.25 + T.traits.greed / 200)));
  addMod(s, target, actor, 'gifts', 'Generous gifts', v, 1);
  log(s, `${nm(s, actor)} gave ${nm(s, target)} a gift of ${amount} crowns.`, [actor, target], 'neutral', [actor, target]);
  return { ok: true, text: `${first(s, target)} accepts your ${amount} crowns${T.traits.greed >= 60 ? ' rather quickly' : ''}.`, tone: 'good' };
}

function whisper(s: GameState, actor: CharId, target: CharId, secretId: SecretId): Outcome {
  const sec = s.secrets[secretId];
  const sworn = warnable(s, actor, target, sec);
  if (sworn) return warn(s, actor, target, sworn);
  const place = vary(s, PLACES);
  if (sec.guilty.includes(target)) {
    if (sec.truth) {
      addMod(s, target, actor, 'knows-secret', 'Knows my secret', -15);
      learn(s, target, secretId, 100, 'self');
      log(s, `${nm(s, actor)} let ${nm(s, target)} know, ${place}, that ${he(s, actor)} knows: ${sec.text}`, [actor, target], 'secret', [actor, target]);
      return { ok: true, text: `${first(s, target)} went pale. ${cap(he(s, target))} knows that you know.`, tone: 'neutral' };
    }
    addMod(s, target, actor, 'lies-about-me', 'Spreads lies about me', -25, 0.5);
    learn(s, target, secretId, 0, actor);
    log(s, `${nm(s, actor)} confronted ${nm(s, target)} with a tale: ${sec.text} ${cap(he(s, target))} knows it is false.`, [actor, target], 'bad', [actor, target]);
    return { ok: false, text: `${first(s, target)} knows it is a lie, and now knows you are telling it.`, tone: 'bad' };
  }
  const c = hearCredence(s, target, actor, sec);
  const isNew = !knows(s, target, secretId);
  learn(s, target, secretId, c, actor);
  for (const g of sec.guilty) {
    if (g === target) continue;
    const sev = capital(sec) ? 0.35 : 0.2;
    addMod(s, target, g, `belief-${secretId}`, `Believes: ${kindLabel(sec).toLowerCase()}`, -Math.round(c * sev), SUSPICION_FADES);
  }
  if (c >= 50) {
    addMod(s, target, actor, 'confided', 'Confided in me', 4, 0.5);
    adjustTrust(s, target, actor, 3);
  } else if (!sec.truth && ch(s, target).traits.cunning >= 55 && c < 25) {
    addMod(s, target, actor, 'tale-teller', 'Spreads tales', -10, 0.5);
  }
  log(s, `${nm(s, actor)} drew ${nm(s, target)} aside ${place} and whispered: “${sec.text}”`, [actor, target], 'secret', [actor, target]);
  const looked = target === s.king && kingLooksInto(s, sec, c);
  const verdict = c >= 65 ? 'believes every word' : c >= 45 ? 'is inclined to believe it' : c >= 25 ? 'is doubtful' : 'does not believe you';
  return {
    ok: c >= 45,
    text: `${first(s, target)} ${verdict}${isNew ? '' : ' (it was not news to them)'}.${looked ? ` ${cap(he(s, target))} will have it looked into.` : ''}`,
    tone: c >= 45 ? 'good' : 'neutral',
  };
}

/** Will the King give his leave? How far he believes the treason, how much he fears it, and whether you could do it. */
export function bladeOdds(s: GameState, actor: CharId, secretId: SecretId): number {
  const K = s.king!;
  const c = hearCredence(s, K, actor, s.secrets[secretId]);
  // He need not like you to use your sword: his dislike counts for little against a traitor.
  return clamp(Math.round(c * 0.9 + (ch(s, K).traits.paranoia - 50) * 0.3 + opinion(s, K, actor) * 0.1 + (ch(s, actor).traits.martial - 50) * 0.15 - 5), 5, 90);
}

/** Offer to rid the King of a traitor. Accepted, you have his leave: a killing that is no crime, and his favour. */
function offerBlade(s: GameState, actor: CharId, target: CharId, secretId: SecretId): Outcome {
  const K = s.king!;
  const sec = s.secrets[secretId];
  // Forged letters laid before the King may be seen through, and traced home.
  if (!sec.truth && chance(s, forgeryDetection(s, sec))) {
    exposeForgery(s, sec, actor);
    return { ok: false, text: 'The King’s clerks looked at your proofs and saw a forgery.', tone: 'dire' };
  }
  const c = hearCredence(s, K, actor, sec);
  const odds = bladeOdds(s, actor, secretId);
  learn(s, K, secretId, c, actor);
  for (const g of sec.guilty) if (g !== K) addMod(s, K, g, `belief-${secretId}`, `Believes: ${kindLabel(sec).toLowerCase()}`, -Math.round(c * 0.35), SUSPICION_FADES);
  if (!chance(s, odds)) {
    if (c < 25) addMod(s, K, actor, 'tale-teller', 'Brings me tales', -6, 0.5);
    log(s, `${nm(s, actor)} offered the King ${his(s, actor)} sword against ${nm(s, target)}. The King would not hear of it.`, [actor, K], 'bad', [actor, target]);
    kingLooksInto(s, sec, c);
    return { ok: false, text: c >= 45 ? 'The King believes you, but will not have it done by your hand.' : 'The King does not believe you.', tone: 'bad' };
  }
  const p = createPlot(s, actor, 'murder', [target]);
  p.warrant = K;
  p.progress = Math.max(p.progress, 30);
  // No one may charge you with what the King has sanctioned.
  markJudged(s, s.secrets[p.secretId], actor);
  learn(s, K, p.secretId, 100, actor);
  addMod(s, K, actor, 'kings-sword', 'Offered me his sword', 15, 0.3);
  log(s, `The King heard ${nm(s, actor)} out, and gave ${him(s, actor)} leave: rid him of ${nm(s, target)}, and quietly.`, [actor, K], 'secret', [actor, K, target]);
  return {
    ok: true,
    text: `The King gives you his leave. “${p.name}” is no crime while he reigns: strike when you are ready, and the deed will win his favour.`,
    tone: 'good',
  };
}

/**
 * A grave tale brought to the King, and not idly dismissed: his people start asking questions. The court
 * notices. Returns whether he did.
 */
function kingLooksInto(s: GameState, sec: Secret, c: number): boolean {
  if (c < 25 || sec.inquiry !== undefined || s.king === s.player || !(sec.treason || sec.kind === 'murder')) return false;
  const suspects = sec.guilty.filter((g) => isFree(s, g) && g !== s.king && !isChild(s, g) && !alreadyJudged(s, sec, g));
  if (!suspects.length) return false;
  sec.inquiry = s.turn;
  log(s, `Word goes round that the King’s people are asking questions about ${names(s, suspects)}.`, 'all', 'court', suspects);
  return true;
}

/**
 * Tell the quarry of a plot you were sworn to. You are out of it, and your name with you; they are on
 * their guard; and those you left behind may work out who talked.
 */
function warn(s: GameState, actor: CharId, target: CharId, p: Plot): Outcome {
  const sec = s.secrets[p.secretId];
  const T = ch(s, target);
  const c = warnCredence(s, actor, target, sec);
  leavePlot(s, p, actor);
  learn(s, target, sec.id, c, actor);
  for (const g of sec.guilty) {
    if (g === target) continue;
    addMod(s, target, g, `belief-${sec.id}`, `Believes: ${kindLabel(sec).toLowerCase()}`, -Math.round(c * (capital(sec) ? 0.35 : 0.2)), SUSPICION_FADES);
  }
  const murder = p.kind === 'murder';
  if (murder) T.guard = Math.max(T.guard, Math.min(60, T.guard + 20));
  addMod(s, target, actor, 'warned', murder ? 'Warned me of a plot on my life' : 'Warned me of a plot against me', murder ? 25 : 15, 0.2);
  adjustTrust(s, target, actor, 8);
  log(s, `${nm(s, actor)} came to ${nm(s, target)} ${vary(s, PLACES)} and told ${him(s, target)} of “${p.name}”: ${sec.text}`, [actor, target], 'secret', [actor, target]);
  const owner = p.owner;
  const found = isFree(s, owner) && chance(s, warnFound(s, owner, target));
  if (found) {
    for (const o of [owner, ...p.members.map((m) => m.id)]) if (o !== actor && !gone(s, o)) addMod(s, o, actor, 'warned-quarry', 'Warned our quarry', -40);
    log(s, `${nm(s, owner)} has worked out who warned ${nm(s, target)} of “${p.name}”: ${nm(s, actor)}.`, [owner, actor], 'bad', [owner, actor]);
  }
  const believed = c >= 65 ? 'believes every word' : 'is inclined to believe it';
  return {
    ok: true,
    text: `${first(s, target)} ${believed}${murder ? `, and will be on guard` : ''}. You are no longer sworn to “${p.name}”.${found ? ` ${first(s, owner)} knows it was you.` : ''}`,
    tone: found ? 'neutral' : 'good',
  };
}

/** The chance the plot's leader learns who warned its quarry: his wits against the quarry's discretion. */
export function warnFound(s: GameState, owner: CharId, target: CharId): number {
  const O = ch(s, owner);
  return clamp(Math.round(20 + O.traits.cunning * 0.25 + O.traits.paranoia * 0.2 - ch(s, target).traits.cunning * 0.15), 10, 60);
}

export function fabricateEvidence(s: GameState, actor: CharId): number {
  return Math.round(20 + ch(s, actor).traits.cunning * 0.4 + (hasPerk(s, actor, 'seals') ? 15 : 0));
}

function fabricate(s: GameState, actor: CharId, kind: FabricateKind, guilty: CharId[], victim: CharId): Outcome {
  const sec = makeSecret(s, {
    kind,
    guilty,
    victims: [victim],
    truth: false,
    fabricatedBy: actor,
    evidence: fabricateEvidence(s, actor) + roll(s, 0, 15),
  });
  learn(s, actor, sec.id, 0, 'self', true);
  log(s, `${nm(s, actor)} forged letters and seals: “${sec.text}”`, [actor], 'secret', [actor, ...guilty]);
  return { ok: true, text: `Your forgery is ready (proof: ${sec.evidence}). Now it must be spread or laid before the King.`, tone: 'neutral' };
}

export function spyChance(s: GameState, actor: CharId, target: CharId): number {
  const A = ch(s, actor);
  const T = ch(s, target);
  const master = officeOf(s, actor) === 'spymaster' ? 20 : 0;
  const informants = hasPerk(s, actor, 'informants') ? 15 : 0;
  return clamp(Math.round(35 + A.traits.cunning * 0.5 - T.traits.cunning * 0.35 + master + informants - T.traits.paranoia * 0.1), 5, 90);
}

function spy(s: GameState, actor: CharId, target: CharId, focus: SpyFocus): Outcome {
  const T = ch(s, target);
  if (!chance(s, spyChance(s, actor, target))) {
    if (chance(s, 45)) {
      addMod(s, target, actor, 'spied', 'Spied on me', -15, 0.5);
      adjustTrust(s, target, actor, -10);
      log(s, `${nm(s, target)} caught a servant of ${nm(s, actor)} going through ${his(s, target)} letters.`, [actor, target], 'bad', [actor, target]);
      return { ok: false, text: `Your man was caught. ${first(s, target)} knows you were prying.`, tone: 'bad' };
    }
    return { ok: false, text: `Your spies learned nothing of ${first(s, target)}.`, tone: 'neutral' };
  }
  const ins = insightOf(s, actor);
  if (focus === 'household') {
    const house = s.houses[T.householdId];
    const members = (house?.members ?? []).filter((m) => m !== actor && ch(s, m).status !== 'dead');
    if (actor === s.player) for (const m of members) hearOf(s, m, 2);
    const servants = members.filter((m) => isServant(s, m));
    const slip = servants.length ? servantGossip(s, actor, servants[Math.floor(rand(s) * servants.length)]) : null;
    const list = members.map((m) => `${first(s, m)}${ch(s, m).role ? ` (${ch(s, m).role})` : ''}`).join(', ');
    log(s, `Your spies mapped the household of ${house ? `House ${house.name}` : nm(s, target)}: ${list}.`, [actor], 'secret', [target]);
    return { ok: true, text: `The household of ${house ? `House ${house.name}` : first(s, target)}: ${list}.${slip ? ` ${slip}` : ''}`, tone: 'good' };
  }
  if (focus === 'motive') {
    if (!ins.agendas.includes(target)) ins.agendas.push(target);
    if (actor === s.player) hearOf(s, target, 5);
    log(s, `Your spies uncovered the true design of ${nm(s, target)}: ${T.agenda.summary}`, [actor], 'secret', [target]);
    return { ok: true, text: `${first(s, target)}'s true design: ${T.agenda.summary}`, tone: 'good' };
  }
  if (focus === 'schemes') {
    const plots = Object.values(s.plots).filter((p) => p.status === 'active' && isMember(p, target));
    if (!plots.length) {
      log(s, `Your spies watched ${nm(s, target)} closely: ${he(s, target)} is part of no scheme.`, [actor], 'secret', [target]);
      return { ok: true, text: `${first(s, target)} is part of no scheme. For now.`, tone: 'neutral' };
    }
    const found: string[] = [];
    for (const p of plots) {
      learn(s, actor, p.secretId, 60, 'spies');
      const key = `${p.id}:${target}`;
      if (p.owner !== target && !ins.sincerity.includes(key)) ins.sincerity.push(key);
      const m = p.members.find((x) => x.id === target);
      found.push(
        p.owner === target
          ? `leads “${p.name}” against ${names(s, p.targets, true)}`
          : `is sworn to ${first(s, p.owner)}'s “${p.name}”${m && !m.sincere ? ' — and means to betray it' : ' — sincerely'}`,
      );
    }
    const text = `${first(s, target)} ${found.join('; ')}.`;
    log(s, `Your spies report: ${text}`, [actor], 'secret', [target]);
    return { ok: true, text, tone: 'good' };
  }
  // secrets
  const row = s.knowledge[target] ?? {};
  const candidates = Object.entries(row)
    .filter(([sid, k]) => (k.lie || k.credence >= 40) && credence(s, actor, sid) < 50 && !knows(s, actor, sid)?.lie)
    .map(([sid, k]) => ({ sec: s.secrets[sid], k }))
    .filter((x) => x.sec && !(x.sec.plotId && s.plots[x.sec.plotId]?.status !== 'active' && !x.sec.exposed && !x.sec.truth));
  if (!candidates.length) return { ok: true, text: `${first(s, target)} carries no secret you do not already know.`, tone: 'neutral' };
  candidates.sort((a, b) => Number(b.sec.guilty.includes(target)) - Number(a.sec.guilty.includes(target)) || Number(b.k.lie ?? 0) - Number(a.k.lie ?? 0));
  const { sec, k } = candidates[0];
  if (k.lie) {
    let sl = Object.values(s.secrets).find((x) => x.kind === 'slander' && x.guilty[0] === target && x.victims.join() === sec.guilty.join());
    sl ??= makeSecret(s, { kind: 'slander', guilty: [target], victims: sec.guilty, truth: true, evidence: 40, treason: false });
    learn(s, actor, sl.id, 85, 'spies');
    learn(s, actor, sec.id, 5, 'spies');
    log(s, `Your spies found forged letters in ${nm(s, target)}'s chest: “${sec.text}” It is a lie of ${his(s, target)} making.`, [actor], 'secret', [target]);
    return { ok: true, text: `You found ${first(s, target)}'s forgery: “${sec.text}” It is a lie — and now you can prove ${he(s, target)} forged it.`, tone: 'good' };
  }
  learn(s, actor, sec.id, sec.truth ? 70 : 45, 'spies');
  log(s, `Your spies learned what ${nm(s, target)} knows: “${sec.text}”`, [actor], 'secret', [target]);
  return { ok: true, text: `${first(s, target)} knows: “${sec.text}”`, tone: 'good' };
}

function scheme(s: GameState, actor: CharId, kind: PlotKind, targets: CharId[], charges: SecretId[]): Outcome {
  const p = createPlot(s, actor, kind, targets, charges);
  log(s, `${nm(s, actor)} began a scheme, “${p.name}”: ${p.intent}`, [actor], 'secret', [actor, ...targets]);
  return { ok: true, text: `“${p.name}” is begun. It is a secret — for now.`, tone: 'neutral' };
}

// Recruitment ---------------------------------------------------------------

export function offerValue(s: GameState, owner: CharId, cand: CharId, o: Offer): number {
  const C = ch(s, cand);
  const t = trust(s, cand, owner);
  switch (o.kind) {
    case 'gold':
      return (o.amount ?? 0) * (0.3 + C.traits.greed / 150);
    case 'land':
      return (s.lands[o.landId!]?.income ?? 3) * 5 * (0.5 + C.traits.greed / 100);
    case 'restitution':
      return 50;
    case 'office':
      return 32 * (t / 60) * (C.traits.ambition / 70);
    case 'vengeance':
      return 5;
    default:
      return 0;
  }
}

export function recruitWillingness(s: GameState, owner: CharId, cand: CharId, p: Plot, o: Offer): number {
  const C = ch(s, cand);
  const E = effective(s, cand);
  let w = opinion(s, cand, owner) * 0.35 + (trust(s, cand, owner) - 40) * 0.25;
  w += Math.max(0, ...p.targets.map((t) => -opinion(s, cand, t) * 0.5));
  w += offerValue(s, owner, cand, o);
  w += E.ambition * 0.1;
  if (p.kind === 'murder') {
    w -= C.traits.honor * 0.25 + (100 - E.boldness) * 0.12;
    if (p.targets.includes(s.king ?? '')) {
      w -= Math.max(0, opinion(s, cand, s.king!)) * 0.4 + C.traits.honor * 0.2;
      if (s.offices.captain === cand) w -= 20;
    }
  } else {
    w -= C.traits.honor * 0.05;
    if (p.charges.some((c) => !s.secrets[c]?.truth && credence(s, cand, c) < 40)) w -= 10;
  }
  if (p.targets.some((t) => C.spouse === t || C.siblings.includes(t))) w -= 40;
  w += p.progress * 0.08 + p.members.length * 3;
  return Math.round(w);
}

export type RecruitAnswer = 'sincere' | 'feign' | 'refuse';

export function recruitDecision(s: GameState, owner: CharId, cand: CharId, p: Plot, o: Offer, noise = true): RecruitAnswer {
  const C = ch(s, cand);
  const w = recruitWillingness(s, owner, cand, p, o) + (noise ? roll(s, -10, 10) : 0);
  if (w >= 20) return 'sincere';
  const motive = opinion(s, cand, owner) < -20 || p.targets.some((t) => opinion(s, cand, t) >= 30);
  if (w >= -15 && (C.traits.cunning >= 50 || motive) && C.traits.honor < 70) return 'feign';
  return 'refuse';
}

export function recruitOdds(s: GameState, owner: CharId, cand: CharId, p: Plot, o: Offer): number {
  const w = recruitWillingness(s, owner, cand, p, o);
  const debtors = hasPerk(s, owner, 'debtors') ? 10 : 0;
  return clamp(Math.round(50 + w * 1.6 + debtors), 3, 97);
}

/** Pay what was promised (now) or record the pledge (later). */
export function honourOffer(s: GameState, from: CharId, to: CharId, o: Offer, plotId?: PlotId): void {
  if (o.kind === 'gold' && o.amount) {
    const amt = Math.min(o.amount, ch(s, from).gold);
    ch(s, from).gold -= amt;
    ch(s, to).gold += amt;
  } else if ((o.kind === 'land' || o.kind === 'restitution') && o.landId) {
    transferLand(s, from, to, o.landId);
  } else if (o.kind === 'office') {
    s.pledges.push({ id: uid(s, 'pl'), from, to, offer: o, plotId, turn: s.turn, status: 'pending', text: pledgeText(s, from, to, o) });
  }
}

function recruit(s: GameState, owner: CharId, cand: CharId, plotId: PlotId, o: Offer): Outcome {
  const p = s.plots[plotId];
  learn(s, cand, p.secretId, 100, owner);
  if (cand === s.player) {
    pushAudience(s, recruitAudience(s, owner, p, o));
    return { ok: true, text: 'An offer has been made.', tone: 'neutral' };
  }
  const answer = recruitDecision(s, owner, cand, p, o);
  return applyRecruitAnswer(s, owner, cand, p, o, answer);
}

export function applyRecruitAnswer(s: GameState, owner: CharId, cand: CharId, p: Plot, o: Offer, answer: RecruitAnswer): Outcome {
  if (answer === 'refuse') {
    if (ch(s, cand).traits.honor >= 55 || p.targets.includes(s.king ?? '')) {
      addMod(s, cand, owner, 'asked-treason', 'Asked me to join a crime', -12, 0.3);
    }
    addMod(s, owner, cand, 'refused', 'Refused me', -8, 0.5);
    log(s, `${nm(s, cand)} refused to join ${nm(s, owner)}'s “${p.name}” — but now knows of it.`, [owner, cand], 'bad', [owner, cand]);
    return { ok: false, text: `${first(s, cand)} refuses — and now knows what you plan.`, tone: 'bad' };
  }
  honourOffer(s, owner, cand, o, p.id);
  joinPlot(s, p, cand, answer === 'sincere', o);
  addMod(s, cand, owner, 'co-conspirator', 'Fellow conspirator', answer === 'sincere' ? 10 : 0, 0.2);
  addMod(s, owner, cand, 'co-conspirator', 'Fellow conspirator', 10, 0.2);
  log(s, `${nm(s, cand)} swore to ${nm(s, owner)}'s “${p.name}”.`, [owner, cand], 'secret', [owner, cand]);
  if (answer === 'feign') {
    log(s, `${nm(s, cand)} joined “${p.name}” meaning to betray it.`, [cand], 'secret', [cand]);
  }
  return { ok: true, text: `${first(s, cand)} clasps your hand and swears to your cause.`, tone: 'good' };
}

export function offerLabel(s: GameState, o: Offer): string {
  switch (o.kind) {
    case 'gold':
      return `${o.amount} crowns now`;
    case 'land':
      return `the manor of ${s.lands[o.landId!]?.name}`;
    case 'restitution':
      return `the return of ${s.lands[o.landId!]?.name}, rightfully theirs`;
    case 'office':
      return `the office of ${OFFICE_NAMES[o.office!]} when you rise`;
    case 'vengeance':
      return 'a shared enemy';
    default:
      return 'nothing but the cause';
  }
}

function recruitAudience(s: GameState, owner: CharId, p: Plot, o: Offer): Audience {
  const what = p.kind === 'murder' ? `the death of ${names(s, p.targets)}` : `the ruin of ${names(s, p.targets)} before the King`;
  return {
    id: uid(s, 'a'),
    kind: 'recruit',
    from: owner,
    turn: s.turn,
    title: `${first(s, owner)} has a proposal`,
    text: `${nm(s, owner)} draws you aside ${vary(s, PLACES)}. ${cap(he(s, owner))} speaks of ${what} — a scheme ${he(s, owner)} calls “${p.name}”. In return ${he(s, owner)} offers ${offerLabel(s, o)}. Whatever you answer, you now know.`,
    options: [
      { id: 'join', label: 'Swear to it, and mean it', hint: 'You become a conspirator. If it is exposed, so are you.', tone: 'neutral' },
      { id: 'feign', label: 'Swear to it — and mean to betray it', hint: 'They will think you an ally. You will know better.', tone: 'dire' },
      { id: 'refuse', label: 'Refuse', hint: 'They will not thank you, and may fear what you know.', tone: 'good' },
    ],
    data: { plotId: p.id, offer: o },
  };
}

// Denunciation ---------------------------------------------------------------

function denounce(s: GameState, actor: CharId, it: Extract<Intent, { type: 'denounce' }>): Outcome {
  const charges = denounceCharges(s, it);
  const plot = it.plotId ? s.plots[it.plotId] : undefined;
  const accusedList = chargesFor(s, actor, charges, it.only);
  const accusedNames = names(s, accusedList.map((x) => x.accused));
  log(
    s,
    `${nm(s, actor)} knelt before the throne and accused ${accusedNames}: ${uniqueTexts(s, charges)}`,
    'all',
    'court',
    [actor, ...accusedList.map((x) => x.accused)],
  );
  if (s.king === s.player) {
    pushAudience(s, judgmentAudience(s, actor, charges, plot, it.only));
    return { ok: true, text: 'The King will hear the charge.', tone: 'neutral' };
  }
  if (accusedList.some((x) => x.accused === s.player) && actor !== s.player) {
    pushAudience(s, accusedAudience(s, actor, charges, plot, it.only));
    return { ok: true, text: 'The accused has been summoned.', tone: 'neutral' };
  }
  // Betraying a plot you were sworn into: you are out of it now, whatever the King decides.
  const betrayed = charges.map((c) => betrayable(s, actor, s.secrets[c])).filter((p): p is Plot => !!p);
  const judgments = rollJudgments(s, actor, charges, plot, {}, it.only);
  const summary = applyJudgments(s, actor, judgments);
  const upheld = judgments.some((j) => j.verdict !== 'dismiss' && !j.forgeryFound);
  if (plot) plot.status = upheld ? 'succeeded' : 'foiled';
  // A sworn man who lays his leader's scheme before the King answers to the leader for how it went.
  if (plot && plot.owner !== actor && !gone(s, plot.owner)) {
    if (upheld) addMod(s, plot.owner, actor, 'carried', 'Carried our scheme to the King', 12, 0.3);
    else addMod(s, plot.owner, actor, 'spent', 'Spent our scheme, and lost it', -15, 0.5);
  }
  const informer = turnInformer(s, actor, betrayed, upheld);
  return {
    ok: upheld,
    text: `The King has judged: ${summary || 'nothing came of it'}.${informer}`,
    tone: judgments.some((j) => j.verdict === 'execute') ? 'dire' : 'neutral',
  };
}

/**
 * The informer leaves the plot (its leader ends it). Believed, they are pardoned for bringing it;
 * disbelieved, they have made enemies for nothing.
 */
function turnInformer(s: GameState, actor: CharId, plots: Plot[], upheld: boolean): string {
  if (!plots.length) return '';
  for (const p of plots) {
    const others = [p.owner, ...p.members.map((m) => m.id)].filter((o) => o !== actor && !gone(s, o));
    for (const o of others) addMod(s, o, actor, 'informed', 'Betrayed us to the King', -40);
    if (p.owner === actor) {
      // The leader is pardoned for what he brought, and his scheme is over either way.
      if (upheld) markJudged(s, s.secrets[p.secretId], actor);
      p.status = upheld ? 'foiled' : 'abandoned';
      continue;
    }
    p.members = p.members.filter((m) => m.id !== actor);
    syncPlotSecret(s, p);
    if (upheld) p.status = 'foiled';
  }
  const aimedAtKing = plots.some((p) => s.king && p.targets.includes(s.king));
  if (upheld) {
    if (s.king) addMod(s, s.king, actor, 'informer', aimedAtKing ? 'Brought me the plot against my life' : 'Turned informer', aimedAtKing ? 20 : 10, 0.2);
    log(s, `${nm(s, actor)} turned informer against ${his(s, actor)} fellow plotters, and the King pardoned ${him(s, actor)} for it.`, 'all', 'court', [actor]);
    return ' You turned informer, and the King pardoned your part in it.';
  }
  return ' The King did not believe it, and your fellow plotters know what you tried.';
}

function uniqueTexts(s: GameState, ids: SecretId[]): string {
  return ids.map((id) => `“${s.secrets[id].text}”`).join(' ');
}

export function denounceOdds(s: GameState, actor: CharId, it: Extract<Intent, { type: 'denounce' }>): { accused: CharId; pct: number; notes: string[] }[] {
  if (!s.king) return [];
  const charges = denounceCharges(s, it);
  const plot = it.plotId ? s.plots[it.plotId] : undefined;
  return chargesFor(s, actor, charges, it.only).map(({ secretId, accused }) => {
    const read = readCase(s, actor, secretId, accused, plot);
    const sec = s.secrets[secretId];
    const threshold = capital(sec) ? TREASON_IMPRISON : CRIME_GUILTY;
    let pct = clamp(Math.round(((read.score - threshold + 12) / 24) * 100), 2, 98);
    if (!sec.truth) {
      const det = forgeryDetection(s, sec);
      pct = Math.round(pct * (1 - det / 100));
      read.notes.push(`Risk the forgery is seen through: ${det}%`);
    }
    return { accused, pct, notes: read.notes };
  });
}

function judgmentAudience(s: GameState, accuser: CharId, charges: SecretId[], plot?: Plot, only?: CharId[]): Audience {
  const reads = chargesFor(s, accuser, charges, only).map(({ secretId, accused }) => readCase(s, accuser, secretId, accused, plot));
  const suspicious = charges.filter((c) => !s.secrets[c].truth).some((c) => chance(s, forgeryDetection(s, s.secrets[c])));
  const lines = reads.map((r) => {
    const sec = s.secrets[r.secretId];
    const mood = r.score >= TREASON_EXECUTE ? 'The hall believes it.' : r.score >= TREASON_IMPRISON ? 'The hall is divided.' : 'The hall is sceptical.';
    return `• ${nm(s, r.accused)} — ${crimeName(sec)}. Proof: ${sec.evidence >= 55 ? 'strong' : sec.evidence >= 35 ? 'some' : 'thin'}. ${r.witnessesFor.length ? `${names(s, r.witnessesFor, true)} speak for the charge. ` : ''}${r.witnessesAgainst.length ? `${names(s, r.witnessesAgainst, true)} speak for the accused. ` : ''}${mood}`;
  });
  return {
    id: uid(s, 'a'),
    kind: 'judgment',
    from: accuser,
    turn: s.turn,
    title: `${first(s, accuser)} brings charges`,
    text: `${nm(s, accuser)} kneels before your throne. “${charges.map((c) => s.secrets[c].text).join(' ')}”\n${lines.join('\n')}${suspicious ? '\nYour clerks murmur that the seals on the letters look wrong.' : ''}`,
    options: [
      { id: 'execute', label: 'Guilty. Send them to the block.', tone: 'dire' },
      { id: 'imprison', label: 'Take them to the Tower for questioning.', tone: 'neutral' },
      { id: 'dismiss', label: 'Dismiss the charges.', tone: 'good' },
      { id: 'punish', label: `Dismiss them — and punish ${first(s, accuser)} for slander.`, tone: 'bad' },
    ],
    data: { accuser, charges, plotId: plot?.id, suspicious, only },
  };
}

/** Who lays a traced killing before the King: the Captain of the Guard, or the dead man's kin, or a great lord. */
function hearingAccuser(s: GameState, killer: CharId, victim: CharId): CharId | undefined {
  const V = ch(s, victim);
  const fit = (id: CharId | null | undefined): id is CharId =>
    !!id && id !== killer && id !== s.king && isFree(s, id) && !isChild(s, id) && !shields(s, id).includes(killer);
  const kin = [V.spouse, ...V.siblings, ...(V.parents ?? []), ...(V.children ?? [])];
  return [s.offices.captain, ...kin].find(fit) ?? s.order.find((id) => fit(id) && ch(s, id).rank === 'great');
}

export function accusedAudience(s: GameState, accuser: CharId, charges: SecretId[], plot?: Plot, only?: CharId[]): Audience {
  const P = s.player;
  const counters = Object.entries(s.knowledge[P] ?? {})
    .filter(([sid, k]) => (k.lie || k.credence >= 40) && s.secrets[sid]?.guilty.includes(accuser))
    .map(([sid]) => s.secrets[sid])
    .slice(0, 3);
  const mine = chargesFor(s, accuser, charges, only).filter((c) => c.accused === P);
  const read = mine.length ? readCase(s, accuser, mine[0].secretId, P, plot) : undefined;
  return {
    id: uid(s, 'a'),
    kind: 'accused',
    from: accuser,
    turn: s.turn,
    title: 'You are summoned before the King',
    text: `Guards fetch you to the great hall. ${nm(s, accuser)} stands before the throne and points at you: “${charges.map((c) => s.secrets[c].text).join(' ')}”${read ? `\nThe mood of the hall: ${read.score >= TREASON_EXECUTE ? 'they believe it' : read.score >= TREASON_IMPRISON ? 'they are divided' : 'they are sceptical'}.` : ''}`,
    options: [
      { id: 'deny', label: 'Deny everything', hint: 'Stand on your name.', tone: 'neutral' },
      { id: 'mercy', label: 'Throw yourself on the King’s mercy', hint: 'Look guiltier, but the axe is less likely.', tone: 'good' },
      ...counters.map((sec) => ({ id: `counter:${sec.id}`, label: `Counter-accuse: “${sec.text}”`, hint: 'Turn the charge on your accuser.', tone: 'dire' as const })),
      { id: 'flee', label: 'Bolt for the door', hint: 'If you escape, you leave the court forever.', tone: 'bad' },
    ],
    data: { accuser, charges, plotId: plot?.id, only },
  };
}

// Blackmail ------------------------------------------------------------------

export function blackmailFear(s: GameState, actor: CharId, target: CharId, secretId: SecretId): number {
  const sec = s.secrets[secretId];
  const T = effective(s, target);
  let fear = sec.evidence * 0.5 + (capital(sec) ? 30 : 10) + (s.king ? opinion(s, s.king, actor) * 0.2 : 0) - T.boldness * 0.3 - T.wrath * 0.2;
  if (!sec.truth) fear -= 25;
  if (hasPerk(s, actor, 'debtors')) fear += 8;
  if (hasPerk(s, actor, 'debts')) fear += 12;
  return Math.round(fear);
}

function demandText(s: GameState, actor: CharId, it: Extract<Intent, { type: 'blackmail' }>): string {
  if (it.demand === 'gold') return `${blackmailAmount(s, it.target)} crowns`;
  if (it.demand === 'restitution') {
    const land = Object.values(s.lands).find((l) => l.holder === it.target && l.rightful === actor);
    return `the return of ${land?.name}`;
  }
  return `that ${he(s, it.target)} swear to “${s.plots[it.plotId!]?.name}”`;
}

const blackmailAmount = (s: GameState, target: CharId) => Math.max(10, Math.min(60, Math.floor(ch(s, target).gold / 2)));

function blackmail(s: GameState, actor: CharId, it: Extract<Intent, { type: 'blackmail' }>): Outcome {
  const sec = s.secrets[it.secretId];
  learn(s, it.target, it.secretId, sec.truth ? 100 : 0, 'self');
  if (it.target === s.player) {
    pushAudience(s, {
      id: uid(s, 'a'),
      kind: 'blackmail',
      from: actor,
      turn: s.turn,
      title: `${first(s, actor)} knows`,
      text: `${nm(s, actor)} closes the door behind ${him(s, actor)}. “${sec.text} I can prove it to the King. Unless you give me ${demandText(s, actor, it)}.”`,
      options: [
        { id: 'comply', label: 'Give them what they want', tone: 'neutral' },
        { id: 'refuse', label: 'Refuse, and dare them to do it', tone: 'dire' },
      ],
      data: { ...it, actor },
    });
    return { ok: true, text: 'Your demand has been made.', tone: 'neutral' };
  }
  const fear = blackmailFear(s, actor, it.target, it.secretId) + roll(s, -10, 10);
  return applyBlackmail(s, actor, it, fear >= 20);
}

export function applyBlackmail(s: GameState, actor: CharId, it: Extract<Intent, { type: 'blackmail' }>, comply: boolean): Outcome {
  const target = it.target;
  addMod(s, target, actor, 'blackmail', 'Blackmailed me', comply ? -30 : -40, 0.2);
  adjustTrust(s, target, actor, -30);
  if (!comply) {
    log(s, `${nm(s, target)} refused ${nm(s, actor)}'s threats.`, [actor, target], 'bad', [actor, target]);
    return { ok: false, text: `${first(s, target)} tells you to do your worst.`, tone: 'bad' };
  }
  let what = '';
  if (it.demand === 'gold') {
    const amt = Math.min(blackmailAmount(s, target), ch(s, target).gold);
    ch(s, target).gold -= amt;
    ch(s, actor).gold += amt;
    what = `${amt} crowns`;
  } else if (it.demand === 'restitution') {
    const land = Object.values(s.lands).find((l) => l.holder === target && l.rightful === actor);
    if (land) {
      transferLand(s, target, actor, land.id);
      what = land.name;
    }
  } else if (it.plotId) {
    joinPlot(s, s.plots[it.plotId], target, false);
    what = `an oath to “${s.plots[it.plotId].name}”`;
  }
  log(s, `${nm(s, target)} paid ${nm(s, actor)}'s price for silence: ${what}.`, [actor, target], 'secret', [actor, target]);
  return { ok: true, text: `${first(s, target)} gives you ${what}, hating you for it.`, tone: 'good' };
}

// Petitions ------------------------------------------------------------------

function petition(s: GameState, actor: CharId, it: Extract<Intent, { type: 'petition' }>): Outcome {
  const K = s.king!;
  if (K === s.player) {
    pushAudience(s, petitionAudience(s, actor, it));
    log(s, `${nm(s, actor)} petitioned the King.`, 'all', 'court', [actor]);
    return { ok: true, text: 'Your petition is before the King.', tone: 'neutral' };
  }
  const pct = petitionOdds(s, actor, it);
  return applyPetition(s, actor, it, chance(s, pct));
}

/** The King's answer to a petition. Holding a district's grain makes him listen. */
export function petitionOdds(s: GameState, actor: CharId, it: Extract<Intent, { type: 'petition' }>): number {
  const base = basePetitionOdds(s, actor, it);
  return hasPerk(s, actor, 'leverage') && s.king ? clamp(base + 10, 3, 95) : base;
}

function basePetitionOdds(s: GameState, actor: CharId, it: Extract<Intent, { type: 'petition' }>): number {
  const K = s.king;
  if (!K) return 0;
  const king = ch(s, K);
  if (it.kind === 'restitution') {
    const theft = Object.values(s.secrets).find((x) => x.kind === 'theft' && x.victims.includes(actor) && x.truth);
    const proof = theft && credence(s, actor, theft.id) >= 40 ? theft.evidence : 10;
    const land = Object.values(s.lands).find((l) => l.rightful === actor && l.holder !== actor);
    const holder = land?.holder;
    const holderPull = holder ? opinion(s, K, holder) * 0.3 : -15;
    return clamp(Math.round(proof * 0.7 + opinion(s, K, actor) * 0.3 - holderPull + 5), 5, 90);
  }
  if (it.kind === 'office') {
    return clamp(Math.round(10 + opinion(s, K, actor) * 0.6 + ch(s, actor).prestige * 0.3), 5, 85);
  }
  const rec = s.imprisoned[it.target!];
  const charges = rec?.charges ?? [];
  const belief = charges.reduce((m, c) => Math.max(m, credence(s, K, c)), 0);
  const hanging = charges.some((c) => s.secrets[c] && capital(s.secrets[c]));
  // A King hardly forgives a man he believes tried to kill him.
  const mine = charges.some((c) => s.secrets[c]?.victims.includes(K) && capital(s.secrets[c]) && credence(s, K, c) >= 50);
  // Time in the Tower softens him, and so does every voice already raised for the prisoner.
  const served = rec ? Math.min(20, (s.turn - rec.since) * 3) : 0;
  const voices = Math.min(24, (rec?.pleas ?? 0) * 8);
  return clamp(
    Math.round(
      15 +
        opinion(s, K, actor) * 0.4 +
        opinion(s, K, it.target!) * 0.2 +
        ch(s, actor).traits.charm * 0.2 +
        (officeOf(s, actor) === 'confessor' ? 15 : 0) +
        (ch(s, actor).spouse === it.target ? 15 : 0) +
        served +
        voices -
        belief * (hanging ? 0.45 : 0.3) -
        (mine ? 50 : 0) +
        (100 - king.traits.wrath) * 0.25,
    ),
    3,
    85,
  );
}

export function applyPetition(s: GameState, actor: CharId, it: Extract<Intent, { type: 'petition' }>, granted: boolean): Outcome {
  const K = s.king!;
  if (!granted) {
    // A lord refused waits a season or more before he asks again. Begging for another costs him less.
    addMod(s, K, actor, 'petitions', 'Pesters me with petitions', it.kind === 'mercy' ? -8 : -20, 0.5);
    // But every voice raised for a prisoner is remembered, and they add up.
    const rec = it.kind === 'mercy' ? s.imprisoned[it.target!] : undefined;
    if (rec) rec.pleas = (rec.pleas ?? 0) + 1;
    log(s, `The King refused ${nm(s, actor)}'s petition.`, [actor, K], 'court', [actor]);
    return { ok: false, text: 'The King refuses you.', tone: 'bad' };
  }
  if (it.kind === 'restitution') {
    const theft = Object.values(s.secrets).find((x) => x.kind === 'theft' && x.victims.includes(actor) && x.truth);
    const lands = Object.values(s.lands).filter((l) => l.rightful === actor && l.holder !== actor);
    const holder = lands[0]?.holder;
    if (theft && holder && isFree(s, holder)) {
      disgrace(s, holder, theft);
    }
    for (const l of Object.values(s.lands).filter((x) => x.rightful === actor && x.holder !== actor)) {
      l.holder = actor;
    }
    addMod(s, actor, K, 'justice', 'Gave me justice', 25, 0.5);
    log(s, `The King granted ${nm(s, actor)}'s petition: ${lands.map((l) => l.name).join(' and ')} restored to the rightful heir.`, 'all', 'good', [actor]);
    return { ok: true, text: `Justice! ${lands.map((l) => l.name).join(' and ')} is yours again.`, tone: 'good' };
  }
  if (it.kind === 'office') {
    appoint(s, actor, it.office!);
    return { ok: true, text: `You are named ${OFFICE_NAMES[it.office!]}.`, tone: 'good' };
  }
  // Mercy spares the neck, not the shame: a crime the King believes is still punished.
  const charges = (s.imprisoned[it.target!]?.charges ?? []).map((c) => s.secrets[c]).filter(Boolean);
  const proven = charges.find((sec) => capital(sec) && credence(s, K, sec.id) >= 60);
  // And it settles the matter: no one may bring the same charge again.
  for (const sec of charges) markJudged(s, sec, it.target!);
  release(s, it.target!, `${nm(s, actor)} begged mercy and the King granted it`);
  if (proven && isFree(s, it.target!)) disgrace(s, it.target!, proven);
  addMod(s, it.target!, actor, 'saved', 'Saved my life', 40, 0.2);
  return { ok: true, text: proven ? `${first(s, it.target!)} is spared the axe, but not the shame.` : `${first(s, it.target!)} is spared.`, tone: 'good' };
}

function petitionAudience(s: GameState, actor: CharId, it: Extract<Intent, { type: 'petition' }>): Audience {
  let ask = '';
  if (it.kind === 'restitution') {
    const lands = Object.values(s.lands).filter((l) => l.rightful === actor && l.holder !== actor);
    ask = `the return of ${lands.map((l) => l.name).join(' and ')}, held by ${lands[0]?.holder ? nm(s, lands[0].holder) : 'the crown'} under a forged will`;
  } else if (it.kind === 'office') ask = `the vacant office of ${OFFICE_NAMES[it.office!]}`;
  else ask = `mercy for ${nm(s, it.target!)}`;
  return {
    id: uid(s, 'a'),
    kind: 'petition',
    from: actor,
    turn: s.turn,
    title: `${first(s, actor)} petitions the throne`,
    text: `${nm(s, actor)} kneels and asks for ${ask}.`,
    options: [
      { id: 'grant', label: 'Grant it', tone: 'good' },
      { id: 'refuse', label: 'Refuse', tone: 'bad' },
    ],
    data: { ...it, actor },
  };
}

// Spouses --------------------------------------------------------------------

export function influence(s: GameState, actor: CharId, target: CharId): number {
  const A = ch(s, actor);
  const T = ch(s, target);
  return clamp(Math.round(A.traits.will * 0.6 + opinion(s, target, actor) * 0.3 - T.traits.will * 0.3 + 10), 5, 60);
}

export function complianceOdds(s: GameState, actor: CharId, target: CharId): number {
  return clamp(Math.round(20 + influence(s, actor, target) * 0.8 + ch(s, target).pressure * 0.25), 5, 92);
}

export function directiveText(s: GameState, d: DirectiveSpec): string {
  switch (d.kind) {
    case 'denounce':
      return d.plotId ? `lay “${s.plots[d.plotId]?.name}” before the King` : `denounce ${d.secretId ? `this: ${s.secrets[d.secretId]?.text}` : 'them'}`;
    case 'strike':
      return `spring “${s.plots[d.plotId!]?.name}” and strike`;
    case 'advance':
      return `press on with “${s.plots[d.plotId!]?.name}”`;
    case 'restore':
      return `return ${s.lands[d.target ?? '']?.name ?? 'the stolen lands'} to your brothers`;
    case 'abandon':
      return `abandon “${s.plots[d.plotId!]?.name}” before it destroys us`;
  }
}

function counsel(s: GameState, actor: CharId, target: CharId, mode: 'goad' | 'restrain' | 'demand', d?: DirectiveSpec): Outcome {
  const T = ch(s, target);
  const inf = influence(s, actor, target);
  if (T.traits.will >= 50 && chance(s, 30)) addMod(s, target, actor, 'nagging', 'Nags me', -2, 0.5);
  if (mode === 'goad') {
    T.pressure = clamp(T.pressure + inf, -100, 100);
    log(s, `${nm(s, actor)} spoke to ${nm(s, target)} of cowardice and crowns, late into the night.`, [actor, target], 'secret', [actor, target]);
    return { ok: true, text: `${first(s, target)} is stung, and bolder for it. (Pressure ${T.pressure})`, tone: 'good' };
  }
  if (mode === 'restrain') {
    T.pressure = clamp(T.pressure - inf, -100, 100);
    log(s, `${nm(s, actor)} begged ${nm(s, target)} to think of the axe, and of home.`, [actor, target], 'secret', [actor, target]);
    return { ok: true, text: `${first(s, target)} is shaken, and more careful for it. (Pressure ${T.pressure})`, tone: 'good' };
  }
  const spec = d!;
  T.pressure = clamp(T.pressure + Math.round(inf / 2), -100, 100);
  const text = directiveText(s, spec);
  if (target === s.player) {
    pushAudience(s, {
      id: uid(s, 'a'),
      kind: 'counsel',
      from: actor,
      turn: s.turn,
      title: `${first(s, actor)} will not be refused`,
      text: `${nm(s, actor)} finds you alone. “You will ${text}. Tomorrow. Or I will know I married a coward.” Her eyes do not leave yours.`,
      options: [
        { id: 'heed', label: 'Do as she says — now', hint: 'It costs you no time: her will carries you.', tone: 'dire' },
        { id: 'placate', label: 'Soothe her with promises', hint: 'A silver tongue may buy time.', tone: 'neutral' },
        { id: 'refuse', label: 'Refuse her', hint: 'She will not forget it.', tone: 'bad' },
      ],
      data: { directive: spec, actor },
    });
    return { ok: true, text: 'You have made your demand.', tone: 'neutral' };
  }
  s.directives[target] = { ...spec, by: actor, until: s.turn + 2, text };
  log(s, `${nm(s, actor)} demanded that ${nm(s, target)} ${text}.`, [actor, target], 'secret', [actor, target]);
  return { ok: true, text: `You have told ${first(s, target)} what he must do. Whether he finds the nerve is another matter (${complianceOdds(s, actor, target)}%).`, tone: 'neutral' };
}

/** Turn a spouse's demand into a concrete deed, if it is still possible. */
export function directiveIntent(s: GameState, who: CharId, d: DirectiveSpec): Intent | null {
  switch (d.kind) {
    case 'denounce':
      if (d.plotId && s.plots[d.plotId]?.status === 'active') return { type: 'denounce', plotId: d.plotId };
      if (d.secretId) return { type: 'denounce', secretId: d.secretId };
      return null;
    case 'strike':
      return d.plotId ? { type: 'strike', plotId: d.plotId } : null;
    case 'advance':
      return d.plotId ? { type: 'advance', plotId: d.plotId, gold: 0 } : null;
    case 'abandon':
      return d.plotId ? { type: 'abandon', plotId: d.plotId } : null;
    case 'restore': {
      const sib = ch(s, who).siblings;
      const land = Object.values(s.lands).find((l) => l.holder === who && l.rightful && sib.includes(l.rightful));
      return land ? { type: 'grant', target: land.rightful!, landId: land.id } : null;
    }
  }
}

// Land ------------------------------------------------------------------------

export function transferLand(s: GameState, from: CharId, to: CharId, landId: LandId): void {
  const land = s.lands[landId];
  if (!land) return;
  land.holder = to;
  if (land.rightful === to) {
    removeMod(s, to, from, 'theft');
    addMod(s, to, from, 'restored', 'Returned my inheritance', 35, 0.3);
    addMod(s, to, from, 'old-wound', 'Old wound', -10);
    adjustTrust(s, to, from, 25);
  } else {
    addMod(s, to, from, 'land-gift', `Gave me ${land.name}`, 10 + land.income * 3, 0.3);
  }
  for (const pl of s.pledges) {
    if (pl.status === 'pending' && pl.from === from && pl.to === to && pl.offer.landId === landId) pl.status = 'kept';
  }
}

function grant(s: GameState, actor: CharId, target: CharId, landId: LandId): Outcome {
  const land = s.lands[landId];
  transferLand(s, actor, target, landId);
  const restored = land.rightful === target;
  log(
    s,
    restored ? `${nm(s, actor)} returned ${land.name} to ${nm(s, target)}, its rightful lord.` : `${nm(s, actor)} granted ${land.name} to ${nm(s, target)}.`,
    'all',
    'good',
    [actor, target],
  );
  return { ok: true, text: restored ? `${first(s, target)} holds ${land.name} again. Something in ${his(s, target)} face softens.` : `${land.name} is now ${first(s, target)}'s.`, tone: 'good' };
}

// Flight, prison, kingship ------------------------------------------------------

export function exile(s: GameState, id: CharId): void {
  const c = ch(s, id);
  vacate(s, id);
  succeedHouse(s, id);
  for (const l of Object.values(s.lands)) if (l.holder === id) l.holder = null;
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active') continue;
    if (p.owner === id) p.status = 'abandoned';
    p.members = p.members.filter((m) => m.id !== id);
    if (p.targets.includes(id)) {
      p.targets = p.targets.filter((t) => t !== id);
      if (!p.targets.length) p.status = 'succeeded';
    }
  }
  const wasKing = s.king === id;
  c.status = 'fled';
  c.statusTurn = s.turn;
  c.fate = `Fled the court, ${dateLabel(s.turn)}`;
  delete s.imprisoned[id];
  if (wasKing) {
    s.king = null;
    s.interregnum = { since: s.turn };
  }
  log(s, `${nm(s, id)} fled the court in the night. ${cap(his(s, id))} lands are forfeit.`, 'all', 'dire', [id]);
}

function escape(s: GameState, actor: CharId): Outcome {
  const A = ch(s, actor);
  const pct = clamp(Math.round(15 + A.traits.cunning * 0.2 + A.gold / 5), 5, 70);
  A.gold = 0;
  if (chance(s, pct)) {
    exile(s, actor);
    return { ok: true, text: 'The gaoler took your gold and left the door unbarred. You are free — and an exile.', tone: 'good' };
  }
  const rec = s.imprisoned[actor];
  if (rec) rec.questioned++;
  log(s, `${nm(s, actor)} tried to bribe a gaoler and was caught.`, 'all', 'bad', [actor]);
  return { ok: false, text: 'The gaoler took your gold and reported you.', tone: 'bad' };
}

function arrest(s: GameState, king: CharId, target: CharId): Outcome {
  const charges = Object.entries(s.knowledge[king] ?? {})
    .filter(([sid, k]) => !k.lie && k.credence >= 25 && s.secrets[sid]?.guilty.includes(target) && !alreadyJudged(s, s.secrets[sid], target))
    .map(([sid]) => sid);
  const belief = charges.reduce((m, c) => Math.max(m, credence(s, king, c)), 0);
  // The player is summoned to answer before the throne, not taken in the night.
  if (target === s.player && charges.length) {
    if (s.audiences.some((a) => a.kind === 'accused')) return { ok: false, text: 'They are already summoned.', tone: 'neutral' };
    log(s, `The King has sent for you: you are to answer before the throne for what he has heard.`, [target], 'dire', [king]);
    pushAudience(s, accusedAudience(s, king, charges, undefined, [target]));
    return { ok: true, text: `${first(s, target)} is summoned to answer.`, tone: 'neutral' };
  }
  imprison(s, target, charges, king);
  if (belief < 40) {
    for (const id of s.order) {
      if (id !== king && id !== target && isAlive(s, id)) addMod(s, id, king, `tyranny-${target}`, `Seized ${first(s, target)} without cause`, -10, 0.3);
    }
  }
  log(s, `By the King's order, the Guard seized ${nm(s, target)} and took ${him(s, target)} to the Tower.`, 'all', 'court', [target]);
  return { ok: true, text: `${first(s, target)} is in the Tower.${belief < 40 ? ' The court mutters about tyranny.' : ''}`, tone: 'neutral' };
}

function kingExecute(s: GameState, king: CharId, target: CharId): Outcome {
  const rec = s.imprisoned[target];
  const charges = rec?.charges ?? [];
  const belief = charges.reduce((m, c) => Math.max(m, credence(s, king, c)), 0);
  const sec = charges.map((c) => s.secrets[c]).find(Boolean);
  if (belief < 50) {
    for (const id of s.order) {
      if (id !== king && id !== target && isAlive(s, id)) addMod(s, id, king, `butcher-${target}`, `Beheaded ${first(s, target)} without proof`, -15, 0.3);
    }
  }
  execute(s, target, sec ? crimeName(sec) : 'the King’s displeasure');
  return { ok: true, text: `${first(s, target)} is dead.`, tone: 'dire' };
}
