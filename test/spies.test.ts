import { describe, expect, it } from 'vitest';
import {
  accessTo,
  alreadyJudged,
  recruitedSpies,
  addMod,
  answerCaughtSpy,
  caught,
  check,
  createPlot,
  credence,
  exposeForgery,
  generateCourt,
  hookProblem,
  houseTier,
  joinPlot,
  kill,
  learn,
  makeSecret,
  perform,
  recruitSpy,
  runSpies,
  secretMatters,
  type GameState,
  type Spy,
} from '../src/engine';
import { createScenario } from './fixtures/osric';

/** A generated court, with a lord who keeps a maid and the player introduced to her. */
function court(): { s: GameState; lord: string; maid: string } {
  for (let seed = 1; seed < 80; seed++) {
    const s = generateCourt(seed);
    for (const h of Object.values(s.houses)) {
      if (!h.head || h.head === s.player || h.rank === 'royal' || h.rank === 'church') continue;
      const maid = h.members.find((m) => s.chars[m].role === 'maid');
      if (!maid) continue;
      s.known[maid] = 3;
      s.known[h.head] = 3;
      return { s, lord: h.head, maid };
    }
  }
  throw new Error('no lord with a maid');
}

/** Recruit until it takes (the odds are a roll). */
function plant(s: GameState, agent: string, mark: string): Spy {
  s.chars[s.player].gold = 1000;
  addMod(s, agent, s.player, 'friend', 'Friendly', 30);
  for (let i = 0; i < 60 && !recruitedSpies(s, s.player).length; i++) recruitSpy(s, s.player, agent, mark, 'gold', 8);
  const sp = recruitedSpies(s, s.player)[0];
  if (!sp) throw new Error('never recruited');
  return sp;
}

describe('recruiting a spy', () => {
  it('needs someone close to the mark', () => {
    const { s, lord, maid } = court();
    expect(accessTo(s, maid, lord)).toBe('household');
    const stranger = s.order.find((id) => id !== lord && id !== maid && !accessTo(s, id, lord) && s.chars[id].status === 'free')!;
    expect(accessTo(s, stranger, lord)).toBeNull();
    expect(check(s, s.player, { type: 'plant', target: maid, mark: s.player, hook: 'gold', wage: 4 })).toMatch(/cannot get close/);
  });

  it('a wage is paid two weeks in hand, then weekly', () => {
    const { s, lord, maid } = court();
    const sp = plant(s, maid, lord);
    expect(sp.wage).toBe(8);
    const gold = s.chars[s.player].gold;
    s.chars[lord].traits.paranoia = 0;
    s.chars[lord].traits.cunning = 0;
    runSpies(s);
    if (sp.status === 'active') expect(s.chars[s.player].gold).toBe(gold - 8);
  });

  it('devotion and grudges cost nothing, but only where they are real', () => {
    const { s, lord, maid } = court();
    expect(hookProblem(s, s.player, maid, lord, 'devotion', 0)).toMatch(/devoted/);
    addMod(s, maid, s.player, 'adores', 'Adores him', 60);
    expect(hookProblem(s, s.player, maid, lord, 'devotion', 0)).toBeNull();
    expect(hookProblem(s, s.player, maid, lord, 'grudge', 0)).toMatch(/grudge/);
    addMod(s, maid, lord, 'hates', 'Hates him', -60);
    expect(hookProblem(s, s.player, maid, lord, 'grudge', 0)).toBeNull();
  });
});

