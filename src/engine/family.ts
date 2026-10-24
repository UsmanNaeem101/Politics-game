// Families. Couples have children, who grow up, come of age and inherit before
// their uncles. Widows and widowers marry again and have more. A wife's child
// may not be her husband's, and that is a secret like any other.

import { ARCHETYPES, type ArchetypeId } from './content/archetypes';
import { EPITHETS, FEMALE_NAMES, HOUSE_NAMES, MALE_NAMES } from './content/names';
import { succeedHouse } from './court';
import { chance, clamp, pick, roll, weighted } from './rng';
import { makeSecret } from './secrets';
import { affairSpy } from './spies';
import { first, nm } from './text';
import { acquaintance, addMod, adjustTrust, ch, gone, hearOf, isChild, isFree, isServant, learn, log, opinion, uid } from './world';
import type { Character, CharId, GameState, House, Traits } from './types';

export const COMING_OF_AGE = 16;

/** A given name no one living at court bears, if one is left. */
function freshName(s: GameState, gender: 'm' | 'f'): string {
  const used = new Set(Object.values(s.chars).filter((c) => c.status !== 'dead').map((c) => c.short));
  const pool = gender === 'm' ? MALE_NAMES : FEMALE_NAMES;
  const left = pool.filter((n) => !used.has(n));
  return pick(s, left.length ? left : pool);
}

/** Children take after their parents, more or less. */
function kinTraits(s: GameState, a: Traits, b?: Traits): Traits {
  const t = {} as Traits;
  for (const k of Object.keys(a) as (keyof Traits)[]) t[k] = clamp(Math.round(((a[k] + (b ?? a)[k]) / 2) + roll(s, -15, 15)), 5, 95);
  return t;
}

function epithet(s: GameState, t: Traits): string {
  if (t.boldness <= 25) return pick(s, EPITHETS.timid);
  const top = (Object.keys(t) as (keyof Traits)[]).sort((a, b) => t[b] - t[a])[0];
  return pick(s, EPITHETS[top] ?? EPITHETS.young);
}

/** Everyone at court swears to the King. */
function swear(s: GameState, id: CharId): void {
  if (s.king && s.king !== id) addMod(s, id, s.king, 'liege', 'Sworn liege', 15, 0, true);
}

/** A child born to a couple (or, as a court is made, already raised by them). `sire` is the true father. */
export function bearChild(s: GameState, mother: CharId, father: CharId | undefined, age = 0, sire = father): Character {
  const M = ch(s, mother);
  const house = s.houses[M.householdId];
  const gender = chance(s, 50) ? 'm' : 'f';
  const short = freshName(s, gender);
  const blood = sire ? ch(s, sire) : undefined;
  const c: Character = {
    id: uid(s, 'c'),
    name: `${short} ${house.name}`,
    short,
    title: gender === 'm' ? `Son of House ${house.name}` : `Daughter of House ${house.name}`,
    epithet: '',
    gender,
    age,
    house: house.name,
    householdId: house.id,
    rank: 'child',
    canClaim: false,
    traits: kinTraits(s, M.traits, blood?.traits),
    status: 'free',
    gold: 0,
    prestige: 0,
    siblings: [],
    parents: [mother, ...(father ? [father] : [])],
    children: [],
    agenda: { kind: 'peace', targets: [], summary: 'Grow up.' },
    facade: gender === 'm' ? 'A boy of the house.' : 'A girl of the house.',
    bio: `${M.name}'s ${gender === 'm' ? 'son' : 'daughter'}.`,
    pressure: 0,
    guard: 0,
    heraldry: house.heraldry,
  };
  s.chars[c.id] = c;
  s.order.push(c.id);
  house.members.push(c.id);
  for (const x of (M.children ?? []).filter((k) => s.chars[k] && !gone(s, k))) {
    c.siblings.push(x);
    ch(s, x).siblings.push(c.id);
    addMod(s, c.id, x, 'blood', 'Kin', 10, 0, true);
    addMod(s, x, c.id, 'blood', 'Kin', 10, 0, true);
  }
  (M.children ??= []).push(c.id);
  if (father) (ch(s, father).children ??= []).push(c.id);
  for (const p of c.parents!) {
    addMod(s, p, c.id, 'blood', gender === 'm' ? 'My son' : 'My daughter', 30, 0, true);
    addMod(s, c.id, p, 'blood', ch(s, p).gender === 'm' ? 'My father' : 'My mother', 25, 0, true);
    adjustTrust(s, c.id, p, 20);
  }
  if (age >= COMING_OF_AGE) comeOfAge(s, c, true);
  return c;
}

