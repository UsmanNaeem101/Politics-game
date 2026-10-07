// "The Season of Knives": the opening position at the court of King Osric.
//
//  - Sir Aldric (the Marshal) means to murder the King and take the crown.
//  - Sir Bertrand (the Chancellor) knows, tells no one but Sir Cedric, and hopes
//    to use Cedric to bring Aldric down.
//  - Sir Cedric (Master of Whispers) says he will carry the charge to the King.
//    In truth he will accuse Aldric AND Bertrand of a shared pact, watch the King
//    behead them both, then murder the King and take the throne.
//  - Lord Edmund Ashby, a minor lord nobody watches, has learned Cedric's design
//    through his wife Isolde, who drives him on. He would expose all three, rise
//    into their offices with his brothers, and take the crown when the time comes.
//  - But Edmund forged their father's will and stole his brothers' lands.
//    Gareth and Wystan have sworn to his scheme only to let him do the bloody
//    work, then murder him and take back everything.

import { makeSecret, syncPlotSecret } from './secrets';
import { addMod, adjustTrust, learn, rel } from './world';
import type { Character, CharId, GameState, Land, OfficeId, Plot, Traits } from './types';

type Seed = Omit<Character, 'status' | 'pressure' | 'guard'> & { pressure?: number };

const T = (
  ambition: number,
  cunning: number,
  honor: number,
  boldness: number,
  greed: number,
  wrath: number,
  paranoia: number,
  will: number,
  charm: number,
  martial: number,
): Traits => ({ ambition, cunning, honor, boldness, greed, wrath, paranoia, will, charm, martial });

