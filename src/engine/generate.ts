// Builds a new court from a seed. History first, then motives, then schemes, so
// every motive has a reason behind it. Nothing here is scripted: the generator
// applies a library of situations to whoever fits them.

import { ARCHETYPES, type ArchetypeId } from './content/archetypes';
import {
  CHARGES,
  DIVISIONS,
  EPITHETS,
  FEMALE_NAMES,
  FIELDS,
  HOUSE_NAMES,
  LAND_NAMES,
  MALE_NAMES,
  MOTTOS,
  ROYAL_HOUSES,
  SEAT_SUFFIX,
  SERVANT_FEMALE,
  SERVANT_MALE,
  TINCTURES,
} from './content/names';
import { chance, clamp, pick, roll, seedFrom, shuffle, weighted } from './rng';
import { makeSecret, syncPlotSecret } from './secrets';
import { emptyState } from './state';
import { names } from './text';
import { addMod, adjustTrust, insightOf, learn, log, rel, uid } from './world';
import type {
  Acquaintance,
  Agenda,
  Character,
  CharId,
  GameState,
  Heraldry,
  House,
  OfficeId,
  Plot,
  PlotCondition,
  Rank,
  SecretKind,
  Traits,
} from './types';

const TRAIT_KEYS: (keyof Traits)[] = ['ambition', 'cunning', 'honor', 'boldness', 'greed', 'wrath', 'paranoia', 'will', 'charm', 'martial'];

interface Gen {
  s: GameState;
  usedGiven: Set<string>;
  usedHouses: Set<string>;
  usedLands: Set<string>;
}

export interface GenerateOptions {
  playerName?: string;
}

/** A fresh court. The same seed always gives the same court. */
export function generateCourt(seed: number, opts: GenerateOptions = {}): GameState {
  for (let attempt = 0; attempt < 25; attempt++) {
    const s = build(seed, attempt, opts);
    if (courtProblems(s).length === 0) return s;
  }
  return build(seed, 0, opts);
}

/** Reasons a generated court is not good enough to play. */
export function courtProblems(s: GameState): string[] {
  const out: string[] = [];
  const active = Object.values(s.plots).filter((p) => p.status === 'active');
  if (!s.king) out.push('no king');
  if (!active.some((p) => p.kind === 'murder' && p.targets.includes(s.king ?? ''))) out.push('no one plots against the King');
  if (active.length < 3) out.push('too few schemes');
  const me = s.chars[s.player];
  if (!me || me.rank !== 'lord') out.push('player is not a minor lord');
  if (!Object.values(s.knowledge[s.player] ?? {}).some((k) => k.credence > 0 && k.source !== 'self')) out.push('player knows no secret');
  for (const o of Object.keys(s.offices) as OfficeId[]) if (!s.offices[o]) out.push(`no ${o}`);
  for (const c of Object.values(s.chars)) {
    if (c.spouse && s.chars[c.spouse]?.spouse !== c.id) out.push(`one-sided marriage ${c.id}`);
    for (const b of c.siblings) if (!s.chars[b]?.siblings.includes(c.id)) out.push(`one-sided siblings ${c.id}`);
  }
  return out;
}

// ── Building blocks ─────────────────────────────────────────────────────────

function heraldry(g: Gen): Heraldry {
  const s = g.s;
  const field = pick(s, FIELDS);
  const division = pick(s, DIVISIONS);
  const field2 = pick(s, FIELDS.filter((f) => f !== field));
  return { field, field2: division === 'plain' ? undefined : field2, division, charge: pick(s, CHARGES), tincture: pick(s, TINCTURES) };
}

function houseName(g: Gen): string {
  const left = HOUSE_NAMES.filter((h) => !g.usedHouses.has(h));
  const name = left.length ? pick(g.s, left) : `${pick(g.s, HOUSE_NAMES)}${g.usedHouses.size}`;
  g.usedHouses.add(name);
  return name;
}

function landName(g: Gen): string {
  const left = LAND_NAMES.filter((l) => !g.usedLands.has(l));
  const name = left.length ? pick(g.s, left) : `${pick(g.s, LAND_NAMES)} ${g.usedLands.size}`;
  g.usedLands.add(name);
  return name;
}

function givenName(g: Gen, gender: 'm' | 'f'): string {
  const pool = gender === 'm' ? MALE_NAMES : FEMALE_NAMES;
  const left = pool.filter((n) => !g.usedGiven.has(n));
  const name = left.length ? pick(g.s, left) : pick(g.s, pool);
  g.usedGiven.add(name);
  return name;
}

function sampleTraits(g: Gen, arch: ArchetypeId): Traits {
  const base = ARCHETYPES[arch].traits as Partial<Traits>;
  const t = {} as Traits;
  for (const k of TRAIT_KEYS) t[k] = clamp((base[k] ?? 50) + roll(g.s, -12, 12), 5, 95);
  return t;
}

function epithetFor(g: Gen, t: Traits, age: number): string {
  if (age >= 60 && chance(g.s, 60)) return pick(g.s, EPITHETS.old);
  if (age <= 24 && chance(g.s, 40)) return pick(g.s, EPITHETS.young);
  if (t.boldness <= 25) return pick(g.s, EPITHETS.timid);
  const top = TRAIT_KEYS.slice().sort((a, b) => t[b] - t[a])[0];
  return pick(g.s, EPITHETS[top]);
}

