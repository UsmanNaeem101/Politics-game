// Families. Couples have children, who grow up, come of age and inherit before
// their uncles. Widows and widowers marry again and have more. A wife's child
// may not be her husband's, and that is a secret like any other.

import { ARCHETYPES, type ArchetypeId } from './content/archetypes';
import { EPITHETS, FEMALE_NAMES, HOUSE_NAMES, MALE_NAMES } from './content/names';
import { succeedHouse } from './court';
import { chance, clamp, pick, roll, weighted } from './rng';
import { makeSecret } from './secrets';
import { affairSpy } from './spies';
import { loversOf } from './love';
import { first, his, names, nm } from './text';
import { acquaintance, addMod, adjustTrust, ch, dateLabel, gone, hearOf, isChild, isFree, isServant, learn, livingSpouse, log, opinion, rename, uid } from './world';
import type { Character, CharId, GameState, House, Traits } from './types';

export const COMING_OF_AGE = 16;
export const PREGNANCY = 9;

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
  rename(s, c.id, c.gender === 'm' ? `${heads ? 'Lord' : 'Sir'} ${c.short} ${house.name}` : `Lady ${c.short} ${house.name}`, false);
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
    if (w.gender !== 'f' || w.status !== 'free') continue;
    // A child she is carrying comes when it is due.
    if (w.expecting) {
      if (s.turn >= w.expecting.due) deliver(s, w);
      continue;
    }
    if (w.age < 17 || w.age > 42 || isServant(s, w.id) || isChild(s, w.id) || (w.children?.length ?? 0) >= 6) continue;
    const h = w.spouse ? s.chars[w.spouse] : undefined;
    if (!h || gone(s, h.id) || h.spouse !== w.id) {
      // No husband, but a lover: now and then, a child out of wedlock.
      const lover = loversOf(s, w.id).find((l) => isFree(s, l) && ch(s, l).gender === 'm');
      if (lover && chance(s, odds * 0.6)) bastard(s, w.id, lover);
      continue;
    }
    if (!chance(s, odds)) continue;
    // A lover's child, now and then, and the mother will know it.
    const affair = Object.values(s.secrets).find((x) => x.kind === 'affair' && x.truth && x.guilty.includes(w.id) && x.victims.includes(h.id));
    const lover = affair?.guilty.find((g) => g !== w.id && isFree(s, g));
    wifeBears(s, w, h, lover && chance(s, 35) ? lover : h.id);
  }
  for (const c of Object.values(s.chars)) if (c.rank === 'child' && c.status === 'free' && c.age >= COMING_OF_AGE) comeOfAge(s, c);
}

/** A wife's child: her husband's in name, and in blood unless `sire` says otherwise (a secret she keeps). */
function wifeBears(s: GameState, w: Character, h: Character, sire: CharId): Character {
  const child = bearChild(s, w.id, h.id, 0, sire);
  if (sire !== h.id) {
    child.sire = sire;
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
    if (sire === s.player) {
      hearOf(s, child.id, 4);
      log(s, `${first(s, w.id)} sent word, in secret: the child is yours, not her husband's.`, [sire], 'secret', [w.id, child.id]);
    }
  }
  log(s, `${nm(s, w.id)} was delivered of a ${child.gender === 'm' ? 'son' : 'daughter'}, ${child.short}.`, 'all', 'good', [w.id, h.id, child.id]);
  if (h.id === s.player || s.chars[s.player]?.householdId === child.householdId) hearOf(s, child.id, 4);
  else if (acquaintance(s, w.id) >= 2 || acquaintance(s, h.id) >= 2) hearOf(s, child.id, 1);
  return child;
}

/** Nine months on: the child is born, and she is bound to its father. */
function deliver(s: GameState, w: Character): void {
  const father = w.expecting!.father;
  delete w.expecting;
  const husband = livingSpouse(s, w.id);
  if (husband) wifeBears(s, w, ch(s, husband), father);
  else bastard(s, w.id, father);
  if (gone(s, father)) return;
  addMod(s, w.id, father, 'child-father', 'Father of my child', 25, 0.05);
  adjustTrust(s, w.id, father, 15);
  addMod(s, father, w.id, 'child-mother', 'Mother of my child', 10, 0.05);
}