const CHARACTERS: Seed[] = [
  {
    id: 'osric',
    name: 'Osric the Grey',
    short: 'Osric',
    title: 'King of Wendmere',
    epithet: 'the Grey',
    gender: 'm',
    age: 61,
    house: 'Wend',
    rank: 'king',
    canClaim: false,
    traits: T(40, 50, 50, 50, 40, 72, 58, 70, 40, 55),
    gold: 300,
    prestige: 90,
    siblings: [],
    agenda: { kind: 'keep-crown', targets: [], summary: 'Hold the crown, and hang anyone who reaches for it.' },
    facade: 'An old lion, grey at the muzzle, who still remembers how to bite.',
    bio: 'His only son fell at Brackenford. With no heir of his body the crown will pass by acclamation of the Witan, and every man at court can count.',
    heraldry: { field: '#6a1f2b', division: 'plain', charge: 'crown', tincture: '#d8b25a' },
    playable: {
      blurb: 'Someone at your court means to kill you. Perhaps several someones. Find the true traitors before the season ends, and try not to hang the innocent.',
      difficulty: 'Cunning',
    },
  },
  {
    id: 'aldric',
    name: 'Sir Aldric Vane',
    short: 'Aldric',
    title: 'Lord Marshal',
    epithet: 'the Hammer of Brackenford',
    gender: 'm',
    age: 44,
    house: 'Vane',
    rank: 'great',
    canClaim: true,
    traits: T(92, 32, 30, 85, 50, 70, 30, 70, 45, 88),
    gold: 80,
    prestige: 70,
    spouse: 'rowena',
    siblings: [],
    agenda: { kind: 'crown', targets: ['osric'], summary: 'Murder the old King and take the crown by right of the sword.' },
    facade: 'The King’s loyal sword, plain-spoken and true.',
    bio: 'Won the day at Brackenford when the King’s son fell. He believes the crown was owed to him that day, and that he has waited long enough.',
    heraldry: { field: '#1d3557', field2: '#b8432f', division: 'per-bend', charge: 'sword', tincture: '#eadfc8' },
    playable: {
      blurb: 'You mean to kill the King and take his crown. You believe your secret is safe. It is not.',
      difficulty: 'Treacherous',
    },
  },
  {
    id: 'rowena',
    name: 'Lady Rowena Vane',
    short: 'Rowena',
    title: 'Lady of Vanehold',
    epithet: 'the Grave',
    gender: 'f',
    age: 39,
    house: 'Vane',
    rank: 'lady',
    canClaim: false,
    traits: T(30, 55, 75, 45, 25, 25, 60, 72, 60, 10),
    gold: 25,
    prestige: 30,
    spouse: 'aldric',
    siblings: [],
    agenda: { kind: 'protect-spouse', targets: ['aldric'], summary: 'Keep her husband alive, even if it means keeping him from the crown.' },
    facade: 'A pious wife who keeps to her prayers.',
    bio: 'She has heard her husband talk in his sleep, and what he says frightens her.',
    heraldry: { field: '#1d3557', division: 'per-fess', field2: '#eadfc8', charge: 'cross', tincture: '#b8432f' },
    pressure: 0,
    playable: {
      blurb: 'Your husband dreams of murdering the King. Restrain him, save him, or choose the crown over your conscience.',
      difficulty: 'Desperate',
    },
  },
  {
    id: 'bertrand',
    name: 'Sir Bertrand Holloway',
    short: 'Bertrand',
    title: 'Lord Chancellor',
    epithet: 'the Careful',
    gender: 'm',
    age: 52,
    house: 'Holloway',
    rank: 'great',
    canClaim: true,
    traits: T(60, 58, 45, 35, 65, 40, 65, 50, 62, 40),
    gold: 150,
    prestige: 60,
    siblings: [],
    agenda: { kind: 'destroy', targets: ['aldric'], summary: 'See Aldric dead, and himself first among the King’s servants.' },
    facade: 'A careful servant of the realm who counts every penny.',
    bio: 'Twenty years of rivalry with Aldric. He learned of the Marshal’s plot and told the King nothing; he told Cedric, hoping to make him the knife.',
    heraldry: { field: '#2f4f3a', division: 'chevron', field2: '#d8b25a', charge: 'key', tincture: '#eadfc8' },
    playable: {
      blurb: 'You know the Marshal plots regicide. You have chosen a clever ally to bring him down. Is he as loyal as he seems?',
      difficulty: 'Cunning',
    },
  },
  {
    id: 'cedric',
    name: 'Sir Cedric Morrow',
    short: 'Cedric',
    title: 'Master of Whispers',
    epithet: 'the Quiet',
    gender: 'm',
    age: 41,
    house: 'Morrow',
    rank: 'great',
    canClaim: true,
    traits: T(88, 90, 15, 55, 45, 30, 50, 65, 72, 45),
    gold: 90,
    prestige: 55,
    siblings: [],
    agenda: {
      kind: 'crown',
      targets: ['aldric', 'bertrand', 'osric'],
      summary: 'Have the King behead Aldric and Bertrand on a false charge, then murder the King and take the crown.',
    },
    facade: 'The King’s ever-loyal eyes and ears.',
    bio: 'Bertrand brought him the Marshal’s secret and asked him to carry it to the King. Cedric smiled and agreed. He has other plans for it.',
    heraldry: { field: '#2b2a33', division: 'per-pale', field2: '#4a3a6b', charge: 'raven', tincture: '#c9c3b4' },
    playable: {
      blurb: 'Two great lords stand between you and the throne, then the King himself. You hold a forged letter and a smile.',
      difficulty: 'Cunning',
    },
  },
  {
    id: 'edmund',
    name: 'Lord Edmund Ashby',
    short: 'Edmund',
    title: 'Lord of Ashby',
    epithet: 'of the Wings',
    gender: 'm',
    age: 36,
    house: 'Ashby',
    rank: 'lord',
    canClaim: true,
    traits: T(62, 55, 25, 30, 72, 35, 45, 38, 58, 50),
    gold: 70,
    prestige: 25,
    spouse: 'isolde',
    siblings: ['gareth', 'wystan'],
    agenda: {
      kind: 'crown',
      targets: ['aldric', 'bertrand', 'cedric', 'osric'],
      summary: 'Let the King destroy the three great lords, step into their places with his brothers, and kill the King when the time comes.',
    },
    facade: 'A modest lord, content with his lot.',
    bio: 'Nobody important. That is his advantage. He forged his father’s will to take his brothers’ shares, and his wife will not let him stop at that.',
    heraldry: { field: '#7a5c1e', division: 'plain', charge: 'wheat', tincture: '#eadfc8' },
    playable: {
      blurb: 'The great lords are about to destroy each other. You know more than any of them. Your wife wants more than you dare, and your brothers smile too easily.',
      difficulty: 'Treacherous',
    },
  },
  {
    id: 'isolde',
    name: 'Lady Isolde Ashby',
    short: 'Isolde',
    title: 'Lady of Ashby',
    epithet: 'the Spur',
    gender: 'f',
    age: 31,
    house: 'Ashby',
    rank: 'lady',
    canClaim: false,
    traits: T(90, 75, 30, 70, 60, 45, 40, 88, 70, 10),
    gold: 20,
    prestige: 15,
    spouse: 'edmund',
    siblings: [],
    agenda: { kind: 'raise-spouse', targets: ['aldric', 'bertrand', 'cedric'], summary: 'Drive Edmund to the top, and herself with him. A crown would do.' },
    facade: 'A dutiful wife from a minor house.',
    bio: 'Her maid shares a bed with Cedric’s clerk, and so she knows what the Master of Whispers intends. She married a small man. She does not intend to stay small.',
    heraldry: { field: '#7a5c1e', division: 'quarterly', field2: '#6a1f2b', charge: 'fleur', tincture: '#eadfc8' },
    pressure: 0,
    playable: {
      blurb: 'You cannot denounce a great lord yourself; no one at court listens to you. But your husband listens. Push him where he will not go alone.',
      difficulty: 'Cunning',
    },
  },
  {
    id: 'gareth',
    name: 'Gareth Ashby',
    short: 'Gareth',
    title: 'Hedge Knight',
    epithet: 'the Disinherited',
    gender: 'm',
    age: 33,
    house: 'Ashby',
    rank: 'knight',
    canClaim: false,
    traits: T(50, 45, 55, 65, 55, 70, 55, 55, 40, 70),
    gold: 8,
    prestige: 10,
    siblings: ['edmund', 'wystan'],
    agenda: { kind: 'restitution', targets: ['edmund'], summary: 'Let Edmund climb, then cut him down and take back Wyke Fields with interest.' },
    facade: 'A loyal younger brother, grateful for Edmund’s charity.',
    bio: 'Their father left the land to all three sons. Edmund produced a will that left it to Edmund. Gareth has not forgotten. He has only learned to smile.',
    heraldry: { field: '#7a5c1e', division: 'per-bend', field2: '#2b2a33', charge: 'boar', tincture: '#eadfc8' },
    playable: {
      blurb: 'Your brother stole your inheritance and now dangles a bigger prize. Let him do the killing. Then take everything back.',
      difficulty: 'Desperate',
    },
  },
  {
    id: 'wystan',
    name: 'Wystan Ashby',
    short: 'Wystan',
    title: 'Hedge Knight',
    epithet: 'the Patient',
    gender: 'm',
    age: 29,
    house: 'Ashby',
    rank: 'knight',
    canClaim: false,
    traits: T(45, 68, 40, 40, 60, 45, 70, 50, 55, 45),
    gold: 10,
    prestige: 10,
    siblings: ['edmund', 'gareth'],
    agenda: { kind: 'restitution', targets: ['edmund'], summary: 'Recover Fenmoor. Edmund’s fall is the price, and Gareth’s sword the means.' },
    facade: 'The quiet youngest, eager to please.',
    bio: 'The cleverest of the three brothers and the least trusted. He has kept a copy of the true will. He shows it to no one yet.',
    heraldry: { field: '#7a5c1e', division: 'per-pale', field2: '#2f4f3a', charge: 'crescent', tincture: '#eadfc8' },
    playable: {
      blurb: 'You hold proof your brother forged the will. Spend it now, or wait for a richer moment. Gareth will do whatever you suggest.',
      difficulty: 'Desperate',
    },
  },
  {
    id: 'anselm',
    name: 'Father Anselm',
    short: 'Anselm',
    title: "King's Confessor",
    epithet: 'the Gentle',
    gender: 'm',
    age: 58,
    house: 'Church',
    rank: 'clergy',
    canClaim: false,
    traits: T(20, 60, 90, 35, 15, 15, 30, 65, 65, 5),
    gold: 15,
    prestige: 40,
    siblings: [],
    agenda: { kind: 'peace', targets: [], summary: 'Prevent murder, spare the innocent, and save what souls he can.' },
    facade: 'A gentle priest who hears everyone’s sins.',
    bio: 'He hears confessions, and is bound by their seal. He senses the court tightening like a bowstring.',
    heraldry: { field: '#eadfc8', division: 'plain', charge: 'chalice', tincture: '#6a1f2b' },
    playable: {
      blurb: 'Knives are being sharpened all around you. You cannot strike; you can only warn, plead and expose. Save as many as you can.',
      difficulty: 'Gentle',
    },
  },
  {
    id: 'hugh',
    name: 'Sir Hugh Brand',
    short: 'Hugh',
    title: 'Captain of the Guard',
    epithet: 'the Shield',
    gender: 'm',
    age: 47,
    house: 'Brand',
    rank: 'knight',
    canClaim: true,
    traits: T(40, 35, 80, 70, 40, 55, 50, 55, 35, 85),
    gold: 30,
    prestige: 35,
    siblings: [],
    agenda: { kind: 'protect-king', targets: [], summary: 'Keep the King alive. Nothing else matters.' },
    facade: 'The King’s shield, blunt and loyal.',
    bio: 'Fought beside Aldric at Brackenford and still thinks of him as a brother-in-arms. He trusts too easily, and he knows it.',
    heraldry: { field: '#b8432f', division: 'plain', charge: 'tower', tincture: '#eadfc8' },
    playable: {
      blurb: 'Your oath is to keep the King alive. The danger is real, but you do not know from where. You trust the wrong people.',
      difficulty: 'Gentle',
    },
  },
];

