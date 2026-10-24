// Where people go, for anyone who has them followed. Routine places say who
// someone is; the quiet ones say what they are hiding.

import type { BusinessKind } from '../types';

export const HAUNTS = {
  hall: 'the great hall',
  council: 'the King’s council chamber',
  chapel: 'the castle chapel',
  priory: 'St Aelred’s priory',
  market: 'the cloth market',
  gardens: 'the Queen’s gardens',
  butts: 'the archery butts',
  mews: 'the falcon mews',
  tiltyard: 'the tiltyard',
  library: 'the old library',
  almshouse: 'the almshouse by the bridge',
} as const;

/** Where lovers and plotters meet, out of sight. */
export const QUIET_PLACES = [
  'the river stairs after dark',
  'a chandler’s house in Cheapside',
  'the old orchard beyond the walls',
  'the crypt beneath St Aelred’s',
  'the back room of the Swan',
  'a hunting lodge in Wendmere Chase',
  'the boathouse below the water gate',
];

/** Where each trade is run from. */
export const TRADE_HAUNTS: Record<BusinessKind, string> = {
  estates: 'the home farm',
  wool: 'the wool hall',
  mill: 'the mill on the Wend',
  wine: 'the wine vaults under Vintry Lane',
  moneylending: 'a counting house in Lombard Row',
  taxfarm: 'the customs house',
  gambling: 'a gaming house behind the Shambles',
  bathhouse: 'a bathhouse in Southbank',
  smuggling: 'the creeks below Saltmere',
  forgery: 'a scrivener’s back room',
  apothecary: 'an apothecary’s shop in Pepper Lane',
};
