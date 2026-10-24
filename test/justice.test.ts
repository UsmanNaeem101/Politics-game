import { describe, expect, it } from 'vitest';
import {
  alreadyJudged,
  addMod,
  applyJudgments,
  decidePrisoners,
  murdererShunned,
  perform,
  resolveAudience,
  chargesFor,
  check,
  applyPetition,
  capital,
  createPlot,
  credence,
  crimeName,
  deedDone,
  imprison,
  joinPlot,
  kill,
  learn,
  makeSecret,
  opinion,
  pursueInquiries,
  repairSave,
  resolveStrike,
  secretMatters,
  strikeChance,
  traceChance,
  verdictFor,
  type GameState,
} from '../src/engine';
import { createScenario } from './fixtures/osric';

const fresh = (seed = 7): GameState => createScenario(seed, 'anselm');

describe('a killing traced to you', () => {
  /** The player strikes and is traced, in whichever court that happens first. */
  function traced(): { s: GameState; victim: string } {
    for (let seed = 1; seed <= 80; seed++) {
      const s = fresh(seed);
      const p = createPlot(s, 'anselm', 'murder', ['edmund']);
      p.progress = 100;
      s.chars.anselm.traits.cunning = 0;
      s.ap = 3;
      const r = perform(s, 'anselm', { type: 'strike', plotId: p.id });
      if (r.ok && s.chars.edmund.status === 'dead' && s.audiences.some((a) => a.kind === 'accused')) return { s, victim: 'edmund' };
    }
    throw new Error('never traced');
  }

  it('brings you before the King to answer for it, not straight to the Tower', () => {
    const { s } = traced();
    expect(s.chars.anselm.status).toBe('free');
    const a = s.audiences.find((x) => x.kind === 'accused')!;
    expect(a.options.map((o) => o.id)).toEqual(expect.arrayContaining(['deny', 'mercy', 'flee']));
  });

  it('mercy granted at the hearing holds: the Tower for six months, then out, disgraced', () => {
    for (let i = 0; i < 30; i++) {
      const { s } = traced();
      const a = s.audiences.find((x) => x.kind === 'accused')!;
      resolveAudience(s, a.id, 'mercy');
      if (s.chars.anselm.status !== 'imprisoned') continue;
      expect(s.imprisoned.anselm.spared).toBe(true);
      learn(s, 'osric', s.imprisoned.anselm.charges[0], 100, 'confession');
      decidePrisoners(s);
      expect(s.chars.anselm.status).toBe('imprisoned');
      s.turn += 6;
      decidePrisoners(s);
      expect(s.chars.anselm.status).toBe('free');
      return;
    }
  });

  it('the court takes it as it felt about the dead: kin hate you, his enemies shed no tears', () => {
    const s = fresh();
    const enemy = s.order.find((id) => !['anselm', 'edmund'].includes(id) && s.chars[id].status === 'free')!;
    addMod(s, enemy, 'edmund', 'hate', 'Hates him', -80);
    const friend = s.order.find((id) => !['anselm', 'edmund', enemy].includes(id) && s.chars[id].status === 'free')!;
    addMod(s, friend, 'edmund', 'love', 'Loves him', 80);
    murdererShunned(s, 'anselm', 'edmund');
    const grudge = (id: string) => s.relations[id]?.anselm?.mods.find((m) => m.key === 'murderer-edmund')?.value ?? 0;
    expect(grudge(enemy)).toBeGreaterThanOrEqual(0);
    expect(grudge(friend)).toBeLessThan(-35);
  });
});

describe('a concealment', () => {
  it('is old news once the plot it hides is over', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['osric']);
    const hide = makeSecret(s, {
      kind: 'concealment',
      guilty: ['cedric'],
      victims: ['osric'],
      truth: true,
      evidence: 20,
      text: `${s.chars.cedric.name} knows that ${s.chars.gareth.name} plots against the King, and keeps it from him.`,
    });
    // An old save: the link is found from the words.
    repairSave(s);
    expect(hide.about).toBe(p.secretId);
    expect(secretMatters(s, hide)).toBe(true);
    kill(s, 'gareth', 'Beheaded', true);
    expect(secretMatters(s, hide)).toBe(false);
  });
});

describe('hired blades', () => {
  it('strike harder, and keep your own hands out of it', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['edmund']);
    p.progress = 40;
    const kill0 = strikeChance(s, p);
    const trace0 = traceChance(s, p);
    p.hiredBlades = 4;
    expect(strikeChance(s, p)).toBeGreaterThan(kill0);
    expect(traceChance(s, p)).toBeLessThan(trace0);
  });
});

describe('a murder done', () => {
  it('is no longer a plan but a hanging crime, and the body lends the charge weight', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const s = fresh(seed);
      const p = createPlot(s, 'gareth', 'murder', ['edmund']);
      p.progress = 100;
      const sec = s.secrets[p.secretId];
      const before = sec.evidence;
      if (!resolveStrike(s, p).success) continue;
      checked++;
      expect(sec.deed).toBe(true);
      expect(sec.kind).toBe('murder');
      expect(sec.text).toMatch(/murdered/);
      expect(sec.evidence).toBeGreaterThan(before);
      expect(capital(sec)).toBe(true);
      expect(crimeName(sec)).toBe('murder');
      // Either the Guard took the killer, or the King's people start asking questions.
      expect(s.chars.gareth.status === 'imprisoned' || sec.inquiry === s.turn).toBe(true);
    }
    expect(checked).toBe(3);
  });

  it('is judged as gravely as treason', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['edmund']);
    const sec = s.secrets[p.secretId];
    expect(verdictFor(s, sec, 55)).toBe('dismiss');
    deedDone(s, sec);
    expect(verdictFor(s, sec, 55)).toBe('imprison');
  });

  it('mercy spares a believed murderer the axe, but not the shame', () => {
    const s = fresh();
    imprison(s, 'aldric', ['s-aldric-regicide']);
    learn(s, 'osric', 's-aldric-regicide', 80, 'anselm');
    const prestige = s.chars.aldric.prestige;
    const out = applyPetition(s, 'rowena', { type: 'petition', kind: 'mercy', target: 'aldric' }, true);
    expect(s.chars.aldric.status).toBe('free');
    expect(s.chars.aldric.prestige).toBeLessThan(prestige);
    expect(out.text).toMatch(/not the shame/);
  });
});

