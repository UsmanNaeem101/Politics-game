// Moments that need the player's answer: someone wants something from you, or
// you sit on the throne and must judge.

import {
  applyBlackmail,
  applyPetition,
  applyRecruitAnswer,
  directiveIntent,
  exile,
  perform,
  type Intent,
  type Outcome,
} from './actions';
import {
  applyJudgments,
  chargesFor,
  claimants,
  crimeName,
  disgrace,
  execute,
  exposeForgery,
  imprison,
  rollJudgments,
} from './court';
import { chance, clamp } from './rng';
import { makeSecret } from './secrets';
import { first, names, nm } from './text';
import { addMod, ch, isFree, learn, log, uid } from './world';
import type { Audience, CharId, GameState, Offer, SecretId } from './types';

export function resolveAudience(s: GameState, audienceId: string, optionId: string): Outcome {
  const idx = s.audiences.findIndex((a) => a.id === audienceId);
  if (idx < 0) return { ok: false, text: 'That moment has passed.', tone: 'neutral' };
  const a = s.audiences[idx];
  s.audiences.splice(idx, 1);
  const P = s.player;
  switch (a.kind) {
    case 'recruit': {
      const plot = s.plots[a.data.plotId as string];
      if (!plot || plot.status !== 'active' || !isFree(s, plot.owner)) return { ok: false, text: 'The scheme has already collapsed.', tone: 'neutral' };
      const answer = optionId === 'join' ? 'sincere' : optionId === 'feign' ? 'feign' : 'refuse';
      const r = applyRecruitAnswer(s, plot.owner, P, plot, a.data.offer as Offer, answer);
      return {
        ...r,
        text: answer === 'refuse' ? `You refuse ${first(s, plot.owner)}. You know the scheme now; so does ${first(s, plot.owner)} know that you know.` : answer === 'feign' ? `You swear to “${plot.name}” with a straight face.` : `You are sworn to “${plot.name}”.`,
      };
    }
    case 'blackmail': {
      const it = a.data as unknown as Extract<Intent, { type: 'blackmail' }> & { actor: CharId };
      if (!isFree(s, it.actor)) return { ok: false, text: 'Your blackmailer is in no position to collect.', tone: 'good' };
      const comply = optionId === 'comply';
      const r = applyBlackmail(s, it.actor, it, comply);
      if (!comply && s.king && s.king !== it.actor && chance(s, 40 + ch(s, it.actor).traits.wrath * 0.4)) {
        perform(s, it.actor, { type: 'whisper', target: s.king, secretId: it.secretId }, { free: true });
        log(s, `${nm(s, it.actor)} made good on the threat and went to the King.`, [P], 'bad', [it.actor]);
      }
      return comply ? { ...r, text: 'You pay. They will be back.' } : { ...r, text: 'You call their bluff.' };
    }
    case 'counsel': {
      const spouse = a.data.actor as CharId;
      const d = a.data.directive as Parameters<typeof directiveIntent>[2];
      if (optionId === 'heed') {
        const it = directiveIntent(s, P, d);
        addMod(s, spouse, P, 'heeded', 'Heeded me', 10, 0.5);
        if (!it) return { ok: false, text: 'You would, but there is nothing left to do.', tone: 'neutral' };
        const r = perform(s, P, it, { free: true });
        return { ...r, text: `Her will carries you. ${r.text}` };
      }
      if (optionId === 'placate') {
        if (chance(s, clamp(ch(s, P).traits.charm * 0.8, 10, 80))) {
          return { ok: true, text: 'Soft words and promises. She lets it rest — for now.', tone: 'good' };
        }
        addMod(s, spouse, P, 'placated', 'Fobbed me off', -8, 0.5);
        ch(s, P).pressure = clamp(ch(s, P).pressure + 10, -100, 100);
        return { ok: false, text: 'She sees through you, and is colder for it.', tone: 'bad' };
      }
      addMod(s, spouse, P, 'defied', 'Defied my wishes', -12, 0.5);
      return { ok: true, text: 'You refuse her. The house is very quiet tonight.', tone: 'bad' };
    }
    case 'judgment':
      return resolveJudgment(s, a, optionId);
    case 'accused':
      return resolveAccused(s, a, optionId);
    case 'petition': {
      const it = a.data as unknown as Extract<Intent, { type: 'petition' }> & { actor: CharId };
      return applyPetition(s, it.actor, it, optionId === 'grant');
    }
    case 'witan': {
      s.witanVote = optionId;
      return { ok: true, text: `You will cast your voice for ${nm(s, optionId)}.`, tone: 'neutral' };
    }
    case 'pledge-due':
      return { ok: true, text: 'Noted.', tone: 'neutral' };
  }
}

