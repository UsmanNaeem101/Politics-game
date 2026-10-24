// Saving and restoring a game in this browser. Every access is guarded: storage
// can be missing or blocked, and the game must still run without it.

import { repairSave, type GameState } from '../engine';

const KEY = 'crown-of-whispers/save/v2';
const PREFS = 'crown-of-whispers/prefs/v1';
// A copy to turn back to after a bad end: the game as it stood before the last week ended, or
// before the deed that ended it.
const PREV = 'crown-of-whispers/save/v2/week-before';
const PREV_TURN = 'crown-of-whispers/save/v2/week-before-turn';

/** Which game and week the saved copy is of, and whether someone was waiting on an answer. */
let saved: { seed: number; turn: number; waiting: boolean } | null = null;

function keepPrev(turn: number): void {
  const last = localStorage.getItem(KEY);
  if (!last) return;
  localStorage.setItem(PREV, last);
  localStorage.setItem(PREV_TURN, String(turn));
}

export function saveGame(s: GameState | null): void {
  try {
    if (s && s.phase === 'playing') {
      if (s.turn === 1) {
        localStorage.removeItem(PREV);
        localStorage.removeItem(PREV_TURN);
      } else if (saved && saved.seed === s.seed && s.turn === saved.turn + 1) keepPrev(saved.turn);
    }
    // Ended by a deed or in the night: turn back to just before it. Ended answering a summons at dawn:
    // the copy from before last week ended is the better place to stand.
    if (s && s.phase === 'ended' && saved && saved.seed === s.seed && !saved.waiting) keepPrev(saved.turn);
    if (!s || s.phase === 'ended') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(s));
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

/** The week a game can be turned back to, if there is one. */
export function weekBefore(): number | null {
  try {
    const t = Number(localStorage.getItem(PREV_TURN));
    return t > 0 && localStorage.getItem(PREV) ? t : null;
  } catch {
    return null;
  }
}

/** The game as it stood just before the last week ended. It becomes the saved game again. */
export function turnBack(): GameState | null {
  try {
    const raw = localStorage.getItem(PREV);
    const s = restore(raw);
    if (s && raw) localStorage.setItem(KEY, raw);
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