/** How likely she is to conceive in a month of trying: best in her early twenties, waning after, rarely past forty. */
export function conceiveOdds(s: GameState, id: CharId): number {
  const age = ch(s, id).age;
  if (age < 17 || age > 44) return 0;
  if (age < 20) return 50;
  if (age <= 26) return 60;
  return clamp(Math.round(60 - (age - 26) * 3), 5, 60);
}

/** A word for where she is in her bearing years. */
export function fertilityWord(s: GameState, id: CharId): string {
  const age = ch(s, id).age;
  return age < 20 ? 'young yet' : age <= 26 ? 'in her prime' : age <= 34 ? 'still in good years' : age <= 40 ? 'past her best years' : 'near the end of her bearing years';
}

/** Why he cannot try for a child with her, or null: she must be his wife or his lover, and able. */
export function tryProblem(s: GameState, actor: CharId, target: CharId): string | null {
  const T = ch(s, target);
  const mine = livingSpouse(s, actor) === target || loversOf(s, target).includes(actor);
  if (!mine || T.gender !== 'f') return 'She is neither your wife nor your lover.';
  if (!isFree(s, target)) return 'She is not at court.';
  if (T.expecting) return 'She is already with child.';
  if (!conceiveOdds(s, target)) return 'She is past bearing children.';
  if ((T.children?.length ?? 0) >= 6) return 'She has borne enough children.';
  return null;
}

/** A month of trying. Whatever comes of it, she is drawn closer. */
export function tryForChild(s: GameState, actor: CharId, target: CharId): { ok: boolean; text: string; tone: 'good' | 'bad' | 'neutral' | 'dire' } {
  const T = ch(s, target);
  const close = s.relations[target]?.[actor]?.mods.find((m) => m.key === 'trying')?.value ?? 0;
  addMod(s, target, actor, 'trying', 'Shares his bed', Math.max(0, Math.min(6, 20 - close)), 0.5);
  adjustTrust(s, target, actor, 4);
  if (!chance(s, conceiveOdds(s, target))) return { ok: false, text: `Not this month. ${first(s, target)} is fonder of you for the trying.`, tone: 'neutral' };
  T.expecting = { father: actor, due: s.turn + PREGNANCY };
  const husband = livingSpouse(s, target);
  const whose = husband && husband !== actor ? ' Her husband will believe it is his.' : '';
  log(s, `${first(s, target)} is with child by you. It is due in ${dateLabel(T.expecting.due)}.${whose}`, [actor], 'secret', [target]);
  return { ok: true, text: `${first(s, target)} is with child. It is due in ${dateLabel(T.expecting.due)}.${whose}`, tone: 'good' };
}

/** A child out of wedlock: born into the mother's house, her lover's by blood, and a secret. */
export function bastard(s: GameState, mother: CharId, father: CharId): Character {
  const child = bearChild(s, mother, undefined, 0, father);
  child.sire = father;
  (ch(s, father).children ??= []).push(child.id);
  addMod(s, father, child.id, 'blood', child.gender === 'm' ? 'My natural son' : 'My natural daughter', 20, 0, true);
  const sec = makeSecret(s, {
    kind: 'affair',
    guilty: [mother, father],
    victims: [],
    truth: true,
    evidence: roll(s, 30, 50),
    text: `${nm(s, child.id)}, born to ${nm(s, mother)} out of wedlock, is the child of ${nm(s, father)}.`,
  });
  learn(s, mother, sec.id, 100, 'self');
  learn(s, father, sec.id, 100, mother);
  const word = child.gender === 'm' ? 'son' : 'daughter';
  log(s, `${nm(s, mother)} was delivered of a ${word}, ${child.short}, and named no father. The court counts the months.`, 'all', 'neutral', [mother, child.id]);
  if (father === s.player) {
    hearOf(s, child.id, 4);
    log(s, `${first(s, mother)} has borne you a ${word}, ${child.short}. The child bears her house's name, and is yours.`, [father], 'secret', [mother, child.id]);
  } else if (acquaintance(s, mother) >= 2) hearOf(s, child.id, 1);
  return child;
}