function resolveJudgment(s: GameState, a: Audience, optionId: string): Outcome {
  const K = s.player;
  const accuser = a.data.accuser as CharId;
  const charges = a.data.charges as SecretId[];
  const plot = a.data.plotId ? s.plots[a.data.plotId as string] : undefined;
  const list = chargesFor(s, accuser, charges, a.data.only as CharId[] | undefined);
  if (!list.length) return { ok: false, text: 'The accused are beyond your judgment now.', tone: 'neutral' };
  for (const { secretId, accused } of list) {
    learn(s, K, secretId, optionId === 'execute' ? 90 : optionId === 'imprison' ? 60 : 20, accuser);
    addMod(s, accused, accuser, 'denounced', 'Denounced me to the King', -40);
  }
  if (plot) plot.status = optionId === 'execute' || optionId === 'imprison' ? 'succeeded' : 'foiled';
  switch (optionId) {
    case 'execute':
      for (const { secretId, accused } of list) {
        const sec = s.secrets[secretId];
        if (!sec.truth) {
          for (const id of s.order) if (isFree(s, id) && id !== K && id !== accused) addMod(s, id, K, `butcher-${accused}`, `Beheaded ${first(s, accused)} on a lie`, -12, 0.3);
        }
        if (sec.treason) execute(s, accused, crimeName(sec));
        else disgrace(s, accused, sec);
      }
      return { ok: true, text: `Judgment is given. ${names(s, list.map((l) => l.accused))} will trouble you no more.`, tone: 'dire' };
    case 'imprison':
      for (const { secretId, accused } of list) {
        imprison(s, accused, [secretId], accuser);
        log(s, `By the King's judgment, ${nm(s, accused)} was taken to the Tower.`, 'all', 'court', [accused]);
      }
      return { ok: true, text: 'The Tower’s questioners will have them by nightfall.', tone: 'neutral' };
    case 'dismiss':
      for (const { accused } of list) addMod(s, accused, K, 'cleared', 'Cleared my name', 10, 0.5);
      addMod(s, accuser, K, 'dismissed', 'Dismissed my charges', -10, 0.5);
      log(s, `The King dismissed ${nm(s, accuser)}'s charges.`, 'all', 'court', [accuser]);
      return { ok: true, text: 'You dismiss the charges.', tone: 'neutral' };
    default: {
      const forged = charges.map((c) => s.secrets[c]).find((sec) => !sec.truth && sec.fabricatedBy);
      if (forged) {
        exposeForgery(s, forged, accuser);
        return { ok: true, text: 'The forgery is laid bare.', tone: 'good' };
      }
      const allTrue = charges.every((c) => s.secrets[c].truth);
      const slander = makeSecret(s, {
        kind: 'slander',
        guilty: [accuser],
        victims: list.map((l) => l.accused),
        truth: !allTrue,
        evidence: 50,
        treason: false,
      });
      learn(s, K, slander.id, 80, 'court');
      if (allTrue) {
        for (const id of s.order) if (isFree(s, id) && id !== K && id !== accuser) addMod(s, id, K, `silenced-${accuser}`, `Punished ${first(s, accuser)} for telling the truth`, -8, 0.3);
      }
      if (isFree(s, accuser)) disgrace(s, accuser, slander);
      return { ok: true, text: `${first(s, accuser)} is disgraced for slander.`, tone: 'bad' };
    }
  }
}

