// Small, pure-ish helpers over GameState used by every other engine module.

import { BUSINESSES } from './content/businesses';
import { clamp } from './rng';
import type {
  Acquaintance,
  Business,
  Character,
  CharId,
  Estate,
  EventTone,
  GameEvent,
  GameState,
  House,
  Knowledge,
  KnowledgeSource,
  LandId,
  OfficeId,
  OpinionMod,
  Perk,
  Relation,
  SecretId,
  Traits,
} from './types';

export const OFFICE_NAMES: Record<OfficeId, string> = {
  marshal: 'Lord Marshal',
  chancellor: 'Lord Chancellor',
  spymaster: 'Master of Whispers',
  captain: 'Captain of the Guard',
  confessor: "King's Confessor",
};

export const OFFICE_INCOME: Record<OfficeId, number> = {
  marshal: 4,
  chancellor: 8,
  spymaster: 4,
  captain: 3,
  confessor: 2,
};

export const ch = (s: GameState, id: CharId): Character => {
  const c = s.chars[id];
  if (!c) throw new Error(`unknown character ${id}`);
  return c;
};

export const isFree = (s: GameState, id: CharId | null | undefined): boolean =>
  !!id && s.chars[id]?.status === 'free';
export const isAlive = (s: GameState, id: CharId | null | undefined): boolean =>
  !!id && (s.chars[id]?.status === 'free' || s.chars[id]?.status === 'imprisoned');
/** Dead, imprisoned or fled: no longer an obstacle. */
export const isRemoved = (s: GameState, id: CharId): boolean => s.chars[id]?.status !== 'free';

export const freeChars = (s: GameState): Character[] => s.order.map((id) => s.chars[id]).filter((c) => c.status === 'free');
export const livingChars = (s: GameState): Character[] =>
  s.order.map((id) => s.chars[id]).filter((c) => c.status === 'free' || c.status === 'imprisoned');

export function officeOf(s: GameState, id: CharId): OfficeId | undefined {
  return (Object.keys(s.offices) as OfficeId[]).find((o) => s.offices[o] === id);
}

export function landsOf(s: GameState, id: CharId): LandId[] {
  return Object.values(s.lands)
    .filter((l) => l.holder === id)
    .map((l) => l.id);
}

export function incomeOf(s: GameState, id: CharId): number {
  let inc = 0;
  for (const l of Object.values(s.lands)) {
    if (l.holder === id || (l.holder === null && s.king === id)) inc += l.income;
  }
  const off = officeOf(s, id);
  if (off) inc += OFFICE_INCOME[off];
  return inc + tradeIncome(s, id);
}

// ── Trades and standing ─────────────────────────────────────────────────────

/** Dead, or gone from court for good. */
export const gone = (s: GameState, id: CharId) => !s.chars[id] || s.chars[id].status === 'dead' || s.chars[id].status === 'fled';

/**
 * A new name or style: a bride takes her husband's house, an heir becomes Lord. What is written
 * about them in secrets keeps up, and the old name is remembered.
 */
export function rename(s: GameState, id: CharId, name: string, remember = true): void {
  const c = ch(s, id);
  const old = c.name;
  if (old === name) return;
  c.name = name;
  if (remember) (c.formerly ??= []).push(old);
  for (const sec of Object.values(s.secrets)) {
    const named = sec.guilty.includes(id) || sec.victims.includes(id) || (!!sec.about && !!s.secrets[sec.about]?.guilty.includes(id));
    if (named && sec.text.includes(old)) sec.text = sec.text.split(old).join(name);
  }
}

/** Everyone named in a secret the player holds is someone they have heard of, whoever has joined it since. */
export function hearOfTheNamed(s: GameState): void {
  for (const sid of Object.keys(s.knowledge[s.player] ?? {})) {
    const sec = s.secrets[sid];
    if (sec) for (const id of sec.guilty.concat(sec.victims)) hearOf(s, id, 1);
  }
}

