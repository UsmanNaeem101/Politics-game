import { describe, expect, it } from 'vitest';
import {
  alreadyJudged,
  applyJudgments,
  chargesFor,
  check,
  applyPetition,
  capital,
  createPlot,
  credence,
  crimeName,
  deedDone,
  imprison,
  kill,
  learn,
  opinion,
  pursueInquiries,
  repairSave,
  resolveStrike,
  verdictFor,
  type GameState,
} from '../src/engine';
import { createScenario } from './fixtures/osric';

const fresh = (seed = 7): GameState => createScenario(seed, 'anselm');

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
