// Saving and restoring a game. Saves live in the browser's database (IndexedDB), which holds hundreds of
// megabytes, so a long game keeps its whole history; localStorage allows only about 5 MB. Reads come from a copy
// held in memory, loaded once before the game starts (openStore); writes go to memory at once and to the
// database behind. Where the database cannot be opened, localStorage stands in. Every access is guarded: the
// game must still run without storage.

import { repairSave, stir, type GameState } from '../engine';

const KEY = 'crown-of-whispers/save/v2';
const PREFS = 'crown-of-whispers/prefs/v1';
// Copies to turn back to after a bad end: the game as it stood when this month began, and as it stood
// before the last month ended (or before the deed that ended it).
const START = 'crown-of-whispers/save/v2/month-start';
const START_TURN = 'crown-of-whispers/save/v2/month-start-turn';
const PREV = 'crown-of-whispers/save/v2/week-before';
const PREV_TURN = 'crown-of-whispers/save/v2/week-before-turn';
const SAVE_KEYS = [KEY, START, START_TURN, PREV, PREV_TURN];

export type BackPoint = 'start' | 'end';
const SLOTS: Record<BackPoint, [string, string]> = { start: [START, START_TURN], end: [PREV, PREV_TURN] };

// ── The store: memory in front, the database behind ─────────────────────────

const DB_NAME = 'crown-of-whispers';
const TABLE = 'saves';
const memory = new Map<string, string>();
let db: IDBDatabase | null = null;
/** Writes waiting for the database: the latest value for each key, or null to delete it. */
const pending = new Map<string, string | null>();
let flushing = false;

/** Whether the last save could not be written. */
let failed = false;
export const saveFailed = (): boolean => failed;

const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string): boolean => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};
const lsRemove = (k: string): void => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
};

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Open the database and load every save into memory. Call once, before the game starts. */
export async function openStore(): Promise<void> {
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(TABLE);
    db = await request(open);
    const tx = db.transaction(TABLE, 'readonly');
    const table = tx.objectStore(TABLE);
    const [keys, values] = await Promise.all([request(table.getAllKeys()), request(table.getAll())]);
    keys.forEach((k, i) => memory.set(String(k), String(values[i])));
    // Saves made before the database: bring them across, then free the old storage.
    const old = SAVE_KEYS.map((k) => [k, lsGet(k)] as const).filter(([k, v]) => v !== null && !memory.has(k));
    if (old.length) {
      const move = db.transaction(TABLE, 'readwrite');
      for (const [k, v] of old) {
        memory.set(k, v!);
        move.objectStore(TABLE).put(v, k);
      }
      await done(move);
    }
    for (const k of SAVE_KEYS) lsRemove(k);
  } catch {
    // No database here: localStorage stands in, as before.
    db = null;
    for (const k of SAVE_KEYS) {
      const v = lsGet(k);
      if (v !== null) memory.set(k, v);
    }
  }
}

const get = (k: string): string | null => memory.get(k) ?? null;

function set(k: string, v: string): void {
  memory.set(k, v);
  persist(k, v);
}

function del(k: string): void {
  memory.delete(k);
  persist(k, null);
}

function persist(k: string, v: string | null): void {
  if (!db) {
    if (v === null) lsRemove(k);
    else if (!lsSet(k, v)) {
      // localStorage is full: the copies to turn back to make room for the game itself.
      for (const x of [START, START_TURN, PREV, PREV_TURN]) if (x !== k) lsRemove(x);
      failed = !lsSet(k, v);
    }
    return;
  }
  pending.set(k, v);
  void flush();
}

/** Write what is waiting, a transaction at a time; whatever arrives meanwhile goes in the next. */
async function flush(): Promise<void> {
  if (flushing || !db) return;
  flushing = true;
  try {
    while (pending.size) {
      const batch = Array.from(pending);
      pending.clear();
      const tx = db.transaction(TABLE, 'readwrite');
      const table = tx.objectStore(TABLE);
      for (const [k, v] of batch) {
        if (v === null) table.delete(k);
        else table.put(v, k);
      }
      try {
        await done(tx);
        failed = false;
      } catch {
        failed = true;
      }
    }
  } finally {
    flushing = false;
  }
}

