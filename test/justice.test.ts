import { describe, expect, it } from 'vitest';
import {
  alreadyJudged,
  addMod,
  candidates,
  readCase,
  bearChild,
  decayMods,
  knows,
  petitionOdds,
  advancePlot,
  leakPlots,
  traceForger,
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
  stir,
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

describe('the dead leave the story', () => {
  it('a scheme’s secret stops naming a member who dies, and a pact with a dead man is old news', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['osric']);
    joinPlot(s, p, 'edmund', true);
    expect(s.secrets[p.secretId].guilty).toContain('edmund');
    kill(s, 'edmund', 'Beheaded', true);
    expect(s.secrets[p.secretId].guilty).not.toContain('edmund');
    expect(s.secrets[p.secretId].text).not.toContain(s.chars.edmund.short);
    const pact = makeSecret(s, { kind: 'pact', guilty: ['gareth', 'cedric'], victims: ['osric'], truth: false, fabricatedBy: 'anselm', evidence: 40 });
    expect(secretMatters(s, pact)).toBe(true);
    kill(s, 'cedric', 'Died', false);
    expect(secretMatters(s, pact)).toBe(false);
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

describe('a forged tale of treason', () => {
  const forge = (s: GameState, evidence = 60) =>
    makeSecret(s, { kind: 'regicide', guilty: ['aldric'], victims: ['osric'], truth: false, fabricatedBy: 'anselm', evidence });
  const tellsKing = (s: GameState, who: string, sid: string) =>
    candidates(s, who).some((c) => c.intent.type === 'whisper' && c.intent.target === 'osric' && c.intent.secretId === sid);

  it('goes to the King from a loyal man who only half believes it', () => {
    const s = fresh();
    const sec = forge(s);
    learn(s, 'hugh', sec.id, 40, 'anselm');
    expect(tellsKing(s, 'hugh', sec.id)).toBe(true);
  });

  it('goes to the King from a man on the rise, who would win his favour by it', () => {
    const s = fresh();
    const sec = forge(s);
    s.chars.bertrand.agenda = { kind: 'rise', targets: [], summary: 'Rise.' };
    learn(s, 'bertrand', sec.id, 40, 'anselm');
    expect(tellsKing(s, 'bertrand', sec.id)).toBe(true);
  });

  it('sets the King’s people asking questions when he hears it, and the court knows', () => {
    let opened = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      s.ap = 3;
      const sec = forge(s);
      learn(s, 'anselm', sec.id, 0, 'self', true);
      perform(s, 'anselm', { type: 'whisper', target: 'osric', secretId: sec.id });
      if (credence(s, 'osric', sec.id) < 25) continue;
      expect(sec.inquiry).toBe(s.turn);
      expect(s.events.some((e) => /asking questions about/.test(e.text))).toBe(true);
      opened++;
    }
    expect(opened).toBeGreaterThan(0);
  });

  it('under inquiry, either convinces with its forged letters, or is seen through, and only sometimes traced home', () => {
    let traced = 0;
    let untraced = 0;
    let believed = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const s = fresh(seed);
      const sec = forge(s);
      // The forger told Hugh, and Hugh told the King: a trail of one hand.
      learn(s, 'hugh', sec.id, 50, 'anselm');
      learn(s, 'osric', sec.id, 40, 'hugh');
      sec.inquiry = s.turn;
      for (let m = 0; m < 7 && sec.inquiry !== undefined; m++) {
        pursueInquiries(s);
        s.turn++;
      }
      const seenThrough = credence(s, 'osric', sec.id) <= 5;
      if (Object.values(s.secrets).some((x) => x.kind === 'slander' && x.guilty[0] === 'anselm')) {
        traced++;
        expect(seenThrough).toBe(true);
      } else if (seenThrough) untraced++;
      else if (credence(s, 'osric', sec.id) > 40) believed++;
    }
    expect(traced).toBeGreaterThan(0);
    expect(untraced).toBeGreaterThan(0);
    expect(believed).toBeGreaterThan(0);
  });

  it('is traced for certain only when the forger lays it before the King himself', () => {
    const s = fresh();
    const sec = forge(s);
    expect(traceForger(s, sec, 'anselm')).toBe(true);
    // Heard as a rumour: no one to ask.
    learn(s, 'hugh', sec.id, 50, 'rumour');
    for (let i = 0; i < 20; i++) expect(traceForger(s, sec, 'hugh')).toBe(false);
  });
});

describe('a ruin scheme you were drawn into', () => {
  function joined() {
    const s = fresh();
    s.ap = 3;
    const p = createPlot(s, 'cedric', 'ruin', ['aldric'], ['s-aldric-regicide']);
    p.progress = 100;
    joinPlot(s, p, 'anselm', true);
    return { s, p };
  }

  it('can be laid before the King by a sworn member, not by an outsider', () => {
    const { s, p } = joined();
    expect(check(s, 'anselm', { type: 'denounce', plotId: p.id })).toBeNull();
    expect(check(s, 'hugh', { type: 'denounce', plotId: p.id })).toMatch(/not sworn/);
  });

  it('has its leader stand witness, and the leader judges the member by how it went', () => {
    const { s, p } = joined();
    expect(readCase(s, 'anselm', 's-aldric-regicide', 'aldric', p).witnessesFor).toContain('cedric');
    perform(s, 'anselm', { type: 'denounce', plotId: p.id });
    expect(['succeeded', 'foiled']).toContain(p.status);
    const mod = s.relations.cedric?.anselm?.mods.find((m) => m.key === (p.status === 'succeeded' ? 'carried' : 'spent'));
    expect(mod).toBeDefined();
  });
});

describe('a plot you were sworn into', () => {
  function sworn(sincere: boolean) {
    const s = fresh();
    s.ap = 3;
    const p = createPlot(s, 'gareth', 'murder', ['edmund']);
    p.progress = 50;
    joinPlot(s, p, 'anselm', sincere);
    return { s, p };
  }

  it('cannot be told to just anyone: that is confessing', () => {
    const { s, p } = sworn(false);
    expect(check(s, 'anselm', { type: 'whisper', target: 'hugh', secretId: p.secretId })).toMatch(/confessing/);
  });

  it('can be told to its quarry as a warning, and takes you out of it', () => {
    for (const sincere of [false, true]) {
      const { s, p } = sworn(sincere);
      const guard = s.chars.edmund.guard;
      const before = opinion(s, 'edmund', 'anselm');
      const it = { type: 'whisper' as const, target: 'edmund', secretId: p.secretId };
      expect(check(s, 'anselm', it)).toBeNull();
      const kill = strikeChance(s, p);
      expect(perform(s, 'anselm', it).ok).toBe(true);
      expect(p.members.some((m) => m.id === 'anselm')).toBe(false);
      expect(s.secrets[p.secretId].guilty).not.toContain('anselm');
      expect(credence(s, 'edmund', p.secretId)).toBeGreaterThanOrEqual(70);
      expect(s.chars.edmund.guard).toBeGreaterThan(guard);
      expect(strikeChance(s, p)).toBeLessThan(kill);
      expect(opinion(s, 'edmund', 'anselm')).toBeGreaterThan(before);
    }
  });
});

describe('a sword offered to the King', () => {
  it('wins his leave though he hates you; the killing is no crime, and wins his favour', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = fresh(seed);
      s.ap = 3;
      const sid = 's-aldric-regicide';
      learn(s, 'anselm', sid, 80, 'hugh');
      addMod(s, 'osric', 'anselm', 'test-hate', 'Loathes him', -60);
      s.chars.osric.traits.paranoia = 90;
      const it = { type: 'offer-blade' as const, target: 'aldric', secretId: sid };
      expect(check(s, 'anselm', it)).toBeNull();
      const before = opinion(s, 'osric', 'anselm');
      if (!perform(s, 'anselm', it).ok) continue;
      const p = Object.values(s.plots).find((x) => x.owner === 'anselm' && x.targets.includes('aldric'))!;
      expect(p.warrant).toBe('osric');
      expect(p.progress).toBeGreaterThanOrEqual(30);
      expect(opinion(s, 'osric', 'anselm')).toBeGreaterThan(before);
      expect(check(s, 'anselm', it)).toMatch(/leave already/);
      // Strike, and answer to no one for it.
      p.progress = 100;
      p.hiredBlades = 10;
      s.chars.aldric.guard = 0;
      s.ap = 3;
      const mid = opinion(s, 'osric', 'anselm');
      if (!perform(s, 'anselm', { type: 'strike', plotId: p.id }).ok) continue;
      expect(s.chars.aldric.status).toBe('dead');
      expect(s.chars.anselm.status).toBe('free');
      expect(s.audiences.some((a) => a.kind === 'accused')).toBe(false);
      expect(chargesFor(s, 'hugh', [p.secretId])).toEqual([]);
      expect(opinion(s, 'osric', 'anselm')).toBeGreaterThan(mid);
      return;
    }
    throw new Error('the King never gave his leave');
  });

  it('is only for treason against the King', () => {
    const s = fresh();
    const sec = makeSecret(s, { kind: 'theft', guilty: ['gareth'], victims: ['edmund'], truth: true, evidence: 50 });
    learn(s, 'anselm', sec.id, 80, 'hugh');
    expect(check(s, 'anselm', { type: 'offer-blade', target: 'gareth', secretId: sec.id })).toMatch(/no treason/);
  });
});

