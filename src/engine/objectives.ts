// Winning and losing. The player rises from a minor lord to the throne, or dies
// trying. Everyone else is judged against the ambition they began with.

import { names, nm } from './text';
import { ch, isAlive, isFree, officeOf, OFFICE_NAMES } from './world';
import type { CharId, GameState, ObjectiveResult, Verdict } from './types';

export const PLAYER_AIM = {
  title: 'The Crown',
  goal: 'Rise from a minor lord to the throne of Wendmere, or die trying.',
};

const SCORE: Record<Verdict, number> = { triumph: 100, victory: 75, survival: 40, defeat: 15, death: 0 };

const isKing = (s: GameState, id: CharId) => s.king === id && isFree(s, id);

export function evaluate(s: GameState, who: CharId = s.player): ObjectiveResult {
  const c = ch(s, who);
  const notes: string[] = [];
  const done = (verdict: Verdict, headline: string): ObjectiveResult => ({ verdict, score: SCORE[verdict], headline, notes });

  if (who === s.player) {
    if (isKing(s, who)) return done('triumph', 'You wear the crown of Wendmere.');
    if (c.status === 'dead') {
      notes.push(c.fate ?? 'You died.');
      return done('death', 'You did not live to rule.');
    }
    if (c.status === 'fled') return done('defeat', 'You fled into exile.');
    if (c.status === 'imprisoned') return done('defeat', 'You rot in the Tower.');
    const off = officeOf(s, who);
    if (off) notes.push(`You hold the office of ${OFFICE_NAMES[off]}.`);
    return done('survival', 'You live, and the crown is still on another head.');
  }

  if (c.status === 'dead') {
    notes.push(c.fate ?? '');
    return done('death', 'Did not live to see it.');
  }
  const a = c.firstAgenda ?? c.agenda;
  const removed = (ids: CharId[]) => ids.length > 0 && ids.every((t) => !isFree(s, t));
  switch (a.kind) {
    case 'crown':
      if (isKing(s, who)) return done('triumph', 'Took the crown.');
      return done(c.status === 'free' ? 'survival' : 'defeat', 'Never wore the crown.');
    case 'keep-crown':
      return isKing(s, who) ? done('victory', 'Still King.') : done('defeat', 'Lost the crown.');
    case 'destroy':
      return removed(a.targets) ? done('victory', `Saw ${names(s, a.targets)} brought down.`) : done('survival', `${names(s, a.targets)} still stand${a.targets.length > 1 ? '' : 's'}.`);
    case 'restitution': {
      const whole = Object.values(s.lands).filter((l) => l.rightful === who);
      const holds = whole.length > 0 && whole.every((l) => l.holder === who);
      if (holds && removed(a.targets)) return done('triumph', 'Took back the inheritance, and the thief has paid.');
      if (holds) return done('victory', 'Took back the inheritance.');
      return done('survival', 'Still landless.');
    }
    case 'protect-king':
      return s.king && isFree(s, s.king) ? done('victory', `King ${s.chars[s.king].short} lives.`) : done('defeat', 'Failed the King.');
    case 'raise-spouse': {
      const sp = c.spouse;
      if (sp && isKing(s, sp)) return done('triumph', 'Her husband wears the crown.');
      if (sp && isFree(s, sp) && officeOf(s, sp)) return done('victory', `Her husband rose to ${OFFICE_NAMES[officeOf(s, sp)!]}.`);
      return done(sp && isAlive(s, sp) ? 'survival' : 'defeat', sp && isAlive(s, sp) ? 'Her husband is still small.' : 'Her husband is gone.');
    }
    case 'protect-spouse':
      return c.spouse && isAlive(s, c.spouse) ? done('victory', `Kept ${nm(s, c.spouse)} alive.`) : done('defeat', 'Could not save her husband.');
    case 'rise':
      if (isKing(s, who)) return done('triumph', 'Rose all the way to the throne.');
      if (officeOf(s, who)) return done('victory', `Rose to ${OFFICE_NAMES[officeOf(s, who)!]}.`);
      return done('survival', 'Never rose.');
    default:
      return c.status === 'free' ? done('victory', 'Survived the court.') : done('defeat', c.status === 'fled' ? 'Fled.' : 'In the Tower.');
  }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  triumph: 'Triumph',
  victory: 'Victory',
  survival: 'Survival',
  defeat: 'Defeat',
  death: 'Death',
};

/** Executed people who were guilty of no real treason. */
export function innocentsExecuted(s: GameState): CharId[] {
  return s.order.filter((id) => {
    const c = ch(s, id);
    if (c.status !== 'dead' || !c.fate?.startsWith('Beheaded')) return false;
    return !Object.values(s.secrets).some((sec) => sec.truth && sec.treason && sec.guilty.includes(id));
  });
}
