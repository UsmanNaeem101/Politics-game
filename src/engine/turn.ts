// The rhythm of a month: you act, the court acts in the night, the world turns.
// The game is open-ended: it runs until the player dies, flees or is crowned.

import { evolveAgendas, expireDirectives, npcTurn } from './ai';
import { witanAudience } from './audiences';
import { decidePrisoners, fillOffices, holdWitan, kill, markJudged, pursueInquiries, questionPrisoner } from './court';
import { arriveHouse, generateCourt, type GenerateOptions } from './generate';
import { evaluate } from './objectives';
import { leakPlots, spymasterHears } from './plots';
import { deedDone } from './secrets';
import { endowTrades, runBusinesses } from './economy';
import { runSpies } from './spies';
import { runTails } from './tails';
import { affairsAsSpies, births, matchmaking } from './family';
import { seasonalFeast } from './tensions';
import { chance, pick, shuffle } from './rng';
import { first, his, nm, names } from './text';
import {
  MONTHS_PER_SEASON,
  MONTHS_PER_YEAR,
  acquaintance,
  addMod,
  ch,
  credence,
  dateLabel,
  decayMods,
  gone,
  hearOf,
  houseTier,
  incomeOf,
  isAlive,
  isFree,
  isServant,
  learn,
  log,
  meetPersonalTies,
  opinion,
} from './world';
import type { Ending, GameState } from './types';

export function newGame(seed: number, opts: GenerateOptions = {}): GameState {
  return generateCourt(seed, opts);
}

/** A house that climbs among the great, or falls from them, is noticed. */
function noteRisingHouses(s: GameState): void {
  for (const h of Object.values(s.houses)) {
    const tier = houseTier(s, h);
    if (tier !== 'great' && tier !== 'lesser') continue;
    const was = h.standing;
    h.standing = tier;
    if (!was || was === tier || !h.head) continue;
    const mine = h.head === s.player;
    const text =
      tier === 'great'
        ? mine
          ? `House ${h.name} is counted among the great houses of the realm now. You have risen.`
          : `House ${h.name} has risen to stand among the great houses.`
        : mine
          ? `House ${h.name} has fallen from among the great houses.`
          : `House ${h.name} no longer stands among the great.`;
    log(s, text, 'all', mine ? (tier === 'great' ? 'good' : 'bad') : 'court', [h.head]);
  }
}

/** Bring a game saved under older rules up to the current ones. Safe to run on any save. */
export function repairSave(s: GameState): void {
  s.spies ??= {};
  affairsAsSpies(s);
  // Trades came after this save was made: every house takes one up now.
  if (!s.businesses) {
    s.businesses = {};
    // The player is given an honest trade; any other is theirs to choose.
    endowTrades(s, 'estates');
  }
  meetPersonalTies(s);
  // Your wife's friends' husbands, whom you dined with but the old rules left strangers.
  for (const lady of s.order) {
    const husband = ch(s, lady).spouse;
    if (!s.relations[lady]?.[s.player]?.mods.some((m) => m.key === 'wife-friend') || acquaintance(s, lady) < 3) continue;
    if (husband && husband !== s.king && husband !== s.player && isFree(s, husband)) hearOf(s, husband, 3);
  }
  // A murder done before murders were recorded as deeds: the plan becomes the crime.
  for (const p of Object.values(s.plots)) {
    const sec = s.secrets[p.secretId];
    if (!sec || sec.deed || p.kind !== 'murder' || p.status !== 'succeeded') continue;
    if (!p.targets.every((t) => s.chars[t]?.status === 'dead')) continue;
    deedDone(s, sec);
    // A King who has already heard of it and let it lie still has his people ask.
    if (s.king && s.king !== s.player && credence(s, s.king, sec.id) >= 30 && sec.guilty.some((g) => isFree(s, g) && g !== s.king)) {
      sec.inquiry = s.turn;
    }
  }
  // Charges the King dismissed before judgments were recorded are not heard again without new proof.
  const K = s.king;
  if (K && !s.judged) {
    s.judged = {};
    for (const sec of Object.values(s.secrets)) {
      if (!credence(s, K, sec.id)) continue;
      for (const g of sec.guilty) {
        if (g !== K && isFree(s, g) && s.relations[K]?.[g]?.mods.some((m) => m.key === 'accused')) markJudged(s, sec, g);
      }
    }
  }
}

