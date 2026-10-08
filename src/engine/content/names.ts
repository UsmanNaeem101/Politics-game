// Names and flavour for the kingdom of Wendmere: an English-feeling realm with
// Saxon and Norman names side by side.

export const KINGDOM = 'Wendmere';

export const MALE_NAMES = [
  'Aldric', 'Alaric', 'Aylwin', 'Baldwin', 'Bertrand', 'Brand', 'Cedric', 'Cuthbert', 'Dunstan', 'Eadric',
  'Edmund', 'Edgar', 'Garrick', 'Gareth', 'Geoffrey', 'Gilbert', 'Godric', 'Hamon', 'Hereward', 'Hugh',
  'Leofric', 'Odo', 'Osbert', 'Oswin', 'Piers', 'Ralph', 'Raynald', 'Reynold', 'Robert', 'Roger',
  'Simon', 'Thurstan', 'Tristan', 'Walter', 'Warin', 'Wulfric', 'Wystan', 'Anselm', 'Ivo', 'Alard',
  'Fulk', 'Humphrey', 'Jocelyn', 'Lambert', 'Maurice', 'Nigel', 'Ranulf', 'Savaric', 'Theobald', 'Waleran',
];

export const FEMALE_NAMES = [
  'Adela', 'Agnes', 'Alys', 'Avice', 'Beatrix', 'Cecily', 'Edith', 'Eleanor', 'Elfrida', 'Emma',
  'Gunnora', 'Hawise', 'Isabel', 'Isolde', 'Joan', 'Juliana', 'Lettice', 'Mabel', 'Margery', 'Matilda',
  'Maud', 'Petronella', 'Rohese', 'Rowena', 'Sabina', 'Sybil', 'Wynn', 'Aldith', 'Ermengarde', 'Godgifu',
  'Ida', 'Millicent', 'Orabel', 'Richenda', 'Basilia',
];

export const SERVANT_MALE = ['Hob', 'Wat', 'Dickon', 'Jankin', 'Perkin', 'Tibbot', 'Colin', 'Gib', 'Hal', 'Lob', 'Ned', 'Rafe'];
export const SERVANT_FEMALE = ['Molly', 'Nan', 'Tibby', 'Bess', 'Gill', 'Kat', 'Meg', 'Sib', 'Annot', 'Joanie', 'Madge'];

export const HOUSE_NAMES = [
  'Vane', 'Holloway', 'Morrow', 'Ashby', 'Thorne', 'Hallam', 'Fenwick', 'Marlowe', 'Ravenscar', 'Blackmere',
  'Greyling', 'Harrow', 'Kestrel', 'Langley', 'Mortlake', 'Northam', 'Oakhurst', 'Pelham', 'Quarrell', 'Redvers',
  'Stowe', 'Tarrant', 'Underhill', 'Varley', 'Westmarch', 'Yelland', 'Corbet', 'Danvers', 'Esterby', 'Gaunt',
];

export const ROYAL_HOUSES = ['Wend', 'Aldmere', 'Cyneric', 'Osmund'];

export const SEAT_SUFFIX = ['Hall', 'Keep', 'Court', 'Manor', 'Castle', 'Grange', 'Holt', 'Tower'];

export const LAND_NAMES = [
  'Wyke Fields', 'Fenmoor', 'Hollin Dale', 'Crowmarsh', 'Ashcombe', 'Thornbury', 'Saltmere', 'Brackenford',
  'Coldwater', 'Ebbsfleet', 'Harrowden', 'Kingsley Mead', 'Lark Rise', 'Mallow Vale', 'Nettlebed', 'Oxley',
];

export const MOTTOS = [
  'Patience is a blade', 'We do not bend', 'Faithful unto death', 'By wit, not steel', 'The tide turns',
  'Hold fast', 'Nothing forgotten', 'Above reproach', 'First in, last out', 'Quiet waters run deep',
  'Ever watchful', 'Our word is iron', 'From little, much', 'Silence and the sword',
];

/** Epithets earned by temperament. Keys are trait names, high or low. */
export const EPITHETS: Record<string, string[]> = {
  ambition: ['the Ambitious', 'the Climber', 'the Restless'],
  cunning: ['the Fox', 'the Quiet', 'the Subtle'],
  honor: ['the True', 'the Just', 'the Upright'],
  boldness: ['the Bold', 'the Lionhearted', 'the Reckless'],
  greed: ['Silverhand', 'the Grasping', 'Coin-Counter'],
  wrath: ['the Hot-Blooded', 'the Stormy', 'the Hard'],
  paranoia: ['the Wary', 'the Watchful', 'Sleepless'],
  will: ['the Iron', 'the Unbending', 'the Spur'],
  charm: ['Fair-Spoken', 'Silver-Tongue', 'the Gracious'],
  martial: ['the Strong', 'the Hammer', 'Ironarm'],
  timid: ['the Mild', 'the Meek', 'the Careful'],
  old: ['the Grey', 'the Elder', 'the Old'],
  young: ['the Young', 'the Green'],
};

/** Heraldic tinctures: fields and charges that read in both themes. */
export const FIELDS = ['#6a1f2b', '#1d3557', '#2f4f3a', '#2b2a33', '#7a5c1e', '#4a3a6b', '#b8432f', '#3c5a5a', '#5b2a1d', '#24394f'];
export const TINCTURES = ['#eadfc8', '#d8b25a', '#c9c3b4', '#e3c46d'];
export const CHARGES = ['lion', 'tower', 'sword', 'key', 'raven', 'boar', 'cross', 'star', 'fleur', 'crescent', 'chalice', 'wheat'] as const;
export const DIVISIONS = ['plain', 'per-pale', 'per-fess', 'per-bend', 'quarterly', 'chevron'] as const;