// ── Marriage ────────────────────────────────────────────────────────────────

/** A year's mourning before a widow or widower is matched again; the first half of it, no one courts her. */
export const MOURNING = 12;

/** Months since this person's husband or wife died, if they are widowed. */
export function widowedFor(s: GameState, id: CharId): number | undefined {
  const sp = s.chars[id]?.spouse;
  return sp && gone(s, sp) ? s.turn - (s.chars[sp].statusTurn ?? 0) : undefined;
}

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
export function moveTo(s: GameState, id: CharId, to: House): void {
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

/** The house a former name belongs to ("Sir Savaric Underhill" → House Underhill), if it still stands. */
function houseOfName(s: GameState, name: string | undefined): House | undefined {
  if (!name) return undefined;
  return Object.values(s.houses).find((h) => h.rank !== 'royal' && h.rank !== 'church' && name.endsWith(` ${h.name}`));
}

/**
 * A marriage undone, as if it had not been: each goes back to the house and the name they had before.
 * If he had taken her house in hand, it is hers to keep again.
 */
export function annul(s: GameState, a: CharId, b: CharId): void {
  const man = ch(s, a).gender === 'm' ? ch(s, a) : ch(s, b);
  const woman = man.id === a ? ch(s, b) : ch(s, a);
  if (man.spouse !== woman.id || woman.spouse !== man.id) return;
  man.spouse = undefined;
  woman.spouse = undefined;
  for (const [x, y] of [[man.id, woman.id], [woman.id, man.id]]) {
    const r = s.relations[x]?.[y];
    if (r) r.mods = r.mods.filter((m) => m.key !== 'marriage');
  }
  forgetCuckolding(s, man.id, woman.id);
  const shared = s.houses[man.householdId];
  if (shared?.head === man.id && woman.householdId === shared.id && man.formerly?.length) {
    // He had married into her house: she keeps it again, and he goes home.
    shared.head = woman.id;
    const before = man.formerly.pop()!;
    man.name = before;
    man.rank = before.startsWith('Lord ') ? man.rank : 'knight';
    const home = houseOfName(s, before);
    if (home && home !== shared) {
      man.house = home.name;
      man.title = `A knight of House ${home.name}`;
      moveTo(s, man.id, home);
    }
  } else if (woman.formerly?.length) {
    // She had joined his: she goes back to the house she came from, and its name.
    const before = woman.formerly.pop()!;
    const home = houseOfName(s, before);
    woman.name = before;
    if (home && home.id !== woman.householdId) {
      woman.house = home.name;
      moveTo(s, woman.id, home);
      if (!home.head || gone(s, home.head)) home.head = woman.id;
    }
  }
  log(s, `The marriage of ${nm(s, man.id)} and ${nm(s, woman.id)} was annulled.`, 'all', 'court', [man.id, woman.id]);
}

/** A marriage that never was leaves no wrong behind: his grudges against her and her lovers go, and so does her spying. */
export function forgetCuckolding(s: GameState, man: CharId, woman: CharId): void {
  const her = s.relations[man]?.[woman];
  if (her) her.mods = her.mods.filter((m) => m.key !== 'faithless');
  for (const lover of loversOf(s, woman)) {
    const r = s.relations[man]?.[lover];
    if (r) r.mods = r.mods.filter((m) => m.key !== 'cuckold');
  }
  for (const sp of Object.values(s.spies ?? {})) if (sp.affair && sp.agent === woman && sp.mark === man && sp.status === 'active') sp.status = 'ended';
}

/** A wedding. The bride joins her husband's house, unless she heads one and he does not. */
export function wed(s: GameState, a: CharId, b: CharId): void {
  const man = ch(s, a).gender === 'm' ? ch(s, a) : ch(s, b);
  const woman = man.id === a ? ch(s, b) : ch(s, a);
  // The late husband or wife is no longer anyone's spouse.
  for (const c of [man, woman]) if (c.spouse && s.chars[c.spouse]?.spouse === c.id) s.chars[c.spouse].spouse = undefined;
  man.spouse = woman.id;
  woman.spouse = man.id;
  woman.mistressOf = undefined;
  const hers = s.houses[woman.householdId];
  const his = s.houses[man.householdId];
  if (hers?.head === woman.id && his?.head !== man.id) {
    // He marries into a house she kept, and takes it in hand: it ranks by him now, and may climb again.
    moveTo(s, man.id, hers);
    hers.head = man.id;
    if (hers.rank !== 'royal' && hers.rank !== 'church') {
      const seat = hers.seat ? s.lands[hers.seat]?.name : undefined;
      man.rank = hers.rank === 'great' ? 'great' : 'lord';
      man.house = hers.name;
      man.title = `Lord of ${seat ?? hers.name}`;
      man.canClaim = true;
      rename(s, man.id, `Lord ${man.short} ${hers.name}`);
    }
    log(s, `By his marriage to ${nm(s, woman.id)}, ${nm(s, man.id)} is now head of House ${hers.name}.`, 'all', 'court', [man.id, woman.id]);
  } else {
    moveTo(s, woman.id, his);
    const seat = his.seat ? s.lands[his.seat]?.name : undefined;
    if (woman.rank === 'lady') {
      rename(s, woman.id, `Lady ${woman.short} ${his.name}`);
      woman.house = his.name;
      woman.title = `Lady of ${seat ?? his.name}`;
    }
  }
  if (s.king === man.id) {
    woman.rank = 'queen';
    rename(s, woman.id, `${woman.short} of ${woman.house}`);
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

/**
 * A widow keeps herself: a few crowns a month for her table, her women and her gowns. If the head of
 * the house she lives in thinks well of her, he pays half. Savings with nothing coming in run down.
 */
export function widowsUpkeep(s: GameState): void {
  for (const w of Object.values(s.chars)) {
    if (w.gender !== 'f' || w.status !== 'free' || w.id === s.player || isChild(s, w.id) || isServant(s, w.id) || w.rank === 'clergy') continue;
    if (widowedFor(s, w.id) === undefined) continue;
    const cost = w.prestige >= 40 ? 6 : 4;
    const head = s.houses[w.householdId]?.head;
    const host = head && head !== w.id && isFree(s, head) && (opinion(s, head, w.id) >= 10 || w.mistressOf === head) ? ch(s, head) : undefined;
    // A kind host bears half; the man who keeps her as his mistress bears it all.
    const share = host ? Math.min(host.gold, w.mistressOf === head ? cost : Math.floor(cost / 2)) : 0;
    if (host) host.gold -= share;
    w.gold = Math.max(0, w.gold - (cost - share));
  }
}

/** How long a courted widow, widower or maid takes to give an answer: the player's window to make an offer. */
export const DELIBERATION = 2;

/** Who is courting this person now, if anyone. */
export const suitorsOf = (s: GameState, id: CharId): CharId[] => s.courtships?.[id]?.suitors ?? [];

/**
 * Widows and widowers marry again after a year's mourning; the unmarried, now and then. It is never
 * sudden: first suitors call, and the court sees who; the answer comes two months later.
 */
export function matchmaking(s: GameState): void {
  const P = s.player;
  const court = (s.courtships ??= {});
  const courting = new Set(Object.values(court).flatMap((x) => x.suitors));

  // Answers.
  for (const [id, ct] of Object.entries(court)) {
    if (!marriageable(s, id)) {
      // Taken by someone who made a better offer, or gone: the suitors are left at the door.
      const winner = livingSpouse(s, id);
      if (winner) for (const x of ct.suitors) if (x !== winner && !gone(s, x)) addMod(s, x, winner, `suitor-${id}`, `Won ${first(s, id)} from me`, -12, 0.3);
      delete court[id];
      continue;
    }
    ct.suitors = ct.suitors.filter((x) => marriageable(s, x));
    if (s.turn - ct.since < DELIBERATION) continue;
    delete court[id];
    const best = ct.suitors.sort((a, b) => regard(s, id, b) - regard(s, id, a))[0];
    // One who has taken a lover since will have no one else.
    const lovers = loversOf(s, id);
    if (lovers.length && !(best && lovers.includes(best))) {
      log(s, `${nm(s, id)} turned ${his(s, id)} suitors away, and would not say why.`, 'all', 'neutral', [id]);
      continue;
    }
    wed(s, id, best ?? outsider(s, id).id);
  }

  // The end of mourning is news, to anyone who has an interest.
  for (const id of s.order) {
    if (widowedFor(s, id) === MOURNING && !gone(s, id) && acquaintance(s, id) >= 2) {
      log(s, `${nm(s, id)}'s year of mourning is over. ${ch(s, id).gender === 'f' ? 'She' : 'He'} may marry again.`, [P], 'neutral', [id]);
    }
  }

  // Suitors come calling.
  for (const id of s.order) {
    if (id === P || court[id] || courting.has(id) || !marriageable(s, id)) continue;
    const c = ch(s, id);
    const widowed = !!c.spouse;
    if (widowed && (widowedFor(s, id) ?? 0) < MOURNING) continue;
    // Someone with a lover is not put forward to anyone else: if the lover is free to marry, the match is with him;
    // if the lover is the player, or married, there is no match to make.
    const lovers = loversOf(s, id);
    if (lovers.length && !lovers.some((l) => l !== P && marriageable(s, l) && !court[l] && !courting.has(l))) continue;
    if (!chance(s, widowed ? 5 : 2)) continue;
    const pool = s.order.filter(
      (o) =>
        o !== id &&
        o !== P &&
        (!lovers.length || lovers.includes(o)) &&
        (lovers.includes(o) || !loversOf(s, o).length) &&
        !court[o] &&
        !courting.has(o) &&
        marriageable(s, o) &&
        (widowedFor(s, o) ?? MOURNING) >= MOURNING &&
        ch(s, o).gender !== c.gender &&
        !akin(s, id, o) &&
        Math.abs(ch(s, o).age - c.age) <= 20,
    );
    const suitors: CharId[] = [];
    for (let n = lovers.length ? 1 : chance(s, 60) ? roll(s, 1, 2) : 0; n > 0; n--) {
      const x = weighted(s, pool.filter((o) => !suitors.includes(o)), (o) => regard(s, id, o) + Math.max(0, opinion(s, o, id)));
      if (x) suitors.push(x);
    }
    suitors.forEach((x) => courting.add(x));
    court[id] = { suitors, since: s.turn };
    const she = c.gender === 'f' ? 'She' : 'He';
    log(
      s,
      suitors.length
        ? c.gender === 'f'
          ? `${names(s, suitors)} ${suitors.length > 1 ? 'have' : 'has'} begun to court ${nm(s, id)}. ${she} will give her answer within two months.`
          : `${names(s, suitors)} ${suitors.length > 1 ? 'have' : 'has'} been offered to ${nm(s, id)} in marriage. ${she} will give his answer within two months.`
        : `A match is being sought for ${nm(s, id)} in the provinces. ${she} will give ${c.gender === 'f' ? 'her' : 'his'} answer within two months.`,
      'all',
      'neutral',
      [id, ...suitors],
    );
  }
}

/** How well a suitor stands with the one they court: liking, and a fair match in standing. */
function regard(s: GameState, id: CharId, o: CharId): number {
  return 10 + Math.max(0, opinion(s, id, o)) + Math.max(0, 20 - Math.abs(ch(s, o).prestige - ch(s, id).prestige) / 2);
}

/** The player asks for a hand. */
export function proposeOdds(s: GameState, actor: CharId, target: CharId): number {
  const T = ch(s, target);
  const head = s.houses[T.householdId]?.head;
  const family = head && head !== target && isFree(s, head) ? opinion(s, head, actor) * 0.3 : 0;
  return clamp(
    Math.round(
      20 + opinion(s, target, actor) * 0.6 + (ch(s, actor).prestige - T.prestige) * 0.4 + family + ch(s, actor).traits.charm * 0.15 - suitorsOf(s, target).length * 6,
    ),
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
