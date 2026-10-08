// The recognisable shapes people come in. The generator samples traits around
// these means, so two soldiers are alike but never the same.

import type { Traits } from '../types';

export interface Archetype {
  id: string;
  label: string;
  traits: Partial<Traits>;
  facades: string[];
  bios: string[];
}

const A = (a: Archetype) => a;

export const ARCHETYPES = {
  'old-king': A({
    id: 'old-king',
    label: 'Old king',
    traits: { ambition: 40, cunning: 50, honor: 50, boldness: 50, wrath: 70, paranoia: 60, will: 70, charm: 40, martial: 50 },
    facades: ['An old lion, grey at the muzzle, who still remembers how to bite.', 'A tired king who trusts no one and shows it.'],
    bios: ['He has no living heir. When he dies the Witan will choose, and every lord at court can count.'],
  }),
  queen: A({
    id: 'queen',
    label: 'Queen',
    traits: { ambition: 60, cunning: 65, honor: 45, boldness: 50, will: 70, charm: 70, martial: 5 },
    facades: ['A gracious queen who smiles at everyone.', 'A cool, watchful queen.'],
    bios: ['Married to an old king, childless, and thinking hard about what becomes of a widowed queen.'],
  }),
  soldier: A({
    id: 'soldier',
    label: 'Soldier passed over',
    traits: { ambition: 85, cunning: 35, honor: 35, boldness: 85, greed: 50, wrath: 70, paranoia: 30, will: 70, charm: 45, martial: 88 },
    facades: ['The King’s loyal sword, plain-spoken and true.', 'A blunt soldier with no head for politics.'],
    bios: ['He won the King’s battles and believes the crown was owed to him long ago.'],
  }),
  official: A({
    id: 'official',
    label: 'Careful official',
    traits: { ambition: 60, cunning: 60, honor: 45, boldness: 35, greed: 65, wrath: 40, paranoia: 65, will: 50, charm: 60, martial: 35 },
    facades: ['A careful servant of the realm who counts every penny.', 'A dry, dependable official.'],
    bios: ['Twenty years at the King’s elbow have taught him to let others take the risks.'],
  }),
  spider: A({
    id: 'spider',
    label: 'Spider',
    traits: { ambition: 88, cunning: 90, honor: 15, boldness: 55, greed: 45, wrath: 30, paranoia: 50, will: 65, charm: 72, martial: 40 },
    facades: ['The King’s ever-loyal eyes and ears.', 'A soft-spoken man who forgets nothing.'],
    bios: ['He collects secrets the way other men collect hawks, and he means to spend them.'],
  }),
  grandee: A({
    id: 'grandee',
    label: 'Grandee',
    traits: { ambition: 40, cunning: 50, honor: 60, boldness: 45, greed: 60, wrath: 45, paranoia: 40, will: 55, charm: 55, martial: 50 },
    facades: ['A wealthy lord who enjoys his comforts.', 'An old name with old money.'],
    bios: ['Rich enough not to need the crown, proud enough to resent anyone who wears it badly.'],
  }),
  climber: A({
    id: 'climber',
    label: 'Climber',
    traits: { ambition: 68, cunning: 58, honor: 30, boldness: 35, greed: 70, wrath: 35, paranoia: 45, will: 40, charm: 58, martial: 45 },
    facades: ['A modest lord, content with his lot.', 'An eager, agreeable newcomer.'],
    bios: ['Small lands, large appetite. He watches the great lords the way a fox watches a henhouse.'],
  }),
  content: A({
    id: 'content',
    label: 'Content lord',
    traits: { ambition: 30, cunning: 45, honor: 60, boldness: 40, greed: 45, wrath: 40, paranoia: 40, will: 50, charm: 50, martial: 55 },
    facades: ['A country lord who would rather be hunting.', 'A steady, unremarkable man.'],
    bios: ['He wants a quiet life. The court rarely allows one.'],
  }),
  spur: A({
    id: 'spur',
    label: 'The spur',
    traits: { ambition: 88, cunning: 75, honor: 30, boldness: 70, greed: 60, wrath: 45, paranoia: 40, will: 88, charm: 70, martial: 10 },
    facades: ['A dutiful wife from a minor house.', 'A charming hostess, always at her husband’s side.'],
    bios: ['She married a smaller man than she is. She does not intend to stay small.'],
  }),
  devoted: A({
    id: 'devoted',
    label: 'Devoted wife',
    traits: { ambition: 30, cunning: 55, honor: 75, boldness: 45, greed: 25, wrath: 25, paranoia: 60, will: 70, charm: 60, martial: 10 },
    facades: ['A pious wife who keeps to her prayers.', 'A gentle lady devoted to her house.'],
    bios: ['She loves her husband and fears what his ambitions will cost them.'],
  }),
  unhappy: A({
    id: 'unhappy',
    label: 'Unhappy wife',
    traits: { ambition: 50, cunning: 60, honor: 35, boldness: 60, greed: 50, wrath: 50, paranoia: 40, will: 60, charm: 72, martial: 10 },
    facades: ['A bright ornament of the court.', 'A dutiful wife who laughs a little too readily.'],
    bios: ['A cold marriage, a warm heart, and a great deal of time on her hands.'],
  }),
  rake: A({
    id: 'rake',
    label: 'Charming rake',
    traits: { ambition: 55, cunning: 60, honor: 30, boldness: 65, greed: 55, wrath: 40, paranoia: 35, will: 55, charm: 82, martial: 60 },
    facades: ['A charming courtier, welcome at every table.', 'The best dancer at court.'],
    bios: ['He has never wanted anything he could not talk his way into.'],
  }),
  disinherited: A({
    id: 'disinherited',
    label: 'Disinherited',
    traits: { ambition: 50, cunning: 55, honor: 45, boldness: 55, greed: 60, wrath: 65, paranoia: 60, will: 55, charm: 45, martial: 60 },
    facades: ['A grateful younger brother.', 'A quiet younger son, eager to please.'],
    bios: ['Cheated of his share of the family lands. He has learned to smile, not to forget.'],
  }),
  'younger-son': A({
    id: 'younger-son',
    label: 'Younger son',
    traits: { ambition: 55, cunning: 50, honor: 50, boldness: 55, greed: 50, wrath: 50, paranoia: 45, will: 45, charm: 55, martial: 60 },
    facades: ['A younger son looking for a place.', 'A hedge knight with good manners.'],
    bios: ['No land of his own. Everything he will ever have, he must win or be given.'],
  }),
  shield: A({
    id: 'shield',
    label: 'Loyal shield',
    traits: { ambition: 35, cunning: 35, honor: 82, boldness: 70, greed: 35, wrath: 55, paranoia: 50, will: 55, charm: 35, martial: 85 },
    facades: ['The King’s shield, blunt and loyal.'],
    bios: ['Sworn to keep the King alive. He trusts too easily, and knows it.'],
  }),
  priest: A({
    id: 'priest',
    label: 'Priest',
    traits: { ambition: 20, cunning: 60, honor: 88, boldness: 35, greed: 15, wrath: 15, paranoia: 30, will: 65, charm: 65, martial: 5 },
    facades: ['A gentle priest who hears everyone’s sins.'],
    bios: ['He hears confessions and is bound by their seal. He can feel the court tightening like a bowstring.'],
  }),
  steward: A({
    id: 'steward',
    label: 'Steward',
    traits: { ambition: 40, cunning: 55, honor: 50, boldness: 30, greed: 60, wrath: 30, paranoia: 50, will: 40, charm: 45, martial: 20 },
    facades: ['A steward who keeps the accounts and his own counsel.'],
    bios: ['He reads every letter that crosses his master’s table.'],
  }),
  maid: A({
    id: 'maid',
    label: 'Maid',
    traits: { ambition: 35, cunning: 50, honor: 50, boldness: 35, greed: 55, wrath: 30, paranoia: 35, will: 40, charm: 55, martial: 5 },
    facades: ['A lady’s maid who is never noticed.'],
    bios: ['She hears everything said behind a bedchamber door.'],
  }),
  player: A({
    id: 'player',
    label: 'Minor lord',
    traits: { ambition: 60, cunning: 55, honor: 50, boldness: 50, greed: 50, wrath: 45, paranoia: 45, will: 50, charm: 55, martial: 50 },
    facades: ['A minor lord new to court.'],
    bios: ['Small lands, an old name nobody remembers, and a seat at the bottom of the hall.'],
  }),
} as const;

export type ArchetypeId = keyof typeof ARCHETYPES;