describe('a dismissed charge', () => {
  it('still muddies the accused, spreads through the hall, and sets the King’s people looking', () => {
    const s = fresh();
    const sid = 's-aldric-regicide';
    const bystander = s.order.find((id) => !['osric', 'aldric', 'anselm'].includes(id) && credence(s, id, sid) < 10)!;
    const prestige = s.chars.aldric.prestige;
    const regard = opinion(s, 'osric', 'aldric');
    const summary = applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: sid, verdict: 'dismiss', score: 45, forgeryFound: false }]);
    expect(summary).toMatch(/hall heard/);
    expect(s.chars.aldric.prestige).toBeLessThan(prestige);
    expect(opinion(s, 'osric', 'aldric')).toBeLessThan(regard);
    expect(credence(s, bystander, sid)).toBeGreaterThanOrEqual(20);
    expect(s.secrets[sid].inquiry).toBe(s.turn);
  });

  it('the inquiry ends in arrest once the King believes enough', () => {
    const s = fresh();
    const sid = 's-aldric-regicide';
    s.secrets[sid].inquiry = s.turn;
    learn(s, 'osric', sid, 55, 'anselm');
    for (let i = 0; i < 200 && s.chars.aldric.status === 'free'; i++) pursueInquiries(s);
    expect(s.chars.aldric.status).toBe('imprisoned');
    expect(s.secrets[sid].inquiry).toBeUndefined();
  });

  it('digging into a lie finds nothing, and the King cools on it', () => {
    const s = fresh();
    const sec = s.secrets['s-false-pact'];
    sec.inquiry = s.turn;
    learn(s, 'osric', sec.id, 60, 'anselm');
    for (let i = 0; i < 100; i++) pursueInquiries(s);
    expect(sec.guilty.every((g) => s.chars[g].status !== 'imprisoned')).toBe(true);
    expect(credence(s, 'osric', sec.id)).toBeLessThan(60);
  });
});

describe('a charge once judged', () => {
  it('is not heard again, from anyone, until new proof comes to light', () => {
    const s = fresh();
    const sid = 's-aldric-regicide';
    const other = s.order.find((id) => !['osric', 'aldric', 'anselm'].includes(id) && s.chars[id].rank !== 'servant' && chargesFor(s, id, [sid]).length > 0)!;
    learn(s, other, sid, 70, 'rumour');
    applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: sid, verdict: 'dismiss', score: 45, forgeryFound: false }]);
    expect(chargesFor(s, other, [sid])).toEqual([]);
    expect(check(s, other, { type: 'denounce', secretId: sid })).toMatch(/already judged/);
    s.secrets[sid].evidence += 15;
    expect(chargesFor(s, other, [sid]).map((c) => c.accused)).toContain('aldric');
  });

  it('a new scheme is a new charge, whatever he was judged for before', () => {
    const s = fresh();
    // Judged once on a forged charge of plotting the King's death...
    const forged = makeSecret(s, { kind: 'regicide', guilty: ['gareth'], victims: ['osric'], truth: false, fabricatedBy: 'cedric', evidence: 60 });
    applyJudgments(s, 'cedric', [{ accused: 'gareth', secretId: forged.id, verdict: 'dismiss', score: 30, forgeryFound: true }]);
    // ...a forged copy is the same charge,
    const again = makeSecret(s, { kind: 'regicide', guilty: ['gareth'], victims: ['osric'], truth: false, fabricatedBy: 'cedric', evidence: 62 });
    expect(alreadyJudged(s, again, 'gareth')).toBe(true);
    // but a real scheme he has since sworn to is not.
    const p = createPlot(s, 'anselm', 'murder', ['osric']);
    joinPlot(s, p, 'gareth', true);
    expect(alreadyJudged(s, s.secrets[p.secretId], 'gareth')).toBe(false);
    expect(chargesFor(s, 'anselm', [p.secretId]).map((c) => c.accused)).toContain('gareth');
  });

  it('an old save remembers what the King has already dismissed', () => {
    const s = fresh();
    const sid = 's-aldric-regicide';
    applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: sid, verdict: 'dismiss', score: 45, forgeryFound: false }]);
    delete s.judged;
    repairSave(s);
    expect(alreadyJudged(s, s.secrets[sid], 'aldric')).toBe(true);
  });
});

describe('an old save', () => {
  it('turns a murder already done into the crime it is, and the King looks into it', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['edmund']);
    const sec = s.secrets[p.secretId];
    Object.assign(sec, { kind: 'betrayal', fixedText: true, text: 'Sir Gareth means to let Edmund rise, then kill him.' });
    p.status = 'succeeded';
    kill(s, 'edmund', 'Murdered', false);
    learn(s, 'osric', sec.id, 50, 'anselm');
    repairSave(s);
    expect(sec.deed).toBe(true);
    expect(sec.kind).toBe('murder');
    expect(sec.text).toMatch(/murdered/);
    expect(sec.inquiry).toBe(s.turn);
    const evidence = sec.evidence;
    repairSave(s);
    expect(sec.evidence).toBe(evidence);
  });
});