/** A cold marriage thaws over years; a wife's unfaithfulness is forgiven, slowly. Keeping company hastens both. */
export const COLD_FADES = 0.25;
export const FAITHLESS_FADES = 0.5;
export const MARRIAGE_WOUNDS = ['cold', 'faithless'];

/** Time spent together eases what lies between husband and wife, both ways. True if anything eased. */
export function mendMarriage(s: GameState, a: CharId, b: CharId, amount: number): boolean {
  let eased = false;
  for (const [x, y] of [[a, b], [b, a]]) {
    const r = s.relations[x]?.[y];
    if (!r) continue;
    for (const m of r.mods) {
      if (!MARRIAGE_WOUNDS.includes(m.key) || m.value >= 0) continue;
      m.value = Math.min(0, m.value + amount);
      eased = true;
    }
    r.mods = r.mods.filter((m) => !MARRIAGE_WOUNDS.includes(m.key) || m.value <= -1);
  }
  return eased;
}

/** A husband or wife still living. A widow keeps a link to her late husband in `spouse`. */
export const livingSpouse = (s: GameState, id: CharId): CharId | undefined => {
  const sp = s.chars[id]?.spouse;
  return sp && !gone(s, sp) ? sp : undefined;
};

/**
 * Where a house stands in the court's eyes now, by its head's prestige and
 * office rather than the rank it started with: houses rise and fall.
 */
/**
 * How high a house stands among its tier: its head's prestige and office. A house kept by a widow or a
 * boy stands below every house a grown man leads, until a man heads it again and works it back up.
 */
export function houseStanding(s: GameState, h: House): number {
  const head = h.head ? s.chars[h.head] : undefined;
  if (!head || gone(s, head.id)) return -2000;
  if (head.gender === 'f' || head.rank === 'child') return -1000 + head.prestige;
  const off = officeOf(s, head.id);
  return head.prestige + (off === 'marshal' || off === 'chancellor' || off === 'spymaster' ? 20 : off ? 10 : 0);
}

export function houseTier(s: GameState, h: House): House['rank'] {
  if (h.rank === 'royal' || h.rank === 'church') return h.rank;
  const head = h.head ? s.chars[h.head] : undefined;
  if (!head || gone(s, head.id)) return h.rank;
  // A house kept by a widow or a boy not yet grown keeps its lands and its trade, not its place among the lords.
  if (head.gender === 'f' || head.rank === 'child') return 'lesser';
  const off = officeOf(s, head.id);
  const great = off === 'marshal' || off === 'chancellor' || off === 'spymaster' ? 20 : 0;
  return head.prestige + great >= 45 ? 'great' : 'lesser';
}

export function businessesOf(s: GameState, id: CharId): Business[] {
  return Object.values(s.businesses ?? {}).filter((b) => b.owner === id);
}

/** Crowns a month from trade. Friends in the guilds make honest trade pay better. */
export function tradeIncome(s: GameState, id: CharId): number {
  const mine = businessesOf(s, id);
  if (!mine.length) return 0;
  const guilds = Math.max(0, standingOf(s, id, 'guilds'));
  return mine.reduce((sum, b) => sum + BUSINESSES[b.kind].income, 0) + Math.floor(guilds / 6);
}

/** Which part of society a person speaks for. */
export function estateOf(s: GameState, id: CharId): Estate {
  const c = s.chars[id];
  if (!c) return 'nobility';
  if (c.rank === 'king') return 'crown';
  if (c.rank === 'clergy') return 'church';
  if (c.rank === 'servant') return 'commons';
  return 'nobility';
}

/** Does this person know the owner runs this racket? */
export function knowsRacket(s: GameState, viewer: CharId, b: Business): boolean {
  if (!b.secretId) return false;
  if (viewer === b.owner) return true;
  const sec = s.secrets[b.secretId];
  return !!sec && (sec.exposed || credence(s, viewer, b.secretId) >= 50);
}

