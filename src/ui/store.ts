// Saving and restoring a game in this browser. Every access is guarded: storage
// can be missing or blocked, and the game must still run without it.

import { repairSave, stir, type GameState } from '../engine';

const KEY = 'crown-of-whispers/save/v2';
const PREFS = 'crown-of-whispers/prefs/v1';
// Copies to turn back to after a bad end: the game as it stood when this month began, and as it stood
// before the last month ended (or before the deed that ended it).
const START = 'crown-of-whispers/save/v2/month-start';
const START_TURN = 'crown-of-whispers/save/v2/month-start-turn';
const PREV = 'crown-of-whispers/save/v2/week-before';
const PREV_TURN = 'crown-of-whispers/save/v2/week-before-turn';

export type BackPoint = 'start' | 'end';
const SLOTS: Record<BackPoint, [string, string]> = { start: [START, START_TURN], end: [PREV, PREV_TURN] };

/** Which game and month the saved copy is of, and whether someone was waiting on an answer. */
let saved: { seed: number; turn: number; waiting: boolean } | null = null;

/** A copy is a nicety: if storage is full, the game itself must still be saved. */
function keep(point: BackPoint, raw: string | null, turn: number): void {
  if (!raw) return;
  try {
    localStorage.setItem(SLOTS[point][0], raw);
    localStorage.setItem(SLOTS[point][1], String(turn));
  } catch {
    drop(point);
  }
}

function drop(point: BackPoint): void {
  try {
    localStorage.removeItem(SLOTS[point][0]);
    localStorage.removeItem(SLOTS[point][1]);
  } catch {
    /* storage unavailable */
  }
}

export function saveGame(s: GameState | null): void {
  try {
    const last = localStorage.getItem(KEY);
    const same = !!s && !!saved && saved.seed === s.seed;
    const raw = s && s.phase === 'playing' ? JSON.stringify(s) : null;
    if (raw) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
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
    return restore(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** The places a game can be turned back to, latest first: the end of a month, then the start of one. */
export function backPoints(): { point: BackPoint; turn: number }[] {
  const out: { point: BackPoint; turn: number }[] = [];
  try {
    for (const point of ['end', 'start'] as BackPoint[]) {
      const t = Number(localStorage.getItem(SLOTS[point][1]));
      if (t > 0 && localStorage.getItem(SLOTS[point][0])) out.push({ point, turn: t });
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

/** The game as it stood at that point. It becomes the saved game again; anything after it is gone. */
export function turnBack(point: BackPoint): GameState | null {
  try {
    const raw = localStorage.getItem(SLOTS[point][0]);
    const turn = Number(localStorage.getItem(SLOTS[point][1]));
    const s = restore(raw);
    if (!s || !raw) return null;
    // Fresh dice: the same luck again would only replay the same failures.
    stir(s, (Math.random() * 0x100000000) ^ Date.now());
    localStorage.setItem(KEY, JSON.stringify(s));
    if (point === 'start' && Number(localStorage.getItem(PREV_TURN)) >= turn) drop('end');
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
