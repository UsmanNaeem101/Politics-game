import { describe, expect, it } from 'vitest';
import { PLAYABLE, evaluate, type GameState } from '../src/engine';
import { autopilotSeason, randomSeason } from './helpers';

function invariants(s: GameState) {
  if (s.king) expect(s.chars[s.king].status, `king ${s.king} must be alive`).not.toBe('dead');
  for (const [office, holder] of Object.entries(s.offices)) {
    if (holder) expect(['free', 'imprisoned'], `${office} held by ${holder}`).toContain(s.chars[holder].status);
  }
  for (const id of Object.keys(s.imprisoned)) expect(s.chars[id].status).toBe('imprisoned');
  for (const c of Object.values(s.chars)) {
    if (c.status === 'imprisoned') expect(s.imprisoned[c.id], `${c.id} has a prison record`).toBeDefined();
    expect(c.gold).toBeGreaterThanOrEqual(0);
  }
  for (const p of Object.values(s.plots)) {
    if (p.status === 'active') expect(['free', 'imprisoned']).toContain(s.chars[p.owner].status);
  }
  expect(s.ap).toBeGreaterThanOrEqual(0);
}

describe('whole seasons', () => {
  it('the same seed and the same choices tell the same story', () => {
    const a = autopilotSeason(42, 'edmund');
    const b = autopilotSeason(42, 'edmund');
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
    const c = autopilotSeason(43, 'edmund');
    expect(c.events.map((e) => e.text)).not.toEqual(a.events.map((e) => e.text));
  });

  it.each(PLAYABLE)('%s can play to the end with random choices without breaking the court', (who) => {
    for (const seed of [3, 17, 101]) {
      const s = randomSeason(seed, who, invariants);
      expect(s.phase).toBe('ended');
      expect(s.ending).toBeDefined();
      expect(['triumph', 'victory', 'survival', 'defeat', 'death']).toContain(s.ending!.result.verdict);
      for (const id of s.order) expect(evaluate(s, id).score).toBeGreaterThanOrEqual(0);
    }
  });

  it('the court produces varied stories across seeds', () => {
    const kings = new Set<string>();
    const firstDead = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = autopilotSeason(seed, 'anselm');
      kings.add(s.king ?? 'none');
      const dead = s.order.filter((id) => s.chars[id].status === 'dead').sort((a, b) => (s.chars[a].statusTurn ?? 0) - (s.chars[b].statusTurn ?? 0));
      if (dead[0]) firstDead.add(dead[0]);
    }
    expect(kings.size).toBeGreaterThanOrEqual(3);
    expect(firstDead.size).toBeGreaterThanOrEqual(3);
  });
});
