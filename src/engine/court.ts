// The machinery of royal justice: accusations, questioning, the headsman,
// inheritance, appointments, and the Witan that chooses a king.

import { chance, clamp, rand, roll } from './rng';
import { makeSecret, publish, refreshText } from './secrets';
import { He, His, first, his, names, nm, vary } from './text';
import {
  OFFICE_NAMES,
  addMod,
  ch,
  credence,
  isAlive,
  isFree,
  learn,
  log,
  officeOf,
  opinion,
  trust,
} from './world';
import type { CharId, GameState, OfficeId, Plot, Secret, SecretId } from './types';

// ── Death, prison and inheritance ───────────────────────────────────────────

export function kill(s: GameState, id: CharId, fate: string, attainted: boolean): void {
  const c = ch(s, id);
  if (c.status === 'dead') return;
  const wasKing = s.king === id;
  c.status = 'dead';
  c.statusTurn = s.turn;
  c.fate = fate;
  c.pressure = 0;
  delete s.imprisoned[id];
  delete s.directives[id];
  vacate(s, id);
  passOnLands(s, id, attainted);
  succeedHouse(s, id);

  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active') continue;
    if (p.owner === id) {
      p.status = 'abandoned';
      continue;
    }
    p.members = p.members.filter((m) => m.id !== id);
    if (p.targets.includes(id)) {
      p.targets = p.targets.filter((t) => t !== id);
      if (p.targets.length === 0) p.status = 'succeeded';
    }
  }
  for (const pl of s.pledges) {
    if (pl.status === 'pending' && (pl.from === id || pl.to === id)) pl.status = 'broken';
  }
  if (c.spouse && isAlive(s, c.spouse)) {
    const sp = ch(s, c.spouse);
    sp.pressure = 0;
    if (wasKing && sp.rank === 'queen') sp.rank = 'lady';
  }
  if (wasKing) {
    s.king = null;
    s.interregnum = { since: s.turn };
  }
}

/** When a head of house dies or flees, the next of kin takes his place. */
export function succeedHouse(s: GameState, id: CharId): void {
  const c = ch(s, id);
  const house = s.houses[c.householdId];
  if (!house || house.head !== id) return;
  const kin = [...c.siblings, ...(c.spouse ? [c.spouse] : [])].filter((k) => isFree(s, k) && ch(s, k).householdId === house.id);
  const heir = kin.find((k) => ch(s, k).gender === 'm') ?? kin[0];
  house.head = heir ?? null;
  if (!heir || house.rank === 'royal' || house.rank === 'church') return;
  const h = ch(s, heir);
  const seat = house.seat ? s.lands[house.seat]?.name : undefined;
  if (h.gender === 'm') {
    h.rank = house.rank === 'great' ? 'great' : 'lord';
    h.name = `Lord ${h.short} ${house.name}`;
    h.title = `Lord of ${seat ?? house.name}`;
    h.canClaim = true;
  }
  h.prestige += 10;
  log(s, `${h.name} is now head of House ${house.name}.`, 'all', 'court', [heir]);
}

/** Lands pass by blood unless the dead man was attainted for treason. */
function passOnLands(s: GameState, id: CharId, attainted: boolean): void {
  const c = ch(s, id);
  const heirs = c.siblings.filter((b) => isAlive(s, b));
  const held = Object.values(s.lands).filter((l) => l.holder === id);
  let i = 0;
  for (const land of held) {
    if (attainted) {
      land.holder = null;
      continue;
    }
    if (land.rightful && isAlive(s, land.rightful)) {
      land.holder = land.rightful;
      continue;
    }
    if (heirs.length) {
      land.holder = heirs[i++ % heirs.length];
    } else if (c.spouse && isAlive(s, c.spouse)) {
      land.holder = c.spouse;
    } else {
      land.holder = null;
    }
  }
  if (!attainted && c.gold > 0) {
    const recips = c.spouse && isAlive(s, c.spouse) ? [c.spouse, ...heirs] : heirs;
    if (recips.length) {
      const share = Math.floor(c.gold / recips.length);
      for (const r of recips) ch(s, r).gold += share;
    }
  }
  c.gold = 0;
}

