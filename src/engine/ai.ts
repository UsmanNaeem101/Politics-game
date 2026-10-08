// How the other souls at court decide what to do with their week.
//
// Each NPC scores every deed open to it by its hidden agenda, its temperament
// (as bent by a spouse's pressure), and what it believes. It then picks among
// the best few, so the same court can play out differently on another seed.

import {
  COST,
  check,
  complianceOdds,
  denounceOdds,
  directiveIntent,
  perform,
  petitionOdds,
  recruitOdds,
  type Intent,
} from './actions';
import { canStrike, isMember, strikeChance, waitCleared } from './plots';
import { chance, rand } from './rng';
import { secretsAgainst, threatsTo } from './secrets';
import { claimants } from './court';
import {
  addMod,
  adjustTrust,
  ch,
  isServant,
  log,
  credence,
  effective,
  isFree,
  knows,
  knowsAgenda,
  opinion,
  officeOf,
  trust,
} from './world';
import type { CharId, GameState, Offer, Plot } from './types';

interface Candidate {
  intent: Intent;
  u: number;
}

const DELEGATED_UNTIL = 4;

/** How badly `me` wants `g` gone. */
export function desire(s: GameState, me: CharId, g: CharId): number {
  if (g === me) return 0;
  const c = ch(s, me);
  let d = Math.max(0, -opinion(s, me, g)) * 0.4;
  if (c.agenda.targets.includes(g)) d += 35;
  if (c.agenda.kind === 'rise' && officeOf(s, g)) d += 12;
  if (threatsTo(s, me, me, 50).some((sec) => sec.guilty.includes(g))) d += 30;
  if (c.agenda.kind === 'crown' && g === s.king) d += 15;
  if (c.spouse === g) d -= 80;
  if (c.siblings.includes(g) && opinion(s, me, g) > 0) d -= 40;
  if (Object.values(s.plots).some((p) => p.status === 'active' && p.owner === g && p.members.some((m) => m.id === me && m.sincere))) d -= 30;
  return d;
}

/** Waiting on purpose: a plot of mine against g is not ready to be sprung. */
function biding(s: GameState, me: CharId, g: CharId): boolean {
  return Object.values(s.plots).some(
    (p) => p.status === 'active' && isMember(p, me) && p.targets.includes(g) && p.kind === 'murder' && !waitCleared(s, p),
  );
}

/** Ruin plots whose charge is meant to be carried by a member, early on. */
function delegated(s: GameState, p: Plot): boolean {
  return s.turn < DELEGATED_UNTIL && p.members.some((m) => m.role.toLowerCase().includes('carry') && isFree(s, m.id));
}

function bestOffer(s: GameState, owner: CharId, cand: CharId, p: Plot): Offer {
  const o = ch(s, owner);
  const C = ch(s, cand);
  const rightful = Object.values(s.lands).find((l) => l.holder === owner && l.rightful === cand);
  if (rightful) return { kind: 'restitution', landId: rightful.id };
  if (o.agenda.kind === 'crown' && C.traits.ambition >= 50) {
    const office = (['marshal', 'chancellor', 'spymaster'] as const).find((x) => s.offices[x] !== cand);
    if (office) return { kind: 'office', office };
  }
  if (o.gold >= 60 && C.traits.greed >= 50) return { kind: 'gold', amount: 40 };
  if (p.targets.some((t) => opinion(s, cand, t) <= -20)) return { kind: 'vengeance' };
  return o.gold >= 30 ? { kind: 'gold', amount: 25 } : { kind: 'none' };
}