function newHouse(g: Gen, name: string, rank: House['rank'], incomeRange: [number, number]): House {
  const s = g.s;
  const id = uid(s, 'h');
  const seatName = rank === 'royal' ? 'The Royal Demesne' : `${name} ${pick(s, SEAT_SUFFIX)}`;
  const seatId = rank === 'royal' ? 'demesne' : uid(s, 'l');
  s.lands[seatId] = {
    id: seatId,
    name: seatName,
    holder: null,
    income: roll(s, incomeRange[0], incomeRange[1]),
    desc: rank === 'royal' ? 'The crown’s own manors, mills and forests.' : `The seat of House ${name}.`,
  };
  const h: House = { id, name, rank, heraldry: heraldry(g), head: null, members: [], seat: seatId, motto: pick(s, MOTTOS), arrived: s.turn > 1 ? s.turn : 0 };
  s.houses[id] = h;
  return h;
}

interface PersonSpec {
  house: House;
  gender: 'm' | 'f';
  arch: ArchetypeId;
  rank: Rank;
  age: number;
  role?: string;
  surname?: string;
  given?: string;
}

function person(g: Gen, p: PersonSpec): Character {
  const s = g.s;
  const id = uid(s, 'c');
  const servant = p.rank === 'servant';
  const given = p.given ?? (servant ? pick(s, p.gender === 'm' ? SERVANT_MALE : SERVANT_FEMALE) : givenName(g, p.gender));
  const surname = p.surname ?? p.house.name;
  const traits = sampleTraits(g, p.arch);
  const epithet = servant ? '' : epithetFor(g, traits, p.age);
  const seat = p.house.seat ? s.lands[p.house.seat]?.name : undefined;
  let name: string;
  let title: string;
  switch (p.rank) {
    case 'king':
      name = `${given} ${epithet}`;
      title = 'King of Wendmere';
      break;
    case 'queen':
      name = `${given} of ${surname}`;
      title = 'Queen of Wendmere';
      break;
    case 'great':
    case 'lord':
      name = `Lord ${given} ${surname}`;
      title = `Lord of ${seat ?? surname}`;
      break;
    case 'knight':
      name = `Sir ${given} ${surname}`;
      title = p.role ?? 'Hedge Knight';
      break;
    case 'lady':
      name = `Lady ${given} ${surname}`;
      title = `Lady of ${seat ?? surname}`;
      break;
    case 'clergy':
      name = `Father ${given}`;
      title = p.role ?? 'Priest';
      break;
    default:
      name = given;
      title = `${cap(p.role ?? 'servant')} of ${seat ?? `House ${surname}`}`;
  }
  const arch = ARCHETYPES[p.arch];
  const c: Character = {
    id,
    name,
    short: given,
    title,
    epithet,
    gender: p.gender,
    age: p.age,
    house: surname,
    householdId: p.house.id,
    role: p.role,
    rank: p.rank,
    canClaim: ['great', 'lord', 'knight'].includes(p.rank) && p.gender === 'm',
    traits,
    status: 'free',
    gold: goldFor(g, p.rank),
    prestige: prestigeFor(g, p.rank),
    siblings: [],
    agenda: { kind: 'peace', targets: [], summary: 'Live quietly, and keep out of other people’s quarrels.' },
    facade: pick(s, arch.facades),
    bio: pick(s, arch.bios),
    pressure: 0,
    guard: 0,
    // Someone of another family living in this household keeps their own arms.
    heraldry: p.surname && p.surname !== p.house.name ? heraldry(g) : p.house.heraldry,
    archetype: p.arch,
  };
  s.chars[id] = c;
  s.order.push(id);
  p.house.members.push(id);
  return c;
}

const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function goldFor(g: Gen, rank: Rank): number {
  const s = g.s;
  switch (rank) {
    case 'king':
      return 300;
    case 'queen':
      return roll(s, 30, 60);
    case 'great':
      return roll(s, 100, 160);
    case 'lord':
      return roll(s, 45, 80);
    case 'knight':
      return roll(s, 8, 30);
    case 'lady':
      return roll(s, 10, 30);
    case 'clergy':
      return 15;
    default:
      return roll(s, 2, 8);
  }
}

function prestigeFor(g: Gen, rank: Rank): number {
  const s = g.s;
  switch (rank) {
    case 'king':
      return 90;
    case 'queen':
      return 50;
    case 'great':
      return roll(s, 50, 70);
    case 'lord':
      return roll(s, 18, 30);
    case 'knight':
      return roll(s, 8, 20);
    case 'lady':
      return roll(s, 10, 25);
    case 'clergy':
      return 40;
    default:
      return 2;
  }
}

function marry(a: Character, b: Character): void {
  a.spouse = b.id;
  b.spouse = a.id;
}

function siblings(s: GameState, group: Character[]): void {
  for (const a of group) for (const b of group) if (a.id !== b.id && !a.siblings.includes(b.id)) a.siblings.push(b.id);
  for (const a of group)
    for (const b of group) {
      if (a.id === b.id) continue;
      addMod(s, a.id, b.id, 'blood', 'Brother', 10, 0, true);
      adjustTrust(s, a.id, b.id, 15);
    }
}

const WIFE_TYPES: [ArchetypeId, number][] = [
  ['devoted', 35],
  ['spur', 25],
  ['unhappy', 25],
  ['content', 15],
];

function wifeArch(g: Gen, weights = WIFE_TYPES): ArchetypeId {
  return weighted(g.s, weights, (w) => w[1])![0];
}

