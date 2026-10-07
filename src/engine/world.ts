// Small, pure-ish helpers over GameState used by every other engine module.

import { clamp } from './rng';
import type {
  Character,
  CharId,
  EventTone,
  GameEvent,
  GameState,
  Knowledge,
  KnowledgeSource,
  LandId,
  OfficeId,
  OpinionMod,
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
  return inc;
}

/** The title a character currently holds, reflecting offices gained and lost. */
export function styleOf(s: GameState, id: CharId): string {
  const c = ch(s, id);
  if (c.rank === 'king') return 'King of Wendmere';
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
  if (!r) return 0;
  return clamp(Math.round(r.mods.reduce((sum, m) => sum + m.value, 0)), -100, 100);
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
  return true;
}

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
  return ev;
}

export function visibleTo(ev: GameEvent, who: CharId): boolean {
  return ev.visibleTo === 'all' || ev.visibleTo.includes(who);
}

export function uid(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/** Characters that sit at court and could be spoken to this week. */
export function courtiers(s: GameState, except?: CharId): CharId[] {
  return s.order.filter((id) => id !== except && s.chars[id].status === 'free');
}

export const SEASONS = ['Lambing', 'Sowing', 'Midsummer', 'Harvest'];

export function weekLabel(turn: number): string {
  return `Week ${turn}`;
}
