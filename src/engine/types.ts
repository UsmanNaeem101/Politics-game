// Core data model. Everything in GameState is plain, serialisable data so a game
// can be saved, replayed from its seed, and inspected in tests.

export type CharId = string;
export type SecretId = string;
export type PlotId = string;
export type LandId = string;

export type OfficeId = 'marshal' | 'chancellor' | 'spymaster' | 'captain' | 'confessor';
export type Rank = 'king' | 'queen' | 'great' | 'lord' | 'knight' | 'lady' | 'clergy' | 'servant' | 'child';
export type HouseId = string;
export type Status = 'free' | 'imprisoned' | 'dead' | 'fled';

/** Temperament, 0..100. Publicly readable in broad strokes; motives are not. */
export interface Traits {
  ambition: number;
  cunning: number;
  honor: number;
  boldness: number;
  greed: number;
  wrath: number;
  paranoia: number;
  /** Force of personality: how hard this person can push someone close to them. */
  will: number;
  charm: number;
  martial: number;
}

export type TraitKey = keyof Traits;

/** The hidden motive that drives a character. The player only sees it once discovered. */
export type AgendaKind =
  | 'crown' // wear the crown
  | 'destroy' // see particular rivals dead or disgraced
  | 'restitution' // recover what was stolen, and make the thief pay
  | 'protect-king' // keep the King alive
  | 'peace' // stop the bloodshed
  | 'raise-spouse' // lift one's husband (and so oneself) to power
  | 'protect-spouse' // keep one's husband alive, whatever he plots
  | 'keep-crown' // a king's agenda: hold what he has
  | 'rise'; // win an office and the King's favour

export interface Agenda {
  kind: AgendaKind;
  targets: CharId[];
  summary: string;
}

export type ChargeShape =
  | 'lion'
  | 'tower'
  | 'sword'
  | 'key'
  | 'crown'
  | 'raven'
  | 'boar'
  | 'cross'
  | 'star'
  | 'fleur'
  | 'crescent'
  | 'chalice'
  | 'wheat';

export type Division = 'plain' | 'per-pale' | 'per-fess' | 'per-bend' | 'quarterly' | 'chevron';

export interface Heraldry {
  field: string;
  field2?: string;
  division: Division;
  charge: ChargeShape;
  tincture: string;
}

export interface Character {
  id: CharId;
  name: string;
  short: string;
  title: string;
  epithet: string;
  gender: 'm' | 'f';
  age: number;
  /** Display name of the house ("Ashby"). */
  house: string;
  householdId: HouseId;
  /** What a servant or retainer does ("steward", "maid"). */
  role?: string;
  rank: Rank;
  /** May be acclaimed king by the Witan. */
  canClaim: boolean;
  traits: Traits;
  status: Status;
  statusTurn?: number;
  /** A child she is carrying: whose, and the month it is due. */
  expecting?: { father: CharId; due: number };
  /** The true father, when it is not the husband (or there is none): a secret, though the father knows. */
  sire?: CharId;
  /** The month she last dined out at her husband's bidding. */
  dined?: number;
  /** Names this person has gone by: a maiden name, a knight's before he was a lord. */
  formerly?: string[];
  /** Found guilty or let out of the Tower: begins no new scheme before this month. */
  lieLow?: number;
  fate?: string;
  gold: number;
  prestige: number;
  spouse?: CharId;
  siblings: CharId[];
  /** Mother and father (as the world believes; a secret may say otherwise). */
  parents?: CharId[];
  children?: CharId[];
  /** The true motive. Hidden. */
  agenda: Agenda;
  /** The motive they began the season with (agendas can change). */
  firstAgenda?: Agenda;
  /** The face shown to the court. */
  facade: string;
  bio: string;
  /** Influence from a spouse, -100 (restrained) .. +100 (goaded). Decays each month. */
  pressure: number;
  /** Extra protection from hired swords; decays each month. */
  guard: number;
  heraldry: Heraldry;
  playable?: { blurb: string; difficulty: 'Gentle' | 'Cunning' | 'Treacherous' | 'Desperate' };
  /** Generator archetype, for flavour and tuning. */
  archetype?: string;
}

export interface House {
  id: HouseId;
  name: string;
  rank: 'royal' | 'great' | 'lesser' | 'church';
  heraldry: Heraldry;
  head: CharId | null;
  members: CharId[];
  seat?: LandId;
  motto?: string;
  /** Turn the house came to court (0 = from the start). */
  arrived: number;
  /** The tier the court last counted this house in, to notice it rising or falling. */
  standing?: 'great' | 'lesser';
}

/** How well the player knows a person. */
export type Acquaintance = 0 | 1 | 2 | 3 | 4 | 5;

export interface OpinionMod {
  key: string;
  label: string;
  value: number;
  /** Amount the modifier shrinks toward zero each month; 0 = permanent. */
  decay: number;
  /** Known to the whole court (an old rivalry, a marriage, a public insult). */
  public?: boolean;
}