/** A household: head, perhaps a wife, perhaps brothers, and servants. */
function household(
  g: Gen,
  h: House,
  head: { arch: ArchetypeId; rank: Rank; age: [number, number] },
  opts: { wife: number; brothers: number[]; steward: number; maid: number; wifeTypes?: [ArchetypeId, number][] },
): Character {
  const s = g.s;
  const lord = person(g, { house: h, gender: 'm', arch: head.arch, rank: head.rank, age: roll(s, head.age[0], head.age[1]) });
  h.head = lord.id;
  if (h.seat) s.lands[h.seat].holder = lord.id;
  if (chance(s, opts.wife)) {
    const arch = wifeArch(g, opts.wifeTypes);
    const wife = person(g, { house: h, gender: 'f', arch, rank: 'lady', age: clamp(lord.age - roll(s, 2, 14), 19, 60) });
    marry(lord, wife);
    spouseFeelings(g, lord, wife);
  }
  const nBrothers = weighted(s, opts.brothers.map((w, i) => ({ i, w })), (x) => x.w)?.i ?? 0;
  const kin = [lord];
  for (let i = 0; i < nBrothers; i++) {
    kin.push(person(g, { house: h, gender: 'm', arch: 'younger-son', rank: 'knight', age: clamp(lord.age - roll(s, 2, 9), 18, 70) }));
  }
  if (kin.length > 1) siblings(s, kin);
  if (chance(s, opts.steward)) person(g, { house: h, gender: 'm', arch: 'steward', rank: 'servant', age: roll(s, 30, 60), role: 'steward' });
  if (lord.spouse && chance(s, opts.maid)) person(g, { house: h, gender: 'f', arch: 'maid', rank: 'servant', age: roll(s, 16, 40), role: 'maid' });
  for (const m of h.members) if (m !== lord.id && s.chars[m].rank === 'servant') {
    addMod(s, m, lord.id, 'master', 'My master', 10, 0, true);
    addMod(s, lord.id, m, 'servant', 'A servant', 0, 0, true);
  }
  return lord;
}

function spouseFeelings(g: Gen, husband: Character, wife: Character): void {
  const s = g.s;
  switch (wife.archetype) {
    case 'devoted':
      addMod(s, husband.id, wife.id, 'marriage', 'Spouse', 30, 0, true);
      addMod(s, wife.id, husband.id, 'marriage', 'Spouse', 35, 0, true);
      rel(s, husband.id, wife.id).trust = 75;
      rel(s, wife.id, husband.id).trust = 75;
      break;
    case 'spur':
      addMod(s, husband.id, wife.id, 'marriage', 'Beloved wife', 40, 0, true);
      addMod(s, wife.id, husband.id, 'marriage', 'Husband', 20, 0, true);
      if (husband.traits.boldness < 55) addMod(s, wife.id, husband.id, 'small', 'Too timid by half', -10);
      rel(s, husband.id, wife.id).trust = 85;
      rel(s, wife.id, husband.id).trust = 55;
      break;
    case 'unhappy':
      addMod(s, husband.id, wife.id, 'marriage', 'Spouse', 15, 0, true);
      addMod(s, wife.id, husband.id, 'marriage', 'Spouse', 10, 0, true);
      addMod(s, wife.id, husband.id, 'cold', 'A cold marriage', -20);
      rel(s, husband.id, wife.id).trust = 70;
      rel(s, wife.id, husband.id).trust = 35;
      break;
    default:
      addMod(s, husband.id, wife.id, 'marriage', 'Spouse', 20, 0, true);
      addMod(s, wife.id, husband.id, 'marriage', 'Spouse', 20, 0, true);
      rel(s, husband.id, wife.id).trust = 60;
      rel(s, wife.id, husband.id).trust = 60;
  }
}

// ── The court ───────────────────────────────────────────────────────────────

function build(seed: number, attempt: number, opts: GenerateOptions): GameState {
  const s = emptyState(seed);
  s.rng = seedFrom(`court:${seed}:${attempt}`) | 0;
  const g: Gen = { s, usedGiven: new Set(), usedHouses: new Set(), usedLands: new Set() };

  // The Crown.
  const royal = newHouse(g, pick(s, ROYAL_HOUSES), 'royal', [25, 25]);
  g.usedHouses.add(royal.name);
  const king = person(g, { house: royal, gender: 'm', arch: 'old-king', rank: 'king', age: roll(s, 58, 72) });
  royal.head = king.id;
  s.king = king.id;
  king.canClaim = false;
  if (chance(s, 40)) {
    const queen = person(g, { house: royal, gender: 'f', arch: 'queen', rank: 'queen', age: roll(s, 28, 45), surname: houseName(g) });
    marry(king, queen);
    addMod(s, king.id, queen.id, 'marriage', 'His queen', 25, 0, true);
    addMod(s, queen.id, king.id, 'marriage', 'Husband', queen.traits.honor >= 50 ? 25 : 5, 0, true);
  }
  const captain = person(g, { house: royal, gender: 'm', arch: 'shield', rank: 'knight', age: roll(s, 35, 55), role: 'Captain of the Guard', surname: houseName(g) });
  s.offices.captain = captain.id;

  const church = newHouse(g, 'Church', 'church', [0, 0]);
  delete s.lands[church.seat!];
  church.seat = undefined;
  const priest = person(g, { house: church, gender: 'm', arch: 'priest', rank: 'clergy', age: roll(s, 45, 66), role: "King's Confessor" });
  church.head = priest.id;
  s.offices.confessor = priest.id;
  g.usedHouses.add('Church');

  // Great houses hold the great offices.
  const offices: OfficeId[] = ['marshal', 'chancellor', 'spymaster'];
  const nGreat = chance(s, 50) ? 4 : 3;
  const greats: Character[] = [];
  for (let i = 0; i < nGreat; i++) {
    const office = offices[i];
    const arch: ArchetypeId =
      office === 'marshal'
        ? chance(s, 80) ? 'soldier' : 'grandee'
        : office === 'chancellor'
          ? chance(s, 80) ? 'official' : 'grandee'
          : office === 'spymaster'
            ? chance(s, 75) ? 'spider' : 'official'
            : pick(s, ['grandee', 'rake', 'soldier'] as ArchetypeId[]);
    const h = newHouse(g, houseName(g), 'great', [7, 10]);
    const lord = household(g, h, { arch, rank: 'great', age: [36, 58] }, { wife: 80, brothers: [45, 40, 15], steward: 100, maid: 70 });
    if (office) s.offices[office] = lord.id;
    greats.push(lord);
  }

  // Lesser houses.
  const nLesser = chance(s, 50) ? 4 : 3;
  const lessers: Character[] = [];
  for (let i = 0; i < nLesser; i++) {
    const arch = weighted(s, [['climber', 50], ['content', 35], ['rake', 15]] as [ArchetypeId, number][], (x) => x[1])![0];
    const h = newHouse(g, houseName(g), 'lesser', [4, 6]);
    lessers.push(household(g, h, { arch, rank: 'lord', age: [25, 55] }, { wife: 70, brothers: [65, 30, 5], steward: 40, maid: 60 }));
  }

  // The player: a minor lord new to court.
  const ph = newHouse(g, houseName(g), 'lesser', [5, 5]);
  const player = household(
    g,
    ph,
    { arch: 'player', rank: 'lord', age: [24, 36] },
    { wife: 92, brothers: [60, 40, 0], steward: 100, maid: 100, wifeTypes: [['spur', 35], ['devoted', 35], ['unhappy', 30]] },
  );
  if (opts.playerName?.trim()) {
    const given = opts.playerName.trim().split(/\s+/)[0].slice(0, 20);
    player.short = given;
    player.name = `Lord ${given} ${ph.name}`;
  }
  s.player = player.id;
  player.agenda = { kind: 'crown', targets: [], summary: 'Rule — or die trying.' };
  player.facade = 'A minor lord new to court.';
  ph.arrived = 0;

  baseRelations(g, king, captain, priest, greats);
  const history = writeHistory(g, king, greats, lessers, player);
  assignAgendas(g, king, captain, priest, greats);
  seedSituations(g, king, greats, lessers, player, history);
  servantsOverhear(g);
  playerAcquaintance(g, player);
  for (const p of Object.values(s.plots)) syncPlotSecret(s, p);
  for (const c of Object.values(s.chars)) c.firstAgenda = { ...c.agenda, targets: c.agenda.targets.slice() };

  log(
    s,
    `You arrive at the court of King ${king.short} with your household. You know almost no one, and almost no one knows you.`,
    'all',
    'court',
  );
  s.nightStart = s.nextId;
  return s;
}