/** Can the player end the month right now? */
export function canEndWeek(s: GameState): string | null {
  if (s.phase !== 'playing') return 'The game is over.';
  if (s.audiences.length) return 'Someone is waiting on your answer.';
  return null;
}

export function endWeek(s: GameState): void {
  if (canEndWeek(s)) return;
  s.nightStart = s.nextId;

  // The night: everyone else moves, in an order no one can predict.
  const npcs = shuffle(
    s,
    s.order.filter((id) => id !== s.player && !isServant(s, id) && ch(s, id).rank !== 'child'),
  );
  for (const id of npcs) {
    if (s.phase !== 'playing') break;
    npcTurn(s, id);
    if (!isAlive(s, s.player) || ch(s, s.player).status === 'fled') break;
  }

  worldTurns(s);
  if (checkEnd(s)) return;

  s.turn++;
  s.ap = s.apMax;
  seasonalFeast(s);
  dawn(s);
  const w = witanAudience(s);
  if (w) s.audiences.unshift(w);
}

function worldTurns(s: GameState): void {
  for (const id of s.order) {
    const c = ch(s, id);
    if (c.status === 'free') c.gold += incomeOf(s, id);
    c.pressure = Math.round(c.pressure * 0.85);
    c.guard = Math.max(0, c.guard - 5);
  }
  if (s.king) {
    for (const id of Object.keys(s.imprisoned)) {
      if (ch(s, id).status === 'imprisoned') questionPrisoner(s, id);
    }
    decidePrisoners(s);
    fillOffices(s);
  }
  leakPlots(s);
  spymasterHears(s);
  pursueInquiries(s);
  runBusinesses(s);
  runSpies(s);
  runTails(s);
  noteRisingHouses(s);
  if (s.interregnum && s.interregnum.since < s.turn) {
    holdWitan(s, s.witanVote);
    s.witanVote = undefined;
    if (s.king === s.player && !s.reigning) finish(s, 'crowned');
  }
  decayMods(s);
  expireDirectives(s);
  evolveAgendas(s);
  mortality(s);
  births(s);
  matchmaking(s);
  newcomers(s);
}

/** Old age takes people, kings included. */
function mortality(s: GameState): void {
  if (s.turn > 1 && (s.turn - 1) % MONTHS_PER_YEAR === 0) {
    for (const c of Object.values(s.chars)) if (c.status === 'free' || c.status === 'imprisoned') c.age++;
  }
  // You and your wife will not die in your beds; only a blade, the axe or poison can end you.
  const spared = [s.player, s.chars[s.player]?.spouse];
  for (const id of s.order) {
    const c = ch(s, id);
    if (c.status === 'dead' || c.status === 'fled' || c.age < 55 || spared.includes(id)) continue;
    const pct = ((c.age - 50) * (c.age - 50)) / 185;
    if (!chance(s, pct)) continue;
    const king = s.king === id;
    kill(s, id, `Died of old age at ${c.age}, ${dateLabel(s.turn)}`, false);
    log(s, king ? `King ${c.short} died in ${his(s, id)} sleep. The throne is empty.` : `${nm(s, id)} died of old age.`, 'all', king ? 'dire' : 'neutral', [id]);
  }
}

/** New families come to court, so an open-ended game never runs dry. */
function newcomers(s: GameState): void {
  if (s.turn % (MONTHS_PER_SEASON * 2) !== 0) return;
  const nobles = s.order.filter((id) => isFree(s, id) && !isServant(s, id) && ch(s, id).rank !== 'clergy' && ch(s, id).rank !== 'child').length;
  if (s.order.filter((id) => !gone(s, id)).length >= 75) return;
  if (nobles < 20 || chance(s, 40)) arriveHouse(s);
}

