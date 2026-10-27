// Prestige won and mended. A name muddied by a charge or a disgrace comes back with time; the
// King's favour lifts those he keeps close; a lord who keeps a good table is talked of.

import { RENOWN } from './content/renown';
import { first, nm } from './text';
import { acquaintance, addMod, ch, dateLabel, hearOf, isFree, log, opinion, rel } from './world';
import type { CharId, GameState } from './types';

type Result = { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' };

/** Those whose name the court weighs: not children, servants or the clergy. */
const NOBLE = ['great', 'lord', 'knight', 'lady'];

/** Standing lost to a charge or a disgrace. It comes back `RENOWN.mends` a month while they are free. */
export function tarnish(s: GameState, id: CharId, pts: number): number {
  const c = ch(s, id);
  const lost = Math.min(c.prestige, Math.max(0, Math.round(pts)));
  c.prestige -= lost;
  if (lost) c.tarnish = (c.tarnish ?? 0) + lost;
  return lost;
}

/** Prestige earned, never past a ceiling the source sets. */
export function raise(s: GameState, id: CharId, pts: number, upTo = Infinity): number {
  const c = ch(s, id);
  const gain = Math.max(0, Math.min(Math.round(pts), upTo - c.prestige));
  c.prestige += gain;
  return gain;
}

/** Whether the King holds them close enough that being seen at his side raises them. */
export function inFavour(s: GameState, id: CharId): boolean {
  const c = s.chars[id];
  return !!s.king && id !== s.king && !!c && NOBLE.includes(c.rank) && c.status === 'free' && opinion(s, s.king, id) >= RENOWN.favour.opinion;
}

/** What the coming month will do for a name: standing mending, and the King's favour. */
export function renownOutlook(s: GameState, id: CharId): { mending: number; favour: number } {
  const c = ch(s, id);
  const free = c.status === 'free';
  return {
    mending: free ? Math.min(RENOWN.mends, c.tarnish ?? 0) : 0,
    favour: inFavour(s, id) && c.prestige < RENOWN.favour.upTo ? RENOWN.favour.gain : 0,
  };
}

/** The month's turn of names: lost standing mends, and the King's favour lifts those he holds close. */
export function renownMonth(s: GameState): void {
  for (const id of s.order) {
    const c = s.chars[id];
    if (!c || c.status !== 'free') continue;
    const { mending, favour } = renownOutlook(s, id);
    if (mending) {
      c.prestige += mending;
      c.tarnish = (c.tarnish ?? 0) - mending;
      if (c.tarnish <= 0) delete c.tarnish;
    }
    if (favour) raise(s, id, favour, RENOWN.favour.upTo);
  }
}

// ── Feasts ─────────────────────────────────────────────────────────────────

/** Prestige a feast brings a host of this standing, before the King's presence. */
export function feastGain(prestige: number): number {
  return RENOWN.feastGain.find((b) => prestige < b.below)?.gain ?? 1;
}

export function feastProblem(s: GameState, host: CharId): string | null {
  const c = ch(s, host);
  if (c.status !== 'free') return 'You cannot keep a table from the Tower.';
  if (!NOBLE.includes(c.rank) && s.king !== host && c.rank !== 'queen') return 'Only the gentry keep a table for the court.';
  const { cost, every } = RENOWN.feast;
  if (c.feasted !== undefined && s.turn - c.feasted < every) return `The court still talks of your last feast. Feast again in ${dateLabel(c.feasted + every)}.`;
  if (c.gold < cost) return `A feast costs ${cost} crowns.`;
  return null;
}

/** Whether the King would come to their table. */
export function kingWouldCome(s: GameState, host: CharId): boolean {
  return !!s.king && s.king !== host && isFree(s, s.king) && opinion(s, s.king, host) >= RENOWN.feast.kingComes;
}

/**
 * Who comes to the table: the highest in the land who think well enough of the host. The player can
 * only ask those met already, and one more known only by name or face, who is introduced over the wine.
 */
export function feastGuests(s: GameState, host: CharId): CharId[] {
  const P = s.player;
  const pool = s.order.filter((id) => {
    const c = s.chars[id];
    if (id === host || id === s.king || !NOBLE.includes(c.rank) || c.status !== 'free') return false;
    return opinion(s, id, host) >= -10;
  });
  const byRank = (a: CharId, b: CharId) => ch(s, b).prestige - ch(s, a).prestige || s.order.indexOf(a) - s.order.indexOf(b);
  if (host !== P) return pool.sort(byRank).slice(0, RENOWN.feast.guests);
  const met = pool.filter((id) => acquaintance(s, id) >= 3).sort(byRank);
  const stranger = pool.filter((id) => acquaintance(s, id) >= 1 && acquaintance(s, id) < 3).sort(byRank)[0];
  return [...met.slice(0, RENOWN.feast.guests - (stranger ? 1 : 0)), ...(stranger ? [stranger] : [])];
}

/** Hold a feast: crowns spent, the guests warmed, and the host talked of. */
export function holdFeast(s: GameState, host: CharId): Result {
  const c = ch(s, host);
  const { cost, warmth, kingBonus } = RENOWN.feast;
  const guests = feastGuests(s, host);
  const king = kingWouldCome(s, host) ? s.king! : undefined;
  c.gold -= cost;
  c.feasted = s.turn;
  const gain = raise(s, host, feastGain(c.prestige) + (king ? kingBonus : 0));
  for (const g of king ? [king, ...guests] : guests) {
    // Good cheer goes so far: one more feast does not make a friend of a man who has had ten.
    const had = rel(s, g, host).mods.find((m) => m.key === 'feasted')?.value ?? 0;
    const add = Math.min(warmth, 3 * warmth - had);
    if (add > 0) addMod(s, g, host, 'feasted', 'Dined at my table', add, 0.3);
  }
  if (host === s.player) for (const g of guests) hearOf(s, g, 3);
  const names = guests.map((g) => nm(s, g));
  const who = names.length ? ` ${king ? 'The King came, and with him ' : 'At the table: '}${names.join(', ')}.` : king ? ' The King came.' : '';
  log(s, `${nm(s, host)} kept a feast.${who}`, [host, ...guests, ...(king ? [king] : [])], 'good', [host, ...guests]);
  if (host !== s.player) return { ok: true, text: '', tone: 'good' };
  const firstNames = guests.map((g) => first(s, g));
  return {
    ok: true,
    text: `${king ? 'The King himself sat at your table. ' : ''}${firstNames.length ? `${firstNames.join(', ')} ate your venison and drank your wine.` : 'The hall was half empty.'} Your name rises (+${gain} prestige).`,
    tone: 'good',
  };
}

/** How a name is moving, in a line for the player. */
export function renownNote(s: GameState, id: CharId): string {
  const c = ch(s, id);
  const { mending, favour } = renownOutlook(s, id);
  const parts: string[] = [];
  if (mending) parts.push(`${mending} a month coming back after the charges against you (${c.tarnish} still to come)`);
  if (favour) parts.push(`${favour} a month for the King's favour`);
  else if (!inFavour(s, id) && s.king && s.king !== id) parts.push(`the King's favour would add ${RENOWN.favour.gain} a month, if he held you at ${RENOWN.favour.opinion} or warmer (now ${opinion(s, s.king, id)})`);
  return `Prestige ${c.prestige}${parts.length ? `: ${parts.join('; ')}` : ''}. Feasts, offices, good matches and charges the King upholds raise it. The great houses begin at 45.`;
}
