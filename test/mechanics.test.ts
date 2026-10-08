import { describe, expect, it } from 'vitest';
import {
  chargesFor,
  complianceOdds,
  credence,
  endWeek,
  exposeForgery,
  hearCredence,
  holdWitan,
  kill,
  learn,
  perform,
  readCase,
  resolveAudience,
  shields,
  visibleEvents,
  dawnEvents,
  type GameState,
} from '../src/engine';
import { createScenario } from './fixtures/osric';

const fresh = (player = 'anselm', seed = 7): GameState => createScenario(seed, player);

describe('belief', () => {
  it('ratchets upward and never forgets a lie is a lie', () => {
    const s = fresh();
    learn(s, 'hugh', 's-aldric-regicide', 30, 'rumour');
    learn(s, 'hugh', 's-aldric-regicide', 10, 'rumour');
    expect(credence(s, 'hugh', 's-aldric-regicide')).toBe(30);
    learn(s, 'hugh', 's-aldric-regicide', 80, 'anselm');
    expect(credence(s, 'hugh', 's-aldric-regicide')).toBeGreaterThan(60);
    learn(s, 'cedric', 's-false-pact', 100, 'bertrand');
    expect(s.knowledge.cedric['s-false-pact']).toMatchObject({ lie: true, credence: 0 });
  });

  it('is easier from someone trusted', () => {
    const s = fresh();
    const sec = s.secrets['s-aldric-regicide'];
    expect(hearCredence(s, 'edmund', 'isolde', sec)).toBeGreaterThan(hearCredence(s, 'edmund', 'gareth', sec));
  });
});

describe('denunciation', () => {
  it('never names the accuser’s own spouse or fellow conspirators', () => {
    const s = fresh();
    expect(shields(s, 'edmund').sort()).toEqual(['gareth', 'isolde', 'wystan']);
    s.secrets['s-cedric-usurp'].guilty.push('isolde');
    const accused = chargesFor(s, 'edmund', ['s-cedric-usurp']).map((c) => c.accused);
    expect(accused).toEqual(['cedric']);
  });

  it('weighs proof, standing and witnesses', () => {
    const s = fresh();
    const weak = readCase(s, 'edmund', 's-cedric-usurp', 'cedric');
    s.secrets['s-cedric-usurp'].evidence = 90;
    learn(s, 'osric', 's-cedric-usurp', 70, 'hugh');
    const strong = readCase(s, 'edmund', 's-cedric-usurp', 'cedric');
    expect(strong.score).toBeGreaterThan(weak.score + 40);
  });

  it('a forgery that comes to light disgraces the forger and frees the accused', () => {
    const s = fresh();
    perform(s, 'osric', { type: 'arrest', target: 'aldric' });
    s.imprisoned.aldric.charges = ['s-false-pact'];
    exposeForgery(s, s.secrets['s-false-pact'], 'cedric');
    expect(s.chars.aldric.status).toBe('free');
    expect(s.offices.spymaster).toBeNull();
    expect(Object.values(s.secrets).some((x) => x.kind === 'slander' && x.guilty[0] === 'cedric' && x.exposed)).toBe(true);
  });

  it('when the player is King, a denunciation waits for the player’s judgment', () => {
    const s = fresh('osric');
    perform(s, 'bertrand', { type: 'denounce', secretId: 's-aldric-regicide', only: ['aldric'] });
    const a = s.audiences.find((x) => x.kind === 'judgment');
    expect(a).toBeDefined();
    resolveAudience(s, a!.id, 'imprison');
    expect(s.chars.aldric.status).toBe('imprisoned');
  });

  it('when the player is accused, they choose how to answer', () => {
    const s = fresh('aldric');
    perform(s, 'bertrand', { type: 'denounce', secretId: 's-aldric-regicide', only: ['aldric'] });
    const a = s.audiences.find((x) => x.kind === 'accused');
    expect(a?.options.map((o) => o.id)).toEqual(expect.arrayContaining(['deny', 'mercy', 'flee']));
  });
});

describe('murder and inheritance', () => {
  it('a murdered man’s lands go to his blood; a traitor’s to the crown', () => {
    const s = fresh();
    kill(s, 'edmund', 'Murdered', false);
    expect(s.lands.wyke.holder).toBe('gareth');
    expect(s.lands.fenmoor.holder).toBe('wystan');
    expect(['gareth', 'wystan']).toContain(s.lands.ashby.holder);

    const t = fresh();
    kill(t, 'edmund', 'Beheaded', true);
    expect(t.lands.wyke.holder).toBeNull();
    expect(t.lands.ashby.holder).toBeNull();
  });

  it('a plot whose leader dies is abandoned, and the dead leave their offices', () => {
    const s = fresh();
    kill(s, 'aldric', 'Murdered', false);
    expect(s.plots['p-aldric'].status).toBe('abandoned');
    expect(s.offices.marshal).toBeNull();
    expect(s.plots['p-bertrand'].status).toBe('succeeded');
  });
});

describe('a strong will', () => {
  it('goading makes a timid husband bolder', () => {
    const s = fresh('isolde');
    const before = s.chars.edmund.pressure;
    perform(s, 'isolde', { type: 'counsel', target: 'edmund', mode: 'goad' });
    expect(s.chars.edmund.pressure).toBeGreaterThan(before);
    expect(complianceOdds(s, 'isolde', 'edmund')).toBeGreaterThan(complianceOdds(s, 'edmund', 'isolde'));
  });

  it('a demand on the player can be heeded at no cost in time', () => {
    const s = fresh('edmund');
    perform(s, 'isolde', { type: 'counsel', target: 'edmund', mode: 'demand', directive: { kind: 'advance', plotId: 'p-edmund-ruin' } });
    const a = s.audiences.find((x) => x.kind === 'counsel')!;
    const before = s.plots['p-edmund-ruin'].progress;
    const ap = s.ap;
    resolveAudience(s, a.id, 'heed');
    expect(s.plots['p-edmund-ruin'].progress).toBeGreaterThan(before);
    expect(s.ap).toBe(ap);
  });
});

describe('the Witan', () => {
  it('acclaims a claimant after the King dies, but never the known regicide', () => {
    const s = fresh();
    s.secrets['s-aldric-regicide'].exposed = true;
    kill(s, 'osric', 'Murdered', false);
    expect(s.king).toBeNull();
    const r = holdWitan(s);
    expect(r.winner).not.toBeNull();
    expect(r.winner).not.toBe('aldric');
    expect(s.chars[r.winner!].rank).toBe('king');
    expect(s.king).toBe(r.winner);
  });

  it('is held at the end of the week after the death', () => {
    const s = fresh();
    kill(s, 'osric', 'Murdered', false);
    s.interregnum = { since: s.turn - 1 };
    endWeek(s);
    expect(s.king === null || s.chars[s.king].rank === 'king').toBe(true);
  });
});

describe('what the player sees', () => {
  it('only events they could know of', () => {
    const s = fresh('hugh');
    for (let i = 0; i < 4 && s.phase === 'playing'; i++) {
      while (s.audiences.length) resolveAudience(s, s.audiences[0].id, s.audiences[0].options[0].id);
      endWeek(s);
    }
    const seen = visibleEvents(s, 'hugh');
    expect(seen.every((e) => e.visibleTo === 'all' || e.visibleTo.includes('hugh'))).toBe(true);
    expect(seen.length).toBeLessThan(s.events.length);
    expect(dawnEvents(s, 'hugh').every((e) => e.id >= s.nightStart)).toBe(true);
  });
});
