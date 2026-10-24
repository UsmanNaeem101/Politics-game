import { describe, expect, it } from 'vitest';
import {
  addMod,
  becomeLovers,
  calendar,
  check,
  credence,
  dateLabel,
  endWeek,
  generateCourt,
  kill,
  livingSpouse,
  loversOf,
  nightOdds,
  perform,
  runTails,
  seduceOdds,
  seduceParts,
  setTail,
  type GameState,
} from '../src/engine';

/** A married lady at court, not the player's kin, whom the player has met. */
function lady(s: GameState): { wife: string; husband: string } {
  for (const id of s.order) {
    const c = s.chars[id];
    if (c.gender !== 'f' || !c.spouse || c.spouse === s.player || c.rank === 'queen' || c.status !== 'free' || c.rank === 'child') continue;
    if (s.chars[c.spouse].status !== 'free' || c.householdId === s.chars[s.player].householdId) continue;
    s.known[id] = 3;
    s.known[c.spouse] = 3;
    return { wife: id, husband: c.spouse };
  }
  throw new Error('no lady');
}

describe('time', () => {
  it('a turn is a month, and a year is twelve of them', () => {
    expect(dateLabel(1)).toBe('March, Year 1');
    expect(calendar(13)).toMatchObject({ month: 'March', year: 2, season: 'Spring' });
    expect(calendar(10).season).toBe('Winter');
  });

  it('everyone ages and the old die; the player and his wife never die of it', () => {
    let s = generateCourt(3);
    for (let seed = 3; !s.chars[s.player].spouse; seed++) s = generateCourt(seed);
    const P = s.player;
    const wife = s.chars[P].spouse!;
    s.chars[P].age = 99;
    s.chars[wife].age = 99;
    const elders = s.order.filter((id) => id !== P && id !== wife && s.chars[id].status === 'free' && s.chars[id].rank !== 'child').slice(0, 3);
    for (const id of elders) s.chars[id].age = 99;
    const someone = s.order.find((id) => id !== P && !elders.includes(id) && s.chars[id].status === 'free' && s.chars[id].rank !== 'child')!;
    const age = s.chars[someone].age;
    for (let i = 0; i < 13 && s.phase === 'playing'; i++) {
      s.audiences = [];
      s.ap = 0;
      endWeek(s);
    }
    if (s.chars[someone].status !== 'dead') expect(s.chars[someone].age).toBe(age + 1);
    expect(elders.some((id) => /old age/.test(s.chars[id].fate ?? ''))).toBe(true);
    expect(s.chars[P].fate ?? '').not.toMatch(/old age/);
    expect(s.chars[wife].fate ?? '').not.toMatch(/old age/);
  });
});

