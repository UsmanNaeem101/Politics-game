// What one character can see of the court. The UI only ever shows the
// player's perspective; the end screen alone shows the truth.

import { isMember, plotsKnownTo } from './plots';
import { fullText } from './secrets';
import { credence, insightOf, knows, opinion, visibleTo } from './world';
import type { CharId, GameEvent, GameState, Knowledge, OpinionMod, Plot, Secret } from './types';

export interface KnownSecret {
  sec: Secret;
  k: Knowledge;
  text: string;
  /** People this viewer has told. */
  told: CharId[];
}

export function knownSecrets(s: GameState, viewer: CharId): KnownSecret[] {
  const row = s.knowledge[viewer] ?? {};
  return Object.entries(row)
    .map(([sid, k]) => ({ sec: s.secrets[sid], k }))
    .filter((x) => !!x.sec && (x.k.lie || x.k.credence > 0 || x.sec.guilty.includes(viewer)))
    .map(({ sec, k }) => ({
      sec,
      k,
      text: fullText(s, sec),
      told: s.order.filter((o) => o !== viewer && s.knowledge[o]?.[sec.id]?.source === viewer),
    }))
    .sort((a, b) => b.k.turn - a.k.turn || Number(b.sec.treason) - Number(a.sec.treason));
}

export function secretsAbout(s: GameState, viewer: CharId, subject: CharId): KnownSecret[] {
  return knownSecrets(s, viewer).filter((x) => x.sec.guilty.includes(subject));
}

export interface PlotView {
  plot: Plot;
  role: 'owner' | 'member' | 'known';
  /** Members whose sincerity the viewer knows: id → sincere? */
  sincerity: Record<CharId, boolean | undefined>;
  belief: number;
}

export function plotViews(s: GameState, viewer: CharId): PlotView[] {
  const ins = insightOf(s, viewer);
  return plotsKnownTo(s, viewer, 25).map((plot) => {
    const role: PlotView['role'] = plot.owner === viewer ? 'owner' : isMember(plot, viewer) ? 'member' : 'known';
    const sincerity: Record<CharId, boolean | undefined> = {};
    for (const m of plot.members) {
      if (m.id === viewer || ins.sincerity.includes(`${plot.id}:${m.id}`)) sincerity[m.id] = m.sincere;
    }
    return { plot, role, sincerity, belief: role === 'known' ? credence(s, viewer, plot.secretId) : 100 };
  });
}

/** Plots the viewer believes are aimed at them. */
export function knownThreats(s: GameState, viewer: CharId): PlotView[] {
  return plotViews(s, viewer).filter((v) => v.plot.status === 'active' && v.plot.targets.includes(viewer) && v.role === 'known');
}

/** Opinion modifiers this viewer can see between two people. */
export function visibleMods(s: GameState, viewer: CharId, a: CharId, b: CharId): OpinionMod[] {
  const mods = s.relations[a]?.[b]?.mods ?? [];
  if (a === viewer || b === viewer) return mods.filter((m) => Math.round(m.value) !== 0);
  return mods.filter((m) => m.public && Math.round(m.value) !== 0);
}

export function visibleEvents(s: GameState, viewer: CharId): GameEvent[] {
  return s.events.filter((e) => visibleTo(e, viewer));
}

/** What happened in the night just gone, as the viewer saw it. */
export function dawnEvents(s: GameState, viewer: CharId): GameEvent[] {
  return s.events.filter((e) => e.id >= s.nightStart && visibleTo(e, viewer));
}

/** Does the viewer suspect this person of plotting anything? */
export function suspects(s: GameState, viewer: CharId, subject: CharId): number {
  const row = s.knowledge[viewer] ?? {};
  let max = 0;
  for (const [sid, k] of Object.entries(row)) {
    const sec = s.secrets[sid];
    if (!sec || k.lie || !sec.guilty.includes(subject) || sec.guilty.includes(viewer)) continue;
    if (sec.plotId && s.plots[sec.plotId]?.status !== 'active') continue;
    max = Math.max(max, k.credence);
  }
  return max;
}

export function attitude(s: GameState, of: CharId, toward: CharId): number {
  return opinion(s, of, toward);
}

export const knowsSecret = (s: GameState, who: CharId, sid: string) => !!knows(s, who, sid);
