import { describe, expect, it } from 'vitest';
import { credence, newGame, plotsOwnedBy } from '../src/engine';

// The opening position must say exactly what the story says.
describe('the Season of Knives opening', () => {
  const s = newGame(1, 'anselm');
  const plot = (id: string) => s.plots[id];

  it('the first knight means to murder the King', () => {
    expect(plot('p-aldric')).toMatchObject({ owner: 'aldric', kind: 'murder', targets: ['osric'], status: 'active' });
    expect(s.chars.aldric.agenda.kind).toBe('crown');
  });

  it('the second knight knows, tells the third rather than the King, and wants the first gone', () => {
    expect(credence(s, 'bertrand', 's-aldric-regicide')).toBeGreaterThanOrEqual(70);
    expect(credence(s, 'osric', 's-aldric-regicide')).toBe(0);
    expect(credence(s, 'cedric', 's-aldric-regicide')).toBeGreaterThanOrEqual(70);
    expect(s.knowledge.cedric['s-aldric-regicide'].source).toBe('bertrand');
    expect(plot('p-bertrand')).toMatchObject({ owner: 'bertrand', kind: 'ruin', targets: ['aldric'] });
  });

  it('the third knight says he will go to the King, but means to accuse both and then kill the King', () => {
    const cedricInBertrands = plot('p-bertrand').members.find((m) => m.id === 'cedric');
    expect(cedricInBertrands?.sincere).toBe(false);
    expect(cedricInBertrands?.role).toMatch(/carry the charge/i);
    const forged = s.secrets['s-false-pact'];
    expect(forged).toMatchObject({ truth: false, fabricatedBy: 'cedric', guilty: ['aldric', 'bertrand'], victims: ['osric'] });
    expect(plot('p-cedric-ruin').charges).toEqual(['s-false-pact']);
    expect(plot('p-cedric-crown')).toMatchObject({ kind: 'murder', targets: ['osric'], waitFor: ['aldric', 'bertrand'] });
  });

  it('a fourth, minor lord knows the third’s plan through his wife, and would have the King kill all three', () => {
    expect(s.chars.edmund.rank).toBe('lord');
    expect(s.chars.edmund.prestige).toBeLessThan(s.chars.cedric.prestige);
    expect(s.knowledge.isolde['s-cedric-usurp'].source).toBe('spies');
    expect(s.knowledge.edmund['s-cedric-usurp'].source).toBe('isolde');
    expect(plot('p-edmund-ruin')).toMatchObject({ owner: 'edmund', kind: 'ruin', targets: ['aldric', 'bertrand', 'cedric'] });
    expect(plot('p-edmund-crown')).toMatchObject({ kind: 'murder', targets: ['osric'], waitFor: ['aldric', 'bertrand', 'cedric'] });
  });

  it('his wife pushes him to it', () => {
    expect(s.chars.isolde.agenda.kind).toBe('raise-spouse');
    expect(s.chars.isolde.traits.will).toBeGreaterThan(s.chars.edmund.traits.will + 30);
    expect(s.chars.edmund.pressure).toBeGreaterThan(0);
  });

  it('he stole his brothers’ inheritance and offers them a bigger dream', () => {
    expect(s.lands.wyke).toMatchObject({ holder: 'edmund', rightful: 'gareth' });
    expect(s.lands.fenmoor).toMatchObject({ holder: 'edmund', rightful: 'wystan' });
    expect(s.secrets['s-edmund-theft']).toMatchObject({ truth: true, guilty: ['edmund'] });
    expect(s.pledges.filter((p) => p.from === 'edmund').map((p) => p.to).sort()).toEqual(['gareth', 'wystan']);
  });

  it('the brothers have sworn to him only to double-cross him once he has done the killing', () => {
    const members = plot('p-edmund-ruin').members;
    expect(members.map((m) => [m.id, m.sincere])).toEqual([
      ['gareth', false],
      ['wystan', false],
    ]);
    expect(plot('p-brothers')).toMatchObject({ owner: 'gareth', kind: 'murder', targets: ['edmund'], waitFor: ['aldric', 'bertrand', 'cedric'] });
    expect(credence(s, 'edmund', 's-brothers-betrayal')).toBe(0);
  });

  it('every plot is described by a secret that points back to it', () => {
    for (const p of Object.values(s.plots)) {
      expect(s.secrets[p.secretId]?.plotId).toBe(p.id);
      expect(credence(s, p.owner, p.secretId)).toBe(100);
    }
  });

  it('the King knows nothing on the first morning', () => {
    expect(Object.keys(s.knowledge.osric ?? {})).toHaveLength(0);
    expect(plotsOwnedBy(s, 'osric')).toHaveLength(0);
  });
});
