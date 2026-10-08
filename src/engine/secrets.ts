// Secrets are facts (or lies) about who intends what. Who knows which secret,
// and how strongly they believe it, is the real map of the court.

import { clamp } from './rng';
import { names, nm } from './text';
import { ch, isAlive, learn, opinion, trust, uid } from './world';
import type { CharId, GameState, KnowledgeSource, Plot, Secret, SecretId, SecretKind } from './types';

export const SECRET_KIND_LABEL: Record<SecretKind, string> = {
  regicide: 'Regicide',
  murder: 'Murder plot',
  concealment: 'Concealed treason',
  usurpation: 'Usurpation',
  pact: 'Treasonous pact',
  theft: 'Theft',
  betrayal: 'Betrayal',
  slander: 'False witness',
  ruin: 'Scheme of ruin',
  affair: 'Secret love',
};

export function describe(s: GameState, kind: SecretKind, guilty: CharId[], victims: CharId[]): string {
  const g = names(s, guilty);
  const v = names(s, victims);
  const plural = guilty.length > 1;
  switch (kind) {
    case 'regicide':
      return `${g} ${plural ? 'plot' : 'plots'} to murder ${v}.`;
    case 'murder':
      return `${g} ${plural ? 'plot' : 'plots'} to murder ${v}.`;
    case 'pact':
      return `${g} have sworn a secret pact to murder ${v}.`;
    case 'concealment':
      return `${g} ${plural ? 'know' : 'knows'} of treason against the King and ${plural ? 'hide' : 'hides'} it for ${plural ? 'their' : 'private'} advantage.`;
    case 'usurpation':
      return `${g} ${plural ? 'mean' : 'means'} to clear a path to the throne and take the crown.`;
    case 'theft':
      return `${g} stole the inheritance of ${v}.`;
    case 'betrayal':
      return `${g} ${plural ? 'mean' : 'means'} to betray ${v}.`;
    case 'slander':
      return `${g} bore false witness against ${v}.`;
    case 'ruin':
      return `${g} ${plural ? 'gather' : 'gathers'} charges to destroy ${v} before the King.`;
    case 'affair':
      return `${g} are lovers, behind the back of ${v}.`;
  }
}

export function makeSecret(
  s: GameState,
  p: {
    kind: SecretKind;
    guilty: CharId[];
    victims: CharId[];
    truth: boolean;
    evidence: number;
    treason?: boolean;
    fabricatedBy?: CharId;
    plotId?: string;
    text?: string;
    id?: SecretId;
  },
): Secret {
  const id = p.id ?? uid(s, 's');
  const treason = p.treason ?? ['regicide', 'pact', 'usurpation'].includes(p.kind);
  const sec: Secret = {
    id,
    kind: p.kind,
    guilty: p.guilty.slice(),
    victims: p.victims.slice(),
    truth: p.truth,
    fabricatedBy: p.fabricatedBy,
    evidence: clamp(Math.round(p.evidence), 0, 100),
    treason,
    plotId: p.plotId,
    createdTurn: s.turn,
    text: p.text ?? describe(s, p.kind, p.guilty, p.victims),
    exposed: false,
    fixedText: !!p.text,
  };
  s.secrets[id] = sec;
  return sec;
}

/** Rewrite a secret's statement after names change (a knight crowned, say). */
export function refreshText(s: GameState, sec: Secret): void {
  if (sec.fixedText) return;
  sec.text = describe(s, sec.kind, sec.guilty, sec.victims);
}

/** Keep a plot's describing secret in step with its members and preparations. */
export function syncPlotSecret(s: GameState, plot: Plot): void {
  const sec = s.secrets[plot.secretId];
  if (!sec) return;
  const guilty = [plot.owner, ...plot.members.map((m) => m.id)];
  sec.guilty = Array.from(new Set(guilty));
  sec.victims = plot.targets.slice();
  const base = plot.kind === 'murder' ? 10 + plot.progress * 0.5 : 5 + plot.progress * 0.3;
  sec.evidence = clamp(Math.round(Math.max(sec.evidence, base + plot.members.length * 6)), 0, 100);
  refreshText(s, sec);
}

/** Secrets `viewer` knows (with belief, or as their own lie) that incriminate `who`. */
export function secretsAgainst(s: GameState, who: CharId, viewer: CharId, minCred = 40): Secret[] {
  const row = s.knowledge[viewer] ?? {};
  return Object.entries(row)
    .filter(([, k]) => k.lie || k.credence >= minCred)
    .map(([id]) => s.secrets[id])
    .filter((sec) => sec && sec.guilty.includes(who));
}

/** Secrets `viewer` believes in that name `who` as an intended victim. */
export function threatsTo(s: GameState, who: CharId, viewer = who, minCred = 40): Secret[] {
  const row = s.knowledge[viewer] ?? {};
  return Object.entries(row)
    .filter(([, k]) => !k.lie && k.credence >= minCred)
    .map(([id]) => s.secrets[id])
    .filter(
      (sec) =>
        sec &&
        sec.victims.includes(who) &&
        ['regicide', 'murder', 'pact', 'betrayal', 'ruin'].includes(sec.kind) &&
        sec.guilty.some((g) => g !== who && isAlive(s, g)) &&
        (!sec.plotId || s.plots[sec.plotId]?.status === 'active'),
    );
}

/** How far `listener` believes a secret when `teller` whispers it. */
export function hearCredence(s: GameState, listener: CharId, teller: CharId, sec: Secret): number {
  const L = ch(s, listener);
  const T = ch(s, teller);
  let c = trust(s, listener, teller) * 0.55 + T.traits.charm * 0.15 + sec.evidence * 0.25;
  const guiltyOp = sec.guilty.reduce((sum, g) => sum + opinion(s, listener, g), 0) / Math.max(1, sec.guilty.length);
  c += guiltyOp < 0 ? -guiltyOp * 0.25 : -guiltyOp * 0.18;
  if (sec.treason) c += (L.traits.paranoia - 40) * 0.2;
  if (!sec.truth) c += (T.traits.cunning - L.traits.cunning) * 0.15;
  // A king hears a hundred tales a week and discounts them all.
  if (s.king === listener) c *= 0.85;
  return clamp(Math.round(c), 5, 95);
}

/** Proclaim a secret to everyone living. */
export function publish(s: GameState, secretId: SecretId, cred: number, source: KnowledgeSource = 'court'): void {
  const sec = s.secrets[secretId];
  if (!sec) return;
  for (const id of s.order) {
    if (!isAlive(s, id)) continue;
    if (sec.guilty.includes(id)) {
      learn(s, id, secretId, sec.truth ? 100 : 0, 'self');
      continue;
    }
    learn(s, id, secretId, cred, source);
  }
  if (cred >= 80) sec.exposed = true;
}

/** The statement plus anyone sworn to it whom the wording does not name. */
export function fullText(s: GameState, sec: Secret): string {
  const extra = sec.guilty.filter((g) => {
    const c = s.chars[g];
    return c && !sec.text.includes(c.short);
  });
  return extra.length ? `${sec.text} Also implicated: ${names(s, extra)}.` : sec.text;
}

export function secretLabel(sec: Secret): string {
  return `${SECRET_KIND_LABEL[sec.kind]}: ${sec.text}`;
}

export const victimsText = (s: GameState, sec: Secret) => sec.victims.map((v) => nm(s, v)).join(', ');
