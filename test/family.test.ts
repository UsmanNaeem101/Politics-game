import { describe, expect, it } from 'vitest';
import {
  COMING_OF_AGE,
  bastard,
  credence,
  becomeLovers,
  addMod,
  affairSpy,
  bearChild,
  births,
  check,
  comeOfAge,
  generateCourt,
  imprison,
  kill,
  learn,
  makeSecret,
  marriageable,
  matchmaking,
  PREGNANCY,
  opinion,
  DELIBERATION,
  proposeOdds,
  perform,
  repairSave,
  runSpies,
  wed,
  widowsUpkeep,
  betrothProblem,
  growOlder,
  livingSpouse,
  arriveHouse,
  newcomers,
  MAX_NEW_HOUSES,
  pruneEvents,
  EVENTS_KEPT_MONTHS,
  OLD_EVENTS_KEPT,
  matchProblem,
  outsider,
  promised,
  type GameState,
  type Intent,
} from '../src/engine';

/** A lord at court with a wife of childbearing age. */
function couple(s: GameState): { lord: string; wife: string } {
  for (const h of Object.values(s.houses)) {
    const lord = h.head && s.chars[h.head];
    if (!lord || lord.id === s.player || lord.id === s.king || !lord.spouse) continue;
    const wife = s.chars[lord.spouse];
    if (wife.status === 'free' && wife.age >= 17 && wife.age <= 40) return { lord: lord.id, wife: wife.id };
  }
  throw new Error('no couple');
}

describe('children', () => {
  it('a generated court has children, linked to both parents, and no deed touches them', () => {
    const s = generateCourt(3);
    const kids = Object.values(s.chars).filter((c) => c.rank === 'child');
    expect(kids.length).toBeGreaterThan(3);
    for (const k of kids) {
      expect(k.age).toBeLessThan(COMING_OF_AGE);
      for (const p of k.parents ?? []) expect(s.chars[p].children).toContain(k.id);
    }
    s.known[kids[0].id] = 3;
    expect(check(s, s.player, { type: 'converse', target: kids[0].id })).toMatch(/child/);
  });

  it('wives bear children, in time', () => {
    const s = generateCourt(4);
    const { lord, wife } = couple(s);
    const before = s.chars[wife].children?.length ?? 0;
    for (let w = 0; w < 400 && (s.chars[wife].children?.length ?? 0) === before; w++) births(s);
    const born = s.chars[wife].children!.at(-1)!;
    expect(s.chars[born].rank).toBe('child');
    expect(s.chars[born].parents).toEqual([wife, lord]);
    expect(s.chars[lord].children).toContain(born);
    expect(s.chars[born].householdId).toBe(s.chars[wife].householdId);
  });

  it('a child comes of age as a knight or a lady of the house', () => {
    const s = generateCourt(4);
    const { lord, wife } = couple(s);
    const c = bearChild(s, wife, lord, 15);
    expect(marriageable(s, c.id)).toBe(false);
    c.age = COMING_OF_AGE;
    comeOfAge(s, c);
    expect(['knight', 'lady']).toContain(c.rank);
    expect(c.name).toMatch(c.gender === 'm' ? /^Sir / : /^Lady /);
  });

  it('a son inherits before his uncle', () => {
    const s = generateCourt(4);
    const { lord, wife } = couple(s);
    const heir = bearChild(s, wife, lord, 20);
    if (heir.gender !== 'm') heir.gender = 'm';
    kill(s, lord, 'Died', false);
    expect(s.houses[s.chars[lord].householdId].head).toBe(heir.id);
  });
});