describe('a spy at work', () => {
  it('brings back the mark’s own schemes', () => {
    const { s, lord, maid } = court();
    const sp = plant(s, maid, lord);
    s.chars[lord].traits.paranoia = 0;
    s.chars[lord].traits.cunning = 0;
    s.chars[maid].traits.cunning = 90;
    const p = createPlot(s, lord, 'murder', [s.order.find((id) => id !== lord && id !== s.player && id !== maid && s.chars[id].status === 'free' && s.chars[id].rank !== 'servant')!]);
    for (let w = 0; w < 30 && credence(s, s.player, p.secretId) === 0; w++) runSpies(s);
    expect(credence(s, s.player, p.secretId)).toBeGreaterThan(0);
    expect(s.knowledge[s.player][p.secretId].source).toBe(maid);
    expect(sp.reports).toBeGreaterThan(0);
  });

  it('a turned spy carries lies in the same voice, until a forgery comes to light', () => {
    const { s, lord, maid } = court();
    const sp = plant(s, maid, lord);
    sp.turnedBy = lord;
    for (let w = 0; w < 30 && !Object.values(s.secrets).some((x) => !x.truth && x.fabricatedBy === lord); w++) runSpies(s);
    const lie = Object.values(s.secrets).find((x) => !x.truth && x.fabricatedBy === lord)!;
    expect(lie).toBeDefined();
    expect(s.knowledge[s.player][lie.id].source).toBe(maid);
    expect(s.knowledge[s.player][lie.id].lie).toBeFalsy();
    exposeForgery(s, lie, s.player);
    expect(sp.status).toBe('ended');
  });

  it('caught in your house: you may turn them, and your forgeries travel', () => {
    const { s, lord } = court();
    const mine = s.chars[s.player].householdId;
    const agent = s.houses[mine].members.find((m) => s.chars[m].rank === 'servant')!;
    const sp: Spy = { id: 'sp-test', agent, master: lord, mark: s.player, hook: 'gold', wage: 0, since: 1, status: 'active', reports: 0 };
    s.spies[sp.id] = sp;
    caught(s, sp);
    const a = s.audiences.find((x) => x.kind === 'caught-spy')!;
    expect(a).toBeDefined();
    answerCaughtSpy(s, sp.id, true, 'turn');
    expect(sp.turnedBy).toBe(s.player);
    const lie = makeSecret(s, { kind: 'regicide', guilty: [s.order.find((id) => id !== lord && id !== s.player && s.chars[id].rank === 'great')!], victims: [s.king!], truth: false, fabricatedBy: s.player, evidence: 40 });
    learn(s, s.player, lie.id, 0, 'self', true);
    for (let w = 0; w < 30 && credence(s, lord, lie.id) === 0; w++) runSpies(s);
    expect(credence(s, lord, lie.id)).toBeGreaterThan(0);
  });
});

describe('turning informer', () => {
  it('a sworn member may lay the plot before the King, and leaves it whatever he decides', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createScenario(seed, 'anselm');
      const p = createPlot(s, 'cedric', 'murder', ['osric']);
      joinPlot(s, p, 'anselm', true);
      s.plots[p.id].progress = 60;
      expect(check(s, 'anselm', { type: 'denounce', secretId: p.secretId })).toBeNull();
      const r = perform(s, 'anselm', { type: 'denounce', secretId: p.secretId });
      expect(p.members.some((m) => m.id === 'anselm')).toBe(false);
      expect(s.secrets[p.secretId].guilty).not.toContain('anselm');
      if (r.ok) {
        expect(r.text).toMatch(/pardoned/);
        expect(p.status).toBe('foiled');
        return;
      }
    }
    throw new Error('the King never believed an informer');
  });
});

describe('the double-cross', () => {
  it('the leader of a scheme may draw a man in, then hand him to the King', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createScenario(seed, 'anselm');
      const p = createPlot(s, 'anselm', 'murder', ['osric']);
      joinPlot(s, p, 'gareth', true);
      s.plots[p.id].progress = 50;
      expect(check(s, 'anselm', { type: 'denounce', secretId: p.secretId })).toBeNull();
      const r = perform(s, 'anselm', { type: 'denounce', secretId: p.secretId });
      expect(p.status).not.toBe('active');
      if (!r.ok) continue;
      expect(r.text).toMatch(/pardoned/);
      expect(s.chars.gareth.status).not.toBe('free');
      expect(alreadyJudged(s, s.secrets[p.secretId], 'anselm')).toBe(true);
      return;
    }
    throw new Error('the King never believed the leader');
  });
});

describe('the dead and the done', () => {
  it('a secret about the dead is old news, and cannot be whispered', () => {
    const s = createScenario(7, 'anselm');
    const sec = s.secrets['s-aldric-regicide'];
    learn(s, 'anselm', sec.id, 80, 'rumour');
    expect(secretMatters(s, sec)).toBe(true);
    kill(s, 'aldric', 'Died', false);
    expect(secretMatters(s, sec)).toBe(false);
    expect(check(s, 'anselm', { type: 'whisper', target: 'hugh', secretId: sec.id })).toMatch(/old news/);
  });
});

describe('houses rise and fall', () => {
  it('a minor lord with a great office and some name stands among the great', () => {
    const s = generateCourt(5);
    const h = s.houses[s.chars[s.player].householdId];
    expect(houseTier(s, h)).toBe('lesser');
    s.offices.marshal = s.player;
    s.chars[s.player].prestige = 33;
    expect(houseTier(s, h)).toBe('great');
  });
});
