// What each soul at court is trying to achieve, judged at the season's end.

import { first, nm } from './text';
import { ch, isAlive, isFree, officeOf } from './world';
import type { CharId, GameState, ObjectiveResult, Verdict } from './types';

export interface Objective {
  title: string;
  goal: string;
  triumph: string;
}

export const OBJECTIVES: Record<CharId, Objective> = {
  osric: {
    title: 'Keep the Crown',
    goal: 'Be alive and King when the season ends.',
    triumph: 'Also see every true regicide dead, jailed or fled, without beheading an innocent man.',
  },
  aldric: { title: 'Seize the Crown', goal: 'Be King when the season ends.', triumph: 'Wear the crown with your wife alive beside you.' },
  rowena: { title: 'Save Your Husband', goal: 'Keep Aldric alive to the season’s end.', triumph: 'Keep him alive and free, with no blood on his hands — or see him crowned.' },
  bertrand: { title: 'Bring Down the Marshal', goal: 'See Aldric dead, jailed or fled while you stay free.', triumph: 'Also hold a great office (or the crown) at the end.' },
  cedric: { title: 'The Long Knife', goal: 'Be King when the season ends.', triumph: 'Be King with Aldric and Bertrand both gone.' },
  edmund: {
    title: 'From the Wings',
    goal: 'See Aldric, Bertrand and Cedric fall while you rise into a great office.',
    triumph: 'Be King when the season ends.',
  },
  isolde: { title: 'The Spur', goal: 'See Edmund hold a great office at the season’s end.', triumph: 'See Edmund crowned, and yourself Queen.' },
  gareth: { title: 'The Second Son', goal: 'Hold Wyke Fields, your rightful land, at the season’s end.', triumph: 'Also see Edmund dead or ruined.' },
  wystan: { title: 'The Patient Brother', goal: 'Hold Fenmoor, your rightful land, at the season’s end.', triumph: 'Also see Edmund dead or ruined.' },
  anselm: { title: 'Shepherd of the Court', goal: 'Let no more than two souls die by murder or the axe.', triumph: 'Let no one die at all, and King Osric still reign.' },
  hugh: { title: 'The King’s Shield', goal: 'Keep King Osric alive to the season’s end.', triumph: 'Also see every true regicide dead, jailed or fled.' },
};

const SCORE: Record<Verdict, number> = { triumph: 100, victory: 75, survival: 40, defeat: 15, death: 0 };

const removed = (s: GameState, id: CharId) => !isFree(s, id);
const isKing = (s: GameState, id: CharId) => s.king === id && isFree(s, id);

/** Did this character truly plot the King's death? */
function trueRegicides(s: GameState): CharId[] {
  const out = new Set<CharId>();
  for (const p of Object.values(s.plots)) {
    if (p.kind === 'murder' && p.targets.includes('osric') && p.createdTurn >= 0 && (p.progress > 0 || p.status !== 'active')) out.add(p.owner);
  }
  for (const sec of Object.values(s.secrets)) {
    if (sec.truth && sec.kind === 'regicide' && sec.victims.includes('osric')) for (const g of sec.guilty) out.add(g);
  }
  return [...out];
}

/** The executed who were guilty of no real treason. */
export function innocentsExecuted(s: GameState): CharId[] {
  return s.order.filter((id) => {
    const c = ch(s, id);
    if (c.status !== 'dead' || !c.fate?.startsWith('Beheaded')) return false;
    return !Object.values(s.secrets).some((sec) => sec.truth && sec.treason && sec.guilty.includes(id));
  });
}

export function violentDeaths(s: GameState): CharId[] {
  return s.order.filter((id) => ch(s, id).status === 'dead');
}