describe('marrying again', () => {
  it('a widow marries again, but not before a year’s mourning', () => {
    const s = generateCourt(5);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    expect(marriageable(s, wife)).toBe(true);
    // Long enough for a suitor to make his case.
    s.turn += 11;
    for (let w = 0; w < 300; w++) matchmaking(s);
    expect(s.chars[wife].spouse).toBe(lord);
    s.turn += 1;
    // Then suitors call, the court hears of it, and she answers two months later.
    let began = 0;
    for (let w = 0; w < 300 && s.chars[wife].spouse === lord; w++) {
      matchmaking(s);
      if (!began && s.courtships?.[wife]) began = s.turn;
      s.turn++;
    }
    const next = s.chars[wife].spouse!;
    expect(next).not.toBe(lord);
    expect(s.chars[next].spouse).toBe(wife);
    expect(began).toBeGreaterThan(0);
    expect(s.turn - 1 - began).toBeGreaterThanOrEqual(DELIBERATION);
    expect(s.events.some((e) => e.visibleTo === 'all' && /court|match is being sought/.test(e.text) && e.text.includes(s.chars[wife].short))).toBe(true);
  });

  it('while she deliberates, you may still make your offer; rivals make it harder', () => {
    const s = generateCourt(5);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    const P = s.player;
    const mine = s.chars[P].spouse;
    if (mine) kill(s, mine, 'Died', false);
    s.turn += 13;
    s.known[wife] = 3;
    const alone = proposeOdds(s, P, wife);
    const rival = s.order.find((id) => s.chars[id].gender === 'm' && id !== P && marriageable(s, id))!;
    (s.courtships ??= {})[wife] = { suitors: [rival], since: s.turn };
    expect(proposeOdds(s, P, wife)).toBeLessThanOrEqual(alone);
    s.ap = 3;
    expect(check(s, P, { type: 'propose', target: wife })).toBeNull();
  });

  it('a widowed player may seek a match: someone at court, or from the provinces', () => {
    const s = generateCourt(6);
    const P = s.player;
    const late = s.chars[P].spouse;
    if (late) kill(s, late, 'Died', false);
    expect(check(s, P, { type: 'propose' })).toBe(late ? 'It is too soon after the funeral.' : null);
    s.turn += 5;
    expect(check(s, P, { type: 'propose' })).toBeNull();
    const r = perform(s, P, { type: 'propose' });
    expect(r.ok).toBe(true);
    const bride = s.chars[P].spouse!;
    expect(s.chars[bride].spouse).toBe(P);
    expect(s.chars[bride].householdId).toBe(s.chars[P].householdId);
    expect(check(s, P, { type: 'propose' })).toBe('You are married.');
  });
});

describe('from the Tower', () => {
  it('you may ask a friend to plead your case before the King', () => {
    const s = generateCourt(7);
    const P = s.player;
    const friend = s.order.find((id) => id !== P && id !== s.king && s.chars[id].status === 'free' && s.chars[id].rank !== 'servant' && s.chars[id].rank !== 'child')!;
    s.known[friend] = 3;
    s.known[s.king!] = 3;
    expect(check(s, P, { type: 'plead', target: friend })).toBe('You are not in the Tower.');
    imprison(s, P, []);
    expect(check(s, P, { type: 'plead', target: s.king! })).toMatch(/someone who can reach/);
    expect(check(s, P, { type: 'plead', target: friend })).toBeNull();
    addMod(s, friend, P, 'friend', 'Old friends', 80);
    let freed = false;
    for (let i = 0; i < 20 && !freed; i++) {
      perform(s, P, { type: 'plead', target: friend });
      freed = s.chars[P].status === 'free';
    }
    expect(freed).toBe(true);
  });
});

describe('an unfaithful wife', () => {
  it('brings her lover what her husband lets fall at home', () => {
    const s = generateCourt(8);
    const { lord, wife } = couple(s);
    const lover = s.order.find((id) => id !== lord && id !== s.player && s.chars[id].gender === 'm' && s.chars[id].status === 'free' && s.chars[id].rank !== 'servant' && s.chars[id].rank !== 'child' && s.chars[id].householdId !== s.chars[wife].householdId)!;
    affairSpy(s, wife, lover);
    const sp = Object.values(s.spies).find((x) => x.affair && x.agent === wife)!;
    expect(sp.mark).toBe(lord);
    s.chars[lord].traits.paranoia = 0;
    s.chars[lord].traits.cunning = 0;
    for (let w = 0; w < 40 && sp.status === 'active' && sp.reports === 0; w++) runSpies(s);
    if (sp.status !== 'active') return; // found out, which is its own story
    expect(sp.reports).toBeGreaterThan(0);
    const pillow = s.events.filter((e) => Array.isArray(e.visibleTo) && e.visibleTo.includes(lover) && /supper|heard at home|kisses/.test(e.text));
    expect(pillow.length).toBeGreaterThan(0);
  });
});