/** A child grown: a knight or a lady of the house, with a will and a place at court. */
export function comeOfAge(s: GameState, c: Character, quiet = false): void {
  const house = s.houses[c.householdId];
  const heads = house?.head === c.id;
  const arch: ArchetypeId = c.gender === 'm' ? 'younger-son' : 'devoted';
  c.rank = c.gender === 'm' ? (heads ? (house.rank === 'great' ? 'great' : 'lord') : 'knight') : 'lady';
  c.name = c.gender === 'm' ? `${heads ? 'Lord' : 'Sir'} ${c.short} ${house.name}` : `Lady ${c.short} ${house.name}`;
  c.canClaim = c.gender === 'm';
  c.archetype = arch;
  c.epithet = epithet(s, c.traits);
  c.prestige = Math.max(c.prestige, heads ? 20 : roll(s, 8, 15));
  c.gold = Math.max(c.gold, roll(s, 5, 20));
  c.agenda = c.gender === 'm' ? { kind: 'rise', targets: [], summary: 'Make a name of his own at court.' } : { kind: 'peace', targets: [], summary: 'Keep her family safe.' };
  c.firstAgenda = { ...c.agenda, targets: [] };
  c.facade = pick(s, ARCHETYPES[arch].facades);
  // As a court is made, everyone swears together; later, each as they come of age.
  if (!quiet) {
    swear(s, c.id);
    log(s, `${c.name} has come of age.`, 'all', 'neutral', [c.id]);
  }
}

/** Every month: babies born, children grown. */
export function births(s: GameState): void {
  // A crowded court has fewer children at it: the rest are fostered in the country.
  const living = s.order.filter((id) => !gone(s, id)).length;
  const odds = 1.6 * clamp((85 - living) / 25, 0.15, 1);
  for (const w of Object.values(s.chars)) {
    if (w.gender !== 'f' || w.status !== 'free' || !w.spouse || w.age < 17 || w.age > 42 || isServant(s, w.id) || isChild(s, w.id)) continue;
    const h = s.chars[w.spouse];
    if (!h || gone(s, h.id) || h.spouse !== w.id || (w.children?.length ?? 0) >= 6 || !chance(s, odds)) continue;
    // A lover's child, now and then, and the mother will know it.
    const affair = Object.values(s.secrets).find((x) => x.kind === 'affair' && x.truth && x.guilty.includes(w.id) && x.victims.includes(h.id));
    const lover = affair?.guilty.find((g) => g !== w.id && isFree(s, g));
    const sire = lover && chance(s, 35) ? lover : h.id;
    const child = bearChild(s, w.id, h.id, 0, sire);
    if (sire !== h.id) {
      const sec = makeSecret(s, {
        kind: 'affair',
        guilty: [w.id, sire],
        victims: [h.id],
        truth: true,
        evidence: roll(s, 10, 25),
        treason: w.rank === 'queen',
        text: `${nm(s, child.id)}, born to ${nm(s, w.id)}, is not her husband's child. The father is ${nm(s, sire)}.`,
      });
      learn(s, w.id, sec.id, 100, 'self');
      learn(s, sire, sec.id, 60, w.id);
    }
    log(s, `${nm(s, w.id)} was delivered of a ${child.gender === 'm' ? 'son' : 'daughter'}, ${child.short}.`, 'all', 'good', [w.id, h.id, child.id]);
    if (h.id === s.player || s.chars[s.player]?.householdId === child.householdId) hearOf(s, child.id, 4);
    else if (acquaintance(s, w.id) >= 2 || acquaintance(s, h.id) >= 2) hearOf(s, child.id, 1);
  }
  for (const c of Object.values(s.chars)) if (c.rank === 'child' && c.status === 'free' && c.age >= COMING_OF_AGE) comeOfAge(s, c);
}

// ── Marriage ────────────────────────────────────────────────────────────────

/** Unmarried, or widowed. */
export const unwed = (s: GameState, id: CharId) => !s.chars[id].spouse || gone(s, s.chars[id].spouse!);

