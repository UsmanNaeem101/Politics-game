import { describe, expect, it } from 'vitest';
import { addMod, createPlot, credence, heardFeeling, insightOf, learn, tableTalk, talkChance, type GameState } from '../src/engine';
import { createScenario } from './fixtures/osric';

const fresh = (seed = 7): GameState => createScenario(seed, 'anselm');
const talkUntil = (s: GameState, target: string, done: () => boolean, tries = 300) => {
  for (let i = 0; i < tries && !done(); i++) tableTalk(s, 'anselm', target);
  return done();
};

describe('keeping company', () => {
  it('a friend says more than a stranger', () => {
    const s = fresh();
    const cold = talkChance(s, 'anselm', 'hugh');
    addMod(s, 'hugh', 'anselm', 'friend', 'Old friends', 40);
    expect(talkChance(s, 'anselm', 'hugh')).toBeGreaterThan(cold);
  });

  it('a friend warns you of a plot against you', () => {
    const s = fresh();
    const p = createPlot(s, 'cedric', 'murder', ['anselm']);
    learn(s, 'hugh', p.secretId, 80, 'rumour');
    addMod(s, 'hugh', 'anselm', 'friend', 'Old friends', 40);
    expect(talkUntil(s, 'hugh', () => credence(s, 'anselm', p.secretId) > 0)).toBe(true);
    expect(s.knowledge.anselm[p.secretId].source).toBe('hugh');
  });

  it('never gives away their own secrets, their spouse’s or their kin’s', () => {
    const s = fresh();
    addMod(s, 'aldric', 'anselm', 'friend', 'Old friends', 60);
    const own = Object.values(s.secrets).filter((x) => x.guilty.includes('aldric'));
    for (let i = 0; i < 300; i++) tableTalk(s, 'anselm', 'aldric');
    // A careless word may leave you half suspecting, never told.
    for (const sec of own) {
      expect(s.knowledge.anselm?.[sec.id]?.source).not.toBe('aldric');
      if (s.knowledge.anselm?.[sec.id]?.source === 'rumour') expect(credence(s, 'anselm', sec.id)).toBeLessThanOrEqual(35);
    }
  });

  it('an ambition spoken freely is a design uncovered', () => {
    const s = fresh();
    s.chars.hugh.agenda = { kind: 'rise', targets: [], summary: 'An office, and the King’s ear.' };
    addMod(s, 'hugh', 'anselm', 'friend', 'Old friends', 40);
    expect(talkUntil(s, 'hugh', () => insightOf(s, 'anselm').agendas.includes('hugh'))).toBe(true);
    expect(s.known.hugh).toBe(5);
  });

  it('you hear whom they cannot abide', () => {
    const s = fresh();
    addMod(s, 'hugh', 'anselm', 'friend', 'Old friends', 40);
    addMod(s, 'hugh', 'bertrand', 'loathing', 'Loathes him', -70);
    expect(talkUntil(s, 'hugh', () => heardFeeling(s, 'anselm', 'hugh', 'bertrand'))).toBe(true);
  });
});