/** What `a` thinks of `b`'s trades, line by line. */
export function tradeRegardParts(s: GameState, a: CharId, b: CharId): { key: string; label: string; value: number; racket: boolean }[] {
  if (a === b) return [];
  const e = estateOf(s, a);
  const out: { key: string; label: string; value: number; racket: boolean }[] = [];
  for (const biz of businessesOf(s, b)) {
    const def = BUSINESSES[biz.kind];
    const known = def.illicit && knowsRacket(s, a, biz);
    const v = (def.illicit && !known ? 0 : def.standing[e] ?? 0) + (known ? def.ifKnown?.[e] ?? 0 : 0);
    if (v) out.push({ key: `trade-${biz.id}`, label: known ? `Runs a ${def.name.toLowerCase()}` : `Trade: ${def.name.toLowerCase()}`, value: v, racket: known });
  }
  return out;
}

/** The same sum as `tradeRegardParts`, without building the lines: opinion() calls this constantly. */
export function tradeRegard(s: GameState, a: CharId, b: CharId): number {
  if (a === b || !s.businesses) return 0;
  let e: Estate | undefined;
  let v = 0;
  for (const id in s.businesses) {
    const biz = s.businesses[id];
    if (biz.owner !== b) continue;
    e ??= estateOf(s, a);
    const def = BUSINESSES[biz.kind];
    if (!def.illicit) v += def.standing[e] ?? 0;
    else if (knowsRacket(s, a, biz)) v += (def.standing[e] ?? 0) + (def.ifKnown?.[e] ?? 0);
  }
  return v;
}

/**
 * How a part of society regards someone for their trades: what they run openly,
 * and any racket that has come out. `ifExposed` counts the rackets as known.
 */
export function standingOf(s: GameState, id: CharId, e: Estate, ifExposed = false): number {
  let v = 0;
  for (const b of businessesOf(s, id)) {
    const def = BUSINESSES[b.kind];
    v += def.standing[e] ?? 0;
    const out = !!b.secretId && (ifExposed || !!s.secrets[b.secretId]?.exposed);
    if (out) v += def.ifKnown?.[e] ?? 0;
  }
  return v;
}

export function hasPerk(s: GameState, id: CharId | undefined, perk: Perk): boolean {
  if (!id) return false;
  return businessesOf(s, id).some((b) => BUSINESSES[b.kind].perk === perk);
}

/** The title a character currently holds, reflecting offices gained and lost. */
export function styleOf(s: GameState, id: CharId): string {
  const c = ch(s, id);
  if (c.rank === 'king' && s.king === id) return 'King of Wendmere';
  if (c.rank === 'king') return 'The late King';
  if (c.rank === 'queen') return 'Queen of Wendmere';
  const off = officeOf(s, id);
  if (off) return OFFICE_NAMES[off];
  return c.title;
}

export function displayName(s: GameState, id: CharId): string {
  const c = ch(s, id);
  if (c.rank === 'king') return `King ${c.short}`;
  if (c.rank === 'queen') return `Queen ${c.short}`;
  return c.name;
}

// ── Opinion and trust ────────────────────────────────────────────────────────

export function rel(s: GameState, a: CharId, b: CharId): Relation {
  let row = s.relations[a];
  if (!row) row = s.relations[a] = {};
  let r = row[b];
  if (!r) r = row[b] = { mods: [], trust: 40 };
  return r;
}

export function opinion(s: GameState, a: CharId, b: CharId): number {
  if (a === b) return 100;
  const r = s.relations[a]?.[b];
  const mods = r ? r.mods.reduce((sum, m) => sum + m.value, 0) : 0;
  return clamp(Math.round(mods + tradeRegard(s, a, b)), -100, 100);
}

export function trust(s: GameState, a: CharId, b: CharId): number {
  if (a === b) return 100;
  return s.relations[a]?.[b]?.trust ?? 40;
}