const LANDS: Land[] = [
  { id: 'demesne', name: 'The Royal Demesne', holder: null, income: 25, desc: 'The crown’s own manors, mills and forests.' },
  { id: 'vanehold', name: 'Vanehold', holder: 'aldric', income: 8, desc: 'A border fortress and its fields, granted after Brackenford.' },
  { id: 'holloway', name: 'Holloway Reach', holder: 'bertrand', income: 9, desc: 'Rich river meadows and three toll bridges.' },
  { id: 'morrow', name: 'Morrow Keep', holder: 'cedric', income: 7, desc: 'A narrow tower over a narrow pass.' },
  { id: 'ashby', name: 'Ashby Hall', holder: 'edmund', income: 5, desc: 'The old Ashby seat. Edmund’s rightful share.' },
  { id: 'wyke', name: 'Wyke Fields', holder: 'edmund', rightful: 'gareth', income: 4, desc: 'Gareth’s portion by their father’s true will.' },
  { id: 'fenmoor', name: 'Fenmoor', holder: 'edmund', rightful: 'wystan', income: 4, desc: 'Wystan’s portion by their father’s true will.' },
  { id: 'brandsrest', name: 'Brand’s Rest', holder: 'hugh', income: 2, desc: 'A modest manor, a soldier’s reward.' },
];

