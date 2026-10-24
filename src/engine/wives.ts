// A wife's dinners. A lord sends his wife to dine with another man's wife, and
// she comes home with what was said: gossip, what the other husband wants, who
// sits in that house. A careless wife may say too much of her own husband's
// business; one who does not care for him may not tell him everything.

import { secretMatters } from './secrets';
import { learnFeeling } from './talk';
import { chance, clamp, pick, roll, weighted } from './rng';
import { first, nm } from './text';
import {
  acquaintance,
  addMod,
  ch,
  credence,
  hearOf,
  insightOf,
  isChild,
  isFree,
  isServant,
  knowsAgenda,
  learn,
  livingSpouse,
  log,
  opinion,
} from './world';
import type { CharId, GameState, Secret } from './types';

type Result = { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' };

export function dineProblem(s: GameState, actor: CharId, lady: CharId): string | null {
  const wife = livingSpouse(s, actor);
  if (!wife || ch(s, wife).gender !== 'f') return 'You have no wife to send.';
  if (!isFree(s, wife)) return 'Your wife is not at court.';
  if (lady === wife) return 'That is your wife.';
  const L = ch(s, lady);
  if (L.gender !== 'f' || isServant(s, lady) || L.rank === 'clergy') return 'Your wife dines with ladies.';
  if (isChild(s, lady)) return 'A child is no part of this.';
  if (ch(s, wife).dined === s.turn) return 'Your wife has already dined out this month.';
  return null;
}

/** Will the lady receive her? How she regards your wife, and you; your wife's charm. */
export function dineOdds(s: GameState, actor: CharId, lady: CharId): number {
  const wife = livingSpouse(s, actor)!;
  return clamp(Math.round(55 + opinion(s, lady, wife) * 0.5 + Math.min(0, opinion(s, lady, actor)) * 0.4 + ch(s, wife).traits.charm * 0.2 - 10), 10, 95);
}

export function sendToDine(s: GameState, actor: CharId, lady: CharId): Result {
  const wife = livingSpouse(s, actor)!;
  const W = ch(s, wife);
  const L = ch(s, lady);
  const P = s.player;
  W.dined = s.turn;
  if (!chance(s, dineOdds(s, actor, lady))) {
    addMod(s, wife, lady, 'snubbed', 'Would not receive me', -8, 0.3);
    log(s, `${nm(s, lady)} sent word that she was indisposed, and would not receive ${actor === P ? 'your wife' : nm(s, wife)}.`, [actor], 'bad', [lady]);
    return { ok: false, text: `${first(s, lady)} would not receive her.`, tone: 'bad' };
  }
  addMod(s, wife, lady, 'dined', 'Dined together', 8, 0.2);
  addMod(s, lady, wife, 'dined', 'Dined together', 8, 0.2);
  addMod(s, lady, actor, 'wife-friend', 'Her friend’s husband', 4, 0.2);

  // Two households at one table: you put faces to hers.
  const husband = livingSpouse(s, lady);
  if (actor === P) {
    hearOf(s, lady, 3);
    if (husband && husband !== s.king && isFree(s, husband)) hearOf(s, husband, 3);
    for (const m of s.houses[L.householdId]?.members ?? []) if (m !== lady && !isServant(s, m) && isFree(s, m)) hearOf(s, m, 2);
  }

  // What she brings home, and how much of it she tells.
  const loyal = opinion(s, wife, actor) >= 0;
  const told = (cred: number) => Math.round(cred * (loyal ? 0.9 : 0.5));
  const lines: string[] = [];
  const unhappy = !!husband && opinion(s, lady, husband) < 0;
  // She keeps her own secrets and her kin's; her husband's only while she loves him.
  const shielded = (sec: Secret) => sec.guilty.some((g) => g === lady || L.siblings.includes(g) || g === wife || g === actor || (g === husband && !unhappy));
  const rounds = 1 + (W.traits.charm >= 60 || W.traits.cunning >= 60 ? 1 : 0);
  for (let r = 0; r < rounds; r++) {
    const gossip = Object.entries(s.knowledge[lady] ?? {})
      .filter(([sid, k]) => !k.lie && k.credence >= 40 && s.secrets[sid] && !shielded(s.secrets[sid]) && credence(s, actor, sid) < 40)
      .map(([sid]) => s.secrets[sid])
      .filter((sec) => sec.guilty.some((g) => isFree(s, g)) && secretMatters(s, sec));
    const hisAims = husband && husband !== actor && !knowsAgenda(s, actor, husband) && (unhappy || opinion(s, lady, wife) >= 20 || chance(s, 35));
    const options: { kind: string; w: number }[] = [];
    if (gossip.length) options.push({ kind: 'gossip', w: 40 });
    if (hisAims) options.push({ kind: 'aims', w: 30 });
    options.push({ kind: 'feeling', w: 15 });
    const choice = weighted(s, options, (o) => o.w);
    if (!choice) break;
    if (choice.kind === 'gossip') {
      const sec = pick(s, gossip);
      learn(s, wife, sec.id, 60, lady);
      learn(s, actor, sec.id, told(roll(s, 45, 70)), wife);
      lines.push(`${first(s, lady)} told her: “${sec.text}”`);
    } else if (choice.kind === 'aims' && husband) {
      const H = ch(s, husband);
      const ins = insightOf(s, actor);
      if (!ins.agendas.includes(husband)) ins.agendas.push(husband);
      lines.push(`${first(s, lady)} let slip what her husband wants: “${H.agenda.summary}”`);
      const own = Object.values(s.plots).find((p) => p.status === 'active' && p.owner === husband);
      if (own && credence(s, actor, own.secretId) < 25) {
        learn(s, actor, own.secretId, told(roll(s, 25, 40)), wife);
        lines.push(`She said he has business he does not speak of at home: “${s.secrets[own.secretId].text}”`);
      }
    } else {
      const strong = s.order
        .filter((o) => o !== lady && o !== actor && o !== wife && o !== husband && isFree(s, o) && !isServant(s, o) && !isChild(s, o))
        .filter((o) => Math.abs(opinion(s, lady, o)) >= 25);
      if (!strong.length) continue;
      const o = pick(s, strong);
      learnFeeling(s, actor, lady, o);
      if (actor === P) hearOf(s, o, 1);
      lines.push(`${first(s, lady)} ${opinion(s, lady, o) > 0 ? 'spoke warmly of' : 'could not abide'} ${nm(s, o)}.`);
    }
  }

  // And what your wife let slip in return.
  const yours = Object.entries(s.knowledge[wife] ?? {})
    .filter(([sid, k]) => !k.lie && k.credence >= 40 && s.secrets[sid]?.guilty.includes(actor) && credence(s, lady, sid) < 40)
    .map(([sid]) => s.secrets[sid]);
  if (yours.length && chance(s, clamp(12 + L.traits.cunning * 0.15 - W.traits.cunning * 0.15, 2, 30))) {
    const sec = pick(s, yours);
    learn(s, lady, sec.id, 45, wife);
    if (loyal) lines.push(`She came home uneasy: she fears she said too much about “${sec.text}”`);
  }

  const who = actor === P ? 'Your wife' : nm(s, wife);
  log(s, `${who} dined with ${nm(s, lady)}. ${lines.length ? lines.join(' ') : 'It was a pleasant evening, and nothing more.'}`, [actor], 'secret', [lady]);
  // The hostess's husband hears whose wife came calling.
  const host = husband && husband !== actor ? husband : undefined;
  if (host === P || lady === livingSpouse(s, P)) log(s, `${nm(s, wife)} came to dine with your wife.`, [P], 'neutral', [wife]);
  if (acquaintance(s, wife) < 2 && (host === P || lady === livingSpouse(s, P))) hearOf(s, wife, 3);
  return {
    ok: true,
    text: lines.length ? `${first(s, wife)} dined with ${first(s, lady)}, and came home with news.` : `${first(s, wife)} dined with ${first(s, lady)}. Nothing of note was said.`,
    tone: lines.length ? 'good' : 'neutral',
  };
}