/** Add (or stack onto) an opinion modifier that `a` holds about `b`. */
export function addMod(
  s: GameState,
  a: CharId,
  b: CharId,
  key: string,
  label: string,
  value: number,
  decay = 0,
  pub = false,
): void {
  if (a === b) return;
  const r = rel(s, a, b);
  const existing = r.mods.find((m) => m.key === key);
  if (existing) {
    existing.value = clamp(existing.value + value, -100, 100);
    existing.decay = Math.max(existing.decay, decay);
    existing.label = label;
  } else {
    r.mods.push({ key, label, value, decay, public: pub });
  }
}

export function removeMod(s: GameState, a: CharId, b: CharId, key: string): void {
  const r = s.relations[a]?.[b];
  if (r) r.mods = r.mods.filter((m) => m.key !== key);
}

export function adjustTrust(s: GameState, a: CharId, b: CharId, delta: number): void {
  if (a === b) return;
  const r = rel(s, a, b);
  r.trust = clamp(r.trust + delta, 0, 100);
}

export function decayMods(s: GameState): void {
  for (const row of Object.values(s.relations)) {
    for (const r of Object.values(row)) {
      r.mods = r.mods
        .map((m): OpinionMod => {
          if (!m.decay) return m;
          const v = m.value > 0 ? Math.max(0, m.value - m.decay) : Math.min(0, m.value + m.decay);
          return { ...m, value: v };
        })
        .filter((m) => !m.decay || Math.abs(m.value) >= 1);
    }
  }
}

/** Traits as they act right now: a goaded man is bolder than he is. */
export function effective(s: GameState, id: CharId): Traits {
  const c = ch(s, id);
  const p = c.pressure;
  return {
    ...c.traits,
    boldness: clamp(c.traits.boldness + p * 0.5, 0, 100),
    ambition: clamp(c.traits.ambition + Math.max(0, p) * 0.3, 0, 100),
    paranoia: clamp(c.traits.paranoia + Math.max(0, -p) * 0.2, 0, 100),
  };
}

// ── Knowledge ────────────────────────────────────────────────────────────────

export function knows(s: GameState, who: CharId, secret: SecretId): Knowledge | undefined {
  return s.knowledge[who]?.[secret];
}

export function credence(s: GameState, who: CharId, secret: SecretId): number {
  return s.knowledge[who]?.[secret]?.credence ?? 0;
}

/**
 * Teach `who` a secret. Belief only ever ratchets up through hearing it again,
 * except for liars, who always know their lie for what it is.
 */
export function learn(
  s: GameState,
  who: CharId,
  secret: SecretId,
  cred: number,
  source: KnowledgeSource,
  lie = false,
): boolean {
  const row = (s.knowledge[who] ??= {});
  const prev = row[secret];
  const c = clamp(Math.round(cred), 0, 100);
  if (prev) {
    if (prev.lie) return false;
    if (c > prev.credence) {
      prev.credence = Math.round(clamp(prev.credence + (c - prev.credence) * 0.7, 0, 100));
      return true;
    }
    return false;
  }
  row[secret] = { credence: c, source, turn: s.turn, lie };
  if (who === s.player) {
    const sec = s.secrets[secret];
    if (sec) for (const id of [...sec.guilty, ...sec.victims]) hearOf(s, id, 1);
  }
  return true;
}

// ── Acquaintance (the player's fog of war) ──────────────────────────────────

export const ACQUAINTANCE = ['Unknown', 'Heard of', 'Seen', 'Introduced', 'Familiar', 'Unmasked'] as const;

export function acquaintance(s: GameState, id: CharId): Acquaintance {
  if (id === s.player) return 5;
  return s.known[id] ?? 0;
}

/** Raise the player's acquaintance with someone. Never lowers it. */
export function hearOf(s: GameState, id: CharId, lvl: Acquaintance): boolean {
  if (!s.chars[id] || id === s.player) return false;
  if ((s.known[id] ?? 0) >= lvl) return false;
  s.known[id] = lvl;
  return true;
}