export interface Relation {
  mods: OpinionMod[];
  trust: number;
}

export type SecretKind =
  | 'regicide' // plots to murder the King
  | 'murder' // plots to murder someone else
  | 'concealment' // knows of treason and hides it
  | 'usurpation' // means to take the crown by foul means
  | 'pact' // a conspiracy of several against the King
  | 'theft' // stole land or gold
  | 'betrayal' // means to turn on an ally
  | 'slander' // bore false witness
  | 'ruin' // gathers charges to destroy someone at court
  | 'affair' // a secret love outside marriage
  | 'racket'; // secretly runs an illicit trade

export interface Secret {
  id: SecretId;
  kind: SecretKind;
  guilty: CharId[];
  victims: CharId[];
  /** False secrets are fabrications. */
  truth: boolean;
  fabricatedBy?: CharId;
  /** How provable it is before the King, 0..100. */
  evidence: number;
  treason: boolean;
  plotId?: PlotId;
  createdTurn: number;
  /** Canonical statement, written with names. */
  text: string;
  /** Proven publicly at court or on the scaffold. */
  exposed: boolean;
  /** Hand-written statement; not regenerated when names change. */
  fixedText?: boolean;
  /** The plotted killing was done: no longer a plan but a murder committed. */
  deed?: boolean;
  /** Month the King set his people to look into it (a dismissed charge, an unsolved murder). */
  inquiry?: number;
  /** For concealment: the treason it hides. When that is old news, so is this. */
  about?: SecretId;
  /** For a racket: the business it is about, and what kind. */
  businessId?: string;
  trade?: BusinessKind;
}

/** The parts of society whose regard a trade wins or loses. */
export type Estate = 'crown' | 'nobility' | 'church' | 'guilds' | 'commons' | 'underworld';

export type BusinessKind =
  | 'estates'
  | 'wool'
  | 'mill'
  | 'wine'
  | 'moneylending'
  | 'taxfarm'
  | 'gambling'
  | 'bathhouse'
  | 'smuggling'
  | 'forgery'
  | 'apothecary';

/** Why a spy serves: it decides how far they can be trusted, and what they will do when caught. */
export type SpyHook = 'gold' | 'blackmail' | 'devotion' | 'grudge';

/** Someone free to marry, and the suitors calling on them. No suitors: a match is sought in the provinces. */
export interface Courtship {
  suitors: CharId[];
  since: number;
}

/** A man hired to follow someone for a month. */
export interface Tail {
  id: string;
  by: CharId;
  target: CharId;
  since: number;
}

/** A person recruited to watch someone they can get close to. */
export interface Spy {
  id: string;
  agent: CharId;
  master: CharId;
  mark: CharId;
  hook: SpyHook;
  /** Crowns a month, for a paid spy. */
  wage: number;
  since: number;
  status: 'active' | 'ended';
  /** Caught and turned by this person: now carries their lies to the master. */
  turnedBy?: CharId;
  reports: number;
  /** An unfaithful spouse, spying on her husband for her lover (and lying to him for her lover). */
  affair?: boolean;
}

/** What a trade gives its owner for intrigue. */
export type Perk = 'retainers' | 'factors' | 'leverage' | 'cellar' | 'debtors' | 'royal-ear' | 'debts' | 'informants' | 'cutthroats' | 'seals' | 'poisons';

export interface Business {
  id: string;
  kind: BusinessKind;
  owner: CharId;
  since: number;
  /** For a racket: the secret that the owner runs it. */
  secretId?: SecretId;
}

export type KnowledgeSource = CharId | 'self' | 'spies' | 'rumour' | 'confession' | 'court';

export interface Knowledge {
  /** How strongly the knower believes it, 0..100. */
  credence: number;
  source: KnowledgeSource;
  turn: number;
  /** The knower invented this. */
  lie?: boolean;
}

export type PlotKind = 'murder' | 'ruin';

export type OfferKind = 'none' | 'gold' | 'land' | 'office' | 'restitution' | 'vengeance';

export interface Offer {
  kind: OfferKind;
  amount?: number;
  landId?: LandId;
  office?: OfficeId;
}

export interface PlotMember {
  id: CharId;
  /** False = joined only to betray. Hidden from everyone but the member. */
  sincere: boolean;
  role: string;
  joinedTurn: number;
  offer?: Offer;
}

export interface Plot {
  id: PlotId;
  kind: PlotKind;
  name: string;
  owner: CharId;
  targets: CharId[];
  members: PlotMember[];
  progress: number;
  status: 'active' | 'succeeded' | 'foiled' | 'abandoned';
  /** The secret that describes this plot's existence. */
  secretId: SecretId;
  /** For ruin plots: the accusations it will bring before the King. */
  charges: SecretId[];
  /** Do not strike until all of these are dead, imprisoned or fled. */
  waitFor: CharId[];
  /** And, if set, until at least one of these holds. */
  trigger?: PlotCondition[];
  createdTurn: number;
  /** The owner's own description of the real plan. */
  intent: string;
  hiredBlades: number;
}

