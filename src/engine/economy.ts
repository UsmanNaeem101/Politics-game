// Money, trades and rackets. Land and office pay rents; a trade pays more, and
// decides how each part of society sees its owner. A racket pays best of all,
// is run in secret, and is a scandal and a crime if it comes out.

import { BUSINESSES, BUSINESS_KINDS, MAX_BUSINESSES } from './content/businesses';
import { chance, pick, roll, weighted } from './rng';
import { makeSecret, secretMatters } from './secrets';
import { first, nm } from './text';
import { acquaintance, businessesOf, ch, credence, hearOf, isAlive, isFree, isServant, learn, log, opinion, standingOf, uid } from './world';
import type { Business, BusinessKind, CharId, GameState } from './types';

/** Open a trade for its owner. A racket becomes a secret the owner and their steward keep. */
export function openBusiness(s: GameState, owner: CharId, kind: BusinessKind): Business {
  const b: Business = { id: uid(s, 'b'), kind, owner, since: s.turn };
  if (BUSINESSES[kind].illicit) racketSecret(s, b);
  s.businesses[b.id] = b;
  return b;
}

/** The secret that this owner runs this racket. */
function racketSecret(s: GameState, b: Business): void {
  const def = BUSINESSES[b.kind];
  const sec = makeSecret(s, {
    kind: 'racket',
    guilty: [b.owner],
    victims: [],
    truth: true,
    evidence: roll(s, 25, 40),
    treason: false,
    text: `${nm(s, b.owner)} secretly runs ${def.secretly}.`,
  });
  sec.businessId = b.id;
  sec.trade = b.kind;
  b.secretId = sec.id;
  learn(s, b.owner, sec.id, 100, 'self');
  const steward = s.houses[ch(s, b.owner).householdId]?.members.find((m) => ch(s, m).role === 'steward' && isAlive(s, m));
  if (steward) learn(s, steward, sec.id, 80, 'spies');
}

/** Why someone cannot take up a trade, or null if they can. */
export function investProblem(s: GameState, actor: CharId, kind: BusinessKind): string | null {
  const def = BUSINESSES[kind];
  if (!def) return 'No such trade.';
  const mine = businessesOf(s, actor);
  if (mine.some((b) => b.kind === kind)) return 'You already run one.';
  if (mine.length >= MAX_BUSINESSES) return `You can run no more than ${MAX_BUSINESSES} trades. Sell one first.`;
  if (ch(s, actor).gold < def.cost) return `You need ${def.cost} crowns.`;
  if (def.royalGrant && s.king !== actor) {
    if (!s.king) return 'There is no King to grant it.';
    if (opinion(s, s.king, actor) < 15) return 'The King grants tax farms only to those he favours.';
  }
  return null;
}

export function sellPrice(b: Business): number {
  return Math.floor(BUSINESSES[b.kind].cost / 2);
}

/** Every month: trades pass to heirs, things go wrong, rackets leak, and perks pay out. */
export function runBusinesses(s: GameState): void {
  for (const b of Object.values(s.businesses ?? {})) {
    const def = BUSINESSES[b.kind];
    const owner = ch(s, b.owner);
    if (!owner) {
      delete s.businesses[b.id];
      continue;
    }
    // The dead and the fled leave their trades to whoever now heads the house.
    if (owner.status === 'dead' || owner.status === 'fled') {
      const head = s.houses[owner.householdId]?.head;
      if (head && head !== b.owner && isFree(s, head) && businessesOf(s, head).length < MAX_BUSINESSES) {
        b.owner = head;
        // The old secret tells of the dead; the heir now runs it, and that is a new secret.
        if (b.secretId) racketSecret(s, b);
        log(s, `${nm(s, head)} took over ${first(s, owner.id)}'s ${def.name.toLowerCase()}.`, def.illicit ? [head] : 'all', 'neutral', [head]);
      } else {
        delete s.businesses[b.id];
      }
      continue;
    }
    if (owner.status !== 'free') continue;

    // Trouble: weather, wrecks, the watch. Resentful commons make more of it.
    const resented = Math.max(0, -standingOf(s, b.owner, 'commons')) / 2;
    if (chance(s, def.risk + resented)) {
      const t = pick(s, def.troubles);
      const loss = Math.min(owner.gold, t.loss);
      owner.gold -= loss;
      log(s, `${def.name}: ${t.text}. It cost ${b.owner === s.player ? 'you' : first(s, b.owner)} ${loss} crowns.`, [b.owner], 'bad', [b.owner]);
    }

    // A racket leaks: a debtor talks, a client is seen, a ledger goes missing.
    if (b.secretId && def.leak && chance(s, def.leak)) {
      const sec = s.secrets[b.secretId];
      const pool = s.order.filter((id) => id !== b.owner && isFree(s, id) && !isServant(s, id) && credence(s, id, sec.id) < 40);
      const who = weighted(s, pool, (id) => (s.offices.spymaster === id ? 4 : 1));
      if (who) {
        learn(s, who, sec.id, roll(s, 40, 60), 'rumour');
        log(s, `Word reaches you: ${sec.text}`, [who], 'secret', [who, b.owner]);
      }
    }

    perkWeek(s, b);
  }
}