/** Strip every office a character holds. Returns the first, for narration. */
export function vacate(s: GameState, id: CharId): OfficeId | undefined {
  const first = officeOf(s, id);
  for (const o of Object.keys(s.offices) as OfficeId[]) if (s.offices[o] === id) s.offices[o] = null;
  return first;
}

export function imprison(s: GameState, id: CharId, charges: SecretId[], accuser?: CharId): void {
  const c = ch(s, id);
  if (c.status !== 'free') return;
  c.status = 'imprisoned';
  c.statusTurn = s.turn;
  s.imprisoned[id] = { charges: charges.slice(), since: s.turn, accuser, questioned: 0 };
}

export function release(s: GameState, id: CharId, why: string): void {
  const c = ch(s, id);
  if (c.status !== 'imprisoned') return;
  const rec = s.imprisoned[id];
  c.status = 'free';
  c.statusTurn = s.turn;
  delete s.imprisoned[id];
  if (s.king) addMod(s, id, s.king, 'jailed', 'Threw me in a cell', -20, 1);
  if (rec?.accuser && rec.accuser !== id) addMod(s, id, rec.accuser, 'denounced', 'Denounced me to the King', -35);
  log(s, `${nm(s, id)} walked free from the Tower: ${why}`, 'all', 'court', [id]);
}

export function execute(s: GameState, id: CharId, crime: string): void {
  if (!isAlive(s, id)) return;
  scaffoldSpeech(s, id);
  kill(s, id, `Beheaded for ${crime}, week ${s.turn}`, true);
  log(
    s,
    vary(s, [
      `${nm(s, id)} was beheaded on Tower Green for ${crime}. The crowd was quiet.`,
      `The axe fell on ${nm(s, id)} at first light. ${He(s, id)} died for ${crime}.`,
      `${nm(s, id)} went to the block for ${crime}. ${His(s, id)} lands are forfeit to the crown.`,
    ]),
    'all',
    'dire',
    [id],
  );
  for (const other of s.order) {
    if (!isAlive(s, other) || other === id) continue;
    const o = opinion(s, other, id);
    if (o >= 30 && s.king) addMod(s, other, s.king, `grief-${id}`, `Executed ${first(s, id)}`, -Math.round(o / 2), 0.5);
  }
}

/** Last words: the condemned may drag someone down with them. */
function scaffoldSpeech(s: GameState, id: CharId): void {
  const row = s.knowledge[id] ?? {};
  const options = Object.entries(row)
    .filter(([sid, k]) => !k.lie && k.credence >= 55 && s.secrets[sid]?.truth && !s.secrets[sid].guilty.includes(id))
    .map(([sid]) => s.secrets[sid])
    .filter((sec) => sec.guilty.some((g) => isAlive(s, g)) && (sec.treason || sec.kind === 'theft' || sec.kind === 'slander'))
    .sort((a, b) => hate(s, id, b) - hate(s, id, a));
  if (!options.length || !chance(s, 55)) return;
  const sec = options[0];
  publish(s, sec.id, 45, 'rumour');
  log(
    s,
    `On the scaffold, ${nm(s, id)} cried out: “${sec.text} Ask them! Ask them before you cheer!”`,
    'all',
    'dire',
    [id, ...sec.guilty],
  );
}

const hate = (s: GameState, who: CharId, sec: Secret) =>
  -sec.guilty.reduce((m, g) => Math.min(m, opinion(s, who, g)), 100);

// ── Accusations ─────────────────────────────────────────────────────────────

export interface CaseRead {
  accused: CharId;
  secretId: SecretId;
  score: number;
  notes: string[];
  witnessesFor: CharId[];
  witnessesAgainst: CharId[];
}