describe('a scheme that leaks', () => {
  it('leaks through one of its people or their household, and its leader may hear who talked', () => {
    const s = fresh();
    const p = createPlot(s, 'anselm', 'murder', ['edmund']);
    p.progress = 100;
    joinPlot(s, p, 'gareth', false);
    s.chars.anselm.traits.cunning = 0;
    const insiders = ['anselm', 'gareth'];
    const roofs = insiders.flatMap((id) => s.houses[s.chars[id].householdId].members);
    for (let m = 0; m < 60; m++) leakPlots(s);
    const heard = s.order.filter((id) => !insiders.includes(id) && s.knowledge[id]?.[p.secretId]);
    expect(heard.length).toBeGreaterThan(0);
    for (const id of heard) expect([...insiders, ...roofs]).toContain(s.knowledge[id][p.secretId].source);
    expect(s.events.some((e) => e.text.includes('is being talked of') && e.visibleTo !== 'all')).toBe(true);
  });
});

describe('the King’s inquiry into a death', () => {
  it('names the dead when it ends, not the killer no one suspected', () => {
    const s = fresh();
    const sec = makeSecret(s, { kind: 'murder', guilty: ['anselm'], victims: ['edmund'], truth: true, evidence: 20 });
    deedDone(s, sec);
    kill(s, 'edmund', 'Murdered', false);
    sec.inquiry = s.turn;
    sec.trail = 5;
    s.turn += 7;
    pursueInquiries(s);
    const last = s.events.at(-1)!.text;
    expect(last).toMatch(/death of/);
    expect(last).not.toMatch(new RegExp(s.chars.anselm.short));
  });
});

