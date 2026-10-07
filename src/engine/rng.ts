// Seeded randomness (mulberry32). The generator's state lives in GameState.rng so
// the same seed and the same choices always produce the same history.

export interface RngHolder {
  rng: number;
}

export function rand(s: RngHolder): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** True with probability pct/100. */
export function chance(s: RngHolder, pct: number): boolean {
  return rand(s) * 100 < pct;
}

/** Integer in [min, max]. */
export function roll(s: RngHolder, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function pick<T>(s: RngHolder, items: readonly T[]): T {
  return items[Math.floor(rand(s) * items.length)];
}

export function shuffle<T>(s: RngHolder, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick by non-negative weight. Returns undefined if every weight is zero. */
export function weighted<T>(s: RngHolder, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((sum, t) => sum + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const t of items) {
    r -= Math.max(0, weight(t));
    if (r < 0) return t;
  }
  return items[items.length - 1];
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A percentage for display: never a promise of 0 or 100. */
export const clampPct = (v: number): number => Math.round(clamp(v, 1, 99));