/** How a charge against one man is likely to go, before the dice. */
export function readCase(s: GameState, accuser: CharId, secretId: SecretId, accused: CharId, plot?: Plot): CaseRead {
  const K = s.king!;
  const king = ch(s, K);
  const sec = s.secrets[secretId];
  const A = ch(s, accused);
  const notes: string[] = [];
  let score = sec.evidence * 0.5;
  notes.push(`Proof: ${Math.round(sec.evidence * 0.5)}`);
  if (plot) {
    score += plot.progress * 0.2;
    notes.push(`Preparation: +${Math.round(plot.progress * 0.2)}`);
  }
  const prior = credence(s, K, secretId);
  if (prior) {
    score += prior * 0.25;
    notes.push(`The King already suspects: +${Math.round(prior * 0.25)}`);
  }
  const accuserStanding = opinion(s, K, accuser) * 0.2 + (trust(s, K, accuser) - 40) * 0.2;
  score += accuserStanding;
  notes.push(`${first(s, accuser)}'s standing with the King: ${signed(accuserStanding)}`);
  const accusedStanding = -opinion(s, K, accused) * 0.2;
  score += accusedStanding;
  notes.push(`${first(s, accused)}'s standing with the King: ${signed(accusedStanding)}`);
  const para = (king.traits.paranoia - 50) * 0.3;
  score += para;
  if (Math.abs(para) >= 1) notes.push(`The King's suspicion: ${signed(para)}`);
  score += sec.treason ? 5 : -10;

  const witnessesFor: CharId[] = [];
  const witnessesAgainst: CharId[] = [];
  let forBonus = 0;
  let againstBonus = 0;
  for (const w of s.order) {
    if (w === accuser || w === accused || w === K || !isFree(s, w)) continue;
    const k = s.knowledge[w]?.[secretId];
    const inPlot = plot && plot.members.some((m) => m.id === w);
    if (inPlot) {
      witnessesFor.push(w);
      forBonus += 9;
      continue;
    }
    if (sec.guilty.includes(w)) {
      witnessesAgainst.push(w);
      againstBonus += 4;
      continue;
    }
    // Speaking up means admitting you knew. Only duty or hatred makes a man do it.
    const W = ch(s, w);
    if (k && (k.lie || k.credence >= 60) && (W.traits.honor >= 60 || opinion(s, w, accused) <= -30)) {
      witnessesFor.push(w);
      forBonus += 5;
      continue;
    }
    if (opinion(s, w, accused) >= 30 && (!k || k.credence < 50)) {
      witnessesAgainst.push(w);
      againstBonus += 5;
    }
  }
  score += Math.min(18, forBonus) - Math.min(15, againstBonus);
  if (witnessesFor.length) notes.push(`Witnesses for the charge: ${names(s, witnessesFor, true)}`);
  if (witnessesAgainst.length) notes.push(`Voices for the accused: ${names(s, witnessesAgainst, true)}`);

  const defence = (A.traits.charm + A.traits.cunning) * 0.08;
  score -= defence;
  notes.push(`${first(s, accused)}'s defence: -${Math.round(defence)}`);
  if (officeOf(s, accused) === 'marshal') {
    score -= 8;
    notes.push('The King is wary of striking at his own general: -8');
  }
  // A guilty man sweats; an innocent one is indignant.
  score += sec.truth ? 4 : -4;
  return { accused, secretId, score: Math.round(score), notes, witnessesFor, witnessesAgainst };
}

const signed = (v: number) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);

/** Case scores at which the King acts. */
export const TREASON_EXECUTE = 80;
export const TREASON_IMPRISON = 48;
export const CRIME_GUILTY = 58;

export type VerdictKind = 'execute' | 'imprison' | 'disgrace' | 'dismiss';

export function verdictFor(s: GameState, sec: Secret, score: number): VerdictKind {
  const king = ch(s, s.king!);
  if (sec.treason) {
    if (score >= TREASON_EXECUTE) return king.traits.wrath >= 45 ? 'execute' : 'imprison';
    if (score >= TREASON_IMPRISON) return 'imprison';
    return 'dismiss';
  }
  return score >= CRIME_GUILTY ? 'disgrace' : 'dismiss';
}

/** Chance the King's people see through a forgery when it is laid before him. */
export function forgeryDetection(s: GameState, sec: Secret): number {
  if (sec.truth || !s.king) return 0;
  const king = ch(s, s.king);
  const spy = s.offices.spymaster;
  const spyHelps = spy && spy !== sec.fabricatedBy && isFree(s, spy) ? 12 : 0;
  const forger = sec.fabricatedBy ? ch(s, sec.fabricatedBy).traits.cunning : 50;
  return clamp(Math.round(12 + king.traits.cunning * 0.3 + spyHelps - forger * 0.25 - sec.evidence * 0.15), 3, 80);
}

export interface Judgment {
  accused: CharId;
  secretId: SecretId;
  verdict: VerdictKind;
  score: number;
  forgeryFound: boolean;
}