export function evaluate(s: GameState, who: CharId = s.player): ObjectiveResult {
  const c = ch(s, who);
  const notes: string[] = [];
  const done = (verdict: Verdict, headline: string): ObjectiveResult => ({ verdict, score: SCORE[verdict], headline, notes });

  if (c.status === 'dead') {
    notes.push(c.fate ?? 'You died.');
    // A wife or a confessor may still win by others' fates; most may not.
    if (who !== 'isolde' && who !== 'rowena' && who !== 'anselm') return done('death', 'You did not live to see the season’s end.');
  }

  switch (who) {
    case 'osric':
    case 'aldric':
    case 'cedric': {
      const king = isKing(s, who);
      if (who === 'osric') {
        if (!king) return done(c.status === 'fled' ? 'defeat' : 'defeat', 'The crown has passed from you.');
        const regs = trueRegicides(s).filter((r) => r !== 'osric');
        const loose = regs.filter((r) => isFree(s, r));
        const innocents = innocentsExecuted(s);
        notes.push(loose.length ? `Still at large: ${loose.map((r) => nm(s, r)).join(', ')}.` : 'Every man who plotted your death is gone.');
        if (innocents.length) notes.push(`Beheaded without true guilt: ${innocents.map((r) => nm(s, r)).join(', ')}.`);
        return !loose.length && !innocents.length ? done('triumph', 'You reign, and your enemies are gone.') : done('victory', 'You still wear the crown.');
      }
      if (king) {
        if (who === 'cedric' && removed(s, 'aldric') && removed(s, 'bertrand')) return done('triumph', 'The long knife found its mark. King Cedric.');
        if (who === 'aldric' && isAlive(s, 'rowena')) return done('triumph', 'King Aldric, by right of the sword.');
        return done('victory', 'You wear the crown.');
      }
      if (c.status === 'free') {
        notes.push(officeOf(s, who) ? 'You keep your office.' : 'You hold no office.');
        return done('survival', 'You live, but the crown is on another head.');
      }
      return done('defeat', c.status === 'fled' ? 'You fled into exile.' : 'You rot in the Tower.');
    }
    case 'rowena': {
      if (!isAlive(s, 'aldric')) return done(c.status === 'dead' ? 'death' : 'defeat', 'Your husband is dead.');
      if (isKing(s, 'aldric')) return done('triumph', 'Your husband wears the crown — and lives.');
      const clean = isFree(s, 'aldric') && isAlive(s, 'osric');
      if (c.status === 'dead') return done('defeat', 'You died; your husband lives on without you.');
      return clean ? done('triumph', 'Aldric lives, free, with no king’s blood on his hands.') : done('victory', 'Aldric lives.');
    }
    case 'bertrand': {
      if (!removed(s, 'aldric')) return done(c.status === 'free' ? 'defeat' : 'defeat', 'The Marshal still stands.');
      if (c.status !== 'free') return done('defeat', 'Aldric fell, but so did you.');
      if (isKing(s, who) || officeOf(s, who)) return done('triumph', 'Aldric is gone, and you stand first among the King’s servants.');
      return done('victory', 'Aldric is gone.');
    }
    case 'edmund': {
      if (isKing(s, who)) return done('triumph', 'The minor lord from the wings is King.');
      const three = ['aldric', 'bertrand', 'cedric'].every((x) => removed(s, x));
      if (c.status !== 'free') return done('defeat', c.status === 'fled' ? 'You fled.' : 'You are in the Tower.');
      if (three && officeOf(s, who)) return done('victory', 'The old management is gone; you are the new.');
      notes.push(three ? 'The three great lords are gone, but you hold no office.' : 'Not all three great lords have fallen.');
      return done('survival', 'You live, still in the wings.');
    }
    case 'isolde': {
      if (isKing(s, 'edmund')) return done('triumph', 'Queen Isolde.');
      if (isFree(s, 'edmund') && officeOf(s, 'edmund')) return done('victory', `Your husband is ${officeOf(s, 'edmund')}, and you with him.`);
      if (c.status === 'dead') return done('death', 'You did not live to see it.');
      return isAlive(s, 'edmund') ? done('survival', 'Edmund lives, still small.') : done('defeat', 'Edmund is dead.');
    }
    case 'gareth':
    case 'wystan': {
      const land = who === 'gareth' ? 'wyke' : 'fenmoor';
      const holds = s.lands[land].holder === who;
      const ed = ch(s, 'edmund');
      const ruined = ed.status !== 'free' || (!officeOf(s, 'edmund') && ed.prestige < 15) || Object.values(s.secrets).some((x) => x.kind === 'theft' && x.exposed);
      if (c.status !== 'free') return done('defeat', c.status === 'fled' ? 'You fled.' : 'You are in the Tower.');
      if (holds && ruined) return done('triumph', `${s.lands[land].name} is yours, and Edmund has paid.`);
      if (holds) return done('victory', `${s.lands[land].name} is yours again.`);
      return done('survival', 'You live, landless still.');
    }
    case 'anselm': {
      const dead = violentDeaths(s).filter((d) => d !== 'anselm');
      notes.push(dead.length ? `The dead: ${dead.map((d) => first(s, d)).join(', ')}.` : 'No one died.');
      if (!dead.length && isKing(s, 'osric')) return done('triumph', 'The bowstring never snapped. Deo gratias.');
      if (dead.length <= 2) return done(c.status === 'dead' ? 'death' : 'victory', 'You saved what could be saved.');
      return done(c.status === 'dead' ? 'death' : 'defeat', 'The court drowned in blood.');
    }
    case 'hugh': {
      if (!isKing(s, 'osric')) return done(c.status === 'free' ? 'defeat' : 'defeat', 'You failed your King.');
      const loose = trueRegicides(s).filter((r) => r !== 'osric' && isFree(s, r));
      notes.push(loose.length ? `Still at large: ${loose.map((r) => nm(s, r)).join(', ')}.` : 'Every regicide is accounted for.');
      return loose.length ? done('victory', 'King Osric lives.') : done('triumph', 'King Osric lives, and his would-be murderers are gone.');
    }
  }
  return done(c.status === 'free' ? 'survival' : 'defeat', 'You endured.');
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  triumph: 'Triumph',
  victory: 'Victory',
  survival: 'Survival',
  defeat: 'Defeat',
  death: 'Death',
};