describe('courting a lover', () => {
  it('any woman may be courted, but not your wife or your kin', () => {
    const s = generateCourt(5);
    const { wife } = lady(s);
    s.ap = 3;
    expect(check(s, s.player, { type: 'seduce', target: wife })).toBeNull();
    const mine = s.chars[s.player].spouse;
    if (mine) {
      s.known[mine] = 4;
      expect(check(s, s.player, { type: 'seduce', target: mine })).toMatch(/your wife/);
    }
  });

  it('a willing wife becomes your lover, and your spy on her husband', () => {
    const s = generateCourt(5);
    const { wife, husband } = lady(s);
    addMod(s, wife, s.player, 'friend', 'Fond of him', 80);
    addMod(s, wife, husband, 'cold', 'Cold', -60);
    s.chars[wife].traits.honor = 5;
    expect(seduceOdds(s, s.player, wife)).toBeGreaterThanOrEqual(70);
    let won = false;
    for (let i = 0; i < 10 && !won; i++) {
      s.ap = 3;
      s.relations[wife][s.player].mods = s.relations[wife][s.player].mods.filter((m) => m.key !== 'rebuffed');
      delete s.chars[wife].refused;
      won = perform(s, s.player, { type: 'seduce', target: wife }).ok;
    }
    expect(won).toBe(true);
    expect(loversOf(s, wife)).toContain(s.player);
    const spy = Object.values(s.spies).find((x) => x.affair && x.agent === wife && x.master === s.player);
    expect(spy?.mark).toBe(husband);
  });

  it('a widow is courted as a widow: no husband to love, or to tell', () => {
    const s = generateCourt(5);
    const { wife, husband } = lady(s);
    addMod(s, wife, husband, 'love', 'Loves him', 80);
    const married = seduceOdds(s, s.player, wife);
    kill(s, husband, 'Died', false);
    expect(livingSpouse(s, wife)).toBeUndefined();
    expect(s.chars[wife].spouse).toBe(husband);
    expect(seduceOdds(s, s.player, wife)).toBeGreaterThan(married);
    // A widow with little to live on looks kindly on a man who can keep her, and on what he settles on her.
    s.chars[wife].gold = 0;
    s.chars[s.player].gold = 200;
    expect(seduceOdds(s, s.player, wife, 50)).toBeGreaterThan(seduceOdds(s, s.player, wife, 0));
    expect(seduceParts(s, s.player, wife).some((p) => /in want/.test(p.label))).toBe(true);
    // Her honour still counts, but half as much: she has no vow to break.
    const honour = seduceParts(s, s.player, wife).find((p) => p.label.startsWith('Her honour'));
    if (honour) expect(honour.label).toMatch(/no vow/);
    s.chars[wife].traits.honor = 95;
    addMod(s, wife, s.player, 'dislike', 'Dislikes him', -60);
    s.ap = 3;
    const r = perform(s, s.player, { type: 'seduce', target: wife });
    expect(r.text).not.toMatch(/husband|told/);
  });

  it('turned away, she may tell her husband', () => {
    const s = generateCourt(5);
    const { wife, husband } = lady(s);
    s.chars[wife].traits.honor = 95;
    addMod(s, wife, s.player, 'dislike', 'Dislikes him', -60);
    s.ap = 3;
    const r = perform(s, s.player, { type: 'seduce', target: wife });
    expect(r.ok).toBe(false);
    expect(check(s, s.player, { type: 'seduce', target: wife })).toMatch(/answer/);
    // Three months on, he may try again, though she still thinks a little less of him.
    s.turn += 3;
    s.ap = 3;
    expect(check(s, s.player, { type: 'seduce', target: wife })).toBeNull();
    if (/told/.test(r.text)) expect(s.relations[husband][s.player].mods.some((m) => m.key === 'advances')).toBe(true);
  });
});

describe('having someone followed', () => {
  it('a month in their footsteps shows where they go and whom they love', () => {
    const s = generateCourt(6);
    const { wife } = lady(s);
    const lover = s.order.find((id) => s.chars[id].gender === 'm' && id !== s.player && s.chars[id].status === 'free' && s.chars[id].rank !== 'child' && s.chars[id].rank !== 'servant' && id !== s.chars[wife].spouse)!;
    const sec = becomeLovers(s, wife, lover);
    s.chars[wife].traits.paranoia = 0;
    s.chars[wife].traits.cunning = 0;
    s.chars[s.player].gold = 500;
    let seen = false;
    for (let i = 0; i < 12 && !seen; i++) {
      setTail(s, s.player, wife);
      runTails(s);
      seen = credence(s, s.player, sec.id) > 0;
    }
    expect(seen).toBe(true);
    const report = s.events.filter((e) => Array.isArray(e.visibleTo) && e.visibleTo.includes(s.player) && /followed/.test(e.text));
    expect(report.length).toBeGreaterThan(0);
    expect(report.some((e) => e.text.includes('slipped away'))).toBe(true);
  });

  it('a husband who follows his wife to her lover knows, and hates him for it', () => {
    const s = generateCourt(6);
    const { wife, husband } = lady(s);
    const sec = becomeLovers(s, wife, s.player);
    s.chars[wife].traits.paranoia = 0;
    s.chars[wife].traits.cunning = 0;
    s.chars[husband].gold = 500;
    for (let i = 0; i < 20 && credence(s, husband, sec.id) < 90; i++) {
      setTail(s, husband, wife);
      runTails(s);
    }
    expect(credence(s, husband, sec.id)).toBeGreaterThanOrEqual(90);
    expect(s.relations[husband][s.player].mods.some((m) => m.key === 'cuckold')).toBe(true);
  });
});