export function candidates(s: GameState, me: CharId): Candidate[] {
  const c = ch(s, me);
  const E = effective(s, me);
  const out: Candidate[] = [];
  const add = (intent: Intent, u: number) => out.push({ intent, u });
  const others = s.order.filter((id) => id !== me && isFree(s, id) && !isServant(s, id));
  const king = s.king;
  const myRow = s.knowledge[me] ?? {};

  if (c.status === 'imprisoned') {
    const charges = s.imprisoned[me]?.charges ?? [];
    const doom = king ? charges.reduce((m, x) => Math.max(m, credence(s, king, x)), 0) : 0;
    add({ type: 'escape' }, 10 + doom * 0.4 + E.boldness * 0.1);
    if (c.spouse && isFree(s, c.spouse)) {
      // Ask the spouse, by letter, to plead.
      const sec = charges.find((x) => s.secrets[x] && !s.secrets[x].truth);
      if (sec) add({ type: 'whisper', target: c.spouse, secretId: sec }, 5);
    }
    return out;
  }

  // ── A spouse's demand ─────────────────────────────────────────────────────
  const dir = s.directives[me];
  if (dir && dir.until >= s.turn) {
    if (dir.obeys === undefined) dir.obeys = chance(s, complianceOdds(s, dir.by, me));
    if (dir.obeys) {
      const it = directiveIntent(s, me, dir);
      if (it) add(it, 95);
    }
  }

  // ── The King's business ──────────────────────────────────────────────────
  if (king === me) {
    for (const g of others) {
      const belief = Object.entries(myRow)
        .filter(([sid, k]) => !k.lie && s.secrets[sid]?.guilty.includes(g) && s.secrets[sid].treason)
        .reduce((m, [, k]) => Math.max(m, k.credence), 0);
      const bar = 70 + Math.max(0, opinion(s, me, g)) * 0.3;
      if (belief >= bar) add({ type: 'arrest', target: g }, 45 + c.traits.paranoia * 0.3 + belief * 0.2);
      else if (belief >= 30) add({ type: 'question', target: g }, 14 + c.traits.paranoia * 0.2 + belief * 0.2);
    }
    if (threatsTo(s, me, me, 40).length && c.gold >= 20 && c.guard < 30) add({ type: 'guard' }, 25 + c.traits.paranoia * 0.1);
    const favourite = others.slice().sort((a, b) => opinion(s, me, b) - opinion(s, me, a))[0];
    if (favourite) add({ type: 'converse', target: favourite }, 6);
    const suspect = others
      .map((g) => ({ g, d: Object.entries(myRow).filter(([sid, k]) => !k.lie && k.credence >= 15 && s.secrets[sid]?.guilty.includes(g)).length }))
      .sort((a, b) => b.d - a.d)[0];
    if (suspect?.d && !s.relations[suspect.g]?.[me]?.mods.some((m) => m.key === 'spied')) {
      add({ type: 'spy', target: suspect.g, focus: 'schemes' }, 5 + c.traits.cunning * 0.05 + suspect.d * 1.5);
    }
    return out;
  }

  // ── Own schemes ───────────────────────────────────────────────────────────
  for (const p of Object.values(s.plots)) {
    if (p.status !== 'active') continue;
    const mine = p.owner === me;
    const member = p.members.find((m) => m.id === me);
    if (!mine && !member) continue;
    if (member && !member.sincere) continue; // a traitor does not labour for the plot
    const ready = waitCleared(s, p);
    const target = p.targets[0];
    if (p.kind === 'murder') {
      if (mine && ready && canStrike(s, p).ok) {
        const sc = strikeChance(s, p);
        const threat = threatsTo(s, me, me, 50).some((sec) => sec.guilty.includes(target)) ? 25 : 0;
        add({ type: 'strike', plotId: p.id }, sc - (100 - E.boldness) * 0.6 + E.ambition * 0.15 + threat);
      }
      // Sharpening a knife you cannot yet use only leaves a trail.
      const prep = ready ? 26 + E.ambition * 0.12 - (p.progress >= 85 ? 16 : 0) : 8 + E.ambition * 0.08 - (p.progress >= 40 ? 10 : 0);
      add({ type: 'advance', plotId: p.id, gold: mine && c.gold >= 60 && p.hiredBlades < 3 ? 20 : 0 }, prep);
    } else if (mine) {
      if (ready && p.progress >= 30) {
        const odds = denounceOdds(s, me, { type: 'denounce', plotId: p.id });
        if (odds.length) {
          const est = odds.reduce((m, o) => m + o.pct, 0) / odds.length;
          const want = odds.reduce((m, o) => m + desire(s, me, o.accused), 0) / odds.length;
          let u = want * 0.4 + (est - (100 - E.boldness) * 0.5) * 0.6 + (p.progress >= 50 ? 10 : 0);
          if (delegated(s, p)) u -= 30;
          add({ type: 'denounce', plotId: p.id }, u);
        }
      }
      add({ type: 'advance', plotId: p.id, gold: 0 }, 16 + E.ambition * 0.1 + (p.progress < 50 ? 8 : 0) - (p.progress >= 80 ? 14 : 0));
    }
    if (mine && p.members.length < 3 && p.progress >= 15) {
      for (const cand of others) {
        if (isMember(p, cand) || p.targets.includes(cand) || cand === king) continue;
        if (ch(s, cand).agenda.kind === 'peace') continue;
        // A conspirator only approaches people he trusts not to run to the King.
        const faith = opinion(s, me, cand) * 0.2 + (trust(s, me, cand) - 40) * 0.25;
        if (opinion(s, me, cand) < 0 || faith < 5) continue;
        const offer = bestOffer(s, me, cand, p);
        const odds = recruitOdds(s, me, cand, p, offer);
        if (odds < 55) continue;
        add({ type: 'recruit', target: cand, plotId: p.id, offer }, 6 + odds * 0.15 + faith - ch(s, cand).traits.honor * 0.08);
      }
    }
  }

  // ── Denunciation with what one knows ──────────────────────────────────────
  if (king && !s.interregnum) {
    for (const [sid, k] of Object.entries(myRow)) {
      const sec = s.secrets[sid];
      if (!sec || sec.guilty.includes(me)) continue;
      if (!k.lie && k.credence < 50) continue;
      if (!(sec.treason || sec.kind === 'theft' || sec.kind === 'slander' || sec.kind === 'murder')) continue;
      const odds = denounceOdds(s, me, { type: 'denounce', secretId: sid }).filter((o) => desire(s, me, o.accused) > -10);
      if (!odds.length) continue;
      for (const o of odds) {
        let want = desire(s, me, o.accused);
        if (sec.treason && sec.victims.includes(king)) {
          if (c.agenda.kind === 'protect-king') want += 30 + k.credence * 0.3;
          if (c.traits.honor >= 60) want += 10;
        }
        if (biding(s, me, o.accused)) want -= 40;
        // A traitor's lands go to the crown. An heir wants him dead some other way.
        if (sec.treason && Object.values(s.lands).some((l) => l.holder === o.accused && (l.rightful === me || c.siblings.includes(o.accused)))) want -= 30;
        if (Object.values(s.plots).some((p) => p.status === 'active' && p.owner === me && p.kind === 'ruin' && p.targets.includes(o.accused))) {
          want -= 10 + c.traits.cunning * 0.25;
          if (Object.values(s.plots).some((p) => p.owner === me && p.targets.includes(o.accused) && delegated(s, p))) want -= 30;
        }
        if (want <= 10 || o.pct < 25) continue;
        add({ type: 'denounce', secretId: sid, only: [o.accused] }, want * 0.45 + (o.pct - (100 - E.boldness) * 0.55) * 0.5);
      }
    }
  }

  // ── Whispers ──────────────────────────────────────────────────────────────
  for (const [sid, k] of Object.entries(myRow)) {
    const sec = s.secrets[sid];
    if (!sec || sec.guilty.includes(me)) continue;
    if (!k.lie && k.credence < 50) continue;
    if (sec.plotId && s.plots[sec.plotId]?.status !== 'active' && !sec.treason) continue;
    if (k.lie && c.traits.honor >= 60) continue;
    const protects = sec.guilty.some((g) => c.spouse === g || (c.siblings.includes(g) && opinion(s, me, g) > 0) || desire(s, me, g) < -10);
    if (protects) continue;
    const want = Math.max(...sec.guilty.map((g) => desire(s, me, g)));
    const anyBiding = sec.guilty.some((g) => biding(s, me, g));
    for (const l of others) {
      if (sec.guilty.includes(l)) continue;
      // Once told is told: repeating a tale does not make it truer.
      if (knows(s, l, sid)) continue;
      let u = 0;
      if (sec.victims.includes(l) && !k.lie && !anyBiding) {
        if (opinion(s, me, l) >= 15 || c.agenda.kind === 'peace' || (l === king && c.agenda.kind === 'protect-king')) {
          u = 16 + opinion(s, me, l) * 0.3 + c.traits.honor * 0.15 + (c.agenda.kind === 'peace' ? 15 : 0);
        }
      }
      if (l === king && sec.treason && (want >= 25 || c.agenda.kind === 'protect-king' || c.traits.honor >= 60)) {
        let v = want * 0.3 + c.traits.honor * 0.1 + (100 - E.boldness) * 0.08;
        if (c.agenda.kind === 'protect-king') v += 30;
        if (anyBiding) v -= 25;
        if (sec.guilty.some((g) => Object.values(s.plots).some((p) => p.owner === me && p.targets.includes(g) && delegated(s, p)))) v -= 30;
        u = Math.max(u, v);
      }
      const theirHate = Math.min(...sec.guilty.map((g) => opinion(s, l, g)));
      if (theirHate <= -15 && want >= 30 && !anyBiding) {
        u = Math.max(u, want * 0.25 - theirHate * 0.15 + (k.lie ? (100 - c.traits.honor) * 0.1 - 5 : 0));
      }
      if (u > 0) add({ type: 'whisper', target: l, secretId: sid }, u);
    }
  }

  // ── Forgery ───────────────────────────────────────────────────────────────
  if (king && c.traits.honor < 50 && c.traits.cunning >= 50) {
    for (const g of others) {
      if (g === king) continue;
      const want = desire(s, me, g);
      if (want < 40) continue;
      const have = secretsAgainst(s, g, me, 50).some((x) => x.treason);
      if (have) continue;
      add({ type: 'fabricate', kind: 'regicide', guilty: [g], victim: king }, want * 0.3 + c.traits.cunning * 0.1 - c.traits.honor * 0.2);
    }
  }

  // ── New schemes ───────────────────────────────────────────────────────────
  const myPlots = Object.values(s.plots).filter((p) => p.status === 'active' && p.owner === me);
  // Only a man with standing reaches for the King's life; small fry climb first.
  const standing = c.rank === 'great' || !!officeOf(s, me) || c.prestige >= 45;
  if (king && c.agenda.kind === 'crown' && standing && !myPlots.some((p) => p.kind === 'murder' && p.targets.includes(king))) {
    add({ type: 'scheme', kind: 'murder', targets: [king], charges: [] }, E.ambition * 0.25 - c.traits.honor * 0.1 - 4);
  }
  for (const sec of threatsTo(s, me, me, 50)) {
    for (const g of sec.guilty) {
      if (!isFree(s, g) || g === king || myPlots.some((p) => p.targets.includes(g))) continue;
      add({ type: 'scheme', kind: 'murder', targets: [g], charges: [] }, 12 + E.boldness * 0.2 + E.wrath * 0.15 - c.traits.honor * 0.2);
      add({ type: 'scheme', kind: 'ruin', targets: [g], charges: [sec.id] }, 14 + c.traits.cunning * 0.1 + c.traits.honor * 0.1);
    }
  }
  if (c.agenda.kind === 'destroy') {
    for (const g of c.agenda.targets) {
      if (!isFree(s, g) || myPlots.some((p) => p.targets.includes(g))) continue;
      const charge = secretsAgainst(s, g, me, 50).find((x) => x.treason || x.kind === 'theft' || x.kind === 'affair');
      if (charge) add({ type: 'scheme', kind: 'ruin', targets: [g], charges: [charge.id] }, 22);
      // No charge to bring: a hot, unscrupulous man reaches for a knife instead.
      else if (g !== king) add({ type: 'scheme', kind: 'murder', targets: [g], charges: [] }, desire(s, me, g) * 0.25 + E.wrath * 0.15 + E.boldness * 0.1 - c.traits.honor * 0.25);
    }
  }

  // ── Spies ─────────────────────────────────────────────────────────────────
  const interest = (g: CharId) =>
    desire(s, me, g) +
    (threatsTo(s, me, me, 25).some((sec) => sec.guilty.includes(g)) ? 25 : 0) +
    (g === king && c.agenda.kind === 'crown' ? 10 : 0) +
    (c.agenda.kind === 'protect-king' && Object.entries(myRow).some(([sid, k]) => !k.lie && k.credence >= 20 && s.secrets[sid]?.guilty.includes(g)) ? 30 : 0);
  const spyTarget = others
    .filter((g) => !knowsAgenda(s, me, g) && !s.relations[g]?.[me]?.mods.some((m) => m.key === 'spied'))
    .map((g) => ({ g, v: interest(g) }))
    .filter((x) => x.v > 5)
    .sort((a, b) => b.v - a.v)[0];
  if (spyTarget) {
    const u = 4 + c.traits.cunning * 0.1 + c.traits.paranoia * 0.06 + spyTarget.v * 0.2 + (officeOf(s, me) === 'spymaster' ? 8 : 0);
    add({ type: 'spy', target: spyTarget.g, focus: 'schemes' }, u);
  }

  // ── Spouse ────────────────────────────────────────────────────────────────
  const sp = c.spouse;
  if (sp && isFree(s, sp) && !s.directives[sp]) {
    const S = ch(s, sp);
    if (c.agenda.kind === 'raise-spouse') {
      add({ type: 'counsel', target: sp, mode: 'goad' }, 12 + (c.traits.ambition - 50) * 0.4 + (S.pressure < 50 ? 12 : -12));
      const ruin = Object.values(s.plots).find((p) => p.status === 'active' && p.owner === sp && p.kind === 'ruin');
      const kill = Object.values(s.plots).find((p) => p.status === 'active' && p.owner === sp && p.kind === 'murder' && waitCleared(s, p) && canStrike(s, p).ok);
      if (ruin && ruin.progress >= 35) add({ type: 'counsel', target: sp, mode: 'demand', directive: { kind: 'denounce', plotId: ruin.id } }, 24 + c.traits.will * 0.15);
      else if (ruin) add({ type: 'counsel', target: sp, mode: 'demand', directive: { kind: 'advance', plotId: ruin.id } }, 14);
      if (kill && strikeChance(s, kill) >= 45) add({ type: 'counsel', target: sp, mode: 'demand', directive: { kind: 'strike', plotId: kill.id } }, 26 + c.traits.will * 0.15);
    }
    if (c.agenda.kind === 'protect-spouse') {
      const danger = Object.entries(myRow).some(([sid, k]) => !k.lie && k.credence >= 30 && s.secrets[sid]?.guilty.includes(sp) && s.secrets[sid].treason);
      if (danger) {
        add({ type: 'counsel', target: sp, mode: 'restrain' }, 18 + c.traits.honor * 0.1 + (S.pressure > -30 ? 10 : -12));
        const theirs = Object.values(s.plots).find((p) => p.status === 'active' && p.owner === sp && credence(s, me, p.secretId) >= 50);
        if (theirs) add({ type: 'counsel', target: sp, mode: 'demand', directive: { kind: 'abandon', plotId: theirs.id } }, 20 + c.traits.will * 0.12);
      }
    }
  }

  // ── Petitions ─────────────────────────────────────────────────────────────
  const pestered = king ? (s.relations[king]?.[me]?.mods.find((m) => m.key === 'petitions')?.value ?? 0) <= -2 : true;
  if (king && !s.interregnum && !pestered) {
    const stolen = Object.values(s.lands).find((l) => l.rightful === me && l.holder !== me);
    if (stolen) {
      const holder = stolen.holder;
      const bide = holder ? biding(s, me, holder) : false;
      const odds = petitionOdds(s, me, { type: 'petition', kind: 'restitution' });
      const u = (holder && !isFree(s, holder)) || !holder ? 35 : bide ? 4 : 10 + odds * 0.2;
      add({ type: 'petition', kind: 'restitution' }, u);
    }
    for (const pid of Object.keys(s.imprisoned)) {
      if (ch(s, pid).status !== 'imprisoned') continue;
      let u = 0;
      if (c.agenda.kind === 'peace') u = 18 + Math.max(0, opinion(s, me, pid)) * 0.2;
      if (c.spouse === pid) u = 45;
      if (c.siblings.includes(pid) && opinion(s, me, pid) > 10) u = 25;
      if (u) add({ type: 'petition', kind: 'mercy', target: pid }, u);
    }
    for (const office of Object.keys(s.offices) as (keyof typeof s.offices)[]) {
      if (!s.offices[office] && c.traits.ambition >= 50) add({ type: 'petition', kind: 'office', office }, 12 + c.traits.ambition * 0.1);
    }
  }

  // ── Safety ───────────────────────────────────────────────────────────────
  const threats = threatsTo(s, me, me, 40);
  if (threats.length && c.gold >= 20 && c.guard < 30) add({ type: 'guard' }, 12 + c.traits.paranoia * 0.15);
  if (king) {
    const doom = Object.values(s.secrets)
      .filter((sec) => sec.guilty.includes(me) && sec.treason)
      .reduce((m, sec) => Math.max(m, credence(s, king, sec.id)), 0);
    if (doom >= 70 && chance(s, c.traits.paranoia * 0.6)) {
      const canKill = myPlots.some((p) => p.kind === 'murder' && p.targets.includes(king) && canStrike(s, p).ok && strikeChance(s, p) >= 40);
      add({ type: 'flee' }, 12 + c.traits.paranoia * 0.2 - E.boldness * 0.25 + (doom - 70) * 0.6 - (canKill ? 30 : 0));
    }
  }

  // ── Mending fences ───────────────────────────────────────────────────────
  if (c.agenda.kind === 'restitution') {
    const p = myPlots.find((x) => x.kind === 'murder');
    const whole = Object.values(s.lands).filter((l) => l.rightful === me).every((l) => l.holder === me);
    if (p && whole) add({ type: 'abandon', plotId: p.id }, 22 - c.traits.wrath * 0.2 + opinion(s, me, p.targets[0]) * 0.3);
  }
  const betrayers = Object.entries(myRow).filter(([sid, k]) => !k.lie && k.credence >= 50 && s.secrets[sid]?.kind === 'betrayal' && s.secrets[sid].victims.includes(me));
  if (betrayers.length) {
    const land = Object.values(s.lands).find((l) => l.holder === me && l.rightful && c.siblings.includes(l.rightful));
    if (land) add({ type: 'grant', target: land.rightful!, landId: land.id }, 10 + c.traits.paranoia * 0.15 - c.traits.greed * 0.15);
  }

  // ── Company and gifts ────────────────────────────────────────────────────
  const claimant = s.interregnum && claimants(s).includes(me);
  for (const l of others) {
    let v = 4 + c.traits.charm * 0.04;
    if (l === king) v += c.traits.ambition * 0.06;
    if (claimant) v += 14 + Math.max(0, -opinion(s, l, me)) * 0.1;
    if (c.spouse === l) v += 2;
    add({ type: 'converse', target: l }, v);
    if (c.gold >= 80 && (l === king || claimant)) add({ type: 'gift', target: l, amount: 25 }, v - 1);
  }

  return out;
}