/** People an accuser would never name: a spouse, or a fellow member of their own schemes. */
export function shields(s: GameState, accuser: CharId): CharId[] {
  const out = new Set<CharId>();
  const sp = s.chars[accuser]?.spouse;
  if (sp) out.add(sp);
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active' || p.owner !== accuser) continue;
    for (const m of p.members) out.add(m.id);
  }
  return [...out];
}

/** Charges a denunciation can bring against particular people. */
export function chargesFor(
  s: GameState,
  accuser: CharId,
  secretIds: SecretId[],
  only?: CharId[],
): { secretId: SecretId; accused: CharId }[] {
  const out: { secretId: SecretId; accused: CharId }[] = [];
  const spared = shields(s, accuser);
  for (const sid of secretIds) {
    const sec = s.secrets[sid];
    if (!sec) continue;
    for (const g of sec.guilty) {
      if (g === accuser || g === s.king || !isFree(s, g) || spared.includes(g)) continue;
      if (only && !only.includes(g)) continue;
      if (out.some((o) => o.accused === g)) continue;
      out.push({ secretId: sid, accused: g });
    }
  }
  return out;
}

/** Roll the dice on a set of charges (King is an NPC). */
export function rollJudgments(
  s: GameState,
  accuser: CharId,
  secretIds: SecretId[],
  plot?: Plot,
  bonus: Record<CharId, number> = {},
  only?: CharId[],
): Judgment[] {
  const out: Judgment[] = [];
  const caught = new Set<SecretId>();
  for (const { secretId, accused } of chargesFor(s, accuser, secretIds, only)) {
    const sec = s.secrets[secretId];
    let forgeryFound = caught.has(secretId);
    if (!sec.truth && !forgeryFound && chance(s, forgeryDetection(s, sec))) {
      forgeryFound = true;
      caught.add(secretId);
    }
    const read = readCase(s, accuser, secretId, accused, plot);
    const score = read.score + roll(s, -12, 12) + (bonus[accused] ?? 0);
    out.push({ accused, secretId, score, forgeryFound, verdict: forgeryFound ? 'dismiss' : verdictFor(s, sec, score) });
  }
  return out;
}

/** Carry out judgments and narrate them. Returns a one-line summary for the accuser. */
export function applyJudgments(s: GameState, accuser: CharId, judgments: Judgment[]): string {
  const K = s.king!;
  const lines: string[] = [];
  const forged = new Set<SecretId>();
  for (const j of judgments) {
    const sec = s.secrets[j.secretId];
    learn(s, K, j.secretId, clamp(j.score, 0, 100), accuser);
    addMod(s, j.accused, accuser, 'denounced', 'Denounced me to the King', -40);
    if (j.forgeryFound) {
      forged.add(j.secretId);
      continue;
    }
    switch (j.verdict) {
      case 'execute':
        addMod(s, K, accuser, 'unmasked', 'Unmasked a traitor', 15, 1);
        execute(s, j.accused, crimeName(sec));
        lines.push(`${first(s, j.accused)} executed`);
        break;
      case 'imprison':
        addMod(s, K, accuser, 'unmasked', 'Unmasked a traitor', 8, 1);
        imprison(s, j.accused, [j.secretId], accuser);
        log(s, `${nm(s, j.accused)} was seized by the Guard and taken to the Tower to be questioned.`, 'all', 'court', [j.accused]);
        lines.push(`${first(s, j.accused)} imprisoned`);
        break;
      case 'disgrace':
        disgrace(s, j.accused, sec);
        lines.push(`${first(s, j.accused)} disgraced`);
        break;
      case 'dismiss':
        addMod(s, K, accuser, 'baseless', 'Brought me baseless charges', j.score < 25 ? -15 : -8, 0.5);
        addMod(s, K, j.accused, 'accused', 'Accused of treason', j.score >= 35 ? -10 : -3, 1);
        log(s, `The King heard the charge against ${nm(s, j.accused)} and dismissed it. ${He(s, accuser)} left the hall with fewer friends.`, 'all', 'court', [accuser, j.accused]);
        lines.push(`charge against ${first(s, j.accused)} dismissed`);
        break;
    }
  }
  for (const sid of forged) {
    const sec = s.secrets[sid];
    exposeForgery(s, sec, accuser);
    lines.push('the letters were exposed as forgeries');
  }
  return lines.join('; ');
}

