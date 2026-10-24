// Love and its consequences. A man may court any woman as his lover; a wife who
// takes one tells him what her husband says at supper. A husband who suspects
// may have her followed, and a husband who knows may do worse. And a man may
// rid himself of a wife under his own roof, at night, if he can bear the questions.

import { deedDone, makeSecret, publish } from './secrets';
import { kill } from './court';
import { MOURNING, akin, moveTo, widowedFor } from './family';
import { affairSpy } from './spies';
import { chance, clamp, roll } from './rng';
import { first, nm } from './text';
import {
  FAITHLESS_FADES,
  addMod,
  adjustTrust,
  ch,
  dateLabel,
  gone,
  hearOf,
  incomeOf,
  isChild,
  isFree,
  isServant,
  learn,
  livingSpouse,
  log,
  opinion,
  rel,
} from './world';
import type { CharId, GameState, Secret } from './types';

type Result = { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' };

/** Months a woman who has turned a man away waits before he may try again. */
export const WOO_AGAIN = 3;

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
  const refused = T.refused?.[actor];
  if (refused !== undefined && s.turn - refused < WOO_AGAIN) return `She has given you her answer. Give it time: try again in ${dateLabel(refused + WOO_AGAIN)}.`;
  return null;
}

/** Will she? Her regard for him, his charm, her honour, and how she feels about her husband. */
export function seduceOdds(s: GameState, actor: CharId, target: CharId, gift = 0): number {
  return clamp(Math.round(seduceParts(s, actor, target, gift).reduce((sum, p) => sum + p.value, 8)), 3, 85);
}

/** What she has to live on: what is in her purse, and half a year of whatever comes in. */
export function meansOf(s: GameState, id: CharId): number {
  return ch(s, id).gold + incomeOf(s, id) * 6;
}

/** How she stands for money, as a suitor would judge it. */
export function meansWord(s: GameState, id: CharId): 'in want' | 'getting by' | 'comfortable' | 'rich' {
  const m = meansOf(s, id);
  return m < 20 ? 'in want' : m < 50 ? 'getting by' : m < 150 ? 'comfortable' : 'rich';
}