function intentKey(it: Intent): string {
  return JSON.stringify(it);
}

function choose(s: GameState, cands: Candidate[]): Candidate | undefined {
  if (!cands.length) return undefined;
  const sorted = cands.slice().sort((a, b) => b.u - a.u);
  const top = sorted.slice(0, 3);
  const best = top[0].u;
  const weights = top.map((x) => Math.exp((x.u - best) / 6));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(s) * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}

/** One NPC's week. */
export function npcTurn(s: GameState, me: CharId): void {
  const c = ch(s, me);
  if (c.status === 'dead' || c.status === 'fled') return;
  let ap = c.status === 'imprisoned' ? 1 : 2;
  const done = new Set<string>();
  while (ap > 0 && s.phase === 'playing') {
    const status = ch(s, me).status;
    if (status === 'dead' || status === 'fled') return;
    const cands = candidates(s, me).filter(
      (x) => !done.has(intentKey(x.intent)) && COST[x.intent.type] <= Math.max(ap, 1) && check(s, me, x.intent) === null,
    );
    const pick = choose(s, cands);
    if (!pick || pick.u < 4) break;
    done.add(intentKey(pick.intent));
    perform(s, me, pick.intent);
    if (s.directives[me] && pick.u >= 95) delete s.directives[me];
    ap -= Math.max(1, COST[pick.intent.type]);
  }
}