/** Too close in blood to marry. */
export function akin(s: GameState, a: CharId, b: CharId): boolean {
  const A = ch(s, a);
  return A.siblings.includes(b) || !!A.parents?.includes(b) || !!A.children?.includes(b);
}

/** Free to marry at all: grown, unwed, not a priest or a servant. */
export function marriageable(s: GameState, id: CharId): boolean {
  const c = s.chars[id];
  return !!c && c.status === 'free' && !isChild(s, id) && !isServant(s, id) && c.rank !== 'clergy' && c.age >= 17 && c.age <= 62 && unwed(s, id);
}

/** Why these two cannot marry, or null. */
export function matchProblem(s: GameState, a: CharId, b: CharId): string | null {
  if (!marriageable(s, a)) return unwed(s, a) ? 'You are not free to marry.' : 'You are married.';
  if (!marriageable(s, b)) return 'They are not free to marry.';
  if (ch(s, a).gender === ch(s, b).gender) return 'The Church will not marry them.';
  if (akin(s, a, b)) return 'They are too close in blood.';
  return null;
}

/** Move someone (and their young children) into another household. */
function moveTo(s: GameState, id: CharId, to: House): void {
  const c = ch(s, id);
  const from = s.houses[c.householdId];
  if (from === to) return;
  if (from?.head === id) succeedHouse(s, id);
  const minors = (c.children ?? []).filter((k) => isChild(s, k) && ch(s, k).householdId === from?.id);
  for (const m of [id, ...minors]) {
    if (from) from.members = from.members.filter((x) => x !== m);
    to.members.push(m);
    ch(s, m).householdId = to.id;
  }
}

/** A wedding. The bride joins her husband's house, unless she heads one and he does not. */
export function wed(s: GameState, a: CharId, b: CharId): void {
  const man = ch(s, a).gender === 'm' ? ch(s, a) : ch(s, b);
  const woman = man.id === a ? ch(s, b) : ch(s, a);
  // The late husband or wife is no longer anyone's spouse.
  for (const c of [man, woman]) if (c.spouse && s.chars[c.spouse]?.spouse === c.id) s.chars[c.spouse].spouse = undefined;
  man.spouse = woman.id;
  woman.spouse = man.id;
  const hers = s.houses[woman.householdId];
  const his = s.houses[man.householdId];
  if (hers?.head === woman.id && his?.head !== man.id) moveTo(s, man.id, hers);
  else {
    moveTo(s, woman.id, his);
    const seat = his.seat ? s.lands[his.seat]?.name : undefined;
    if (woman.rank === 'lady') {
      woman.name = `Lady ${woman.short} ${his.name}`;
      woman.house = his.name;
      woman.title = `Lady of ${seat ?? his.name}`;
    }
  }
  if (s.king === man.id) {
    woman.rank = 'queen';
    woman.name = `${woman.short} of ${woman.house}`;
    woman.title = 'Queen of Wendmere';
  }
  addMod(s, man.id, woman.id, 'marriage', 'Spouse', 20, 0, true);
  addMod(s, woman.id, man.id, 'marriage', 'Spouse', 20, 0, true);
  adjustTrust(s, man.id, woman.id, 20);
  adjustTrust(s, woman.id, man.id, 20);
  log(s, `${nm(s, man.id)} and ${nm(s, woman.id)} were married.`, 'all', 'good', [man.id, woman.id]);
  const P = s.player;
  if (man.id === P || woman.id === P || s.chars[P]?.householdId === man.householdId) {
    hearOf(s, man.id, 4);
    hearOf(s, woman.id, 4);
  } else if (acquaintance(s, man.id) >= 2 || acquaintance(s, woman.id) >= 2) {
    hearOf(s, man.id, 1);
    hearOf(s, woman.id, 1);
  }
}