describe('a death in the night', () => {
  it('only under your own roof; done, it is a murder someone may suspect', () => {
    let s = generateCourt(7);
    for (let seed = 7; !s.chars[s.player].spouse; seed++) s = generateCourt(seed);
    const P = s.player;
    const wife = s.chars[P].spouse!;
    s.known[wife] = 4;
    const stranger = lady(s).wife;
    s.ap = 3;
    expect(check(s, P, { type: 'night-kill', target: stranger })).toMatch(/own roof/);
    expect(check(s, P, { type: 'night-kill', target: wife })).toBeNull();
    s.chars[wife].traits.paranoia = 0;
    expect(nightOdds(s, P, wife)).toBeGreaterThanOrEqual(80);
    let done = false;
    for (let i = 0; i < 6 && !done; i++) {
      s.ap = 3;
      if (check(s, P, { type: 'night-kill', target: wife })) break;
      done = perform(s, P, { type: 'night-kill', target: wife }).ok;
    }
    expect(done).toBe(true);
    expect(s.chars[wife].status).toBe('dead');
    const sec = Object.values(s.secrets).find((x) => x.kind === 'murder' && x.deed && x.guilty.includes(P) && x.victims.includes(wife))!;
    expect(sec).toBeDefined();
    // A widower may marry again from next month.
    s.ap = 3;
    expect(check(s, P, { type: 'propose' })).toMatch(/too soon/);
    s.turn++;
    expect(check(s, P, { type: 'propose' })).toBeNull();
  });
});

describe('a wife dines out', () => {
  /** A court where the player has a wife, and another lady whose husband has an aim. */
  function setup() {
    let s = generateCourt(11);
    for (let seed = 11; !s.chars[s.player].spouse; seed++) s = generateCourt(seed);
    const P = s.player;
    const wife = s.chars[P].spouse!;
    const { wife: lady, husband } = lady_(s);
    return { s, P, wife, lady, husband };
  }
  const lady_ = (s: GameState) => {
    for (const id of s.order) {
      const c = s.chars[id];
      if (c.gender !== 'f' || !c.spouse || c.spouse === s.player || c.rank === 'queen' || c.status !== 'free' || c.rank === 'child') continue;
      if (s.chars[c.spouse].status !== 'free') continue;
      s.known[id] = 2;
      return { wife: id, husband: c.spouse };
    }
    throw new Error('no lady');
  };

  it('she brings home what the hostess lets fall, and you meet that house', () => {
    const { s, P, wife, lady, husband } = setup();
    s.chars[wife].traits.charm = 90;
    addMod(s, lady, wife, 'friends', 'Friends', 60);
    addMod(s, lady, husband, 'cold', 'Cold', -60);
    addMod(s, wife, P, 'love', 'Loves him', 60);
    let news = false;
    for (let i = 0; i < 12 && !news; i++) {
      s.ap = 3;
      s.turn++;
      const r = perform(s, P, { type: 'dine', target: lady });
      news = r.ok && /news/.test(r.text);
    }
    expect(news).toBe(true);
    expect(s.known[lady]).toBeGreaterThanOrEqual(3);
    expect(s.events.some((e) => Array.isArray(e.visibleTo) && e.visibleTo.includes(P) && /dined with/.test(e.text))).toBe(true);
  });

  it('once a month, and only with ladies', () => {
    const { s, P, lady, husband } = setup();
    s.ap = 3;
    s.known[husband] = 3;
    expect(check(s, P, { type: 'dine', target: husband })).toMatch(/ladies/);
    perform(s, P, { type: 'dine', target: lady });
    s.ap = 3;
    expect(check(s, P, { type: 'dine', target: lady })).toMatch(/already dined/);
  });
});