export type PlotCondition =
  | { kind: 'office'; who: CharId }
  | { kind: 'favour'; who: CharId; min: number }
  | { kind: 'after'; turn: number };

export interface Pledge {
  id: string;
  from: CharId;
  to: CharId;
  offer: Offer;
  plotId?: PlotId;
  turn: number;
  status: 'pending' | 'kept' | 'broken';
  text: string;
}

export interface Land {
  id: LandId;
  name: string;
  holder: CharId | null; // null = held by the Crown
  rightful?: CharId;
  income: number;
  desc: string;
}

export type EventTone = 'neutral' | 'good' | 'bad' | 'dire' | 'secret' | 'court';

export interface GameEvent {
  id: number;
  turn: number;
  text: string;
  /** 'all' = public. An empty array = nobody saw it (revealed only at the end). */
  visibleTo: CharId[] | 'all';
  actors: CharId[];
  tone: EventTone;
}

export type AudienceKind =
  | 'caught-spy'
  | 'recruit'
  | 'blackmail'
  | 'counsel'
  | 'judgment'
  | 'accused'
  | 'petition'
  | 'witan'
  | 'pledge-due';

export interface AudienceOption {
  id: string;
  label: string;
  hint?: string;
  tone?: 'good' | 'bad' | 'dire' | 'neutral';
}

export interface Audience {
  id: string;
  kind: AudienceKind;
  from: CharId;
  turn: number;
  title: string;
  text: string;
  options: AudienceOption[];
  data: Record<string, unknown>;
}

export interface Directive {
  by: CharId;
  kind: 'denounce' | 'strike' | 'advance' | 'restore' | 'abandon';
  plotId?: PlotId;
  secretId?: SecretId;
  target?: CharId;
  until: number;
  text: string;
  /** Rolled once: whether the spouse finds the nerve to obey. */
  obeys?: boolean;
}

export interface Imprisonment {
  charges: SecretId[];
  since: number;
  accuser?: CharId;
  questioned: number;
  /** The King commuted the axe at a hearing: the Tower, for a time, then disgrace. */
  spared?: boolean;
}

export interface Insight {
  /** Characters whose true agenda this observer has uncovered. */
  agendas: CharId[];
  /** `${plotId}:${memberId}` pairs whose sincerity this observer has uncovered. */
  sincerity: string[];
  /** `${a}>${b}`: this observer has heard how a feels about b. */
  feelings?: string[];
}

export type Verdict = 'triumph' | 'victory' | 'survival' | 'defeat' | 'death';

export interface ObjectiveResult {
  verdict: Verdict;
  score: number;
  headline: string;
  notes: string[];
}

export interface Ending {
  reason: 'season-end' | 'player-dead' | 'player-fled' | 'crowned';
  turn: number;
  result: ObjectiveResult;
}

export interface GameState {
  version: 2;
  seed: number;
  rng: number;
  turn: number;
  /** 0 = open-ended: the game runs until the player dies, flees or is crowned. */
  maxTurns: number;
  /** The player was crowned and chose to rule on. */
  reigning?: boolean;
  player: CharId;
  phase: 'playing' | 'ended';
  chars: Record<CharId, Character>;
  order: CharId[];
  houses: Record<HouseId, House>;
  /** The player's acquaintance with each person (fog of war). Missing = unknown. */
  known: Record<CharId, Acquaintance>;
  /** Times the player has kept company with each person. */
  company: Record<CharId, number>;
  relations: Record<CharId, Record<CharId, Relation>>;
  secrets: Record<SecretId, Secret>;
  knowledge: Record<CharId, Record<SecretId, Knowledge>>;
  plots: Record<PlotId, Plot>;
  pledges: Pledge[];
  lands: Record<LandId, Land>;
  /** Trades and rackets. Missing in saves from before businesses. */
  businesses: Record<string, Business>;
  /** Recruited spies, everyone's. Missing in saves from before spies. */
  spies: Record<string, Spy>;
  /** Matches being made: who is courting whom, and since when. The answer comes after DELIBERATION months. */
  courtships?: Record<CharId, Courtship>;
  /** People being followed this month. */
  tails?: Record<string, Tail>;
  offices: Record<OfficeId, CharId | null>;
  king: CharId | null;
  interregnum: { since: number } | null;
  imprisoned: Record<CharId, Imprisonment>;
  /** The player's chosen candidate while the Witan is pending. */
  witanVote?: CharId;
  directives: Record<CharId, Directive>;
  insight: Record<CharId, Insight>;
  ap: number;
  apMax: number;
  audiences: Audience[];
  events: GameEvent[];
  nextId: number;
  /** Event id at which the current month's turn began, for the dawn report. */
  nightStart: number;
  /** Charges the King has judged, by chargeKey(): how much proof there was then. A forged copy is the same charge. */
  judged?: Record<string, number>;
  ending?: Ending;
}