describe('blades for hire', () => {
  it('are paid for only when hired, up to ten a scheme', () => {
    const s = fresh();
    const p = createPlot(s, 'anselm', 'murder', ['edmund']);
    s.chars.anselm.gold = 300;
    advancePlot(s, p, 'anselm', 260);
    expect(p.hiredBlades).toBe(10);
    expect(s.chars.anselm.gold).toBe(100);
    advancePlot(s, p, 'anselm', 100);
    expect(p.hiredBlades).toBe(10);
    expect(s.chars.anselm.gold).toBe(100);
  });
});

describe('a killing no one saw', () => {
  it('puts no name in the mouths of strangers', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const s = fresh(seed);
      const p = createPlot(s, 'anselm', 'murder', ['edmund']);
      p.progress = 100;
      p.hiredBlades = 6;
      s.chars.edmund.guard = 0;
      s.ap = 3;
      const before = new Set(s.order.filter((id) => knows(s, id, p.secretId)));
      const r = perform(s, 'anselm', { type: 'strike', plotId: p.id });
      if (!r.ok || r.tone !== 'good') continue;
      const E = s.chars.edmund;
      const close = (id: string) => E.spouse === id || E.siblings.includes(id) || !!E.parents?.includes(id) || !!E.children?.includes(id) || opinion(s, id, 'edmund') >= 30;
      const strangers = s.order.filter((id) => id !== 'anselm' && !before.has(id) && !close(id) && knows(s, id, p.secretId));
      expect(strangers).toEqual([]);
      expect(s.secrets[p.secretId].trail).toBeLessThan(30);
      return;
    }
    throw new Error('never an unseen killing');
  });
});

describe('friends, when you are in the Tower', () => {
  it('good company kept up becomes a friendship that outlasts a year apart', () => {
    const s = fresh();
    for (let i = 0; i < 8; i++) {
      s.ap = 3;
      perform(s, 'anselm', { type: 'converse', target: 'hugh' });
    }
    const friend = () => s.relations.hugh.anselm.mods.find((m) => m.key === 'friend')?.value ?? 0;
    expect(friend()).toBeGreaterThanOrEqual(12);
    for (let m = 0; m < 12; m++) decayMods(s);
    expect(s.relations.hugh.anselm.mods.find((m) => m.key === 'company')).toBeUndefined();
    expect(friend()).toBeGreaterThanOrEqual(8);
  });

  it('a friendship takes root in a few warm conversations', () => {
    const s = fresh();
    for (let i = 0; i < 3; i++) {
      s.ap = 3;
      perform(s, 'anselm', { type: 'converse', target: 'hugh' });
    }
    expect(s.relations.hugh.anselm.mods.find((m) => m.key === 'friend')?.value ?? 0).toBeGreaterThanOrEqual(16);
  });

  it('the King softens with time served, and with every plea he has refused', () => {
    const s = fresh();
    const tale = makeSecret(s, { kind: 'murder', guilty: ['anselm'], victims: ['edmund'], truth: true, evidence: 50 });
    deedDone(s, tale);
    imprison(s, 'anselm', [tale.id]);
    learn(s, 'osric', tale.id, 60, 'hugh');
    const it = { type: 'petition' as const, kind: 'mercy' as const, target: 'anselm' };
    const first = petitionOdds(s, 'hugh', it);
    s.turn += 4;
    applyPetition(s, 'cedric', it, false);
    applyPetition(s, 'bertrand', it, false);
    expect(petitionOdds(s, 'hugh', it)).toBeGreaterThanOrEqual(first + 20);
  });

  it('a friend goes to the King for you unasked', () => {
    const s = fresh();
    addMod(s, 'hugh', 'anselm', 'friend', 'Old friend', 60);
    const tale = makeSecret(s, { kind: 'regicide', guilty: ['anselm'], victims: ['osric'], truth: false, evidence: 40 });
    imprison(s, 'anselm', [tale.id]);
    expect(candidates(s, 'hugh').some((c) => c.intent.type === 'petition' && c.intent.kind === 'mercy' && c.intent.target === 'anselm')).toBe(true);
  });
});