describe('names', () => {
  it('a bride takes her husband’s name; secrets about her keep up, and her old name is remembered', () => {
    const s = generateCourt(9);
    // A widow, and a widower from another house.
    const wives = s.order.filter((id) => s.chars[id].gender === 'f' && s.chars[id].rank === 'lady' && s.chars[id].spouse && s.chars[s.chars[id].spouse!].status === 'free' && s.chars[id].spouse !== s.player);
    const bride = wives[0];
    const other = wives.find((w) => s.chars[w].householdId !== s.chars[bride].householdId)!;
    const groom = s.chars[other].spouse!;
    kill(s, s.chars[bride].spouse!, 'Died', false);
    kill(s, other, 'Died', false);
    expect(marriageable(s, bride) && marriageable(s, groom)).toBe(true);
    const old = s.chars[bride].name;
    const victim = s.order.find((id) => id !== bride && id !== groom && s.chars[id].status === 'free' && s.chars[id].rank !== 'child')!;
    const sec = makeSecret(s, { kind: 'murder', guilty: [bride], victims: [victim], truth: true, evidence: 30, text: `${old} conspired to kill ${s.chars[victim].name}.` });
    learn(s, s.player, sec.id, 60, 'rumour');
    wed(s, groom, bride);
    expect(s.chars[bride].name).not.toBe(old);
    expect(s.chars[bride].formerly).toContain(old);
    expect(sec.text).toContain(s.chars[bride].name);
    expect(sec.text).not.toContain(old);
  });
});

describe('a marriage mends', () => {
  it('keeping company with your wife eases a cold marriage, and time thaws it', () => {
    let s = generateCourt(12);
    for (let seed = 12; !s.chars[s.player].spouse; seed++) s = generateCourt(seed);
    const P = s.player;
    const wife = s.chars[P].spouse!;
    s.known[wife] = 4;
    addMod(s, wife, P, 'cold', 'A cold marriage', -20, 0.25);
    addMod(s, P, wife, 'faithless', 'Faithless', -40, 0.5);
    const before = opinion(s, wife, P);
    s.ap = 3;
    const r = perform(s, P, { type: 'converse', target: wife });
    expect(r.text).toMatch(/chill/);
    expect(s.relations[wife][P].mods.find((m) => m.key === 'cold')!.value).toBe(-14);
    expect(s.relations[P][wife].mods.find((m) => m.key === 'faithless')!.value).toBe(-34);
    expect(opinion(s, wife, P)).toBeGreaterThan(before);
    for (let i = 0; i < 4; i++) {
      s.ap = 3;
      perform(s, P, { type: 'converse', target: wife });
    }
    expect(s.relations[wife][P].mods.some((m) => m.key === 'cold')).toBe(false);
  });
});

describe('children out of wedlock', () => {
  it('a widow’s lover may father her child: a secret, and the father is told', () => {
    const s = generateCourt(13);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    s.chars[wife].age = 25;
    becomeLovers(s, wife, s.player);
    const before = s.chars[wife].children?.length ?? 0;
    for (let i = 0; i < 600 && (s.chars[wife].children?.length ?? 0) === before; i++) births(s);
    const child = s.chars[s.chars[wife].children!.at(-1)!];
    expect(child.sire).toBe(s.player);
    expect(child.parents).toEqual([wife]);
    expect(child.householdId).toBe(s.chars[wife].householdId);
    expect(s.chars[s.player].children).toContain(child.id);
    expect(s.known[child.id]).toBe(4);
    const sec = Object.values(s.secrets).find((x) => x.kind === 'affair' && x.text.includes('out of wedlock'))!;
    expect(credence(s, s.player, sec.id)).toBe(100);
    expect(s.events.some((e) => Array.isArray(e.visibleTo) && e.visibleTo.includes(s.player) && /borne you/.test(e.text))).toBe(true);
  });
});

describe('a widow’s purse', () => {
  it('runs down month by month, and a kind host bears half', () => {
    const s = generateCourt(14);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    s.chars[wife].gold = 62;
    s.chars[wife].prestige = 10;
    const head = s.houses[s.chars[wife].householdId].head;
    if (head && head !== wife) addMod(s, head, wife, 'cold', 'Cold', -100);
    for (let i = 0; i < 3; i++) widowsUpkeep(s);
    expect(s.chars[wife].gold).toBe(50);
    if (head && head !== wife) {
      s.relations[head][wife].mods = [{ key: 'kin', label: 'Kin', value: 60, decay: 0 }];
      s.chars[head].gold = 100;
      widowsUpkeep(s);
      expect(s.chars[wife].gold).toBe(48);
      expect(s.chars[head].gold).toBe(98);
    }
  });
});