function baseRelations(g: Gen, king: Character, captain: Character, priest: Character, greats: Character[]): void {
  const s = g.s;
  for (const id of s.order) {
    const c = s.chars[id];
    if (c.rank === 'servant') continue;
    if (id !== king.id) addMod(s, id, king.id, 'liege', 'Sworn liege', 15, 0, true);
    if (id !== priest.id) addMod(s, id, priest.id, 'priest', 'A man of God', 10, 0, true);
  }
  addMod(s, captain.id, king.id, 'oath', 'Sworn to his life', 50, 0, true);
  addMod(s, king.id, captain.id, 'shield', 'His sworn shield', 40, 0, true);
  rel(s, king.id, captain.id).trust = 80;
  addMod(s, king.id, priest.id, 'confessor', 'His confessor', 30, 0, true);
  rel(s, king.id, priest.id).trust = 75;
  for (const lord of greats) {
    addMod(s, king.id, lord.id, 'service', 'Long service', roll(s, 15, 30), 0, true);
    rel(s, king.id, lord.id).trust = roll(s, 50, 70);
  }
  // A few loose friendships and dislikes among the nobility.
  const nobles = s.order.filter((id) => !['servant', 'king'].includes(s.chars[id].rank));
  for (let i = 0; i < 6; i++) {
    const a = pick(s, nobles);
    const b = pick(s, nobles);
    if (a === b || s.chars[a].spouse === b) continue;
    if (chance(s, 55)) addMod(s, a, b, 'friend', 'Old friends', roll(s, 15, 25), 0, true);
    else addMod(s, a, b, 'dislike', 'Cannot abide him', -roll(s, 10, 20));
  }
}

interface History {
  thefts: { thief: Character; brothers: Character[]; secretId: string }[];
  rivals: [Character, Character][];
  affairs: { wife: Character; lover: Character; husband: Character; secretId: string }[];
}

