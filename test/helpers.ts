import {
  COST,
  check,
  endWeek,
  knownSecrets,
  newGame,
  npcTurn,
  perform,
  resolveAudience,
  afterPlayerAction,
  type CharId,
  type GameState,
  type Intent,
  type OfficeId,
} from '../src/engine';

/** A tiny deterministic generator for test choices (separate from the game's own). */
export function lcg(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export function pickOf<T>(r: () => number, xs: T[]): T | undefined {
  return xs.length ? xs[Math.floor(r() * xs.length)] : undefined;
}

/** Every intent the player could plausibly try this moment, legal or not. */
export function intentPool(s: GameState, r: () => number): Intent[] {
  const P = s.player;
  const people = s.order.filter((id) => id !== P);
  const secrets = knownSecrets(s, P).map((k) => k.sec.id);
  const plots = Object.values(s.plots).filter((p) => p.status === 'active');
  const mine = plots.filter((p) => p.owner === P);
  const lands = Object.keys(s.lands);
  const offices: OfficeId[] = ['marshal', 'chancellor', 'spymaster', 'captain', 'confessor'];
  const t = () => pickOf(r, people)!;
  const out: Intent[] = [
    { type: 'converse', target: t() },
    { type: 'gift', target: t(), amount: 10 },
    { type: 'spy', target: t(), focus: pickOf(r, ['motive', 'secrets', 'schemes'] as const)! },
    { type: 'guard' },
    { type: 'fabricate', kind: 'regicide', guilty: [t()], victim: s.king ?? '' },
    { type: 'fabricate', kind: 'pact', guilty: [t(), t()], victim: s.king ?? '' },
    { type: 'fabricate', kind: 'murder', guilty: [t()], victim: t() },
    { type: 'scheme', kind: 'murder', targets: [t()], charges: [] },
    { type: 'petition', kind: 'restitution' },
    { type: 'petition', kind: 'office', office: pickOf(r, offices)! },
    { type: 'petition', kind: 'mercy', target: t() },
    { type: 'counsel', target: s.chars[P].spouse ?? t(), mode: pickOf(r, ['goad', 'restrain'] as const)! },
    { type: 'grant', target: t(), landId: pickOf(r, lands)! },
    { type: 'arrest', target: t() },
    { type: 'question', target: t() },
    { type: 'execute', target: t() },
    { type: 'release', target: t() },
    { type: 'appoint', target: t(), office: pickOf(r, offices)! },
    { type: 'escape' },
  ];
  if (secrets.length) {
    const sid = pickOf(r, secrets)!;
    out.push(
      { type: 'whisper', target: t(), secretId: sid },
      { type: 'denounce', secretId: sid },
      { type: 'blackmail', target: pickOf(r, s.secrets[sid].guilty) ?? t(), secretId: sid, demand: pickOf(r, ['gold', 'restitution', 'join'] as const)!, plotId: mine[0]?.id },
      { type: 'scheme', kind: 'ruin', targets: s.secrets[sid].guilty.filter((g) => g !== P), charges: [sid] },
    );
  }
  for (const p of plots) {
    out.push({ type: 'advance', plotId: p.id, gold: 20 }, { type: 'abandon', plotId: p.id });
    if (p.owner === P) {
      out.push(
        { type: 'strike', plotId: p.id },
        { type: 'denounce', plotId: p.id },
        { type: 'recruit', target: t(), plotId: p.id, offer: pickOf(r, [{ kind: 'none' }, { kind: 'vengeance' }, { kind: 'gold', amount: 10 }, { kind: 'office', office: 'marshal' }] as const)! },
      );
    }
    if (s.chars[P].spouse && p.owner === s.chars[P].spouse) {
      out.push({ type: 'counsel', target: s.chars[P].spouse!, mode: 'demand', directive: { kind: p.kind === 'murder' ? 'strike' : 'denounce', plotId: p.id } });
    }
  }
  // Flight ends the game; keep it rare so seasons run long.
  if (r() < 0.01) out.push({ type: 'flee' });
  return out;
}

/** Play one season with random (legal) player choices. */
export function randomSeason(seed: number, player: CharId, onStep?: (s: GameState) => void): GameState {
  const s = newGame(seed, player);
  const r = lcg(seed * 7919 + player.length);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 400) {
    let answered = 0;
    while (s.audiences.length && s.phase === 'playing') {
      if (answered++ > 50) throw new Error(`audiences never stop coming: ${s.audiences.map((a) => a.kind).join(',')}`);
      const a = s.audiences[0];
      resolveAudience(s, a.id, pickOf(r, a.options)!.id);
      afterPlayerAction(s);
      onStep?.(s);
    }
    if (s.phase !== 'playing') break;
    let tries = 0;
    while (s.ap > 0 && tries++ < 25 && s.phase === 'playing' && !s.audiences.length) {
      const it = pickOf(r, intentPool(s, r))!;
      if (check(s, P(s), it) !== null || COST[it.type] > s.ap) continue;
      perform(s, P(s), it);
      afterPlayerAction(s);
      onStep?.(s);
    }
    if (s.phase !== 'playing' || s.audiences.length) continue;
    endWeek(s);
    onStep?.(s);
  }
  return s;
}

const P = (s: GameState) => s.player;

/** Play a season with the player on the same autopilot as the rest of the court. */
export function autopilotSeason(seed: number, player: CharId): GameState {
  const s = newGame(seed, player);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 200) {
    let answered = 0;
    while (s.audiences.length) {
      if (answered++ > 50) throw new Error('audiences never stop coming');
      resolveAudience(s, s.audiences[0].id, s.audiences[0].options[0].id);
      afterPlayerAction(s);
    }
    if (s.phase !== 'playing') break;
    npcTurn(s, s.player);
    s.ap = 0;
    afterPlayerAction(s);
    endWeek(s);
  }
  return s;
}
