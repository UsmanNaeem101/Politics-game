import { describe, expect, it } from 'vitest';
import {
  COMING_OF_AGE,
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
  opinion,
  DELIBERATION,
  proposeOdds,
  perform,
  runSpies,
  wed,
  widowsUpkeep,
  type GameState,
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