/** A decade of past events, compressed into grievances, debts and secrets. */
function writeHistory(g: Gen, king: Character, greats: Character[], lessers: Character[], player: Character): History {
  const s = g.s;
  const hist: History = { thefts: [], rivals: [], affairs: [] };
  const heads = [...greats, ...lessers, player];

  // A stolen inheritance.
  const withBrothers = shuffle(s, heads.filter((h) => h.siblings.length > 0));
  for (const thief of withBrothers.slice(0, chance(s, 25) ? 2 : 1)) {
    if (!chance(s, thief.id === player.id ? 30 : 75)) continue;
    const brothers = thief.siblings.map((b) => s.chars[b]);
    for (const b of brothers) {
      const lid = uid(s, 'l');
      s.lands[lid] = { id: lid, name: landName(g), holder: thief.id, rightful: b.id, income: roll(s, 3, 4), desc: `${b.short}'s portion by their father's true will.` };
      b.archetype = 'disinherited';
      b.traits.wrath = clamp(b.traits.wrath + 12, 5, 95);
      b.facade = 'A grateful younger brother.';
      b.bio = `Cheated of his share of the family lands by ${thief.short}. He has learned to smile, not to forget.`;
      addMod(s, b.id, thief.id, 'theft', 'Stole our inheritance', -55);
      adjustTrust(s, b.id, thief.id, -30);
      addMod(s, thief.id, b.id, 'guilt', 'Uneasy conscience', -5);
    }
    const sec = makeSecret(s, {
      kind: 'theft',
      guilty: [thief.id],
      victims: brothers.map((b) => b.id),
      truth: true,
      evidence: roll(s, 35, 55),
      treason: false,
      text: `${thief.name} forged his father's will and took the inheritance of ${names(s, brothers.map((b) => b.id))}.`,
    });
    learn(s, thief.id, sec.id, 100, 'self');
    for (const b of brothers) learn(s, b.id, sec.id, 100, 'self');
    if (thief.spouse) learn(s, thief.spouse, sec.id, 100, thief.id);
    thief.bio = `${thief.bio} He forged his father's will to take his brothers' shares.`;
    hist.thefts.push({ thief, brothers, secretId: sec.id });
  }

  // An old rivalry between two great lords.
  if (greats.length >= 2) {
    const [a, b] = shuffle(s, greats);
    addMod(s, a.id, b.id, 'rivalry', 'Old rivalry', -35, 0, true);
    addMod(s, b.id, a.id, 'rivalry', 'Old rivalry', -35, 0, true);
    hist.rivals.push([a, b]);
  }

  // A life saved in battle.
  const fighters = s.order.map((id) => s.chars[id]).filter((c) => c.gender === 'm' && c.traits.martial >= 55 && ['great', 'lord', 'knight'].includes(c.rank));
  if (fighters.length >= 2) {
    const [a, b] = shuffle(s, fighters);
    const where = pick(s, ['Brackenford', 'the Saltmere crossing', 'Harrowden Bridge', 'the siege of Coldwater']);
    addMod(s, b.id, a.id, 'saved', `Saved my life at ${where}`, 30, 0, true);
    adjustTrust(s, b.id, a.id, 20);
  }

  // An insult at court, a debt, a broken betrothal.
  if (greats.length && lessers.length) {
    const a = pick(s, greats);
    const b = pick(s, [...lessers, player]);
    addMod(s, b.id, a.id, 'insult', 'Humiliated me before the court', -25, 0, true);
    const c = pick(s, lessers);
    const d = pick(s, greats);
    addMod(s, c.id, d.id, 'debt', `Holds my debts`, -10);
    addMod(s, d.id, c.id, 'debtor', `Owes me ${roll(s, 3, 12) * 10} crowns`, -5);
  }
  if (chance(s, 50) && lessers.length >= 2) {
    const [a, b] = shuffle(s, lessers);
    addMod(s, a.id, b.id, 'betrothal', 'Broke a betrothal with my house', -25, 0, true);
  }
  // The King has a favourite.
  if (chance(s, 60)) {
    const fav = pick(s, [...greats, ...lessers]);
    addMod(s, king.id, fav.id, 'favourite', 'A favourite', 25, 0, true);
  }

  // A secret love.
  const wives = shuffle(
    s,
    s.order.map((id) => s.chars[id]).filter((c) => c.spouse && (c.archetype === 'unhappy' || (c.rank === 'queen' && c.traits.honor < 50))),
  );
  for (const wife of wives.slice(0, chance(s, 40) ? 2 : 1)) {
    const husband = s.chars[wife.spouse!];
    const lovers = s.order
      .map((id) => s.chars[id])
      .filter((c) => c.gender === 'm' && c.id !== husband.id && c.status === 'free' && !['king', 'clergy', 'servant'].includes(c.rank) && c.householdId !== wife.householdId && c.traits.honor < 60);
    const lover = weighted(s, lovers, (c) => c.traits.charm + (c.archetype === 'rake' ? 60 : 0));
    if (!lover) continue;
    const sec = makeSecret(s, {
      kind: 'affair',
      guilty: [wife.id, lover.id],
      victims: [husband.id],
      truth: true,
      evidence: roll(s, 20, 35),
      treason: wife.rank === 'queen',
      text: `${wife.name} has taken ${lover.name} as her lover.`,
    });
    learn(s, wife.id, sec.id, 100, 'self');
    learn(s, lover.id, sec.id, 100, 'self');
    addMod(s, wife.id, lover.id, 'lover', 'Her lover', 45);
    addMod(s, lover.id, wife.id, 'lover', 'His lover', 35);
    rel(s, wife.id, lover.id).trust = 75;
    addMod(s, wife.id, husband.id, 'cold', 'A cold marriage', -10);
    wife.bio = `${wife.bio} She has taken ${lover.short} as her lover.`;
    hist.affairs.push({ wife, lover, husband, secretId: sec.id });
  }
  return hist;
}

function setAgenda(c: Character, a: Agenda): void {
  c.agenda = a;
}