/**
 * Motives move. A man whose enemy is dead looks higher; a widow wants blood;
 * a brother made whole may let a grudge go.
 */
export function evolveAgendas(s: GameState): void {
  reactToBetrayals(s);
  for (const id of s.order) {
    const c = ch(s, id);
    if (c.status !== 'free' || id === s.king) continue;
    const a = c.agenda;
    const truth = (text: string) => log(s, text, [], 'secret', [id]);
    if (a.kind === 'destroy' && a.targets.every((t) => !isFree(s, t))) {
      if (c.traits.ambition >= 55 && s.king) {
        c.agenda = { kind: 'crown', targets: [s.king], summary: 'With the old enemy gone, look higher: why should the crown sit on another head?' };
        truth(`${c.name} looked at the throne and wondered why he served at all.`);
      } else {
        c.agenda = { kind: 'peace', targets: [], summary: 'Keep what has been won, and keep out of the next quarrel.' };
      }
      continue;
    }
    if (a.kind === 'crown') {
      const targets = a.targets.filter((t) => isFree(s, t));
      if (s.king && s.king !== id && !targets.includes(s.king)) targets.push(s.king);
      a.targets = targets;
      continue;
    }
    if ((a.kind === 'protect-spouse' || a.kind === 'raise-spouse') && c.spouse && ch(s, c.spouse).status === 'dead') {
      const blame = s.order.filter((o) => o !== id && isFree(s, o) && s.relations[c.spouse!]?.[o]?.mods.some((m) => m.key === 'denounced' || m.key === 'tried-kill'));
      if (blame.length) {
        c.agenda = { kind: 'destroy', targets: blame, summary: `Avenge ${ch(s, c.spouse).short}.` };
        for (const b of blame) addMod(s, id, b, 'widowed', 'Destroyed my husband', -60);
        truth(`${c.name} put on black and swore that ${blame.map((b) => ch(s, b).short).join(' and ')} would pay.`);
      } else {
        c.agenda = { kind: 'peace', targets: [], summary: 'Survive widowhood.' };
      }
      continue;
    }
    if (a.kind === 'rise' && officeOf(s, id) && c.traits.ambition >= 70 && s.king && chance(s, 5)) {
      c.agenda = { kind: 'crown', targets: [s.king], summary: 'An office was not enough. Why not the throne?' };
      truth(`${c.name} sat in his new office and began to look at the throne.`);
      continue;
    }
    if (a.kind === 'restitution') {
      const whole = Object.values(s.lands).filter((l) => l.rightful === id).every((l) => l.holder === id);
      if (whole && c.traits.wrath < 60 && opinion(s, id, a.targets[0] ?? id) > -20) {
        c.agenda = { kind: 'peace', targets: [], summary: 'He has his land back. Let the rest go.' };
        truth(`${c.name} walked his own fields again, and let the old grudge go.`);
      } else if (a.targets.every((t) => !isFree(s, t)) && whole) {
        c.agenda = { kind: 'peace', targets: [], summary: 'Justice is done. Keep the land.' };
      }
    }
  }
}