describe('a child', () => {
  it('cannot be named in a forgery, charged, or jailed', () => {
    const s = fresh();
    const kid = bearChild(s, 'isolde', 'edmund', 8);
    s.known[kid.id] = 3;
    expect(check(s, 'anselm', { type: 'fabricate', kind: 'regicide', guilty: [kid.id], victim: 'osric' })).toMatch(/child/);
    const tale = makeSecret(s, { kind: 'regicide', guilty: [kid.id], victims: ['osric'], truth: false, fabricatedBy: 'anselm', evidence: 90 });
    expect(chargesFor(s, 'hugh', [tale.id])).toEqual([]);
    imprison(s, kid.id, [tale.id]);
    expect(kid.status).toBe('free');
  });
});

describe('a strike bought with gold', () => {
  it('keeps getting surer past 92%, each blade buying less, and never past 98%', () => {
    const s = fresh();
    const p = createPlot(s, 'gareth', 'murder', ['edmund']);
    p.progress = 100;
    s.chars.edmund.guard = 0;
    const by = (n: number) => ((p.hiredBlades = n), strikeChance(s, p));
    let n = 0;
    while (by(n) < 92) n++;
    expect(by(n + 4)).toBeGreaterThan(by(n));
    expect(by(n + 4) - by(n)).toBeLessThan(20 - 4);
    expect(by(n + 100)).toBe(98);
  });
});

describe('a strike retried after turning back', () => {
  it('draws fresh dice, rather than failing the same way again', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = fresh(seed);
      const p = createPlot(s, 'anselm', 'murder', ['edmund']);
      p.progress = 100;
      p.hiredBlades = 6;
      s.chars.edmund.guard = 0;
      s.ap = 3;
      if (strikeChance(s, p) < 90) continue;
      const saved = JSON.stringify(s);
      if (perform(s, 'anselm', { type: 'strike', plotId: p.id }).ok) continue;
      // The same dice, the same failure.
      expect(perform(JSON.parse(saved) as GameState, 'anselm', { type: 'strike', plotId: p.id }).ok).toBe(false);
      let killed = 0;
      for (let salt = 1; salt <= 10; salt++) {
        const back = JSON.parse(saved) as GameState;
        stir(back, salt);
        if (perform(back, 'anselm', { type: 'strike', plotId: p.id }).ok) killed++;
      }
      expect(killed).toBeGreaterThanOrEqual(7);
      return;
    }
    throw new Error('no failed strike at 90% or better');
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

  it('digging into a tale with no forged letters behind it finds nothing, and the King cools on it', () => {
    const s = fresh();
    const sec = s.secrets['s-false-pact'];
    delete sec.fabricatedBy;
    sec.inquiry = s.turn;
    learn(s, 'osric', sec.id, 60, 'anselm');
    for (let i = 0; i < 100; i++) pursueInquiries(s);
    expect(sec.guilty.every((g) => s.chars[g].status !== 'imprisoned')).toBe(true);
    expect(credence(s, 'osric', sec.id)).toBeLessThan(60);
  });
});

describe('a charge once judged', () => {
  it('is not heard again, from anyone, whatever comes to light after', () => {
    const s = fresh();
    const sid = 's-aldric-regicide';
    const other = s.order.find((id) => !['osric', 'aldric', 'anselm'].includes(id) && s.chars[id].rank !== 'servant' && chargesFor(s, id, [sid]).length > 0)!;
    learn(s, other, sid, 70, 'rumour');
    applyJudgments(s, 'anselm', [{ accused: 'aldric', secretId: sid, verdict: 'dismiss', score: 45, forgeryFound: false }]);
    expect(chargesFor(s, other, [sid])).toEqual([]);
    expect(check(s, other, { type: 'denounce', secretId: sid })).toMatch(/already judged/);
    s.secrets[sid].evidence += 40;
    expect(chargesFor(s, other, [sid])).toEqual([]);
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
