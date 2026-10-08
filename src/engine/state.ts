// A blank game state. The generator (and test fixtures) fill it in.

import type { CharId, GameState } from './types';

export function emptyState(seed: number, player: CharId = ''): GameState {
  return {
    version: 2,
    seed,
    rng: seed | 0,
    turn: 1,
    maxTurns: 0,
    player,
    phase: 'playing',
    chars: {},
    order: [],
    houses: {},
    known: {},
    company: {},
    relations: {},
    secrets: {},
    knowledge: {},
    plots: {},
    pledges: [],
    lands: {},
    offices: { marshal: null, chancellor: null, spymaster: null, captain: null, confessor: null },
    king: null,
    interregnum: null,
    imprisoned: {},
    directives: {},
    insight: {},
    ap: 3,
    apMax: 3,
    audiences: [],
    events: [],
    nextId: 1,
    nightStart: 1,
  };
}
