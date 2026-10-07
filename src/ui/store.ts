// Saving and restoring a game in this browser. Every access is guarded: storage
// can be missing or blocked, and the game must still run without it.

import type { GameState } from '../engine';

const KEY = 'crown-of-whispers/save/v1';
const PREFS = 'crown-of-whispers/prefs/v1';

export function saveGame(s: GameState | null): void {
  try {
    if (!s || s.phase === 'ended') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.version === 1 && s.phase === 'playing' ? s : null;
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