const OFFICES: Record<OfficeId, CharId | null> = {
  marshal: 'aldric',
  chancellor: 'bertrand',
  spymaster: 'cedric',
  captain: 'hugh',
  confessor: 'anselm',
};

export function createScenario(seed: number, player: CharId): GameState {
  const s: GameState = {
    version: 1,
    seed,
    rng: seed | 0,
    turn: 1,
    maxTurns: 20,
    player,
    phase: 'playing',
    chars: {},
    order: CHARACTERS.map((c) => c.id),
    relations: {},
    secrets: {},
    knowledge: {},
    plots: {},
    pledges: [],
    lands: Object.fromEntries(LANDS.map((l) => [l.id, { ...l }])),
    offices: { ...OFFICES },
    king: 'osric',
    interregnum: null,
    imprisoned: {},
    directives: {},
    insight: {},
    ap: 3,
    apMax: 3,
    audiences: [],
    events: [],
    nextId: 1,
    nightStart: 1,
  };
  for (const c of CHARACTERS) {
    s.chars[c.id] = {
      ...c,
      traits: { ...c.traits },
      agenda: { ...c.agenda, targets: c.agenda.targets.slice() },
      siblings: c.siblings.slice(),
      status: 'free',
      pressure: c.pressure ?? 0,
      guard: 0,
    };
  }

  seedRelations(s);
  seedSecretsAndPlots(s);
  return s;
}

function mutual(s: GameState, a: CharId, b: CharId, key: string, label: string, value: number, pub = false) {
  addMod(s, a, b, key, label, value, 0, pub);
  addMod(s, b, a, key, label, value, 0, pub);
}