function assignAgendas(g: Gen, king: Character, captain: Character, priest: Character, greats: Character[]): void {
  const s = g.s;
  setAgenda(king, { kind: 'keep-crown', targets: [], summary: 'Hold the crown, and hang anyone who reaches for it.' });
  setAgenda(captain, { kind: 'protect-king', targets: [], summary: 'Keep the King alive. Nothing else matters.' });
  setAgenda(priest, { kind: 'peace', targets: [], summary: 'Prevent murder, spare the innocent, and save what souls he can.' });
  const rivalOf = (c: Character) =>
    greats.filter((o) => o.id !== c.id).sort((a, b) => (s.relations[c.id]?.[a.id] ? 0 : 1) - (s.relations[c.id]?.[b.id] ? 0 : 1))[0];

  for (const c of Object.values(s.chars)) {
    if (c.id === s.player || c === king || c === captain || c === priest) continue;
    if (c.rank === 'servant') {
      setAgenda(c, { kind: 'peace', targets: [], summary: 'Keep a roof over their head, and a little silver put by.' });
      continue;
    }
    switch (c.archetype) {
      case 'soldier':
      case 'spider':
        setAgenda(c, { kind: 'crown', targets: [king.id], summary: c.archetype === 'spider' ? 'Clear a path to the throne with other men’s hands, then take it.' : 'Murder the old King and take the crown by right of the sword.' });
        break;
      case 'climber':
        if (c.traits.ambition >= 72) setAgenda(c, { kind: 'crown', targets: [king.id], summary: 'Rise from nothing to the throne, one fallen great lord at a time.' });
        else setAgenda(c, { kind: 'rise', targets: [], summary: 'Win a great office and the King’s ear.' });
        break;
      case 'official': {
        const r = rivalOf(c);
        if (r) setAgenda(c, { kind: 'destroy', targets: [r.id], summary: `See ${r.short} brought down, and himself first among the King’s servants.` });
        else setAgenda(c, { kind: 'rise', targets: [], summary: 'Stand first among the King’s servants.' });
        break;
      }
      case 'rake':
      case 'younger-son':
        setAgenda(c, { kind: 'rise', targets: [], summary: c.archetype === 'rake' ? 'Charm his way into an office and a fortune.' : 'Win lands and a place of his own.' });
        break;
      case 'disinherited': {
        const thief = Object.values(s.lands).find((l) => l.rightful === c.id)?.holder;
        setAgenda(c, { kind: 'restitution', targets: thief ? [thief] : [], summary: `Let ${thief ? s.chars[thief].short : 'the thief'} climb, then cut him down and take back what is ours.` });
        break;
      }
      case 'spur':
        setAgenda(c, { kind: 'raise-spouse', targets: greats.map((x) => x.id).filter((x) => x !== c.spouse), summary: 'Drive her husband to the top, and herself with him. A crown would do.' });
        break;
      case 'devoted':
        setAgenda(c, { kind: 'protect-spouse', targets: c.spouse ? [c.spouse] : [], summary: 'Keep her husband alive, even if it means keeping him from his ambitions.' });
        break;
      case 'queen':
        setAgenda(c, c.traits.honor >= 50 ? { kind: 'protect-spouse', targets: [king.id], summary: 'Keep the old King alive, and her place with him.' } : { kind: 'rise', targets: [], summary: 'Secure her future before the King dies — whoever must pay for it.' });
        break;
      default:
        setAgenda(c, { kind: 'peace', targets: [], summary: 'Live comfortably and keep out of other people’s quarrels.' });
    }
  }
  // Every court needs at least one would-be king among the great.
  if (!greats.some((c) => c.agenda.kind === 'crown')) {
    const c = greats.slice().sort((a, b) => b.traits.ambition - a.traits.ambition)[0];
    c.traits.ambition = Math.max(c.traits.ambition, 75);
    setAgenda(c, { kind: 'crown', targets: [king.id], summary: 'He has waited long enough. Kill the King and take his crown.' });
  }
}

interface SeedPlot {
  kind: 'murder' | 'ruin';
  owner: Character;
  targets: CharId[];
  progress: number;
  charges?: string[];
  waitFor?: CharId[];
  trigger?: PlotCondition[];
  secret: { kind: SecretKind; text?: string; evidence: number; treason?: boolean };
  intent: string;
}

function seedPlot(g: Gen, p: SeedPlot): Plot {
  const s = g.s;
  const id = uid(s, 'p');
  const sec = makeSecret(s, {
    kind: p.secret.kind,
    guilty: [p.owner.id],
    victims: p.targets,
    truth: true,
    evidence: p.secret.evidence,
    treason: p.secret.treason,
    plotId: id,
    text: p.secret.text,
  });
  const plot: Plot = {
    id,
    kind: p.kind,
    name: `The ${pick(s, ['Silent', 'Red', 'Long', 'Crooked', 'Hollow', 'Winter', 'Last', 'Gilded', 'Black', 'Quiet'])} ${pick(s, ['Cup', 'Feast', 'Stair', 'Glove', 'Bell', 'Hunt', 'Letter', 'Candle', 'Ledger', 'Bargain'])}`,
    owner: p.owner.id,
    targets: p.targets.slice(),
    members: [],
    progress: p.progress,
    status: 'active',
    secretId: sec.id,
    charges: p.charges ?? [],
    waitFor: p.waitFor ?? [],
    trigger: p.trigger,
    createdTurn: 0,
    intent: p.intent,
    hiredBlades: 0,
  };
  s.plots[id] = plot;
  learn(s, p.owner.id, sec.id, 100, 'self');
  return plot;
}

