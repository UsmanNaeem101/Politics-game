import { describe, expect, it } from 'vitest';
import {
  BUSINESSES,
  businessesOf,
  check,
  createPlot,
  disgrace,
  estateOf,
  generateCourt,
  incomeOf,
  kill,
  learn,
  openBusiness,
  opinion,
  perform,
  repairSave,
  runBusinesses,
  standingOf,
  strikeChance,
  type GameState,
} from '../src/engine';

/** A court with the player's own trade removed, to measure one trade at a time. */
function bare(seed = 5): GameState {
  const s = generateCourt(seed);
  for (const b of businessesOf(s, s.player)) delete s.businesses[b.id];
  return s;
}

const noble = (s: GameState) => s.order.find((id) => id !== s.player && estateOf(s, id) === 'nobility' && s.chars[id].status === 'free' && s.chars[id].householdId !== s.chars[s.player].householdId)!;
const priest = (s: GameState) => s.order.find((id) => estateOf(s, id) === 'church')!;

describe('trades at court', () => {
  it('every court gives the player a trade, the great houses theirs, and hides a few rackets', () => {
    let rackets = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = generateCourt(seed);
      expect(businessesOf(s, s.player)).toHaveLength(1);
      for (const h of Object.values(s.houses)) if (h.rank === 'great' && h.head) expect(businessesOf(s, h.head).length).toBe(1);
      for (const b of Object.values(s.businesses)) {
        if (!BUSINESSES[b.kind].illicit) continue;
        rackets++;
        const sec = s.secrets[b.secretId!];
        expect(sec.kind).toBe('racket');
        expect(sec.guilty).toEqual([b.owner]);
        expect(s.knowledge[b.owner][sec.id].credence).toBe(100);
      }
    }
    expect(rackets).toBeGreaterThan(5);
  });

  it('lets the player choose a trade without reshuffling the rest of the court', () => {
    const a = generateCourt(11, { trade: 'smuggling' });
    const b = generateCourt(11, { trade: 'wool' });
    expect(businessesOf(a, a.player)[0].kind).toBe('smuggling');
    expect(businessesOf(b, b.player)[0].kind).toBe('wool');
    expect(a.order.map((id) => a.chars[id].name)).toEqual(b.order.map((id) => b.chars[id].name));
  });

  it('pays a weekly income on top of the land', () => {
    const s = bare();
    const land = incomeOf(s, s.player);
    openBusiness(s, s.player, 'moneylending');
    expect(incomeOf(s, s.player)).toBe(land + BUSINESSES.moneylending.income);
  });

  it('colours how each part of society regards the owner', () => {
    const s = bare();
    const P = s.player;
    const lord = noble(s);
    const before = opinion(s, lord, P);
    const estates = openBusiness(s, P, 'estates');
    expect(opinion(s, lord, P)).toBe(before + 8);
    delete s.businesses[estates.id];
    openBusiness(s, P, 'moneylending');
    expect(opinion(s, lord, P)).toBe(before - 8);
    expect(standingOf(s, P, 'church')).toBe(-12);
  });

  it('a racket costs nothing with those who do not know of it, and a great deal with those who do', () => {
    const s = bare();
    const P = s.player;
    const father = priest(s);
    const before = opinion(s, father, P);
    const b = openBusiness(s, P, 'bathhouse');
    expect(opinion(s, father, P)).toBe(before);
    learn(s, father, b.secretId!, 80, 'rumour');
    expect(opinion(s, father, P)).toBe(before - 20);
    expect(standingOf(s, P, 'church')).toBe(0);
    expect(standingOf(s, P, 'church', true)).toBe(-20);
  });
});

describe('trade deeds', () => {
  it('setting up costs gold and a trade; you may run two at most', () => {
    const s = bare();
    const P = s.player;
    s.chars[P].gold = 500;
    perform(s, P, { type: 'invest', kind: 'wool' });
    expect(s.chars[P].gold).toBe(500 - BUSINESSES.wool.cost);
    expect(businessesOf(s, P).map((b) => b.kind)).toEqual(['wool']);
    s.ap = 3;
    expect(check(s, P, { type: 'invest', kind: 'wool' })).toMatch(/already/);
    perform(s, P, { type: 'invest', kind: 'wine' });
    s.ap = 3;
    expect(check(s, P, { type: 'invest', kind: 'estates' })).toMatch(/no more than 2/);
  });

  it('a tax farm needs the King’s favour', () => {
    const s = bare();
    s.chars[s.player].gold = 500;
    expect(check(s, s.player, { type: 'invest', kind: 'taxfarm' })).toMatch(/favours/);
  });

  it('selling returns half the cost', () => {
    const s = bare();
    const P = s.player;
    const b = openBusiness(s, P, 'mill');
    const gold = s.chars[P].gold;
    perform(s, P, { type: 'divest', businessId: b.id });
    expect(s.chars[P].gold).toBe(gold + BUSINESSES.mill.cost / 2);
    expect(s.businesses[b.id]).toBeUndefined();
  });

  it('a racket proven before the King is shut down', () => {
    const s = bare();
    const lord = noble(s);
    const b = openBusiness(s, lord, 'gambling');
    disgrace(s, lord, s.secrets[b.secretId!]);
    expect(s.businesses[b.id]).toBeUndefined();
    expect(s.secrets[b.secretId!].exposed).toBe(true);
  });

  it('passes to whoever heads the house when the owner dies', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = generateCourt(seed);
      const lord = Object.values(s.houses).find((h) => h.rank === 'lesser' && h.head && h.head !== s.player && s.chars[h.head].siblings.some((b) => s.chars[b].status === 'free'))?.head;
      if (!lord) continue;
      for (const b of businessesOf(s, lord)) delete s.businesses[b.id];
      const b = openBusiness(s, lord, 'wine');
      kill(s, lord, 'Died', false);
      runBusinesses(s);
      const heir = s.houses[s.chars[lord].householdId].head!;
      expect(heir).not.toBe(lord);
      expect(s.businesses[b.id].owner).toBe(heir);
      return;
    }
    throw new Error('no court with a lord and a living brother');
  });
});

describe('what a trade gives you for intrigue', () => {
  it('smugglers’ cutthroats strike surer', () => {
    const s = bare();
    const P = s.player;
    const p = createPlot(s, P, 'murder', [noble(s)]);
    p.progress = 50;
    const before = strikeChance(s, p);
    openBusiness(s, P, 'smuggling');
    expect(strikeChance(s, p)).toBeGreaterThan(before);
  });
});

describe('an old save', () => {
  it('without trades gets them on load', () => {
    const s = generateCourt(9);
    (s as Partial<GameState>).businesses = undefined;
    repairSave(s);
    expect(businessesOf(s, s.player)).toHaveLength(1);
    expect(Object.keys(s.businesses).length).toBeGreaterThan(3);
  });
});