/** What the odds are made of, for anyone weighing them. */
export function seduceParts(s: GameState, actor: CharId, target: CharId, gift = 0): { label: string; value: number }[] {
  const A = ch(s, actor);
  const T = ch(s, target);
  const husband = livingSpouse(s, target);
  // A woman alone with little to live on looks kindly on a man who could keep her; one who is rich needs no one.
  const means = meansOf(s, target);
  const want = husband ? 0 : clamp((50 - means) / 50, 0, 1);
  const purse = clamp(A.gold / 80, 0, 1);
  // What a settlement is worth to her: a great deal if she is in want, little if she is rich or has a husband's purse.
  const perCrown = husband ? 0.2 : means >= 150 ? 0.12 : 0.3 + want * 0.5;
  const giftWorth = Math.min(35, gift * perCrown * (0.6 + T.traits.greed / 100));
  const love = husband ? opinion(s, target, husband) : 0;
  // Honour is chiefly a wife's vow. A widow or a maid has none to break, and weighs it half as much.
  const widowed = widowedFor(s, target);
  const parts = [
    { label: 'Her regard for you', value: opinion(s, target, actor) * 0.45 },
    { label: 'Your charm', value: A.traits.charm * 0.3 },
    husband ? { label: 'Her honour', value: -T.traits.honor * 0.3 } : { label: 'Her honour (no vow to break)', value: -T.traits.honor * 0.15 },
    { label: 'A lonely widow', value: widowed !== undefined && widowed >= MOURNING / 2 ? 6 : 0 },
    { label: 'She is in want, and you are not', value: want * purse * 15 },
    { label: 'She is rich, and needs no one', value: !husband && means >= 150 ? -6 : 0 },
    { label: `${gift} crowns settled on her`, value: giftWorth },
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

export function seduce(s: GameState, actor: CharId, target: CharId, gift = 0): Result {
  const T = ch(s, target);
  const husband = livingSpouse(s, target);
  if (chance(s, seduceOdds(s, actor, target, gift))) {
    becomeLovers(s, target, actor);
    // What he promised, he pays.
    if (gift > 0) {
      ch(s, actor).gold -= gift;
      T.gold += gift;
    }
    if (actor === s.player) hearOf(s, target, 4);
    log(s, `${nm(s, target)} has become ${actor === s.player ? 'your' : `${first(s, actor)}'s`} lover.`, [actor, target], 'secret', [actor, target]);
    return {
      ok: true,
      text: `${first(s, target)} is yours.${gift > 0 ? ` You settled ${gift} crowns on her.` : ''}${husband ? ` She will tell you what ${first(s, husband)} says at home.` : ''}`,
      tone: 'good',
    };
  }
  addMod(s, target, actor, 'rebuffed', 'Made advances to me', -10, 1);
  (T.refused ??= {})[actor] = s.turn;
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

// ── A mistress under his roof ───────────────────────────────────────────────

/** His lover, living in his household for all to see. */
export const mistressOf = (s: GameState, man: CharId): CharId | undefined =>
  s.order.find((id) => s.chars[id].mistressOf === man && !gone(s, id));

/** Why she cannot come to live in his house as his mistress, or null. */
export function mistressProblem(s: GameState, actor: CharId, target: CharId): string | null {
  const T = ch(s, target);
  if (!loversOf(s, target).includes(actor)) return 'She is not your lover.';
  if (livingSpouse(s, target)) return 'She has a husband to keep her.';
  if (T.mistressOf === actor) return 'She lives under your roof already.';
  if (T.householdId === ch(s, actor).householdId) return 'She lives under your roof already.';
  if (!isFree(s, target) || !isFree(s, actor)) return 'Neither of you can move house from the Tower.';
  if (mistressOf(s, actor)) return 'You keep a mistress already.';
  return null;
}

/** Will she come? Her love for him, a child of his, against her honour and a house of her own to keep. */
export function mistressOdds(s: GameState, actor: CharId, target: CharId): number {
  const T = ch(s, target);
  const child = T.children?.some((k) => s.chars[k]?.sire === actor || T.expecting?.father === actor) || T.expecting?.father === actor;
  const keeps = s.houses[T.householdId]?.head === target;
  return clamp(Math.round(35 + opinion(s, target, actor) * 0.6 + (child ? 20 : 0) - (keeps ? 25 : 0) - T.traits.honor * 0.2), 5, 95);
}

export function takeMistress(s: GameState, actor: CharId, target: CharId): Result {
  const A = ch(s, actor);
  const T = ch(s, target);
  if (!chance(s, mistressOdds(s, actor, target))) {
    addMod(s, target, actor, 'kept-woman', 'Would make a kept woman of me', -8, 0.5);
    return { ok: false, text: `${first(s, target)} will be your lover, not your kept woman.`, tone: 'bad' };
  }
  const home = s.houses[A.householdId];
  const was = s.houses[T.householdId];
  moveTo(s, target, home);
  T.mistressOf = actor;
  addMod(s, target, actor, 'kept', 'Keeps me in his house', 15);
  adjustTrust(s, target, actor, 15);
  // No longer a secret: the whole court knows what she is to him.
  for (const sec of Object.values(s.secrets)) {
    if (sec.kind === 'affair' && sec.truth && sec.guilty.includes(target) && sec.guilty.includes(actor)) publish(s, sec.id, 90, 'court');
  }
  // His wife will not forgive it.
  const wife = livingSpouse(s, actor);
  if (wife) {
    addMod(s, wife, actor, 'mistress', 'Brought his mistress under our roof', -45, 0.1);
    adjustTrust(s, wife, actor, -30);
    addMod(s, wife, target, 'rival', 'His mistress, in my house', -60, 0.05);
    addMod(s, target, wife, 'rival', 'His wife', -20, 0.05);
    const W = ch(s, wife);
    if (wife !== s.player && W.traits.wrath >= 55 && W.traits.honor < 55) {
      W.agenda = { kind: 'destroy', targets: [target], summary: `Be rid of ${T.short}, whom her husband keeps under her own roof.` };
    }
  }
  // Honest men and the Church think less of him; a great lord is forgiven more.
  const great = A.rank === 'great' || s.king === actor;
  for (const id of s.order) {
    const c = ch(s, id);
    if (id === actor || id === target || !isFree(s, id) || isChild(s, id) || isServant(s, id)) continue;
    if (c.rank === 'clergy' || c.traits.honor >= 60) addMod(s, id, actor, 'mistress-scandal', 'Keeps his mistress under his roof', great ? -3 : -8, 0.2);
  }
  // Her family's name is in the gutter.
  const kin = new Set([...(T.parents ?? []), ...T.siblings, ...(was?.head && was.head !== target ? [was.head] : [])]);
  for (const k of kin) if (isFree(s, k) && k !== actor) addMod(s, k, actor, 'dishonour', 'Dishonoured our house', -30, 0.1);
  log(s, `${nm(s, actor)} has brought ${nm(s, target)} into his household as his mistress. The court talks of nothing else.`, 'all', 'court', [actor, target]);
  return { ok: true, text: `${first(s, target)} has come to live under your roof.${wife ? ` ${first(s, wife)} will not forgive it.` : ''}`, tone: 'good' };
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