/** Apply dramatic situations to whoever fits them. */
function seedSituations(g: Gen, king: Character, greats: Character[], lessers: Character[], player: Character, hist: History): void {
  const s = g.s;
  const K = king.id;

  // 1. Would-be regicides.
  const regicides: Character[] = [];
  for (const c of greats) {
    if (c.agenda.kind !== 'crown' || c.archetype === 'spider') continue;
    const p = seedPlot(g, {
      kind: 'murder',
      owner: c,
      targets: [K],
      progress: roll(s, 15, 40),
      secret: { kind: 'regicide', evidence: roll(s, 25, 40) },
      intent: 'Kill the King on a hunting day, then claim the crown as the realm’s strongest hand.',
    });
    insightOf(s, c.id);
    regicides.push(c);
    if (c.spouse && chance(s, 50)) learn(s, c.spouse, p.secretId, roll(s, 30, 45), 'rumour');
  }
  if (!regicides.length) {
    const c = greats.find((x) => x.agenda.kind === 'crown')!;
    if (c && c.archetype !== 'spider') regicides.push(c);
  }

  // 2. The knowledge chain: someone learns of it and chooses to exploit it, not report it.
  const plotter = regicides[0];
  const spider = greats.find((c) => c.archetype === 'spider' && c.agenda.kind === 'crown');
  if (plotter) {
    const regSecret = Object.values(s.plots).find((p) => p.owner === plotter.id && p.kind === 'murder')?.secretId;
    const knower = greats
      .filter((c) => c.id !== plotter.id && c !== spider)
      .sort((a, b) => (s.relations[a.id]?.[plotter.id]?.mods.reduce((m, x) => m + x.value, 0) ?? 0) - (s.relations[b.id]?.[plotter.id]?.mods.reduce((m, x) => m + x.value, 0) ?? 0))[0];
    if (knower && regSecret) {
      learn(s, knower.id, regSecret, roll(s, 70, 85), 'spies');
      insightOf(s, knower.id).agendas.push(plotter.id);
      if (knower.agenda.kind !== 'crown') {
        knower.agenda = { kind: 'destroy', targets: [plotter.id], summary: `See ${plotter.short} destroyed — without being the one who carries the charge.` };
      }
      const ruin = seedPlot(g, {
        kind: 'ruin',
        owner: knower,
        targets: [plotter.id],
        progress: roll(s, 15, 30),
        charges: [regSecret],
        secret: { kind: 'ruin', evidence: 12 },
        intent: `Let someone else take ${plotter.short}'s treason to the King, keep my own hands clean, and stand first when his head is on a spike.`,
      });
      const conceal = makeSecret(s, {
        kind: 'concealment',
        guilty: [knower.id],
        victims: [K],
        truth: true,
        evidence: 20,
        text: `${knower.name} knows that ${plotter.name} plots against the King, and keeps it from him.`,
      });
      learn(s, knower.id, conceal.id, 100, 'self');

      // 3. The spider: says he will carry the charge, means to frame both and take the crown.
      if (spider) {
        learn(s, spider.id, regSecret, 85, knower.id);
        ruin.members.push({ id: spider.id, sincere: false, role: 'Will carry the charge to the King', joinedTurn: 0 });
        learn(s, spider.id, ruin.secretId, 100, 'self');
        conceal.guilty.push(spider.id);
        conceal.text = `${knower.name} and ${spider.name} know that ${plotter.name} plots against the King, and keep it from him.`;
        learn(s, spider.id, conceal.id, 100, 'self');
        insightOf(s, spider.id).agendas.push(knower.id, plotter.id);
        const pact = makeSecret(s, { kind: 'pact', guilty: [plotter.id, knower.id], victims: [K], truth: false, fabricatedBy: spider.id, evidence: roll(s, 35, 45) });
        learn(s, spider.id, pact.id, 0, 'self', true);
        seedPlot(g, {
          kind: 'ruin',
          owner: spider,
          targets: [plotter.id, knower.id],
          progress: roll(s, 30, 45),
          charges: [pact.id],
          secret: { kind: 'slander', text: `${spider.name} has forged letters to convict ${plotter.name} and ${knower.name} of a pact they never swore.`, evidence: 10, treason: false },
          intent: `Tell ${knower.short} I go to the King about ${plotter.short}. Tell the King they are sworn together. Let the axe take both.`,
        });
        seedPlot(g, {
          kind: 'murder',
          owner: spider,
          targets: [K],
          progress: roll(s, 10, 20),
          waitFor: [plotter.id, knower.id],
          secret: { kind: 'usurpation', text: `${spider.name} means to have ${plotter.name} and ${knower.name} destroyed on a false charge, then murder the King and take the crown.`, evidence: 12 },
          intent: 'When the two are dead, the King dies of a fever no physician can name.',
        });
      }
    }
  }
  if (spider && !Object.values(s.plots).some((p) => p.owner === spider.id)) {
    seedPlot(g, { kind: 'murder', owner: spider, targets: [K], progress: roll(s, 10, 25), secret: { kind: 'regicide', evidence: 10 }, intent: 'Poison, patiently.' });
  }

  // 4. Disinherited brothers: feign loyalty, let him rise, then take everything back.
  for (const t of hist.thefts) {
    const [elder, ...rest] = t.brothers;
    const p = seedPlot(g, {
      kind: 'murder',
      owner: elder,
      targets: [t.thief.id],
      progress: roll(s, 5, 15),
      trigger: [
        { kind: 'office', who: t.thief.id },
        { kind: 'favour', who: elder.id, min: 25 },
        { kind: 'after', turn: roll(s, 18, 30) },
      ],
      secret: {
        kind: 'betrayal',
        text: `${names(s, t.brothers.map((b) => b.id))} mean to let ${t.thief.name} rise, then kill him and take back their lands.`,
        evidence: 5,
        treason: false,
      },
      intent: `Smile at ${t.thief.short}. Get close to the King. When the time is right, ${t.thief.short} dies by a stranger's hand — a murdered man's lands go to his brothers; a traitor's go to the crown.`,
    });
    for (const b of rest) {
      p.members.push({ id: b.id, sincere: true, role: 'Keeper of the true will', joinedTurn: 0 });
      learn(s, b.id, p.secretId, 100, 'self');
    }
    for (const b of t.brothers) insightOf(s, b.id).agendas.push(t.thief.id, ...t.brothers.map((x) => x.id).filter((x) => x !== b.id));
  }

  // 5. Spurs: their maids hear things, and they make their husbands use it.
  const allSecrets = () => Object.values(s.secrets).filter((x) => x.truth && x.kind !== 'affair' && !x.guilty.includes(player.id));
  for (const lord of [...lessers, ...greats, player]) {
    const wife = lord.spouse ? s.chars[lord.spouse] : undefined;
    if (!wife || wife.archetype !== 'spur') continue;
    insightOf(s, wife.id).agendas.push(lord.id);
    const pool = shuffle(s, allSecrets().filter((x) => !x.guilty.includes(lord.id) && !x.guilty.includes(wife.id))).slice(0, roll(s, 1, 2));
    for (const sec of pool) {
      learn(s, wife.id, sec.id, roll(s, 60, 75), 'spies');
      learn(s, lord.id, sec.id, roll(s, 55, 70), wife.id);
    }
    wife.pressure = 0;
    lord.pressure = roll(s, 15, 35);
    // An ambitious NPC husband turns what she heard into a scheme.
    if (lord.id !== player.id) {
      const charges = pool.filter((x) => x.treason || x.kind === 'concealment');
      const targets = Array.from(new Set(charges.flatMap((x) => x.guilty))).filter((x) => x !== lord.id && x !== K);
      if (targets.length) {
        seedPlot(g, {
          kind: 'ruin',
          owner: lord,
          targets,
          progress: roll(s, 5, 15),
          charges: charges.map((x) => x.id),
          secret: { kind: 'ruin', evidence: 8 },
          intent: 'Take what my wife has learned to the King at the right moment, and step into the empty chairs.',
        });
        if (lord.agenda.kind !== 'crown') lord.agenda = { kind: 'rise', targets, summary: 'Let the King destroy the great lords, and step into their places.' };
      }
    }
  }

  // 6. The player starts with something: a wife's gossip, or a rumour from the tavern.
  if (!Object.values(s.knowledge[player.id] ?? {}).some((k) => k.source !== 'self')) {
    const pool = allSecrets().filter((x) => x.treason || x.kind === 'theft' || x.kind === 'concealment');
    const sec = pool.length ? pick(s, pool) : allSecrets()[0];
    if (sec) learn(s, player.id, sec.id, roll(s, 40, 55), 'rumour');
  }
}