/** A husband who learns of his wife's lover turns on them both. */
function reactToBetrayals(s: GameState): void {
  for (const sec of Object.values(s.secrets)) {
    if (sec.kind !== 'affair' || !sec.truth) continue;
    for (const v of sec.victims) {
      if (!isFree(s, v) || credence(s, v, sec.id) < 60) continue;
      const r = s.relations[v]?.[sec.guilty[1]];
      if (r?.mods.some((m) => m.key === 'cuckold')) continue;
      const [wife, lover] = sec.guilty;
      addMod(s, v, lover, 'cuckold', 'Lies with my wife', -60);
      addMod(s, v, wife, 'faithless', 'Faithless', -40);
      adjustTrust(s, v, wife, -50);
      const c = ch(s, v);
      if (v !== s.player && c.traits.wrath >= 45 && isFree(s, lover) && c.agenda.kind !== 'keep-crown') {
        c.agenda = { kind: 'destroy', targets: [lover], summary: `Destroy ${ch(s, lover).short}, who shamed him.` };
      }
      log(s, `${c.name} has learned that his wife is unfaithful.`, [], 'secret', [v, wife, lover]);
    }
  }
}

/** Expired spousal demands sour a marriage. */
export function expireDirectives(s: GameState): void {
  for (const [who, d] of Object.entries(s.directives)) {
    if (d.until >= s.turn) continue;
    addMod(s, d.by, who, 'defied', 'Defied my wishes', -10, 0.5);
    delete s.directives[who];
  }
}