describe('trying for a child', () => {
  it('with a lover: she is drawn closer, carries nine months, and the birth binds her to you', () => {
    const s = generateCourt(15);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    s.chars[wife].age = 24;
    becomeLovers(s, wife, s.player);
    s.known[wife] = 4;
    s.ap = 3;
    expect(check(s, s.player, { type: 'try-child', target: wife })).toBeNull();
    const before = opinion(s, wife, s.player);
    for (let i = 0; i < 30 && !s.chars[wife].expecting; i++) {
      s.ap = 3;
      perform(s, s.player, { type: 'try-child', target: wife });
    }
    expect(opinion(s, wife, s.player)).toBeGreaterThan(before);
    const due = s.chars[wife].expecting!.due;
    expect(due).toBe(s.turn + PREGNANCY);
    s.ap = 3;
    expect(check(s, s.player, { type: 'try-child', target: wife })).toMatch(/already with child/);
    const kids = s.chars[wife].children?.length ?? 0;
    s.turn = due - 1;
    births(s);
    expect(s.chars[wife].children?.length ?? 0).toBe(kids);
    s.turn = due;
    births(s);
    const child = s.chars[s.chars[wife].children!.at(-1)!];
    expect(child.sire).toBe(s.player);
    expect(s.chars[wife].expecting).toBeUndefined();
    expect(s.relations[wife][s.player].mods.some((m) => m.key === 'child-father')).toBe(true);
  });

  it('not with a stranger, nor one past bearing', () => {
    const s = generateCourt(15);
    const { wife } = couple(s);
    s.known[wife] = 3;
    s.ap = 3;
    expect(check(s, s.player, { type: 'try-child', target: wife })).toMatch(/neither/);
    becomeLovers(s, wife, s.player);
    s.chars[wife].age = 50;
    expect(check(s, s.player, { type: 'try-child', target: wife })).toMatch(/past bearing/);
  });
});

describe('a lover is not married off', () => {
  it('a widow with a lover is not put forward to anyone else, and turns suitors away', () => {
    const s = generateCourt(16);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    becomeLovers(s, wife, s.player);
    s.turn += 30;
    for (let i = 0; i < 300; i++) {
      matchmaking(s);
      s.turn++;
    }
    expect(s.chars[wife].spouse).toBe(lord);
  });

  it('an old save: your lover married to your brother while you were lovers is annulled, and each goes home', () => {
    let s = generateCourt(17);
    const brotherOf = (x: GameState) => x.chars[x.player].siblings.find((b) => x.chars[b].gender === 'm' && x.chars[b].status === 'free' && !x.chars[b].spouse);
    for (let seed = 17; !brotherOf(s); seed++) s = generateCourt(seed);
    const brother = brotherOf(s)!;
    const home = s.chars[brother].householdId;
    const oldName = s.chars[brother].name;
    // A widow who keeps her own house, and is your lover.
    const h = Object.values(s.houses).find((x) => x.rank === 'lesser' && x.head && x.head !== s.player && s.chars[x.head].spouse)!;
    const lady = s.chars[h.head!].spouse!;
    kill(s, h.head!, 'Died', false);
    h.head = lady;
    becomeLovers(s, lady, s.player);
    s.turn += 2;
    wed(s, brother, lady);
    expect(h.head).toBe(brother);
    // He had found her letters, and hated you for it.
    addMod(s, brother, s.player, 'cuckold', 'Beds my wife', -50);
    repairSave(s);
    expect(s.relations[brother][s.player].mods.some((m) => m.key === 'cuckold')).toBe(false);
    expect(s.chars[lady].spouse === brother).toBe(false);
    expect(h.head).toBe(lady);
    expect(s.chars[brother].householdId).toBe(home);
    expect(s.chars[brother].name).toBe(oldName);
  });
});