/** Someone from the provinces, come to court to marry. */
export function outsider(s: GameState, partner: CharId): Character {
  const P = ch(s, partner);
  const gender = P.gender === 'm' ? 'f' : 'm';
  const arch: ArchetypeId = gender === 'f' ? weighted(s, [['devoted', 40], ['spur', 35], ['unhappy', 25]] as [ArchetypeId, number][], (x) => x[1])![0] : 'content';
  const base = ARCHETYPES[arch].traits as Traits;
  const traits = {} as Traits;
  for (const k of Object.keys(base) as (keyof Traits)[]) traits[k] = clamp(base[k] + roll(s, -12, 12), 5, 95);
  const short = freshName(s, gender);
  const surname = pick(s, HOUSE_NAMES);
  const house = s.houses[P.householdId];
  const c: Character = {
    id: uid(s, 'c'),
    name: gender === 'f' ? `Lady ${short} ${surname}` : `Sir ${short} ${surname}`,
    short,
    title: gender === 'f' ? `Lady of ${surname}` : 'A knight from the provinces',
    epithet: epithet(s, traits),
    gender,
    age: clamp(P.age + roll(s, -10, 3), 18, 60),
    house: surname,
    householdId: house.id,
    rank: gender === 'f' ? 'lady' : 'knight',
    canClaim: gender === 'm',
    traits,
    status: 'free',
    gold: roll(s, 10, 40),
    prestige: roll(s, 8, 18),
    siblings: [],
    parents: [],
    children: [],
    agenda: arch === 'spur' ? { kind: 'raise-spouse', targets: [], summary: 'Drive her husband up the hall.' } : { kind: 'peace', targets: [], summary: 'Make a life at court.' },
    facade: pick(s, ARCHETYPES[arch].facades),
    bio: `Came to court from the provinces to marry ${P.name}.`,
    pressure: 0,
    guard: 0,
    heraldry: house.heraldry,
    archetype: arch,
  };
  c.firstAgenda = { ...c.agenda, targets: [] };
  s.chars[c.id] = c;
  s.order.push(c.id);
  house.members.push(c.id);
  swear(s, c.id);
  return c;
}

/** Widows and widowers marry again after a season's mourning; the unmarried, now and then. */
export function matchmaking(s: GameState): void {
  const P = s.player;
  for (const id of s.order) {
    if (id === P || !marriageable(s, id)) continue;
    const c = ch(s, id);
    const widowed = !!c.spouse;
    if (widowed && s.turn - (ch(s, c.spouse!).statusTurn ?? 0) < 4) continue;
    if (!chance(s, widowed ? 10 : 2)) continue;
    const pool = s.order.filter(
      (o) => o !== id && o !== P && marriageable(s, o) && ch(s, o).gender !== c.gender && !akin(s, id, o) && Math.abs(ch(s, o).age - c.age) <= 20,
    );
    const partner = pool.length && chance(s, 60) ? weighted(s, pool, (o) => 10 + Math.max(0, opinion(s, id, o)) + Math.max(0, opinion(s, o, id)) + Math.max(0, 20 - Math.abs(ch(s, o).prestige - c.prestige) / 2)) : undefined;
    wed(s, id, partner ?? outsider(s, id).id);
  }
}

/** The player asks for a hand. */
export function proposeOdds(s: GameState, actor: CharId, target: CharId): number {
  const T = ch(s, target);
  const head = s.houses[T.householdId]?.head;
  const family = head && head !== target && isFree(s, head) ? opinion(s, head, actor) * 0.3 : 0;
  return clamp(
    Math.round(20 + opinion(s, target, actor) * 0.6 + (ch(s, actor).prestige - T.prestige) * 0.4 + family + ch(s, actor).traits.charm * 0.15),
    3,
    95,
  );
}

export function propose(s: GameState, actor: CharId, target?: CharId): { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' } {
  if (!target) {
    const match = outsider(s, actor);
    wed(s, actor, match.id);
    return { ok: true, text: `A match was made: ${match.name} has come from the provinces to be your ${match.gender === 'f' ? 'wife' : 'husband'}.`, tone: 'good' };
  }
  if (!chance(s, proposeOdds(s, actor, target))) {
    addMod(s, target, actor, 'suitor', 'An unwelcome suitor', -5, 0.3);
    return { ok: false, text: `${first(s, target)} will not have you.`, tone: 'bad' };
  }
  wed(s, actor, target);
  return { ok: true, text: `${first(s, target)} has said yes.`, tone: 'good' };
}

/** Every unfaithful wife spies for her lover; old saves get theirs. */
export function affairsAsSpies(s: GameState): void {
  for (const sec of Object.values(s.secrets)) {
    if (sec.kind !== 'affair' || !sec.truth) continue;
    const wife = sec.guilty.find((g) => s.chars[g]?.gender === 'f');
    const lover = sec.guilty.find((g) => g !== wife);
    if (wife && lover) affairSpy(s, wife, lover);
  }
}