function perkWeek(s: GameState, b: Business): void {
  const def = BUSINESSES[b.kind];
  const P = s.player;
  // Factors abroad: names reach you before faces do.
  if (def.perk === 'factors' && b.owner === P && chance(s, 45)) {
    const unknown = s.order.filter((id) => isFree(s, id) && !isServant(s, id) && acquaintance(s, id) === 0);
    if (unknown.length) {
      const id = pick(s, unknown);
      hearOf(s, id, 1);
      log(s, `Your factors' letters speak of ${nm(s, id)}.`, [P], 'neutral', [id]);
    }
  }
  // Informants: clients talk in the steam.
  if (def.perk === 'informants' && chance(s, 25)) {
    const clients = s.order.filter((id) => id !== b.owner && isFree(s, id) && !isServant(s, id) && ch(s, id).gender === 'm');
    const client = clients.length ? pick(s, clients) : undefined;
    if (!client) return;
    const pool = Object.entries(s.knowledge[client] ?? {}).filter(
      ([sid, k]) =>
        !k.lie && k.credence >= 50 && s.secrets[sid] && !s.secrets[sid].guilty.includes(b.owner) && credence(s, b.owner, sid) < 40 && secretMatters(s, s.secrets[sid]),
    );
    if (!pool.length) return;
    const [sid] = pick(s, pool);
    learn(s, b.owner, sid, 55, client);
    log(s, `A client at your bathhouse talked too freely: “${s.secrets[sid].text}”`, [b.owner], 'secret', [client, ...s.secrets[sid].guilty]);
  }
}

/** Trades that suit a household, by its standing. */
const TRADE_ODDS: Record<'great' | 'lesser' | 'player', [BusinessKind, number][]> = {
  great: [
    ['estates', 30],
    ['taxfarm', 20],
    ['moneylending', 20],
    ['wool', 15],
    ['wine', 15],
  ],
  lesser: [
    ['estates', 25],
    ['wool', 15],
    ['mill', 15],
    ['wine', 10],
    ['moneylending', 8],
    ['apothecary', 7],
    ['gambling', 8],
    ['bathhouse', 5],
    ['smuggling', 5],
    ['forgery', 2],
  ],
  player: [
    ['estates', 30],
    ['wool', 20],
    ['wine', 12],
    ['mill', 10],
    ['apothecary', 8],
    ['gambling', 8],
    ['smuggling', 6],
    ['forgery', 3],
    ['bathhouse', 3],
  ],
};

/** Give every head of house a trade (and some a racket). The player may choose theirs. */
export function endowTrades(s: GameState, playerTrade?: BusinessKind): void {
  for (const h of Object.values(s.houses)) {
    const head = h.head;
    if (!head || !isFree(s, head) || h.rank === 'royal' || h.rank === 'church' || businessesOf(s, head).length) continue;
    if (head === s.player) {
      // Always draw, so choosing a trade does not reshuffle the rest of the court.
      const drawn = weighted(s, TRADE_ODDS.player, (x) => x[1])![0];
      openBusiness(s, head, playerTrade && BUSINESS_KINDS.includes(playerTrade) ? playerTrade : drawn);
      continue;
    }
    if (h.rank === 'lesser' && !chance(s, 70)) continue;
    const kind = weighted(s, TRADE_ODDS[h.rank === 'great' ? 'great' : 'lesser'], (x) => x[1])![0];
    openBusiness(s, head, kind);
  }
}

/** A newly arrived house sets up in trade. */
export function endowNewcomer(s: GameState, head: CharId): void {
  if (businessesOf(s, head).length || !chance(s, 60)) return;
  openBusiness(s, head, weighted(s, TRADE_ODDS.lesser, (x) => x[1])![0]);
}

/** Who the player knows to be running a racket, for the ledger and the dossier. */
export function knownRackets(s: GameState, viewer: CharId): Business[] {
  return Object.values(s.businesses ?? {}).filter((b) => b.secretId && (b.owner === viewer || credence(s, viewer, b.secretId) >= 40));
}
