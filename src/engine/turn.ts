// The rhythm of a month: you act, the court acts in the night, the world turns.
// The game is open-ended: it runs until the player dies, flees or is crowned.

import { accusedAudience, pushAudience } from './actions';
import { evolveAgendas, expireDirectives, npcTurn } from './ai';
import { witanAudience } from './audiences';
import { decidePrisoners, fillOffices, holdWitan, kill, markJudged, pursueInquiries, questionPrisoner } from './court';
import { arriveHouse, generateCourt, type GenerateOptions } from './generate';
import { evaluate } from './objectives';
import { heardOfYourSchemes, leakPlots, spymasterHears } from './plots';
import { deedDone, secretMatters, syncPlotSecret } from './secrets';
import { endowTrades, runBusinesses } from './economy';
import { runSpies } from './spies';
import { runTails } from './tails';
import { renownMonth } from './renown';
import { MARRYING_AGE, affairsAsSpies, annul, births, forgetCuckolding, honestWoman, matchmaking, widowsUpkeep } from './family';
import { loversOf, mistressOf } from './love';
import { seasonalFeast } from './tensions';
import { chance, pick, shuffle } from './rng';
import { first, his, nm, names } from './text';
import {
  COLD_FADES,
  FAITHLESS_FADES,
  MONTHS_PER_SEASON,
  MONTHS_PER_YEAR,
  acquaintance,
  FRIENDSHIP_MAX,
  SUSPICION_FADES,
  addMod,
  ch,
  credence,
  dateLabel,
  decayMods,
  gone,
  hearOf,
  hearOfTheNamed,
  houseTier,
  incomeOf,
  isAlive,
  isFree,
  isServant,
  learn,
  livingSpouse,
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

/**
 * Prestige lost to charges and disgrace once stayed lost. In a save from before it mended, what each person
 * has lost since the court began (the same seed gives the same court) starts coming back now.
 */
function mendOldLosses(s: GameState): void {
  s.mendingSince = s.turn;
  let start: GameState;
  try {
    start = generateCourt(s.seed);
  } catch {
    return;
  }
  // Only trust the comparison if it is the same court.
  if (start.player !== s.player || start.order.some((id) => s.chars[id]?.archetype !== start.chars[id].archetype || s.chars[id]?.gender !== start.chars[id].gender)) return;
  for (const id of start.order) {
    const c = s.chars[id];
    const lost = start.chars[id].prestige - c.prestige;
    if (lost > 0 && c.status !== 'dead' && c.status !== 'fled') c.tarnish = (c.tarnish ?? 0) + lost;
  }
}

/** Bring a game saved under older rules up to the current ones. Safe to run on any save. */
export function repairSave(s: GameState): void {
  s.spies ??= {};
  // Suspicion once faded at a point a month; it fades at the new pace now.
  for (const row of Object.values(s.relations)) {
    for (const r of Object.values(row)) {
      for (const m of r.mods) if ((m.key.startsWith('belief-') || m.key === 'accused' || m.key === 'disgraced') && m.decay && m.decay < SUSPICION_FADES) m.decay = SUSPICION_FADES;
    }
  }
  // An unseen killing once put the killer's name in the mouths of strangers at random. Strangers forget it;
  // the dead man's kin and friends keep their suspicions.
  for (const sec of Object.values(s.secrets)) {
    if (sec.kind !== 'murder' || !sec.deed || !sec.truth) continue;
    const victim = s.chars[sec.victims[0]];
    if (!victim) continue;
    for (const [id, row] of Object.entries(s.knowledge)) {
      const k = row[sec.id];
      if (!k || k.source !== 'rumour' || k.credence > 35 || sec.guilty.includes(id)) continue;
      const close = victim.spouse === id || victim.siblings.includes(id) || !!victim.parents?.includes(id) || !!victim.children?.includes(id) || opinion(s, id, victim.id) >= 30;
      if (!close) delete row[sec.id];
    }
  }
  // Friendship came after this save was made: those you have kept company with are old friends already.
  for (const [id, talks] of Object.entries(s.company ?? {})) {
    if (talks < 3 || !s.chars[id] || s.chars[id].status === 'dead') continue;
    for (const [a, b] of [[id, s.player], [s.player, id]]) {
      if (s.relations[a]?.[b]?.mods.some((m) => m.key === 'friend') || opinion(s, a, b) < 10) continue;
      addMod(s, a, b, 'friend', 'Old friend', Math.min(FRIENDSHIP_MAX, talks * 3), 0.1);
    }
  }
  // A child is no one's prisoner: any jailed on a forged tale go home.
  for (const c of Object.values(s.chars)) {
    if (c.rank !== 'child' || c.status !== 'imprisoned') continue;
    c.status = 'free';
    delete s.imprisoned[c.id];
  }
  affairsAsSpies(s);
  if (s.mendingSince === undefined) mendOldLosses(s);
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
  // Secrets written before a wedding or an heir's styling still use the old names.
  const nameOf = new Map(s.order.filter((id) => !gone(s, id)).map((id) => [ch(s, id).name, id]));
  for (const sec of Object.values(s.secrets)) {
    for (const id of sec.guilty.concat(sec.victims)) {
      const c = s.chars[id];
      if (!c || sec.text.includes(c.name)) continue;
      const m = new RegExp(`\\b(?:Lady|Lord|Sir) ${c.short} [A-Z][a-z]+\\b`).exec(sec.text);
      if (!m || nameOf.has(m[0])) continue;
      sec.text = sec.text.split(m[0]).join(c.name);
      if (!(c.formerly ??= []).includes(m[0])) c.formerly.push(m[0]);
    }
  }
  hearOfTheNamed(s);
  // A lover of the player's married off to another man while they were lovers: that marriage should never have been.
  for (const w of Object.values(s.chars)) {
    const h = w.gender === 'f' && !gone(s, w.id) ? livingSpouse(s, w.id) : undefined;
    if (!h || h === s.player || !loversOf(s, w.id).includes(s.player)) continue;
    const affair = Object.values(s.secrets).find((x) => x.kind === 'affair' && x.truth && x.guilty.includes(w.id) && x.guilty.includes(s.player));
    const wedding = s.events.filter((e) => e.actors.includes(w.id) && e.actors.includes(h) && / were married\./.test(e.text)).at(-1);
    if (affair && wedding && wedding.turn >= affair.createdTurn) annul(s, h, w.id);
  }
  // A mistress since married, or gone: the scandal of keeping her is over.
  for (const id of s.order) {
    const wife = livingSpouse(s, id);
    if (mistressOf(s, id)) continue;
    const scandal = s.order.some((o) => s.relations[o]?.[id]?.mods.some((m) => m.key === 'mistress-scandal'));
    if (scandal) honestWoman(s, id, wife ?? id);
  }
  // Marriages annulled before annulment took the wrongs of them away too.
  for (const e of s.events) {
    if (!/ was annulled\./.test(e.text) || e.actors.length < 2) continue;
    const [a, b] = e.actors;
    const man = s.chars[a]?.gender === 'm' ? a : b;
    forgetCuckolding(s, man, man === a ? b : a);
  }
  // Schemes that still named members who died before the dead were struck from them.
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active' || p.members.every((m) => isAlive(s, m.id))) continue;
    p.members = p.members.filter((m) => isAlive(s, m.id));
    syncPlotSecret(s, p);
  }
  // Cold marriages and unfaithfulness were once forever; now they thaw.
  for (const row of Object.values(s.relations)) {
    for (const r of Object.values(row)) {
      for (const m of r.mods) {
        if (m.key === 'cold' && !m.decay) m.decay = COLD_FADES;
        if (m.key === 'faithless' && (m.decay ?? 0) < FAITHLESS_FADES) m.decay = FAITHLESS_FADES;
        // ...but the man who bedded his wife is not forgiven, or the injury would be felt afresh.
        if (m.key === 'cuckold') m.decay = 0;
        // A refusal's sting now fades in months, not years.
        if (m.key === 'rebuffed' && (m.decay ?? 0) < 1) m.decay = 1;
      }
    }
  }
  // Concealments made before they were tied to the treason they hide.
  for (const sec of Object.values(s.secrets)) {
    if (sec.kind !== 'concealment' || sec.about) continue;
    const hidden = Object.values(s.secrets).find(
      (x) =>
        ['regicide', 'pact', 'usurpation'].includes(x.kind) &&
        x.guilty.some((g) => s.chars[g] && [s.chars[g].name, ...(s.chars[g].formerly ?? [])].some((n) => sec.text.includes(`${n} plots`))),
    );
    if (hidden) sec.about = hidden.id;
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
  for (const x of pursueInquiries(s)) {
    if (!isFree(s, s.player) || s.audiences.some((a) => a.kind === 'accused')) continue;
    log(s, `${nm(s, x.accuser)} brings what the King’s people found before the throne: you are summoned to answer it.`, [s.player], 'dire', [x.accuser]);
    pushAudience(s, accusedAudience(s, x.accuser, [x.secretId], undefined, [s.player]));
  }
  runBusinesses(s);
  runSpies(s);
  runTails(s);
  renownMonth(s);
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
  widowsUpkeep(s);
  matchmaking(s);
  newcomers(s);
  heardOfYourSchemes(s);
}

/** Birthdays. Youth passes quickly: until they are of an age to marry, a year goes by every month. */
export function growOlder(s: GameState): void {
  if (s.turn <= 1) return;
  const year = (s.turn - 1) % MONTHS_PER_YEAR === 0;
  for (const c of Object.values(s.chars)) {
    if (c.status !== 'free' && c.status !== 'imprisoned') continue;
    if (c.age < MARRYING_AGE || year) c.age++;
  }
}

/** Old age takes people, kings included. */
function mortality(s: GameState): void {
  growOlder(s);
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
/** No more than this many houses come to court in a game: the court fills, and then it only thins. */
export const MAX_NEW_HOUSES = 15;

export function newcomers(s: GameState): void {
  if (s.turn % (MONTHS_PER_SEASON * 2) !== 0) return;
  if (Object.values(s.houses).filter((h) => h.arrived > 0).length >= MAX_NEW_HOUSES) return;
  const nobles = s.order.filter((id) => isFree(s, id) && !isServant(s, id) && ch(s, id).rank !== 'clergy' && ch(s, id).rank !== 'child').length;
  if (s.order.filter((id) => !gone(s, id)).length >= 75) return;
  if (nobles < 20 || chance(s, 40)) arriveHouse(s);
}

/** What the player notices, and what their wife brings home, as a new month begins. */
function dawn(s: GameState): void {
  const P = s.player;
  hearOfTheNamed(s);
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
    const pool = Object.entries(s.knowledge[lady] ?? {}).filter(
      ([sid, k]) => !k.lie && k.credence >= 40 && !s.secrets[sid].guilty.includes(lady) && !s.knowledge[P]?.[sid] && secretMatters(s, s.secrets[sid]),
    );
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