export function crimeName(sec: Secret): string {
  switch (sec.kind) {
    case 'regicide':
    case 'pact':
      return 'plotting the King’s murder';
    case 'usurpation':
      return 'conspiring to usurp the crown';
    case 'concealment':
      return 'concealing treason from the King';
    case 'murder':
      return 'conspiracy to murder';
    case 'theft':
      return 'forgery and theft of an inheritance';
    case 'slander':
      return 'bearing false witness';
    case 'betrayal':
      return 'conspiracy';
    case 'ruin':
      return 'malicious conspiracy';
    case 'affair':
      return 'adultery against the crown';
  }
}

/** Non-capital guilt: stripped of office, fined, and stolen lands returned. */
export function disgrace(s: GameState, id: CharId, sec: Secret): void {
  const c = ch(s, id);
  const off = vacate(s, id);
  const fine = Math.floor(c.gold / 2);
  c.gold -= fine;
  if (s.king) ch(s, s.king).gold += fine;
  c.prestige = Math.max(0, c.prestige - 20);
  if (s.king) addMod(s, s.king, id, 'disgraced', `Found guilty of ${crimeName(sec)}`, -35, 0.5);
  let restored = '';
  if (sec.kind === 'theft') {
    for (const land of Object.values(s.lands)) {
      if (land.holder === id && land.rightful && sec.victims.includes(land.rightful) && isAlive(s, land.rightful)) {
        land.holder = land.rightful;
        restored += ` ${land.name} was restored to ${nm(s, land.rightful)}.`;
        for (const v of sec.victims) addMod(s, v, s.king!, 'justice', 'Gave me justice', 25, 0.5);
      }
    }
  }
  sec.exposed = true;
  publish(s, sec.id, 85, 'court');
  log(
    s,
    `${nm(s, id)} was found guilty of ${crimeName(sec)}${off ? `, stripped of the office of ${OFFICE_NAMES[off]}` : ''} and fined ${fine} crowns.${restored}`,
    'all',
    'court',
    [id],
  );
}

