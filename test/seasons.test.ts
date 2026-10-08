import { describe, expect, it } from 'vitest';
import { evaluate, type GameState } from '../src/engine';
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
    if (c.spouse) expect(s.chars[c.spouse].spouse).toBe(c.id);
  }
  for (const p of Object.values(s.plots)) {
    if (p.status === 'active') expect(['free', 'imprisoned']).toContain(s.chars[p.owner].status);
  }
  for (const h of Object.values(s.houses)) if (h.head) expect(['free', 'imprisoned']).toContain(s.chars[h.head].status);
  expect(s.ap).toBeGreaterThanOrEqual(0);
}

describe('generated courts over time', () => {
  it('the same seed and the same choices tell the same story', () => {
    const a = autopilotSeason(42, 30);
    const b = autopilotSeason(42, 30);
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
    const c = autopilotSeason(43, 30);
    expect(c.events.map((e) => e.text)).not.toEqual(a.events.map((e) => e.text));
  });

  it.each([3, 17, 101, 202, 303, 404])('court %i survives forty weeks of random choices without breaking', (seed) => {
    const s = randomSeason(seed, 40, invariants);
    expect(s.turn > 1 || s.phase === 'ended').toBe(true);
    for (const id of s.order) expect(evaluate(s, id).score).toBeGreaterThanOrEqual(0);
  });

  it('is open-ended: no season limit, and the court stays populated', () => {
    const s = autopilotSeason(9, 80);
    expect(s.maxTurns).toBe(0);
    if (s.phase === 'playing') expect(s.turn).toBeGreaterThan(80);
    const living = s.order.filter((id) => s.chars[id].status === 'free' && s.chars[id].rank !== 'servant');
    expect(living.length).toBeGreaterThanOrEqual(10);
  });

  it('different seeds give different courts and different stories', () => {
    const kings = new Set<string>();
    const houses = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const s = autopilotSeason(seed, 40);
      kings.add(s.king ? s.chars[s.king].archetype ?? '?' : 'none');
      for (const h of Object.values(s.houses)) houses.add(h.name);
    }
    expect(kings.size).toBeGreaterThanOrEqual(3);
    expect(houses.size).toBeGreaterThanOrEqual(15);
  });
});
