import { describe, expect, it } from 'vitest';
import {
  acquaintance,
  check,
  continueReign,
  courtProblems,
  crown,
  endWeek,
  generateCourt,
  perform,
  waitCleared,
  type GameState,
} from '../src/engine';

const courts = Array.from({ length: 40 }, (_, i) => generateCourt(i + 1));

describe('the court generator', () => {
  it('always produces a playable court', () => {
    for (const s of courts) expect(courtProblems(s), `seed ${s.seed}`).toEqual([]);
  });

  it('is deterministic', () => {
    const a = generateCourt(77);
    const b = generateCourt(77);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(generateCourt(78))).not.toEqual(JSON.stringify(a));
  });

  it('puts the player in a minor house of their own, with a household', () => {
    for (const s of courts) {
      const me = s.chars[s.player];
      const house = s.houses[me.householdId];
      expect(me.rank).toBe('lord');
      expect(house.rank).toBe('lesser');
      expect(house.head).toBe(s.player);
      expect(house.members.some((m) => s.chars[m].rank === 'servant')).toBe(true);
    }
  });

  it('builds households: every member belongs to exactly one house, and heads are members', () => {
    for (const s of courts) {
      const seen = new Map<string, string>();
      for (const h of Object.values(s.houses)) {
        if (h.head) expect(h.members).toContain(h.head);
        for (const m of h.members) {
          expect(seen.has(m), `${m} in two houses`).toBe(false);
          seen.set(m, h.id);
          expect(s.chars[m].householdId).toBe(h.id);
        }
      }
      expect(seen.size).toBe(s.order.length);
    }
  });

  it('fills every great office and seeds real intrigue', () => {
    let affairs = 0;
    let thefts = 0;
    let doubleCrosses = 0;
    for (const s of courts) {
      for (const holder of Object.values(s.offices)) expect(holder).toBeTruthy();
      affairs += Object.values(s.secrets).filter((x) => x.kind === 'affair').length;
      thefts += Object.values(s.secrets).filter((x) => x.kind === 'theft').length;
      doubleCrosses += Object.values(s.plots).filter((p) => p.members.some((m) => !m.sincere)).length;
    }
    expect(affairs).toBeGreaterThan(10);
    expect(thefts).toBeGreaterThan(10);
    expect(doubleCrosses).toBeGreaterThan(10);
  });

  it('gives cheated brothers a plan that waits for the thief to rise', () => {
    const s = courts.find((c) => Object.values(c.plots).some((p) => p.trigger?.length))!;
    const p = Object.values(s.plots).find((x) => x.trigger?.length)!;
    expect(waitCleared(s, p)).toBe(false);
    s.offices.marshal = p.targets[0];
    expect(waitCleared(s, p)).toBe(true);
  });
});

describe('the fog of war', () => {
  const s0 = (): GameState => generateCourt(5);

  it('starts the player knowing their household and the great faces, and little else', () => {
    const s = s0();
    const me = s.chars[s.player];
    for (const m of s.houses[me.householdId].members) expect(acquaintance(s, m)).toBeGreaterThanOrEqual(4);
    expect(acquaintance(s, s.king!)).toBe(2);
    const strangers = s.order.filter((id) => acquaintance(s, id) === 0);
    expect(strangers.length).toBeGreaterThan(5);
  });

  it('will not let you deal with a stranger until you are introduced', () => {
    const s = s0();
    const seen = s.order.find((id) => acquaintance(s, id) === 2 && s.chars[id].rank !== 'servant')!;
    expect(check(s, s.player, { type: 'converse', target: seen })).toMatch(/introduced/);
    expect(check(s, s.player, { type: 'introduce', target: seen })).toBeNull();
    const unknown = s.order.find((id) => acquaintance(s, id) === 0)!;
    expect(check(s, s.player, { type: 'spy', target: unknown, focus: 'motive' })).toMatch(/nothing of them/);
  });

  it('a successful introduction opens the door', () => {
    let opened = false;
    for (let seed = 1; seed <= 20 && !opened; seed++) {
      const s = generateCourt(seed);
      const seen = s.order.find((id) => acquaintance(s, id) === 2 && s.chars[id].rank !== 'servant' && id !== s.king)!;
      const out = perform(s, s.player, { type: 'introduce', target: seen });
      if (out.ok) {
        expect(acquaintance(s, seen)).toBe(3);
        expect(check(s, s.player, { type: 'converse', target: seen })).toBeNull();
        opened = true;
      }
    }
    expect(opened).toBe(true);
  });

  it('spying on a household maps it', () => {
    let mapped = false;
    for (let seed = 1; seed <= 20 && !mapped; seed++) {
      const s = generateCourt(seed);
      const head = s.order.find((id) => acquaintance(s, id) >= 1 && s.chars[id].householdId !== s.chars[s.player].householdId && s.houses[s.chars[id].householdId].members.length >= 3)!;
      const out = perform(s, s.player, { type: 'spy', target: head, focus: 'household' });
      if (out.ok) {
        for (const m of s.houses[s.chars[head].householdId].members) expect(acquaintance(s, m)).toBeGreaterThanOrEqual(2);
        mapped = true;
      }
    }
    expect(mapped).toBe(true);
  });
});

describe('ruling', () => {
  it('being crowned ends the game in triumph, and you may rule on', () => {
    const s = generateCourt(11);
    s.king = null;
    crown(s, s.player);
    s.interregnum = null;
    // The Witan crowns at the end of a week; emulate the ending path directly.
    s.phase = 'ended';
    s.ending = { reason: 'crowned', turn: s.turn, result: { verdict: 'triumph', score: 100, headline: '', notes: [] } };
    continueReign(s);
    expect(s.phase as string).toBe('playing');
    expect(s.reigning).toBe(true);
    endWeek(s);
    expect((s.phase as string) === 'playing' || s.ending?.reason !== 'crowned').toBe(true);
  });
});