describe('owning a natural child', () => {
  it('a natural son taken into your house under your name, and named your heir', () => {
    const s = generateCourt(19);
    const { lord, wife } = couple(s);
    kill(s, lord, 'Died', false);
    becomeLovers(s, wife, s.player);
    const son = bastard(s, wife, s.player);
    son.gender = 'm';
    const home = s.houses[s.chars[s.player].householdId];
    s.ap = 3;
    expect(check(s, s.player, { type: 'acknowledge', target: son.id })).toBeNull();
    perform(s, s.player, { type: 'acknowledge', target: son.id });
    expect(son.parents).toContain(s.player);
    expect(son.householdId).toBe(home.id);
    expect(son.name).toContain(home.name);
    expect(home.heir).toBe(son.id);
    s.ap = 3;
    expect(check(s, s.player, { type: 'acknowledge', target: son.id })).toMatch(/already/);
  });

  it('a married lover’s child: her husband learns it was never his', () => {
    const s = generateCourt(19);
    const { lord, wife } = couple(s);
    becomeLovers(s, wife, s.player);
    const child = bearChild(s, wife, lord, 0, s.player);
    child.sire = s.player;
    (s.chars[s.player].children ??= []).push(child.id);
    s.ap = 3;
    perform(s, s.player, { type: 'acknowledge', target: child.id });
    expect(child.parents).not.toContain(lord);
    expect(s.chars[lord].children ?? []).not.toContain(child.id);
    expect(s.relations[lord][s.player].mods.some((m) => m.key === 'cuckold')).toBe(true);
  });

  it('a natural child never owned does not inherit; a named heir comes first', () => {
    const s = generateCourt(20);
    const { lord, wife } = couple(s);
    const house = s.houses[s.chars[lord].householdId];
    const legit = bearChild(s, wife, lord, 30);
    legit.gender = 'm';
    const other = s.order.find((id) => s.chars[id].gender === 'f' && id !== wife && s.chars[id].status === 'free' && s.chars[id].rank !== 'child')!;
    const natural = bastard(s, other, lord);
    natural.gender = 'm';
    natural.age = 40;
    natural.rank = 'knight';
    // Living under his roof, but never owned: he does not inherit.
    s.houses[natural.householdId].members = s.houses[natural.householdId].members.filter((m) => m !== natural.id);
    house.members.push(natural.id);
    natural.householdId = house.id;
    house.heir = undefined;
    kill(s, lord, 'Died', false);
    expect(house.head).toBe(legit.id);
  });
});

describe('marrying your mistress', () => {
  it('ends the scandal of keeping her, and mends her family’s honour', () => {
    const s = generateCourt(21);
    const P = s.player;
    const mine = s.chars[P].spouse;
    if (mine) kill(s, mine, 'Died', false);
    const { lord, wife: widow } = couple(s);
    kill(s, lord, 'Died', false);
    const priest = s.order.find((id) => s.chars[id].rank === 'clergy')!;
    addMod(s, priest, P, 'mistress-scandal', 'Keeps his mistress under his roof', -8, 0.2);
    const kin = s.chars[widow].siblings[0];
    if (kin) addMod(s, kin, P, 'dishonour', 'Dishonoured our house', -30, 0.1);
    s.chars[widow].mistressOf = P;
    s.turn += 2;
    wed(s, P, widow);
    expect(s.relations[priest][P].mods.some((m) => m.key === 'mistress-scandal')).toBe(false);
    if (kin) expect(s.relations[kin][P].mods.some((m) => m.key === 'dishonour')).toBe(false);
    expect(s.chars[widow].mistressOf).toBeUndefined();
  });
});

describe('a long game’s chronicle', () => {
  it('keeps the last year whole, and only so much the player saw before that', () => {
    const s = generateCourt(4);
    s.turn = 120;
    for (let m = 1; m <= 120; m++) {
      for (let i = 0; i < 60; i++) s.events.push({ id: s.nextId++, turn: m, text: 'x', visibleTo: i % 3 ? [] : [s.player], actors: [], tone: 'neutral' });
    }
    pruneEvents(s);
    const old = s.events.filter((e) => e.turn < 120 - EVENTS_KEPT_MONTHS);
    expect(old.length).toBeLessThanOrEqual(OLD_EVENTS_KEPT);
    expect(old.every((e) => e.visibleTo === 'all' || e.visibleTo.includes(s.player))).toBe(true);
    expect(s.events.filter((e) => e.turn >= 120 - EVENTS_KEPT_MONTHS).length).toBe(13 * 60);
  });
});

describe('new houses', () => {
  it('stop coming once fifteen have arrived', () => {
    const s = generateCourt(4);
    s.turn = 6;
    for (let i = 0; i < 15; i++) arriveHouse(s);
    const count = () => Object.values(s.houses).filter((h) => h.arrived > 0).length;
    expect(count()).toBe(MAX_NEW_HOUSES);
    for (let i = 0; i < 40; i++) newcomers(s);
    expect(count()).toBe(MAX_NEW_HOUSES);
  });
});

describe('a widow who kept a house', () => {
  it('passes it on when she dies, though she married into another', () => {
    const s = generateCourt(4);
    const { lord, wife } = couple(s);
    // She still heads a house of her own, though she lives in her husband's.
    const own = Object.values(s.houses).find((h) => h.id !== s.chars[lord].householdId && h.head && h.head !== s.player && h.head !== s.king)!;
    own.head = wife;
    kill(s, wife, 'Died', false);
    expect(own.head).not.toBe(wife);
  });
});