function resolveAccused(s: GameState, a: Audience, optionId: string): Outcome {
  const P = s.player;
  const accuser = a.data.accuser as CharId;
  const charges = a.data.charges as SecretId[];
  const plot = a.data.plotId ? s.plots[a.data.plotId as string] : undefined;
  if (!s.king) return { ok: true, text: 'With the throne empty, no one judges you.', tone: 'good' };
  let bonus = 0;
  if (optionId === 'flee') {
    if (chance(s, clamp(30 + ch(s, P).traits.cunning * 0.3 + ch(s, P).traits.boldness * 0.1, 10, 75))) {
      exile(s, P);
      return { ok: true, text: 'You shoulder past the guards and are gone into the night.', tone: 'dire' };
    }
    bonus += 15;
    log(s, `${nm(s, P)} tried to flee the hall and was dragged back.`, 'all', 'bad', [P]);
  }
  if (optionId === 'mercy') bonus += 6;
  let counter: SecretId | undefined;
  if (optionId.startsWith('counter:')) {
    counter = optionId.slice('counter:'.length);
    bonus -= 8;
  }
  const judgments = rollJudgments(s, accuser, charges, plot, { [P]: bonus }, a.data.only as CharId[] | undefined);
  if (optionId === 'mercy') {
    for (const j of judgments) if (j.accused === P && j.verdict === 'execute') j.verdict = 'imprison';
  }
  const summary = applyJudgments(s, accuser, judgments);
  if (plot) plot.status = judgments.some((j) => j.verdict !== 'dismiss' && !j.forgeryFound) ? 'succeeded' : 'foiled';
  let extra = '';
  if (counter && isFree(s, P) && isFree(s, accuser) && s.king) {
    log(s, `${nm(s, P)} turned on ${nm(s, accuser)}: “${s.secrets[counter].text}”`, 'all', 'court', [P, accuser]);
    const cj = rollJudgments(s, P, [counter]);
    extra = ` Your counter-charge: ${applyJudgments(s, P, cj) || 'nothing came of it'}.`;
  }
  const mine = judgments.find((j) => j.accused === P);
  const fate = !mine
    ? 'The charge did not touch you.'
    : mine.forgeryFound
      ? 'The letters were exposed as forgeries. You walk free.'
      : mine.verdict === 'execute'
        ? 'The King has condemned you.'
        : mine.verdict === 'imprison'
          ? 'You are taken to the Tower.'
          : mine.verdict === 'disgrace'
            ? 'You are disgraced and fined.'
            : 'The charge is dismissed.';
  return { ok: !mine || mine.verdict === 'dismiss' || mine.forgeryFound, text: `${fate} (${summary})${extra}`, tone: mine && mine.verdict !== 'dismiss' && !mine.forgeryFound ? 'dire' : 'good' };
}

/** At dawn while the throne is empty, the player is asked for their voice. */
export function witanAudience(s: GameState): Audience | null {
  const P = s.player;
  if (!s.interregnum || !isFree(s, P)) return null;
  if (s.audiences.some((a) => a.kind === 'witan')) return null;
  const cands = claimants(s);
  if (!cands.length) return null;
  return {
    id: uid(s, 'a'),
    kind: 'witan',
    from: P,
    turn: s.turn,
    title: 'The Witan will gather',
    text: `The throne stands empty. At the week's end the lords of the Witan will acclaim a new king. Whom will you name? (You have this week to win voices for your choice.)`,
    options: cands.map((c) => ({ id: c, label: c === P ? 'Yourself' : nm(s, c), tone: 'neutral' as const })),
    data: {},
  };
}
