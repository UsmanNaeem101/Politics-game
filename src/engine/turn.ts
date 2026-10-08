// The rhythm of a week: you act, the court acts in the night, the world turns.
// The game is open-ended: it runs until the player dies, flees or is crowned.

import { evolveAgendas, expireDirectives, npcTurn } from './ai';
import { witanAudience } from './audiences';
import { decidePrisoners, fillOffices, holdWitan, kill, questionPrisoner } from './court';
import { arriveHouse, generateCourt, type GenerateOptions } from './generate';
import { evaluate } from './objectives';
import { leakPlots, spymasterHears } from './plots';
import { seasonalFeast } from './tensions';
import { chance, pick, shuffle } from './rng';
import { first, his, nm, names } from './text';
import {
  WEEKS_PER_SEASON,
  WEEKS_PER_YEAR,
  acquaintance,
  addMod,
  ch,
  decayMods,
  hearOf,
  incomeOf,
  isAlive,
  isFree,
  isServant,
  learn,
  log,
  opinion,
} from './world';
import type { Ending, GameState } from './types';

export function newGame(seed: number, opts: GenerateOptions = {}): GameState {
  return generateCourt(seed, opts);
}

/** Can the player end the week right now? */
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
    s.order.filter((id) => id !== s.player && !isServant(s, id)),
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
  if (s.interregnum && s.interregnum.since < s.turn) {
    holdWitan(s, s.witanVote);
    s.witanVote = undefined;
    if (s.king === s.player && !s.reigning) finish(s, 'crowned');
  }
  decayMods(s);
  expireDirectives(s);
  evolveAgendas(s);
  mortality(s);
  newcomers(s);
}

/** Old age takes people, kings included. */
function mortality(s: GameState): void {
  if (s.turn > 1 && (s.turn - 1) % WEEKS_PER_YEAR === 0) {
    for (const c of Object.values(s.chars)) if (c.status === 'free' || c.status === 'imprisoned') c.age++;
  }
  for (const id of s.order) {
    const c = ch(s, id);
    if (c.status === 'dead' || c.status === 'fled' || c.age < 55) continue;
    const pct = ((c.age - 50) * (c.age - 50)) / 800;
    if (!chance(s, pct)) continue;
    const king = s.king === id;
    kill(s, id, `Died of old age at ${c.age}, week ${s.turn}`, false);
    log(s, king ? `King ${c.short} died in ${his(s, id)} sleep. The throne is empty.` : `${nm(s, id)} died of old age.`, 'all', king ? 'dire' : 'neutral', [id]);
  }
}

/** New families come to court, so an open-ended game never runs dry. */
function newcomers(s: GameState): void {
  if (s.turn % WEEKS_PER_SEASON !== 0) return;
  const nobles = s.order.filter((id) => isFree(s, id) && !isServant(s, id) && ch(s, id).rank !== 'clergy').length;
  if (s.order.length >= 75) return;
  if (nobles < 20 || chance(s, 40)) arriveHouse(s);
}

/** What the player notices, and what their wife brings home, as a new week begins. */
function dawn(s: GameState): void {
  const P = s.player;
  if (!isFree(s, P)) return;
  // Faces at court.
  const heard = shuffle(
    s,
    s.order.filter((id) => isFree(s, id) && acquaintance(s, id) === 1 && !isServant(s, id)),
  ).slice(0, 2);
  const marked = heard.filter((id) => hearOf(s, id, 2));
  if (marked.length) log(s, `At court this week you put faces to names: ${names(s, marked)}.`, [P], 'neutral', []);

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
  const husband = ch(s, lady).spouse;
  if (husband && isFree(s, husband)) hearOf(s, husband, 2);
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
  log(s, `Your wife ${first(s, wife)} has befriended ${nm(s, lady)}, and through her you are now acquainted.${gossip}`, [P, wife], gossip ? 'secret' : 'good', [lady]);
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
