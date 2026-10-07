// Core data model. Everything in GameState is plain, serialisable data so a game
// can be saved, replayed from its seed, and inspected in tests.

export type CharId = string;
export type SecretId = string;
export type PlotId = string;
export type LandId = string;

export type OfficeId = 'marshal' | 'chancellor' | 'spymaster' | 'captain' | 'confessor';
export type Rank = 'king' | 'queen' | 'great' | 'lord' | 'knight' | 'lady' | 'clergy';
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
  | 'keep-crown'; // a king's agenda: hold what he has

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
  house: string;
  rank: Rank;
  /** May be acclaimed king by the Witan. */
  canClaim: boolean;
  traits: Traits;
  status: Status;
  statusTurn?: number;
  fate?: string;
  gold: number;
  prestige: number;
  spouse?: CharId;
  siblings: CharId[];
  /** The true motive. Hidden. */
  agenda: Agenda;
  /** The face shown to the court. */
  facade: string;
  bio: string;
  /** Influence from a spouse, -100 (restrained) .. +100 (goaded). Decays each week. */
  pressure: number;
  /** Extra protection from hired swords; decays each week. */
  guard: number;
  heraldry: Heraldry;
  playable: { blurb: string; difficulty: 'Gentle' | 'Cunning' | 'Treacherous' | 'Desperate' };
}

export interface OpinionMod {
  key: string;
  label: string;
  value: number;
  /** Amount the modifier shrinks toward zero each week; 0 = permanent. */
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
  | 'ruin'; // gathers charges to destroy someone at court

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
  createdTurn: number;
  /** The owner's own description of the real plan. */
  intent: string;
  hiredBlades: number;
}

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
}

export interface Insight {
  /** Characters whose true agenda this observer has uncovered. */
  agendas: CharId[];
  /** `${plotId}:${memberId}` pairs whose sincerity this observer has uncovered. */
  sincerity: string[];
}

export type Verdict = 'triumph' | 'victory' | 'survival' | 'defeat' | 'death';

export interface ObjectiveResult {
  verdict: Verdict;
  score: number;
  headline: string;
  notes: string[];
}

export interface Ending {
  reason: 'season-end' | 'player-dead' | 'player-fled';
  turn: number;
  result: ObjectiveResult;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  turn: number;
  maxTurns: number;
  player: CharId;
  phase: 'playing' | 'ended';
  chars: Record<CharId, Character>;
  order: CharId[];
  relations: Record<CharId, Record<CharId, Relation>>;
  secrets: Record<SecretId, Secret>;
  knowledge: Record<CharId, Record<SecretId, Knowledge>>;
  plots: Record<PlotId, Plot>;
  pledges: Pledge[];
  lands: Record<LandId, Land>;
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
  /** Event id at which the current week's night began, for the dawn report. */
  nightStart: number;
  ending?: Ending;
}