/** A forgery comes to light: the forger is disgraced, the accused cleared. */
export function exposeForgery(s: GameState, sec: Secret, accuser: CharId): void {
  const K = s.king;
  if (!K) return;
  const k = s.knowledge[K]?.[sec.id];
  if (k) k.credence = Math.min(k.credence, 5);
  else learn(s, K, sec.id, 5, 'court');
  for (const g of sec.guilty) {
    const rec = s.imprisoned[g];
    if (rec && rec.charges.every((c) => c === sec.id || credence(s, K, c) < 40)) release(s, g, 'the letters against them were forged');
  }
  const forger = sec.fabricatedBy;
  if (!forger) return;
  let slander = Object.values(s.secrets).find((x) => x.kind === 'slander' && x.guilty[0] === forger && sameSet(x.victims, sec.guilty));
  if (!slander) {
    slander = makeSecret(s, { kind: 'slander', guilty: [forger], victims: sec.guilty, truth: true, evidence: 70, treason: false });
  }
  slander.evidence = Math.max(slander.evidence, 70);
  publish(s, slander.id, 75, 'court');
  for (const v of sec.guilty) addMod(s, v, forger, 'forged', 'Forged evidence against me', -60);
  if (forger !== accuser) addMod(s, K, accuser, 'gullible', 'Repeated a forgery', -10, 0.5);
  log(
    s,
    `The King's clerks examined the letters against ${names(s, sec.guilty)} and found the seals counterfeit. ${forger === accuser ? `${nm(s, forger)} stood exposed as the forger.` : `The forgery was traced to ${nm(s, forger)}.`}`,
    'all',
    'dire',
    [forger, ...sec.guilty],
  );
  if (isFree(s, forger) && forger !== K) disgrace(s, forger, slander);
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// ── Questioning ─────────────────────────────────────────────────────────────

/** The Tower's questioners at work. Returns true if something came out. */
export function questionPrisoner(s: GameState, id: CharId): boolean {
  const rec = s.imprisoned[id];
  const K = s.king;
  if (!rec || !K) return false;
  const p = ch(s, id);
  const king = ch(s, K);
  rec.questioned++;
  let spoke = false;

  for (const sid of rec.charges) {
    const sec = s.secrets[sid];
    if (!sec) continue;
    if (sec.truth) {
      const pct = 5 + king.traits.wrath * 0.15 + (100 - p.traits.will) * 0.12 - p.traits.boldness * 0.1 + rec.questioned * 5;
      if (chance(s, pct)) {
        learn(s, K, sid, 100, 'confession');
        sec.exposed = true;
        log(s, `Under questioning in the Tower, ${nm(s, id)} confessed: “${sec.text}”`, 'all', 'dire', [id]);
        spoke = true;
      }
    } else {
      const anselm = s.offices.confessor && isFree(s, s.offices.confessor) ? 8 : 0;
      const pct = 10 + king.traits.cunning * 0.2 + p.traits.charm * 0.1 + rec.questioned * 8 + anselm;
      if (chance(s, pct)) {
        learn(s, K, sid, 5, 'court');
        s.knowledge[K][sid].credence = Math.min(s.knowledge[K][sid].credence, 10);
        log(s, `${nm(s, id)} held to ${his(s, id)} story through every question. The King began to doubt the charge.`, 'all', 'court', [id]);
        if (sec.fabricatedBy && chance(s, 50)) exposeForgery(s, sec, rec.accuser ?? sec.fabricatedBy);
        spoke = true;
      }
    }
  }

  // Name others, to buy mercy or settle scores — one name a week at most.
  const row = s.knowledge[id] ?? {};
  const guiltyHere = rec.charges.some((c) => s.secrets[c]?.truth);
  const tellable = Object.entries(row)
    .filter(([sid, k]) => !k.lie && k.credence >= 55 && s.secrets[sid] && !s.secrets[sid].guilty.includes(id))
    .map(([sid]) => s.secrets[sid])
    .filter((sec) => sec.treason && sec.guilty.some((g) => isFree(s, g) && g !== K) && credence(s, K, sec.id) < 70)
    .filter((sec) => hate(s, id, sec) >= 10 || guiltyHere)
    .sort((a, b) => hate(s, id, b) - hate(s, id, a));
  const sec = tellable[0];
  if (sec) {
    const pct = 15 + (100 - p.traits.will) * 0.15 + Math.max(0, hate(s, id, sec)) * 0.2 + rec.questioned * 4 + (guiltyHere ? 10 : 0);
    if (chance(s, pct)) {
      const cred = trust(s, K, id) * 0.3 + sec.evidence * 0.3 + 20;
      learn(s, K, sec.id, cred, id);
      log(s, `In the Tower, ${nm(s, id)} named names: “${sec.text}”`, [K, id], 'secret', [id, ...sec.guilty]);
      log(s, `Word leaked from the Tower that ${first(s, id)} has been talking to the questioners.`, 'all', 'court', [id]);
      spoke = true;
    }
  }
  return spoke;
}

/** An NPC king decides what to do with each prisoner. */
export function decidePrisoners(s: GameState): void {
  const K = s.king;
  if (!K || K === s.player) return;
  const king = ch(s, K);
  for (const id of Object.keys(s.imprisoned)) {
    const rec = s.imprisoned[id];
    if (!rec || ch(s, id).status !== 'imprisoned') continue;
    const secs = rec.charges.map((c) => s.secrets[c]).filter(Boolean);
    const best = secs.reduce((m, sec) => Math.max(m, credence(s, K, sec.id)), 0);
    const worst = secs.find((sec) => credence(s, K, sec.id) === best) ?? secs[0];
    // A favourite needs more proof before the King will kill him.
    const bar = 75 + Math.max(0, opinion(s, K, id)) * 0.3;
    if (best >= bar && worst) {
      if (worst.treason) execute(s, id, crimeName(worst));
      else {
        release(s, id, 'the King judged the crime unworthy of the axe');
        disgrace(s, id, worst);
      }
    } else if (best <= 30) {
      release(s, id, 'the King found no proof against them');
    } else if (rec.questioned >= 4) {
      if (best >= 65 && king.traits.wrath >= 60 && worst?.treason) execute(s, id, crimeName(worst));
      else if (best < 65) release(s, id, 'nothing more could be wrung from them');
    }
  }
}

/** The King summons a free man to answer questions. */
export function questionFree(s: GameState, target: CharId): { slipped: boolean; text: string } {
  const K = s.king!;
  const king = ch(s, K);
  const t = ch(s, target);
  const suspected = Object.entries(s.knowledge[K] ?? {})
    .filter(([sid, k]) => k.credence >= 25 && s.secrets[sid]?.guilty.includes(target))
    .map(([sid]) => s.secrets[sid]);
  addMod(s, target, K, 'questioned', 'Questioned me like a thief', -6, 0.5);
  if (!suspected.length) {
    return { slipped: false, text: `${nm(s, target)} answered every question with injured innocence.` };
  }
  const pct = clamp(25 + king.traits.cunning * 0.3 - t.traits.cunning * 0.3 + king.traits.paranoia * 0.1, 5, 85);
  const sec = suspected.sort((a, b) => credence(s, K, b.id) - credence(s, K, a.id))[0];
  if (sec.truth && chance(s, pct)) {
    learn(s, K, sec.id, credence(s, K, sec.id) + 25, 'court');
    return { slipped: true, text: `${nm(s, target)} stumbled over ${his(s, target)} answers. The King marked it.` };
  }
  const k = s.knowledge[K][sec.id];
  if (k && !k.lie) k.credence = Math.max(0, k.credence - 15);
  return { slipped: false, text: `${nm(s, target)} answered calmly. The King’s suspicion cooled a little.` };
}

// ── Offices ─────────────────────────────────────────────────────────────────

export function officeEligible(s: GameState, id: CharId, office: OfficeId): boolean {
  const c = ch(s, id);
  if (c.status !== 'free' || s.king === id || officeOf(s, id)) return false;
  if (office === 'confessor') return c.rank === 'clergy';
  return !['lady', 'clergy', 'queen', 'servant'].includes(c.rank);
}

export function appoint(s: GameState, id: CharId, office: OfficeId): void {
  s.offices[office] = id;
  const c = ch(s, id);
  c.prestige += 10;
  for (const pl of s.pledges) {
    if (pl.status === 'pending' && pl.to === id && pl.offer.kind === 'office' && pl.offer.office === office) {
      pl.status = 'kept';
      addMod(s, id, pl.from, 'pledge-kept', 'Kept his word to me', 20, 0.5);
    }
  }
  log(s, `${nm(s, id)} was named ${OFFICE_NAMES[office]}.`, 'all', 'good', [id]);
}

/** An NPC king fills empty offices. */
export function fillOffices(s: GameState): void {
  const K = s.king;
  if (!K || K === s.player) return;
  for (const office of Object.keys(s.offices) as OfficeId[]) {
    if (s.offices[office]) continue;
    const cands = s.order.filter((id) => officeEligible(s, id, office));
    if (!cands.length) continue;
    const score = (id: CharId) => {
      const c = ch(s, id);
      let v = opinion(s, K, id) + c.prestige * 0.4 + rand(s) * 10;
      if (c.rank === 'great' || c.rank === 'lord') v += 12;
      if (office === 'marshal' || office === 'captain') v += c.traits.martial * 0.3;
      if (office === 'spymaster') v += c.traits.cunning * 0.3;
      if (office === 'chancellor') v += c.traits.cunning * 0.15 + c.traits.charm * 0.15;
      // A king honours the pledges that put him on the throne.
      if (s.pledges.some((p) => p.status === 'pending' && p.from === K && p.to === id && p.offer.office === office)) {
        v += ch(s, K).traits.honor * 0.8;
      }
      return v;
    };
    const best = cands.sort((a, b) => score(b) - score(a))[0];
    appoint(s, best, office);
  }
}

// ── Succession ──────────────────────────────────────────────────────────────

export function claimants(s: GameState): CharId[] {
  return s.order.filter((id) => {
    const c = ch(s, id);
    if (c.status !== 'free' || !c.canClaim) return false;
    // A man the whole court believes to be the regicide cannot be acclaimed.
    const proven = Object.values(s.secrets).some(
      (sec) => sec.exposed && sec.truth && (sec.kind === 'regicide' || sec.kind === 'murder') && sec.guilty.includes(id) && sec.victims.some((v) => ch(s, v).rank === 'king'),
    );
    return !proven;
  });
}

export function electorWeight(s: GameState, id: CharId): number {
  return Math.round((1 + ch(s, id).prestige / 25) * 10) / 10;
}

export function preferredCandidate(s: GameState, elector: CharId, cands: CharId[], noise = true): CharId {
  const e = ch(s, elector);
  const score = (cand: CharId) => {
    if (cand === elector) return 1000;
    const c = ch(s, cand);
    let v = opinion(s, elector, cand) + c.prestige * 0.25;
    if (e.spouse === cand) v += 120;
    if (e.siblings.includes(cand)) v += 15;
    for (const p of Object.values(s.plots)) {
      if (p.owner === cand && p.members.some((m) => m.id === elector && m.sincere)) v += 30;
    }
    if (s.pledges.some((pl) => pl.status === 'pending' && pl.from === cand && pl.to === elector)) v += 20;
    for (const [sid, k] of Object.entries(s.knowledge[elector] ?? {})) {
      const sec = s.secrets[sid];
      if (!k.lie && k.credence >= 50 && sec?.guilty.includes(cand) && sec.treason) v -= 40;
    }
    return v + (noise ? rand(s) * 8 : 0);
  };
  return cands.slice().sort((a, b) => score(b) - score(a))[0];
}

/** How the Witan would vote if it met today. Pure: safe to call from the UI. */
export function witanForecast(s: GameState): { id: CharId; votes: number }[] {
  const cands = claimants(s);
  if (!cands.length) return [];
  const tally = new Map<CharId, number>(cands.map((c) => [c, 0]));
  for (const id of s.order) {
    if (!isFree(s, id) || ch(s, id).rank === 'servant') continue;
    const vote = id === s.player ? s.player : preferredCandidate(s, id, cands, false);
    if (!tally.has(vote)) continue;
    tally.set(vote, (tally.get(vote) ?? 0) + electorWeight(s, id));
  }
  return [...tally.entries()].map(([id, votes]) => ({ id, votes: Math.round(votes * 10) / 10 })).sort((a, b) => b.votes - a.votes);
}

export interface WitanResult {
  winner: CharId | null;
  tally: { id: CharId; votes: number }[];
}

export function holdWitan(s: GameState, playerVote?: CharId): WitanResult {
  const cands = claimants(s);
  if (!cands.length) {
    log(s, 'The Witan met, but no lord with a claim stood free to take the crown. The realm drifts without a king.', 'all', 'dire');
    return { winner: null, tally: [] };
  }
  const tally = new Map<CharId, number>(cands.map((c) => [c, 0]));
  for (const id of s.order) {
    if (!isFree(s, id) || ch(s, id).rank === 'servant') continue;
    const vote = id === s.player && playerVote && cands.includes(playerVote) ? playerVote : preferredCandidate(s, id, cands);
    tally.set(vote, (tally.get(vote) ?? 0) + electorWeight(s, id));
  }
  const ranked = [...tally.entries()].map(([id, votes]) => ({ id, votes: Math.round(votes * 10) / 10 })).sort((a, b) => b.votes - a.votes);
  const winner = ranked[0].id;
  crown(s, winner);
  log(
    s,
    `The Witan acclaimed ${nm(s, winner)} King of Wendmere. (${ranked.map((r) => `${first(s, r.id)} ${r.votes}`).join(', ')})`,
    'all',
    'court',
    [winner],
  );
  return { winner, tally: ranked };
}

export function crown(s: GameState, id: CharId): void {
  const c = ch(s, id);
  vacate(s, id);
  c.rank = 'king';
  c.prestige += 30;
  s.king = id;
  s.interregnum = null;
  if (c.spouse && isAlive(s, c.spouse)) ch(s, c.spouse).rank = 'queen';
  if (id !== s.player) {
    c.agenda = { kind: 'keep-crown', targets: [], summary: 'Hold the crown he has taken.' };
  }
  for (const other of s.order) {
    if (other !== id && isAlive(s, other)) addMod(s, other, id, 'liege', 'Sworn liege', 10, 0, true);
  }
  for (const sec of Object.values(s.secrets)) refreshText(s, sec);
  // A regicide already in chains is dealt with by the new king.
  for (const pid of Object.keys(s.imprisoned)) {
    const rec = s.imprisoned[pid];
    const regicide = rec.charges.map((x) => s.secrets[x]).find((sec) => sec?.kind === 'regicide' && sec.exposed);
    if (regicide && id !== s.player) execute(s, pid, 'the murder of the late King');
  }
}