function seedRelations(s: GameState) {
  const all = s.order;
  // Everyone holds the King in some regard; the Confessor in a little more.
  for (const id of all) {
    if (id !== 'osric') addMod(s, id, 'osric', 'liege', 'Sworn liege', 15, 0, true);
    if (id !== 'anselm') addMod(s, id, 'anselm', 'priest', 'A man of God', 10, 0, true);
  }
  addMod(s, 'aldric', 'osric', 'covet', 'Covets his crown', -40);
  addMod(s, 'osric', 'aldric', 'brackenford', 'Victor of Brackenford', 30, 0, true);
  addMod(s, 'osric', 'bertrand', 'service', 'Twenty years of service', 25, 0, true);
  addMod(s, 'osric', 'cedric', 'eyes', 'His indispensable eyes', 30, 0, true);
  addMod(s, 'osric', 'hugh', 'shield', 'Sworn shield', 40, 0, true);
  addMod(s, 'osric', 'anselm', 'confessor', 'His confessor', 30, 0, true);
  addMod(s, 'osric', 'edmund', 'minor', 'A minor lord', 0, 0, true);

  mutual(s, 'aldric', 'bertrand', 'rivalry', 'Old rivalry', -35, true);
  addMod(s, 'bertrand', 'cedric', 'confidant', 'Trusted confidant', 30);
  addMod(s, 'cedric', 'bertrand', 'fool', 'A useful fool', -10);
  addMod(s, 'cedric', 'aldric', 'brute', 'An ambitious brute', -20);
  addMod(s, 'aldric', 'cedric', 'whisperer', 'Distrusts whisperers', -10, 0, true);
  for (const g of ['aldric', 'bertrand', 'cedric']) {
    addMod(s, 'edmund', g, 'sneer', 'Sneers at minor lords', -15);
    addMod(s, 'isolde', g, 'inway', 'Stands in the way', -20);
  }
  mutual(s, 'aldric', 'rowena', 'marriage', 'Spouse', 30, true);
  addMod(s, 'rowena', 'aldric', 'fear', 'Fears what he has become', -5);
  addMod(s, 'edmund', 'isolde', 'marriage', 'Beloved wife', 40, 0, true);
  addMod(s, 'isolde', 'edmund', 'marriage', 'Husband', 20, 0, true);
  addMod(s, 'isolde', 'edmund', 'small', 'Too timid by half', -10);

  for (const b of ['gareth', 'wystan']) {
    addMod(s, b, 'edmund', 'theft', 'Stole our inheritance', -55);
    addMod(s, b, 'edmund', 'blood', 'Brother', 10, 0, true);
    addMod(s, 'edmund', b, 'blood', 'Brother', 20, 0, true);
    addMod(s, 'edmund', b, 'guilt', 'Uneasy conscience', -5);
    adjustTrust(s, b, 'edmund', -25);
  }
  mutual(s, 'gareth', 'wystan', 'grievance', 'Brothers in grievance', 45);
  addMod(s, 'gareth', 'wystan', 'blood', 'Brother', 10, 0, true);
  addMod(s, 'wystan', 'gareth', 'blood', 'Brother', 10, 0, true);
  addMod(s, 'isolde', 'gareth', 'brute', 'Hot-headed', -10);
  addMod(s, 'isolde', 'wystan', 'sly', 'Too sly', -15);

  addMod(s, 'hugh', 'osric', 'oath', 'Sworn to his life', 50, 0, true);
  mutual(s, 'hugh', 'aldric', 'comrades', 'Comrades of Brackenford', 25, true);
  addMod(s, 'hugh', 'cedric', 'creep', 'Mistrusts creeping men', -10);
  addMod(s, 'anselm', 'rowena', 'flock', 'Devout parishioner', 20);
  addMod(s, 'rowena', 'anselm', 'confessor', 'Her confessor', 25);

  // Trust: who would believe whom.
  rel(s, 'bertrand', 'cedric').trust = 75;
  rel(s, 'cedric', 'bertrand').trust = 30;
  rel(s, 'edmund', 'isolde').trust = 85;
  rel(s, 'isolde', 'edmund').trust = 55;
  rel(s, 'gareth', 'wystan').trust = 85;
  rel(s, 'wystan', 'gareth').trust = 75;
  rel(s, 'osric', 'cedric').trust = 70;
  rel(s, 'osric', 'hugh').trust = 80;
  rel(s, 'osric', 'anselm').trust = 75;
  rel(s, 'osric', 'bertrand').trust = 60;
  rel(s, 'osric', 'aldric').trust = 55;
  rel(s, 'osric', 'edmund').trust = 35;
  rel(s, 'hugh', 'aldric').trust = 70;
  rel(s, 'rowena', 'anselm').trust = 85;
  rel(s, 'aldric', 'rowena').trust = 60;
}