/** Personal ties that mean the player has met someone, and how well they know them. */
const MET_THROUGH: Record<string, Acquaintance> = {
  lover: 4,
  friend: 3,
  dislike: 3,
  saved: 3,
  insult: 3,
  rivalry: 3,
  betrothal: 3,
  debt: 3,
  debtor: 3,
};

/** You have met anyone you share a past with, in either direction: a lover, an old friend, a man who humiliated you. */
export function meetPersonalTies(s: GameState): void {
  for (const id of s.order) {
    const mods = [...(s.relations[s.player]?.[id]?.mods ?? []), ...(s.relations[id]?.[s.player]?.mods ?? [])];
    for (const m of mods) if (MET_THROUGH[m.key]) hearOf(s, id, MET_THROUGH[m.key]);
  }
}

export const isServant = (s: GameState, id: CharId) => s.chars[id]?.rank === 'servant';
/** Too young to take part: no schemes, no votes, no offices, no deeds done to them. */
export const isChild = (s: GameState, id: CharId) => s.chars[id]?.rank === 'child';
export const isNoble = (s: GameState, id: CharId) => !!s.chars[id] && s.chars[id].rank !== 'servant';

export function knowers(s: GameState, secret: SecretId, minCred = 1): CharId[] {
  return s.order.filter((id) => {
    const k = s.knowledge[id]?.[secret];
    return !!k && (k.lie || k.credence >= minCred);
  });
}

// ── Insight (discovered motives) ────────────────────────────────────────────

export function insightOf(s: GameState, who: CharId) {
  return (s.insight[who] ??= { agendas: [], sincerity: [] });
}

export function knowsAgenda(s: GameState, observer: CharId, subject: CharId): boolean {
  return observer === subject || insightOf(s, observer).agendas.includes(subject);
}

// ── Event log ────────────────────────────────────────────────────────────────

export function log(
  s: GameState,
  text: string,
  visibleTo: CharId[] | 'all',
  tone: EventTone = 'neutral',
  actors: CharId[] = [],
): GameEvent {
  const ev: GameEvent = {
    id: s.nextId++,
    turn: s.turn,
    text,
    visibleTo: visibleTo === 'all' ? 'all' : Array.from(new Set(visibleTo)),
    actors,
    tone,
  };
  s.events.push(ev);
  // What reaches the player's ears puts names and faces on the map.
  const P = s.player;
  if (P && (visibleTo === 'all' || visibleTo.includes(P))) {
    const met = actors.includes(P);
    for (const a of actors) {
      if (a === P) continue;
      hearOf(s, a, met ? 2 : visibleTo === 'all' && (tone === 'court' || tone === 'dire') ? 2 : 1);
    }
  }
  return ev;
}

export function visibleTo(ev: GameEvent, who: CharId): boolean {
  return ev.visibleTo === 'all' || ev.visibleTo.includes(who);
}

export function uid(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/** Characters that sit at court and could be spoken to this month. */
export function courtiers(s: GameState, except?: CharId): CharId[] {
  return s.order.filter((id) => id !== except && s.chars[id].status === 'free');
}

// A turn is a month. Years are counted from your arrival at court, which was in the spring.
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const MONTHS = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February'] as const;
export const MONTHS_PER_SEASON = 3;
export const MONTHS_PER_YEAR = 12;

export interface CalendarDate {
  year: number;
  season: (typeof SEASONS)[number];
  month: (typeof MONTHS)[number];
}

export function calendar(turn: number): CalendarDate {
  const t = turn - 1;
  return { year: Math.floor(t / MONTHS_PER_YEAR) + 1, season: SEASONS[Math.floor(t / MONTHS_PER_SEASON) % 4], month: MONTHS[t % MONTHS_PER_YEAR] };
}

export function dateLabel(turn: number): string {
  const d = calendar(turn);
  return `${d.month}, Year ${d.year}`;
}
