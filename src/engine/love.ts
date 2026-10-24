// Love and its consequences. A man may court any woman as his lover; a wife who
// takes one tells him what her husband says at supper. A husband who suspects
// may have her followed, and a husband who knows may do worse. And a man may
// rid himself of a wife under his own roof, at night, if he can bear the questions.

import { deedDone, makeSecret } from './secrets';
import { kill } from './court';
import { akin } from './family';
import { affairSpy } from './spies';
import { chance, clamp, roll } from './rng';
import { first, nm } from './text';
import { FAITHLESS_FADES, addMod, adjustTrust, ch, dateLabel, gone, hearOf, isChild, isFree, isServant, learn, livingSpouse, log, opinion, rel } from './world';
import type { CharId, GameState, Secret } from './types';

type Result = { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' };

/** Whoever this person has taken as a lover, living. */
export function loversOf(s: GameState, id: CharId): CharId[] {
  const row = s.relations[id] ?? {};
  return Object.keys(row).filter((o) => !gone(s, o) && row[o].mods.some((m) => m.key === 'lover'));
}

/** Why he cannot court her as a lover, or null. */
export function seduceProblem(s: GameState, actor: CharId, target: CharId): string | null {
  const A = ch(s, actor);
  const T = ch(s, target);
  if (A.gender !== 'm' || T.gender !== 'f') return 'That is not a door you can open here.';
  if (isChild(s, target)) return 'A child is no part of this.';
  if (T.rank === 'clergy') return 'She has taken vows.';
  if (A.spouse === target) return 'She is your wife.';
  if (akin(s, actor, target)) return 'She is your kin.';
  if (loversOf(s, target).includes(actor)) return 'She is your lover already.';
  if (s.relations[target]?.[actor]?.mods.some((m) => m.key === 'rebuffed')) return 'She has given you her answer. Give it time.';
  return null;
}

/** Will she? Her regard for him, his charm, her honour, and how she feels about her husband. */
export function seduceOdds(s: GameState, actor: CharId, target: CharId): number {
  return clamp(Math.round(seduceParts(s, actor, target).reduce((sum, p) => sum + p.value, 8)), 3, 85);
}

/** What the odds are made of, for anyone weighing them. */
export function seduceParts(s: GameState, actor: CharId, target: CharId): { label: string; value: number }[] {
  const A = ch(s, actor);
  const T = ch(s, target);
  const husband = livingSpouse(s, target);
  const love = husband ? opinion(s, target, husband) : 0;
  const parts = [
    { label: 'Her regard for you', value: opinion(s, target, actor) * 0.45 },
    { label: 'Your charm', value: A.traits.charm * 0.3 },
    { label: 'Her honour', value: -T.traits.honor * 0.3 },
    husband
      ? { label: love >= 0 ? `Her love for ${first(s, husband)}` : `Her coldness to ${first(s, husband)}`, value: -Math.max(0, love) * 0.3 + Math.max(0, -love) * 0.35 }
      : { label: 'No husband to betray', value: 8 },
    { label: 'An unhappy woman', value: T.archetype === 'unhappy' ? 15 : 0 },
    { label: 'Your standing against hers', value: (A.prestige - T.prestige) * 0.1 },
    { label: 'Her husband is the King', value: husband && husband === s.king ? -10 : 0 },
    { label: 'A lover already', value: -loversOf(s, target).length * 15 },
  ];
  return parts.filter((p) => Math.round(p.value) !== 0).map((p) => ({ ...p, value: Math.round(p.value) }));
}

/** They become lovers: a secret, a bond, and if she is married, a spy in her husband's house. */
export function becomeLovers(s: GameState, woman: CharId, man: CharId, evidence = roll(s, 15, 30)): Secret {
  const W = ch(s, woman);
  const husband = livingSpouse(s, woman);
  const head = s.houses[W.householdId]?.head;
  const shamed = husband ?? (head && head !== woman && head !== man && !gone(s, head) ? head : undefined);
  const sec = makeSecret(s, {
    kind: 'affair',
    guilty: [woman, man],
    victims: shamed ? [shamed] : [],
    truth: true,
    evidence,
    treason: W.rank === 'queen',
    text: husband ? `${W.name} has taken ${nm(s, man)} as her lover.` : `${W.name} and ${nm(s, man)} are lovers${shamed ? `, to the shame of ${nm(s, shamed)}` : ''}.`,
  });
  learn(s, woman, sec.id, 100, 'self');
  learn(s, man, sec.id, 100, 'self');
  addMod(s, woman, man, 'lover', 'Her lover', 45);
  addMod(s, man, woman, 'lover', 'His lover', 35);
  rel(s, woman, man).trust = 75;
  const maid = s.houses[W.householdId]?.members.find((m) => ch(s, m).role === 'maid' && isFree(s, m));
  if (maid && chance(s, 50)) learn(s, maid, sec.id, 60, 'spies');
  if (husband) affairSpy(s, woman, man);
  return sec;
}

export function seduce(s: GameState, actor: CharId, target: CharId): Result {
  const T = ch(s, target);
  const husband = livingSpouse(s, target);
  if (chance(s, seduceOdds(s, actor, target))) {
    becomeLovers(s, target, actor);
    if (actor === s.player) hearOf(s, target, 4);
    log(s, `${nm(s, target)} has become ${actor === s.player ? 'your' : `${first(s, actor)}'s`} lover.`, [actor, target], 'secret', [actor, target]);
    return {
      ok: true,
      text: `${first(s, target)} is yours.${husband ? ` She will tell you what ${first(s, husband)} says at home.` : ''}`,
      tone: 'good',
    };
  }
  addMod(s, target, actor, 'rebuffed', 'Made advances to me', -10, 0.5);
  // An honest wife tells her husband; a loose tongue tells the hall.
  if (husband && isFree(s, husband) && chance(s, 20 + T.traits.honor * 0.5)) {
    addMod(s, husband, actor, 'advances', 'Made advances to my wife', -30, 0.2);
    log(s, `${first(s, target)} told her husband that ${nm(s, actor)} had made advances to her.`, [husband, actor], 'bad', [actor, target, husband]);
    return { ok: false, text: `${first(s, target)} turned you away, and told ${first(s, husband)}.`, tone: 'bad' };
  }
  return { ok: false, text: `${first(s, target)} turned you away.`, tone: 'bad' };
}

/** A husband learns for certain that his wife has a lover. */
export function discoverAffair(s: GameState, husband: CharId, sec: Secret): void {
  const wife = sec.guilty.find((g) => ch(s, g).gender === 'f');
  const lover = sec.guilty.find((g) => g !== wife);
  learn(s, husband, sec.id, 90, 'self');
  // Who bedded his wife he never forgets; her, in time, he may forgive.
  if (lover) addMod(s, husband, lover, 'cuckold', 'Beds my wife', -50);
  if (wife) {
    addMod(s, husband, wife, 'faithless', 'Faithless', -35, FAITHLESS_FADES);
    adjustTrust(s, husband, wife, -40);
  }
}

// ── A death in the night ────────────────────────────────────────────────────

/** Someone under his own roof: a wife, a brother, a servant. */
export function nightProblem(s: GameState, actor: CharId, target: CharId): string | null {
  const A = ch(s, actor);
  const T = ch(s, target);
  if (!isFree(s, target)) return 'They are not at court.';
  if (isChild(s, target)) return 'A child is no part of this.';
  if (T.householdId !== A.householdId && A.spouse !== target) return 'Only under your own roof, where no one asks why you are on the stair.';
  return null;
}

export function nightOdds(s: GameState, actor: CharId, target: CharId): number {
  const T = ch(s, target);
  return clamp(Math.round(80 + ch(s, actor).traits.cunning * 0.1 - T.traits.paranoia * 0.2 - T.guard * 0.5), 30, 92);
}

/** He does it himself, at night, and says it was a fever. */
export function killInTheNight(s: GameState, actor: CharId, target: CharId): Result {
  const T = ch(s, target);
  const wife = ch(s, actor).spouse === target;
  const house = s.houses[ch(s, actor).householdId];
  if (!chance(s, nightOdds(s, actor, target))) {
    // She woke. Now she knows, and so may others.
    const sec = makeSecret(s, {
      kind: 'murder',
      guilty: [actor],
      victims: [target],
      truth: true,
      evidence: roll(s, 45, 60),
      treason: false,
      text: `${nm(s, actor)} tried to kill ${nm(s, target)} in the night, under his own roof.`,
    });
    learn(s, target, sec.id, 100, 'self');
    addMod(s, target, actor, 'tried-to-kill', 'Tried to kill me', -80);
    adjustTrust(s, target, actor, -100);
    for (const m of house?.members ?? []) if (m !== actor && m !== target && isFree(s, m) && chance(s, 40)) learn(s, m, sec.id, 55, 'spies');
    log(s, `There was screaming in ${nm(s, actor)}'s house in the night. ${first(s, target)} would not say why.`, 'all', 'bad', [actor, target]);
    return { ok: false, text: `${first(s, target)} woke and fought you off. ${T.gender === 'f' ? 'She' : 'He'} knows what you meant to do.`, tone: 'dire' };
  }
  kill(s, target, `Died in the night, ${dateLabel(s.turn)}`, false);
  const sec = makeSecret(s, {
    kind: 'murder',
    guilty: [actor],
    victims: [target],
    truth: true,
    evidence: roll(s, 15, 30),
    treason: false,
    text: `${nm(s, actor)} killed ${nm(s, target)} in the night, under his own roof.`,
  });
  deedDone(s, sec);
  learn(s, actor, sec.id, 100, 'self');
  // The household heard something; her family wonders.
  for (const m of house?.members ?? []) if (m !== actor && isFree(s, m) && !isChild(s, m) && chance(s, isServant(s, m) ? 35 : 20)) learn(s, m, sec.id, 50, 'spies');
  for (const k of [...(T.parents ?? []), ...T.siblings]) if (isFree(s, k)) learn(s, k, sec.id, 30, 'rumour');
  if (T.prestige >= 30 || T.parents?.some((p) => isFree(s, p) && ch(s, p).prestige >= 40)) sec.inquiry ??= s.turn;
  log(
    s,
    `${nm(s, target)} died in the night. ${nm(s, actor)} says it was ${wife ? 'a fever' : 'a fall on the stair'}.`,
    'all',
    'dire',
    [target, actor],
  );
  return { ok: true, text: `It is done. ${wife ? 'You are a widower.' : ''} The house will be quiet for a while.`.trim(), tone: 'dire' };
}