// ── Saves ───────────────────────────────────────────────────────────────────

/** Which game and month the saved copy is of, and whether someone was waiting on an answer. */
let saved: { seed: number; turn: number; waiting: boolean } | null = null;

function keep(point: BackPoint, raw: string | null, turn: number): void {
  if (!raw) return;
  set(SLOTS[point][0], raw);
  set(SLOTS[point][1], String(turn));
}

function drop(point: BackPoint): void {
  del(SLOTS[point][0]);
  del(SLOTS[point][1]);
}

export function saveGame(s: GameState | null): void {
  try {
    const last = get(KEY);
    const same = !!s && !!saved && saved.seed === s.seed;
    const raw = s && s.phase === 'playing' ? JSON.stringify(s) : null;
    if (raw) set(KEY, raw);
    else del(KEY);
    if (s && s.phase === 'playing') {
      if (s.turn === 1) drop('end');
      // A month has ended: what stood before it is the place to turn back to.
      if (same && s.turn === saved!.turn + 1) keep('end', last, saved!.turn);
      if (!same || s.turn !== saved!.turn) keep('start', raw, s.turn);
    }
    // Ended by a deed or in the night: turn back to just before it. Ended answering a summons at dawn:
    // the copy from before last month ended is the better place to stand.
    if (s && s.phase === 'ended' && same && !saved!.waiting) keep('end', last, saved!.turn);
    saved = s && s.phase === 'playing' ? { seed: s.seed, turn: s.turn, waiting: s.audiences.length > 0 } : null;
  } catch {
    /* storage unavailable */
  }
}

function restore(raw: string | null): GameState | null {
  if (!raw) return null;
  const s = JSON.parse(raw) as GameState;
  if (!s || s.version !== 2 || s.phase !== 'playing') return null;
  repairSave(s);
  saved = { seed: s.seed, turn: s.turn, waiting: s.audiences.length > 0 };
  return s;
}

export function loadGame(): GameState | null {
  try {
    return restore(get(KEY));
  } catch {
    return null;
  }
}

/** The saved game as text, to keep in a file. */
export const savedText = (): string | null => get(KEY);

/**
 * A game brought in from a file becomes the saved game (repaired if it was made by an older version). The places
 * to turn back to belonged to the game it replaces, so they go. Returns null if the text is not a game in play.
 */
export function importGame(raw: string): GameState | null {
  try {
    const s = restore(raw);
    if (!s) return null;
    set(KEY, JSON.stringify(s));
    drop('start');
    drop('end');
    return s;
  } catch {
    return null;
  }
}

/** The places a game can be turned back to, latest first: the end of a month, then the start of one. */
export function backPoints(): { point: BackPoint; turn: number }[] {
  const out: { point: BackPoint; turn: number }[] = [];
  for (const point of ['end', 'start'] as BackPoint[]) {
    const t = Number(get(SLOTS[point][1]));
    if (t > 0 && get(SLOTS[point][0])) out.push({ point, turn: t });
  }
  return out;
}

/** The game as it stood at that point. It becomes the saved game again; anything after it is gone. */
export function turnBack(point: BackPoint): GameState | null {
  try {
    const raw = get(SLOTS[point][0]);
    const turn = Number(get(SLOTS[point][1]));
    const s = restore(raw);
    if (!s || !raw) return null;
    // Fresh dice: the same luck again would only replay the same failures.
    stir(s, (Math.random() * 0x100000000) ^ Date.now());
    set(KEY, JSON.stringify(s));
    if (point === 'start' && Number(get(PREV_TURN)) >= turn) drop('end');
    return s;
  } catch {
    return null;
  }
}

export interface Prefs {
  theme?: 'light' | 'dark';
  seenHelp?: boolean;
}

export function loadPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function applyTheme(theme?: 'light' | 'dark'): void {
  const root = document.documentElement;
  if (theme) root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}