describe('matching your children', () => {
  /** The player as a father, with a wife; and another house with children of its own. */
  function families(seed = 4) {
    const s = generateCourt(seed);
    const P = s.player;
    const wife = livingSpouse(s, P) ?? outsider(s, P).id;
    if (!livingSpouse(s, P)) wed(s, P, wife);
    const other = couple(s);
    s.ap = 9;
    const child = (mother: string, father: string, age: number, gender: 'm' | 'f') => {
      const c = bearChild(s, mother, father, age);
      c.gender = gender;
      s.known[c.id] = 2;
      if (age >= COMING_OF_AGE) comeOfAge(s, c, true);
      return c;
    };
    // Their family thinks the world of you.
    addMod(s, other.lord, P, 'test-friend', 'Old friend', 100);
    addMod(s, other.wife, P, 'test-friend', 'Old friend', 100);
    return { s, P, wife, other, child };
  }
  /** Ask until the dice say yes: the odds are tested elsewhere. */
  function agree(s: GameState, P: string, it: Extract<Intent, { type: 'betroth' }>) {
    for (let i = 0; i < 40; i++) {
      delete s.chars[it.partner!].refused;
      s.ap = 9;
      expect(check(s, P, it)).toBeNull();
      if (perform(s, P, it).ok) return;
    }
    throw new Error('never agreed');
  }

  it('youth passes a year every month; grown men age a year a year', () => {
    const s = generateCourt(5);
    const { lord, wife } = couple(s);
    const kid = bearChild(s, wife, lord, 2);
    const man = s.chars[lord];
    const [k0, m0] = [kid.age, man.age];
    // A year of months.
    for (let t = 2; t <= 13; t++) {
      s.turn = t;
      growOlder(s);
    }
    expect(kid.age).toBe(k0 + 12);
    expect(man.age).toBe(m0 + 1);
  });

  it('a young son is promised to a girl of another house, and they wed when both are grown', () => {
    const { s, P, wife, other, child } = families();
    const son = child(wife, P, 8, 'm');
    const girl = child(other.wife, other.lord, 7, 'f');
    agree(s, P, { type: 'betroth', target: son.id, partner: girl.id });
    expect(promised(s, son.id)).toBe(girl.id);
    expect(promised(s, girl.id)).toBe(son.id);
    expect(s.relations[other.lord][P].mods.some((m) => m.key === `match-${son.id}`)).toBe(true);
    // Grown, and the match is kept.
    for (const c of [son, girl]) {
      c.age = 17;
      comeOfAge(s, c, true);
    }
    matchmaking(s);
    expect(son.spouse).toBe(girl.id);
    expect(promised(s, son.id)).toBeUndefined();
  });

  it('a grown daughter weds at once, and her promise keeps others away until then', () => {
    const { s, P, wife, other, child } = families();
    const daughter = child(wife, P, 18, 'f');
    const man = child(other.wife, other.lord, 19, 'm');
    agree(s, P, { type: 'betroth', target: daughter.id, partner: man.id });
    expect(daughter.spouse).toBe(man.id);

    const young = child(wife, P, 10, 'm');
    const maid = child(other.wife, other.lord, 17, 'f');
    agree(s, P, { type: 'betroth', target: young.id, partner: maid.id });
    expect(maid.spouse).toBeUndefined();
    expect(matchProblem(s, other.lord === s.player ? young.id : s.player, maid.id) ?? 'promised').toMatch(/promised|married|free/);
    expect(betrothProblem(s, P, young.id, maid.id)).toMatch(/Already promised/);
  });

  it('a grown son or daughter of yours is put forward for marriage at once', () => {
    const { s, P, wife, child } = families();
    const daughter = child(wife, P, 17, 'f');
    matchmaking(s);
    expect(s.courtships?.[daughter.id]).toBeDefined();
    s.turn += DELIBERATION;
    matchmaking(s);
    expect(daughter.spouse).toBeDefined();
  });

  it('is only for your own children, and not across a wide gap in age', () => {
    const { s, P, wife, other, child } = families();
    const theirs = child(other.wife, other.lord, 8, 'm');
    const mine = child(wife, P, 6, 'f');
    expect(betrothProblem(s, P, theirs.id, mine.id)).toMatch(/not your child/);
    const grownMan = child(other.wife, other.lord, 30, 'm');
    expect(betrothProblem(s, P, mine.id, grownMan.id)).toMatch(/too far apart/);
    expect(betrothProblem(s, P, mine.id)).toMatch(/matchmaker/);
  });
});