/** Servants hear what is said behind their masters' doors. */
function servantsOverhear(g: Gen): void {
  const s = g.s;
  for (const h of Object.values(s.houses)) {
    const servants = h.members.filter((m) => s.chars[m].rank === 'servant');
    if (!servants.length || !h.head) continue;
    const head = s.chars[h.head];
    const lady = head.spouse ? s.chars[head.spouse] : undefined;
    for (const sv of servants) {
      const role = s.chars[sv].role;
      const watched = role === 'maid' && lady ? lady : head;
      for (const [sid, k] of Object.entries(s.knowledge[watched.id] ?? {})) {
        if (k.lie) continue;
        const sec = s.secrets[sid];
        if (!sec || !sec.truth) continue;
        const own = sec.guilty.includes(watched.id);
        if (chance(s, own ? 40 : 20)) learn(s, sv, sid, roll(s, 40, 65), 'spies');
      }
    }
  }
}

/** A newcomer knows his own household, the great faces of the court, and a few names. */
function playerAcquaintance(g: Gen, player: Character): void {
  const s = g.s;
  const set = (id: CharId, lvl: Acquaintance) => {
    if ((s.known[id] ?? 0) < lvl) s.known[id] = lvl;
  };
  set(player.id, 5);
  for (const m of s.houses[player.householdId].members) set(m, 4);
  for (const b of player.siblings) set(b, 4);
  for (const id of s.order) {
    const c = s.chars[id];
    const house = s.houses[c.householdId];
    if (c.rank === 'king' || c.rank === 'queen') set(id, 2);
    else if (Object.values(s.offices).includes(id)) set(id, 2);
    else if (house.head === id) set(id, house.rank === 'great' ? 2 : 1);
    else if (c.rank === 'lady' && house.rank === 'great') set(id, 1);
  }
  // Anyone named in what you know, you have at least heard of.
  for (const sid of Object.keys(s.knowledge[player.id] ?? {})) {
    const sec = s.secrets[sid];
    for (const id of [...sec.guilty, ...sec.victims]) set(id, 1);
  }
  // You know your own wife's face, if not her heart.
  insightOf(s, player.id);
}

// ── Newcomers ───────────────────────────────────────────────────────────────

/** A new lesser house comes to court, to keep an open-ended game alive. */
export function arriveHouse(s: GameState): House {
  const g: Gen = {
    s,
    usedGiven: new Set(Object.values(s.chars).map((c) => c.short)),
    usedHouses: new Set(Object.values(s.houses).map((h) => h.name)),
    usedLands: new Set(Object.values(s.lands).map((l) => l.name)),
  };
  const h = newHouse(g, houseName(g), 'lesser', [4, 6]);
  const arch = weighted(s, [['climber', 50], ['content', 30], ['rake', 20]] as [ArchetypeId, number][], (x) => x[1])![0];
  const lord = household(g, h, { arch, rank: 'lord', age: [22, 50] }, { wife: 65, brothers: [70, 30, 0], steward: 40, maid: 60 });
  h.arrived = s.turn;
  for (const m of h.members) {
    const c = s.chars[m];
    if (c.rank !== 'servant' && s.king) addMod(s, m, s.king, 'liege', 'Sworn liege', 15, 0, true);
    c.firstAgenda = { ...c.agenda };
  }
  if (arch === 'climber' || arch === 'rake') lord.agenda = { kind: 'rise', targets: [], summary: 'Make a name at court, quickly.' };
  if (lord.spouse && s.chars[lord.spouse].archetype === 'spur') s.chars[lord.spouse].agenda = { kind: 'raise-spouse', targets: [], summary: 'Drive her husband up the hall.' };
  if (lord.spouse && s.chars[lord.spouse].archetype === 'devoted') s.chars[lord.spouse].agenda = { kind: 'protect-spouse', targets: [lord.id], summary: 'Keep her husband out of trouble.' };
  for (const m of h.members) s.chars[m].firstAgenda = { ...s.chars[m].agenda };
  if ((s.known[lord.id] ?? 0) < 1) s.known[lord.id] = 1;
  log(s, `A new family has come to court: House ${h.name}, led by ${lord.name}.`, 'all', 'court', [lord.id]);
  return h;
}

