import { describe, expect, it } from 'vitest';
import {
  RENOWN,
  addMod,
  applyJudgments,
  check,
  feastGain,
  generateCourt,
  imprison,
  opinion,
  perform,
  renownMonth,
  repairSave,
  tarnish,
  wed,
  type GameState,
} from '../src/engine';
import { createScenario } from './fixtures/osric';

const fresh = (seed = 7): GameState => createScenario(seed, 'anselm');
/** The fixture court, played as its minor lord. */
const asLord = (): GameState => createScenario(7, 'edmund');

describe('lost standing mends', () => {
  it('comes back a little each month, while free', () => {
    const s = fresh();
    const c = s.chars.aldric;
    c.prestige = 30;
    tarnish(s, 'aldric', 10);
    expect(c.prestige).toBe(20);
    expect(c.tarnish).toBe(10);
    renownMonth(s);
    expect(c.prestige).toBe(20 + RENOWN.mends);
    for (let i = 0; i < 10; i++) renownMonth(s);
    expect(c.prestige).toBe(30);
    expect(c.tarnish).toBeUndefined();
  });

  it('does not mend in the Tower', () => {
    const s = fresh();
    tarnish(s, 'aldric', 10);
    const before = s.chars.aldric.prestige;
    imprison(s, 'aldric', [], 'anselm');
    renownMonth(s);
    expect(s.chars.aldric.prestige).toBe(before);
  });

  it('a dismissed charge muddies the accused, and the mud washes off', () => {
    const s = fresh();
    const before = s.chars.aldric.prestige;
    applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: 's-aldric-regicide', verdict: 'dismiss', score: 45, forgeryFound: false }]);
    const lost = before - s.chars.aldric.prestige;
    expect(lost).toBeGreaterThan(0);
    expect(s.chars.aldric.tarnish).toBe(lost);
  });
});

describe('earning prestige', () => {
  it('the King’s favour lifts those he holds close, up to a ceiling', () => {
    const s = asLord();
    const c = s.chars.edmund;
    c.prestige = 30;
    addMod(s, 'osric', 'edmund', 'test', 'Test', 100);
    expect(opinion(s, 'osric', 'edmund')).toBeGreaterThanOrEqual(RENOWN.favour.opinion);
    renownMonth(s);
    expect(c.prestige).toBe(31);
    c.prestige = RENOWN.favour.upTo;
    renownMonth(s);
    expect(c.prestige).toBe(RENOWN.favour.upTo);
  });

  it('a charge the King upholds raises the man who brought it', () => {
    const s = fresh();
    const before = s.chars.anselm.prestige;
    applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: 's-aldric-regicide', verdict: 'imprison', score: 80, forgeryFound: false }]);
    expect(s.chars.anselm.prestige).toBe(before + RENOWN.upheld.imprison);
  });

  it('a match into a greater house lifts the lesser house’s head', () => {
    const s = generateCourt(3);
    const P = s.player;
    const me = s.chars[P];
    me.prestige = 20;
    // A bride from another house, whose head stands well above us.
    const greatLady = s.order.find((id) => {
      const c = s.chars[id];
      const head = s.houses[c.householdId]?.head;
      return c.gender === 'f' && c.rank === 'lady' && !c.spouse && c.status === 'free' && !!head && head !== s.king && head !== P && head !== id;
    });
    expect(greatLady).toBeDefined();
    if (!greatLady) return;
    s.chars[s.houses[s.chars[greatLady].householdId].head!].prestige = 70;
    if (me.spouse) s.chars[me.spouse].status = 'dead';
    me.spouse = undefined;
    wed(s, P, greatLady);
    expect(me.prestige).toBe(20 + RENOWN.match.max);
  });
});

describe('a feast', () => {
  it('costs crowns, warms the guests, raises the host, and waits its turn', () => {
    const s = asLord();
    const P = s.player;
    const me = s.chars[P];
    me.gold = 100;
    me.prestige = 25;
    s.ap = 5;
    expect(check(s, P, { type: 'feast' })).toBeNull();
    const out = perform(s, P, { type: 'feast' });
    expect(out.ok).toBe(true);
    expect(me.gold).toBe(100 - RENOWN.feast.cost);
    expect(me.prestige).toBeGreaterThanOrEqual(25 + feastGain(25));
    const warmed = s.order.filter((id) => s.relations[id]?.[P]?.mods.some((m) => m.key === 'feasted'));
    expect(warmed.length).toBeGreaterThan(0);
    expect(check(s, P, { type: 'feast' })).toMatch(/last feast/);
    s.turn += RENOWN.feast.every;
    expect(check(s, P, { type: 'feast' })).toBeNull();
  });

  it('the King comes to the table of a man he likes, and it counts for more', () => {
    const s = asLord();
    const P = s.player;
    s.chars[P].gold = 100;
    s.chars[P].prestige = 25;
    addMod(s, 'osric', P, 'test', 'Test', 100);
    perform(s, P, { type: 'feast' });
    expect(s.chars[P].prestige).toBe(25 + feastGain(25) + RENOWN.feast.kingBonus);
    expect(s.relations.osric[P].mods.some((m) => m.key === 'feasted')).toBe(true);
  });

  it('a lesser name gains more from it than a great one', () => {
    expect(feastGain(20)).toBeGreaterThan(feastGain(50));
    expect(feastGain(90)).toBe(1);
  });
});

describe('an older save', () => {
  it('starts mending what was lost since the court began', () => {
    const s = generateCourt(5);
    const P = s.player;
    const start = s.chars[P].prestige;
    s.chars[P].prestige = start - 12;
    delete s.mendingSince;
    repairSave(s);
    expect(s.chars[P].tarnish).toBe(12);
    expect(s.mendingSince).toBe(s.turn);
    repairSave(s);
    expect(s.chars[P].tarnish).toBe(12);
  });
});
