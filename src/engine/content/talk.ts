// What people let fall in conversation. `{he}`, `{his}`, `{him}` and `{target}`
// are filled in when spoken.

import type { AgendaKind } from '../types';

/** Aims a person will talk about freely: hearing them is learning their true design. */
export const OPEN_AIMS: Partial<Record<AgendaKind, string[]>> = {
  rise: ['{He} makes no secret of it: {he} wants an office, and the King’s ear.', '{He} talks of little but which office will fall vacant next.'],
  peace: ['{He} is sick of the knives at court, and says so.', '{He} prays aloud that the killing will stop.'],
  'protect-king': ['{He} would die for the King, and says it as if {he} means it.'],
  'protect-spouse': ['Everything {he} says comes back to keeping {his} husband safe.'],
  'raise-spouse': ['{He} wants {his} husband higher in the hall, and does not care who knows it.'],
  'keep-crown': ['{He} trusts no one who wants anything, and watches the whole hall.'],
};

/** Aims a person hides: a careless word is all you get. */
export const SLIPS: Partial<Record<AgendaKind, string[]>> = {
  crown: ['{He} talks a little too long about how old the King looks.', '{He} asked, as if idly, how the Witan would vote if the throne fell empty.'],
  destroy: ['{He} cannot speak of {target} without {his} jaw tightening.', 'Every road in the talk led back to {target}, and none of them kindly.'],
  restitution: ['{He} spoke of {his} father’s will, and of what was taken, and then fell silent.'],
};

export const WARM = ['{He} speaks warmly of {target}.', '{He} would trust {target} with {his} life, {he} says.'];
export const BITTER = ['{He} speaks bitterly of {target}.', '{He} cannot hear the name of {target} without a sneer.'];

export const GOSSIP_OPENERS = ['Over the wine, {first} said:', 'Leaning close, {first} told you:', 'Half in jest, {first} let slip:', '{first} lowered {his} voice:'];
export const WARNING_OPENERS = ['{first} took your arm and warned you:', 'Before you parted, {first} said quietly:'];
