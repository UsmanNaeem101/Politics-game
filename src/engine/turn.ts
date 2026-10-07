// The rhythm of a week: you act, the court acts in the night, the world turns.

import { evolveAgendas, expireDirectives, npcTurn } from './ai';
import { witanAudience } from './audiences';
import { decidePrisoners, fillOffices, holdWitan, questionPrisoner } from './court';
import { evaluate } from './objectives';
import { leakPlots, spymasterHears } from './plots';
import { shuffle } from './rng';
import { createScenario } from './scenario';
import { ch, decayMods, incomeOf, isAlive, isFree, log } from './world';
import type { CharId, GameState } from './types';

export function newGame(seed: number, player: CharId): GameState {
  const s = createScenario(seed, player);
  log(s, 'The court of King Osric gathers for the Season of Knives. Twenty weeks until the Midsummer Witan.', 'all', 'court');
  s.nightStart = s.nextId;
  return s;
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
    s.order.filter((id) => id !== s.player),
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
  }
  decayMods(s);
  expireDirectives(s);
  evolveAgendas(s);
}

function checkEnd(s: GameState): boolean {
  const p = ch(s, s.player);
  let reason: 'season-end' | 'player-dead' | 'player-fled' | null = null;
  if (p.status === 'dead') reason = 'player-dead';
  else if (p.status === 'fled') reason = 'player-fled';
  else if (s.turn >= s.maxTurns) reason = 'season-end';
  if (!reason) return false;
  finish(s, reason);
  return true;
}

export function finish(s: GameState, reason: 'season-end' | 'player-dead' | 'player-fled'): void {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.audiences = [];
  s.ending = { reason, turn: s.turn, result: evaluate(s) };
  log(
    s,
    reason === 'season-end' ? 'Midsummer. The Witan gathers, the season of knives is over, and the court counts its dead.' : reason === 'player-dead' ? 'Your story ends here.' : 'You are gone from the court. Others will finish the story.',
    'all',
    'court',
  );
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