function plot(s: GameState, p: Omit<Plot, 'status' | 'createdTurn' | 'hiredBlades'>): Plot {
  const full: Plot = { ...p, status: 'active', createdTurn: 0, hiredBlades: 0 };
  s.plots[p.id] = full;
  return full;
}

function seedSecretsAndPlots(s: GameState) {
  // 1. Aldric's regicide.
  makeSecret(s, { id: 's-aldric-regicide', kind: 'regicide', guilty: ['aldric'], victims: ['osric'], truth: true, evidence: 35, plotId: 'p-aldric' });
  plot(s, {
    id: 'p-aldric',
    kind: 'murder',
    name: 'The Marshal’s Knife',
    owner: 'aldric',
    targets: ['osric'],
    members: [],
    progress: 35,
    secretId: 's-aldric-regicide',
    charges: [],
    waitFor: [],
    intent: 'Cut down the King on a hunting day, then claim the crown as the realm’s strongest sword.',
  });

  // 2. Bertrand knows and hides it; he and Cedric are to bring Aldric down.
  makeSecret(s, {
    id: 's-bertrand-conceal',
    kind: 'concealment',
    guilty: ['bertrand', 'cedric'],
    victims: ['osric'],
    truth: true,
    evidence: 25,
    text: 'Sir Bertrand Holloway and Sir Cedric Morrow know the Marshal plots against the King, and hide it for their own advantage.',
  });
  makeSecret(s, {
    id: 's-bertrand-ruin',
    kind: 'ruin',
    guilty: ['bertrand', 'cedric'],
    victims: ['aldric'],
    truth: true,
    evidence: 15,
    plotId: 'p-bertrand',
  });
  plot(s, {
    id: 'p-bertrand',
    kind: 'ruin',
    name: 'The Chancellor’s Ledger',
    owner: 'bertrand',
    targets: ['aldric'],
    members: [{ id: 'cedric', sincere: false, role: 'Will carry the charge to the King', joinedTurn: 0 }],
    progress: 25,
    secretId: 's-bertrand-ruin',
    charges: ['s-aldric-regicide'],
    waitFor: [],
    intent: 'Let Cedric take Aldric’s treason to the King, keep my own hands clean, and stand first among the King’s servants when the Marshal’s head is on a spike.',
  });

  // 3. Cedric's real design, and the forged pact he will use for it.
  makeSecret(s, {
    id: 's-cedric-usurp',
    kind: 'usurpation',
    guilty: ['cedric'],
    victims: ['osric', 'aldric', 'bertrand'],
    truth: true,
    evidence: 15,
    plotId: 'p-cedric-crown',
    text: 'Sir Cedric Morrow means to have Aldric and Bertrand executed on a false charge, then murder the King and take the crown.',
  });
  makeSecret(s, {
    id: 's-false-pact',
    kind: 'pact',
    guilty: ['aldric', 'bertrand'],
    victims: ['osric'],
    truth: false,
    fabricatedBy: 'cedric',
    evidence: 40,
  });
  makeSecret(s, {
    id: 's-cedric-ruin',
    kind: 'slander',
    guilty: ['cedric'],
    victims: ['aldric', 'bertrand'],
    truth: true,
    evidence: 10,
    plotId: 'p-cedric-ruin',
    text: 'Sir Cedric Morrow has forged letters to convict Aldric and Bertrand of a pact they never swore.',
  });
  plot(s, {
    id: 'p-cedric-ruin',
    kind: 'ruin',
    name: 'The Two-Headed Serpent',
    owner: 'cedric',
    targets: ['aldric', 'bertrand'],
    members: [],
    progress: 40,
    secretId: 's-cedric-ruin',
    charges: ['s-false-pact'],
    waitFor: [],
    intent: 'Tell Bertrand I go to the King about Aldric. Tell the King that Aldric and Bertrand are sworn together. Let the axe take both.',
  });
  plot(s, {
    id: 'p-cedric-crown',
    kind: 'murder',
    name: 'The Long Knife',
    owner: 'cedric',
    targets: ['osric'],
    members: [],
    progress: 15,
    secretId: 's-cedric-usurp',
    charges: [],
    waitFor: ['aldric', 'bertrand'],
    intent: 'When the Marshal and the Chancellor are dead, the King dies of a fever no physician can name.',
  });

  // 4. Edmund's theft, and his own climb.
  makeSecret(s, {
    id: 's-edmund-theft',
    kind: 'theft',
    guilty: ['edmund'],
    victims: ['gareth', 'wystan'],
    truth: true,
    evidence: 45,
    treason: false,
    text: 'Lord Edmund Ashby forged his father’s will and stole the inheritance of Gareth and Wystan Ashby.',
  });
  makeSecret(s, {
    id: 's-edmund-design',
    kind: 'usurpation',
    guilty: ['edmund'],
    victims: ['aldric', 'bertrand', 'cedric', 'osric'],
    truth: true,
    evidence: 10,
    text: 'Lord Edmund Ashby means to have the King destroy Aldric, Bertrand and Cedric, take their places, and in time murder the King.',
  });
  makeSecret(s, {
    id: 's-edmund-ruin',
    kind: 'ruin',
    guilty: ['edmund'],
    victims: ['aldric', 'bertrand', 'cedric'],
    truth: true,
    evidence: 10,
    plotId: 'p-edmund-ruin',
  });
  plot(s, {
    id: 'p-edmund-ruin',
    kind: 'ruin',
    name: 'From the Wings',
    owner: 'edmund',
    targets: ['aldric', 'bertrand', 'cedric'],
    members: [
      { id: 'gareth', sincere: false, role: 'Witness before the King', joinedTurn: 0, offer: { kind: 'office', office: 'marshal' } },
      { id: 'wystan', sincere: false, role: 'Witness before the King', joinedTurn: 0, offer: { kind: 'office', office: 'spymaster' } },
    ],
    progress: 10,
    secretId: 's-edmund-ruin',
    charges: ['s-aldric-regicide', 's-bertrand-conceal', 's-cedric-usurp'],
    waitFor: [],
    intent: 'Take all three great lords’ secrets to the King at once. The axe falls three times; the Ashbys fill the empty chairs.',
  });
  makeSecret(s, {
    id: 's-edmund-regicide',
    kind: 'regicide',
    guilty: ['edmund'],
    victims: ['osric'],
    truth: true,
    evidence: 5,
    plotId: 'p-edmund-crown',
  });
  plot(s, {
    id: 'p-edmund-crown',
    kind: 'murder',
    name: 'When the Time Comes',
    owner: 'edmund',
    targets: ['osric'],
    members: [],
    progress: 0,
    secretId: 's-edmund-regicide',
    charges: [],
    waitFor: ['aldric', 'bertrand', 'cedric'],
    intent: '“And if the time comes, I will kill the King myself.”',
  });

  // 5. The brothers' double-cross.
  makeSecret(s, {
    id: 's-brothers-betrayal',
    kind: 'betrayal',
    guilty: ['gareth', 'wystan'],
    victims: ['edmund'],
    truth: true,
    evidence: 5,
    plotId: 'p-brothers',
    text: 'Gareth and Wystan Ashby mean to let Edmund do the killing, then murder him and take back their lands.',
  });
  plot(s, {
    id: 'p-brothers',
    kind: 'murder',
    name: 'The Second Sons',
    owner: 'gareth',
    targets: ['edmund'],
    members: [{ id: 'wystan', sincere: true, role: 'Keeper of the true will', joinedTurn: 0 }],
    progress: 10,
    secretId: 's-brothers-betrayal',
    charges: [],
    waitFor: ['aldric', 'bertrand', 'cedric'],
    intent: 'Let him climb. A man who has climbed falls further. His lands pass to his brothers, if he dies by a stranger’s hand and not the headsman’s.',
  });

  s.pledges.push(
    {
      id: 'pl-gareth',
      from: 'edmund',
      to: 'gareth',
      offer: { kind: 'office', office: 'marshal' },
      plotId: 'p-edmund-ruin',
      turn: 0,
      status: 'pending',
      text: 'Edmund swore Gareth would be Marshal when Aldric falls.',
    },
    {
      id: 'pl-wystan',
      from: 'edmund',
      to: 'wystan',
      offer: { kind: 'office', office: 'spymaster' },
      plotId: 'p-edmund-ruin',
      turn: 0,
      status: 'pending',
      text: 'Edmund swore Wystan would be Master of Whispers when Cedric falls.',
    },
  );

  for (const p of Object.values(s.plots)) syncPlotSecret(s, p);

  // Who knows what on the first morning.
  const K = (who: CharId, id: string, cred: number, src: Parameters<typeof learn>[4], lie = false) =>
    learn(s, who, id, cred, src, lie);

  K('aldric', 's-aldric-regicide', 100, 'self');
  K('bertrand', 's-aldric-regicide', 80, 'spies');
  K('cedric', 's-aldric-regicide', 85, 'bertrand');
  K('isolde', 's-aldric-regicide', 75, 'spies');
  K('edmund', 's-aldric-regicide', 70, 'isolde');
  K('gareth', 's-aldric-regicide', 60, 'edmund');
  K('wystan', 's-aldric-regicide', 60, 'edmund');
  K('rowena', 's-aldric-regicide', 35, 'rumour');

  K('bertrand', 's-bertrand-conceal', 100, 'self');
  K('cedric', 's-bertrand-conceal', 100, 'self');
  K('bertrand', 's-bertrand-ruin', 100, 'self');
  K('cedric', 's-bertrand-ruin', 100, 'self');
  K('isolde', 's-bertrand-conceal', 70, 'spies');
  K('edmund', 's-bertrand-conceal', 65, 'isolde');
  K('gareth', 's-bertrand-conceal', 55, 'edmund');
  K('wystan', 's-bertrand-conceal', 55, 'edmund');

  K('cedric', 's-cedric-usurp', 100, 'self');
  K('cedric', 's-false-pact', 0, 'self', true);
  K('cedric', 's-cedric-ruin', 100, 'self');
  K('isolde', 's-cedric-usurp', 70, 'spies');
  K('edmund', 's-cedric-usurp', 65, 'isolde');
  K('gareth', 's-cedric-usurp', 60, 'edmund');
  K('wystan', 's-cedric-usurp', 60, 'edmund');
  K('isolde', 's-cedric-ruin', 55, 'spies');
  K('edmund', 's-cedric-ruin', 50, 'isolde');

  K('edmund', 's-edmund-theft', 100, 'self');
  K('isolde', 's-edmund-theft', 100, 'edmund');
  K('gareth', 's-edmund-theft', 100, 'self');
  K('wystan', 's-edmund-theft', 100, 'self');

  K('edmund', 's-edmund-ruin', 100, 'self');
  K('isolde', 's-edmund-ruin', 100, 'edmund');
  K('gareth', 's-edmund-ruin', 100, 'self');
  K('wystan', 's-edmund-ruin', 100, 'self');
  K('edmund', 's-edmund-design', 100, 'self');
  K('isolde', 's-edmund-design', 100, 'edmund');
  K('gareth', 's-edmund-design', 100, 'edmund');
  K('wystan', 's-edmund-design', 100, 'edmund');
  K('edmund', 's-edmund-regicide', 100, 'self');
  K('isolde', 's-edmund-regicide', 90, 'edmund');
  K('gareth', 's-edmund-regicide', 70, 'edmund');
  K('wystan', 's-edmund-regicide', 70, 'edmund');

  K('gareth', 's-brothers-betrayal', 100, 'self');
  K('wystan', 's-brothers-betrayal', 100, 'self');

  // Insight: every plotter knows their own motive; Isolde has read her husband.
  s.insight.isolde = { agendas: ['edmund'], sincerity: [] };
  s.insight.gareth = { agendas: ['wystan', 'edmund'], sincerity: ['p-brothers:wystan'] };
  s.insight.wystan = { agendas: ['gareth', 'edmund'], sincerity: ['p-brothers:wystan'] };
  s.insight.bertrand = { agendas: ['aldric'], sincerity: [] };
  s.insight.edmund = { agendas: ['cedric'], sincerity: [] };
  s.insight.cedric = { agendas: ['bertrand'], sincerity: [] };

  // Isolde begins already pressing her husband.
  s.chars.edmund.pressure = 30;
  // Rowena has begun to hold hers back.
  s.chars.aldric.pressure = -10;
}

export const PLAYABLE: CharId[] = CHARACTERS.map((c) => c.id);