/** What the player notices, and what their wife brings home, as a new month begins. */
function dawn(s: GameState): void {
  const P = s.player;
  if (!isFree(s, P)) return;
  // Faces at court.
  const heard = shuffle(
    s,
    s.order.filter((id) => isFree(s, id) && acquaintance(s, id) === 1 && !isServant(s, id)),
  ).slice(0, 2);
  const marked = heard.filter((id) => hearOf(s, id, 2));
  if (marked.length) log(s, `At court this month you put faces to names: ${names(s, marked)}.`, [P], 'neutral', []);

  // A wife's social rounds open doors.
  const wife = ch(s, P).spouse;
  if (!wife || !isFree(s, wife) || !chance(s, 45)) return;
  const ladies = s.order.filter((id) => {
    const c = ch(s, id);
    return isFree(s, id) && (c.rank === 'lady' || c.rank === 'queen') && id !== wife && c.householdId !== ch(s, P).householdId && acquaintance(s, id) < 3;
  });
  const lady = ladies.length ? pick(s, ladies) : undefined;
  if (!lady) return;
  hearOf(s, lady, 3);
  addMod(s, wife, lady, 'friends', 'Friends', 10, 0.3);
  addMod(s, lady, wife, 'friends', 'Friends', 10, 0.3);
  addMod(s, lady, P, 'wife-friend', 'Her friend’s husband', 5, 0.3);
  // The two households dine together: you meet her husband too, unless he is the King.
  const husband = ch(s, lady).spouse;
  const metHusband = !!husband && isFree(s, husband) && husband !== s.king;
  if (metHusband) hearOf(s, husband!, 3);
  else if (husband && isFree(s, husband)) hearOf(s, husband, 2);
  let gossip = '';
  if (opinion(s, wife, P) >= 0 && chance(s, 40)) {
    const pool = Object.entries(s.knowledge[lady] ?? {}).filter(([sid, k]) => !k.lie && k.credence >= 40 && !s.secrets[sid].guilty.includes(lady) && !s.knowledge[P]?.[sid]);
    if (pool.length) {
      const [sid, k] = pick(s, pool);
      learn(s, wife, sid, k.credence * 0.8, lady);
      learn(s, P, sid, k.credence * 0.7, wife);
      gossip = ` Over the embroidery frames, ${first(s, lady)} told her: “${s.secrets[sid].text}”`;
    }
  }
  const met = metHusband
    ? `, and the two houses dined together: you are now acquainted with her and with ${nm(s, husband!)}.`
    : ', and through her you are now acquainted.';
  log(s, `Your wife ${first(s, wife)} has befriended ${nm(s, lady)}${met}${gossip}`, [P, wife], gossip ? 'secret' : 'good', metHusband ? [lady, husband!] : [lady]);
}

function checkEnd(s: GameState): boolean {
  if (s.phase !== 'playing') return true;
  const p = ch(s, s.player);
  let reason: Ending['reason'] | null = null;
  if (p.status === 'dead') reason = 'player-dead';
  else if (p.status === 'fled') reason = 'player-fled';
  else if (s.maxTurns > 0 && s.turn >= s.maxTurns) reason = 'season-end';
  if (!reason) return false;
  finish(s, reason);
  return true;
}

export function finish(s: GameState, reason: Ending['reason']): void {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.audiences = [];
  s.ending = { reason, turn: s.turn, result: evaluate(s) };
  const line =
    reason === 'crowned'
      ? 'The Witan has spoken. The crown is yours.'
      : reason === 'season-end'
        ? 'The season is over, and the court counts its dead.'
        : reason === 'player-dead'
          ? 'Your story ends here.'
          : 'You are gone from the court. Others will finish the story.';
  log(s, line, 'all', 'court');
}

/** After the crown: keep playing as King. */
export function continueReign(s: GameState): void {
  if (s.phase !== 'ended' || s.ending?.reason !== 'crowned') return;
  s.phase = 'playing';
  s.reigning = true;
  s.ending = undefined;
  s.turn++;
  s.ap = s.apMax;
  s.nightStart = s.nextId;
  log(s, `King ${first(s, s.player)} begins ${his(s, s.player)} reign. Every knife at court has a new target now.`, 'all', 'court', [s.player]);
}

/** Called after any player deed: their death or flight ends the game at once. */
export function afterPlayerAction(s: GameState): void {
  if (s.phase !== 'playing') return;
  const p = ch(s, s.player);
  if (p.status === 'dead') finish(s, 'player-dead');
  else if (p.status === 'fled') finish(s, 'player-fled');
  else if (s.interregnum && isFree(s, s.player)) {
    const w = witanAudience(s);
    if (w) s.audiences.unshift(w);
  }
}
