// Prose helpers. All names go through here so a character's style follows their
// fortunes (a knight crowned is "King Cedric" from then on).

import { pick, type RngHolder } from './rng';
import { ch, displayName } from './world';
import type { CharId, GameState } from './types';

export const nm = (s: GameState, id: CharId): string => displayName(s, id);

export const first = (s: GameState, id: CharId): string => {
  const c = ch(s, id);
  if (c.rank === 'king') return `King ${c.short}`;
  if (c.rank === 'queen') return `Queen ${c.short}`;
  return c.short;
};

export function names(s: GameState, ids: CharId[], short = false): string {
  const parts = ids.map((id) => (short ? first(s, id) : nm(s, id)));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export const he = (s: GameState, id: CharId) => (ch(s, id).gender === 'f' ? 'she' : 'he');
export const him = (s: GameState, id: CharId) => (ch(s, id).gender === 'f' ? 'her' : 'him');
export const his = (s: GameState, id: CharId) => (ch(s, id).gender === 'f' ? 'her' : 'his');
export const He = (s: GameState, id: CharId) => cap(he(s, id));
export const His = (s: GameState, id: CharId) => cap(his(s, id));

export const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** "You" when the subject is the reader, otherwise the name. */
export function who(s: GameState, id: CharId, reader: CharId): string {
  return id === reader ? 'you' : nm(s, id);
}

export function vary(r: RngHolder, options: string[]): string {
  return pick(r, options);
}

export const PLACES = [
  'in the cloister walk',
  'beneath the minstrels’ gallery',
  'by the chapel door',
  'on the windy battlements',
  'in the stables at dusk',
  'over a cup of hippocras',
  'behind the arras of the great hall',
  'in the herb garden',
  'at the foot of the north stair',
  'while the hounds were being fed',
];

export function credenceWord(c: number): string {
  if (c >= 85) return 'certain';
  if (c >= 65) return 'convinced';
  if (c >= 45) return 'inclined to believe';
  if (c >= 25) return 'doubtful';
  return 'disbelieving';
}

export function evidenceWord(e: number): string {
  if (e >= 75) return 'damning';
  if (e >= 55) return 'strong';
  if (e >= 35) return 'some';
  if (e >= 15) return 'thin';
  return 'none to speak of';
}

export function opinionWord(o: number): string {
  if (o >= 60) return 'Devoted';
  if (o >= 30) return 'Warm';
  if (o >= 10) return 'Cordial';
  if (o > -10) return 'Indifferent';
  if (o > -30) return 'Cool';
  if (o > -60) return 'Hostile';
  return 'Loathing';
}

export function chanceWord(p: number): string {
  if (p >= 85) return 'Near certain';
  if (p >= 65) return 'Likely';
  if (p >= 45) return 'Even odds';
  if (p >= 25) return 'Unlikely';
  return 'Remote';
}

export const TRAIT_WORDS: Record<string, [string, string]> = {
  ambition: ['Content', 'Ambitious'],
  cunning: ['Guileless', 'Cunning'],
  honor: ['Unscrupulous', 'Honourable'],
  boldness: ['Cautious', 'Bold'],
  greed: ['Generous', 'Greedy'],
  wrath: ['Patient', 'Wrathful'],
  paranoia: ['Trusting', 'Suspicious'],
  will: ['Pliable', 'Iron-willed'],
  charm: ['Awkward', 'Silver-tongued'],
  martial: ['Unwarlike', 'Formidable'],
};

/** The temperament the court can read at a glance. */
export function temperament(s: GameState, id: CharId): string[] {
  const t = ch(s, id).traits;
  const out: string[] = [];
  for (const [k, [lo, hi]] of Object.entries(TRAIT_WORDS)) {
    const v = t[k as keyof typeof t];
    if (v >= 70) out.push(hi);
    else if (v <= 25) out.push(lo);
  }
  return out;
}
