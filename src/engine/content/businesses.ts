// Trades and rackets. What you run decides how the court sees you, and what
// doors it opens. Standing values are opinion points that each part of society
// adds to its regard for an owner; a racket's `ifKnown` applies only to those
// who know of it.

import type { BusinessKind, Estate, Perk } from '../types';

export interface BusinessDef {
  kind: BusinessKind;
  name: string;
  blurb: string;
  /** Gold to set it up. */
  cost: number;
  /** Crowns a week, before trouble. */
  income: number;
  /** An illicit trade: run in secret, and a scandal and a crime if known. */
  illicit: boolean;
  /** How each part of society regards an owner who runs it openly. */
  standing: Partial<Record<Estate, number>>;
  /** Further regard, from anyone who knows of a racket. */
  ifKnown?: Partial<Record<Estate, number>>;
  /** Weekly chance (%) that something goes wrong. */
  risk: number;
  troubles: { text: string; loss: number }[];
  /** Weekly chance (%) that word of a racket gets out. */
  leak?: number;
  /** How the secret is told, after the owner's name: "secretly runs …". */
  secretly?: string;
  /** The charge if it is laid before the King. */
  crime?: string;
  perk: Perk;
  perkText: string;
  /** Needs the King's grant (and his favour) to take up. */
  royalGrant?: boolean;
}

export const BUSINESSES: Record<BusinessKind, BusinessDef> = {
  estates: {
    kind: 'estates',
    name: 'Estates and harvest',
    blurb: 'Tenants, fields and a home farm. Honest money, and not much of it.',
    cost: 30,
    income: 3,
    illicit: false,
    standing: { nobility: 8, commons: 4 },
    risk: 5,
    troubles: [
      { text: 'Hail flattened the barley', loss: 10 },
      { text: 'Murrain ran through the cattle', loss: 8 },
    ],
    perk: 'retainers',
    perkText: 'Your own men about you: knives find you harder to reach.',
  },
  wool: {
    kind: 'wool',
    name: 'Wool trade',
    blurb: 'Fleeces bought in the dales and shipped to the looms over the sea.',
    cost: 60,
    income: 6,
    illicit: false,
    standing: { guilds: 12, commons: 3, nobility: -4 },
    risk: 8,
    troubles: [
      { text: 'A wool fleet foundered off the Saltmere coast', loss: 25 },
      { text: 'Buyers over the sea broke their contract', loss: 15 },
    ],
    perk: 'factors',
    perkText: 'Factors and foreign letters: names reach you before faces do.',
  },
  mill: {
    kind: 'mill',
    name: 'Mill and toll bridge',
    blurb: 'Every sack of grain in the district is ground at your wheel, and every cart pays at your bridge.',
    cost: 70,
    income: 6,
    illicit: false,
    standing: { commons: -10, guilds: 4, crown: 3 },
    risk: 8,
    troubles: [
      { text: 'The commons broke the mill-race in the night, crying monopoly', loss: 20 },
      { text: 'The great wheel cracked', loss: 10 },
    ],
    perk: 'leverage',
    perkText: 'Leverage over a district: the King hears your petitions more kindly.',
  },
  wine: {
    kind: 'wine',
    name: 'Wine import',
    blurb: 'Gascon reds and sweet Rhenish for the best tables at court.',
    cost: 70,
    income: 6,
    illicit: false,
    standing: { nobility: 8, guilds: 5, church: -3 },
    risk: 6,
    troubles: [{ text: 'A cargo of Gascon wine turned to vinegar on the quay', loss: 15 }],
    perk: 'cellar',
    perkText: "Every feast's cellar: introductions come easier, and you dine with more of the court.",
  },
  moneylending: {
    kind: 'moneylending',
    name: 'Moneylending',
    blurb: 'Lords live beyond their rents. You lend them the difference, at a price.',
    cost: 100,
    income: 9,
    illicit: false,
    standing: { nobility: -8, church: -12, guilds: 5, commons: -5, crown: 3 },
    risk: 6,
    troubles: [{ text: 'A debtor died owing you, and his heirs will not pay', loss: 30 }],
    perk: 'debtors',
    perkText: 'Debtors owe you favours: easier to draw into a scheme, or to squeeze.',
  },
  taxfarm: {
    kind: 'taxfarm',
    name: 'Tax farming',
    blurb: 'You pay the King the shire’s taxes up front, then collect them yourself, with interest.',
    cost: 80,
    income: 10,
    illicit: false,
    standing: { crown: 12, commons: -15, nobility: -4, guilds: -3 },
    risk: 8,
    troubles: [
      { text: 'Your collectors were stoned out of a village', loss: 20 },
      { text: 'A thin harvest left the farm short of the King’s due', loss: 25 },
    ],
    perk: 'royal-ear',
    perkText: "The King's ear: your charges weigh more when you lay them before him.",
    royalGrant: true,
  },
  gambling: {
    kind: 'gambling',
    name: 'Gambling house',
    blurb: 'Dice and cards behind an alehouse, where younger sons lose what their fathers left them.',
    cost: 50,
    income: 10,
    illicit: true,
    standing: { underworld: 10 },
    ifKnown: { nobility: -10, church: -15, crown: -5, commons: 3 },
    risk: 8,
    troubles: [
      { text: 'A brawl at the tables broke every stool in the house', loss: 12 },
      { text: 'A sharp from the coast cleaned out the bank', loss: 20 },
    ],
    leak: 4,
    secretly: 'a gambling house behind an alehouse in the Shambles',
    crime: 'keeping a gambling house',
    perk: 'debts',
    perkText: "Gamblers' debts as leverage: your threats bite harder.",
  },
  bathhouse: {
    kind: 'bathhouse',
    name: 'Bathhouse',
    blurb: 'Steam, wine and company by the river stairs. The clients talk.',
    cost: 60,
    income: 12,
    illicit: true,
    standing: { underworld: 10 },
    ifKnown: { church: -20, nobility: -12, crown: -6 },
    risk: 8,
    troubles: [{ text: 'The watch raided the bathhouse, and silence cost a purse', loss: 15 }],
    leak: 5,
    secretly: 'a bawdy bathhouse by the river stairs',
    crime: 'keeping a bawdy house',
    perk: 'informants',
    perkText: 'Informants among the clients: spying comes easier, and secrets drift your way.',
  },
  smuggling: {
    kind: 'smuggling',
    name: 'Smuggling',
    blurb: 'Untaxed wine, wool and worse, landed at night in the creeks below Saltmere.',
    cost: 60,
    income: 14,
    illicit: true,
    standing: { underworld: 15 },
    ifKnown: { crown: -20, guilds: -10, nobility: -6, commons: 5 },
    risk: 12,
    troubles: [
      { text: 'A barge of untaxed goods was seized at the river mouth', loss: 35 },
      { text: 'The excisemen found a cellar of brandy', loss: 25 },
    ],
    leak: 5,
    secretly: 'a smuggling ring out of the Saltmere creeks',
    crime: 'smuggling and cheating the crown of its customs',
    perk: 'cutthroats',
    perkText: 'Cutthroats for hire: murders strike surer and leave fewer traces.',
  },
  forgery: {
    kind: 'forgery',
    name: 'Forgery and fencing',
    blurb: 'A back room of scriveners, seal-cutters and men who buy what is stolen.',
    cost: 40,
    income: 8,
    illicit: true,
    standing: { underworld: 12 },
    ifKnown: { crown: -25, nobility: -12, guilds: -8, church: -6 },
    risk: 8,
    troubles: [{ text: 'One of your forgers was taken by the watch, and buying his silence was dear', loss: 20 }],
    leak: 4,
    secretly: 'a den of forgers and fences in the old town',
    crime: 'forging seals and receiving stolen goods',
    perk: 'seals',
    perkText: 'Better forged letters and seals: your lies carry more proof and are harder to see through.',
  },
  apothecary: {
    kind: 'apothecary',
    name: 'Apothecary',
    blurb: 'Physic, spices and simples, and on a high shelf, other things.',
    cost: 25,
    income: 3,
    illicit: false,
    standing: { guilds: 5, commons: 5 },
    risk: 5,
    troubles: [{ text: "A bad batch of physic killed a merchant's son, and his father had to be paid", loss: 15 }],
    perk: 'poisons',
    perkText: 'Poisons: murder plots prepare faster and strike surer.',
  },
};

export const BUSINESS_KINDS = Object.keys(BUSINESSES) as BusinessKind[];

export const ESTATES: Estate[] = ['crown', 'nobility', 'church', 'guilds', 'commons', 'underworld'];

export const ESTATE_NAMES: Record<Estate, string> = {
  crown: 'The Crown',
  nobility: 'The nobility',
  church: 'The Church',
  guilds: 'The guilds',
  commons: 'The commons',
  underworld: 'The underworld',
};

/** Most a household may run at once. */
export const MAX_BUSINESSES = 2;
