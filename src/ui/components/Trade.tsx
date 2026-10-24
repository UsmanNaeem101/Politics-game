import {
  BUSINESSES,
  ESTATES,
  ESTATE_NAMES,
  credence,
  standingOf,
  type Business,
  type BusinessKind,
  type CharId,
  type Estate,
  type GameState,
} from '../../engine';
import { GIcon, type GIName } from '../icons/GIcon';

export const ESTATE_ICON: Record<Estate, GIName> = {
  crown: 'crown',
  nobility: 'nobility',
  church: 'church',
  guilds: 'guilds',
  commons: 'commons',
  underworld: 'underworld',
};

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export function standingWord(v: number): string {
  if (v >= 15) return 'Esteemed';
  if (v >= 5) return 'Well regarded';
  if (v > -5) return 'Indifferent';
  if (v > -15) return 'Frowned on';
  return 'Despised';
}

/** How each part of society takes to a trade: one icon and number per part. */
function Effects({ values, tone }: { values: Partial<Record<Estate, number>>; tone?: 'danger' }) {
  const shown = ESTATES.filter((e) => values[e]);
  if (!shown.length) return null;
  return (
    <span className="effects">
      {shown.map((e) => (
        <span key={e} className={`effect ${tone ? `effect--${tone}` : (values[e] ?? 0) > 0 ? 'effect--good' : 'effect--bad'}`} title={`${ESTATE_NAMES[e]}: ${signed(values[e]!)}`}>
          <GIcon name={ESTATE_ICON[e]} size={13} /> {signed(values[e]!)}
        </span>
      ))}
    </span>
  );
}

/** A trade as it would be offered: cost, income, what society makes of it, and what it gives you. */
export function TradeCard({ kind }: { kind: BusinessKind }) {
  const def = BUSINESSES[kind];
  return (
    <span className="trade-card">
      <GIcon name={kind} size={30} />
      <span className="trade-body">
        <span className="trade-name">
          {def.name} {def.illicit && <span className="chip chip--danger">racket</span>}
        </span>
        <span className="trade-nums">
          <GIcon name="gold" size={13} /> {def.cost} to set up · <strong>+{def.income}</strong> a month
        </span>
        <Effects values={def.standing} />
        {def.ifKnown && (
          <span className="trade-ifknown">
            if found out: <Effects values={def.ifKnown} tone="danger" />
          </span>
        )}
        <span className="trade-perk">{def.perkText}</span>
      </span>
    </span>
  );
}

/** How far the court knows of a racket. */
export function racketStatus(s: GameState, b: Business, viewer: CharId): string | null {
  if (!b.secretId) return null;
  const sec = s.secrets[b.secretId];
  if (!sec) return null;
  if (sec.exposed) return 'Exposed: the whole court knows';
  // Your own household knowing is the price of running it; it is outsiders that matter.
  const home = s.chars[b.owner].householdId;
  const knowers = s.order.filter(
    (id) => id !== viewer && s.chars[id].householdId !== home && s.chars[id].status === 'free' && credence(s, id, sec.id) >= 40,
  ).length;
  return knowers ? `Whispered about: ${knowers} ${knowers === 1 ? 'outsider knows' : 'outsiders know'}` : 'Secret';
}

/** One of your trades, as it stands now. */
export function TradeLine({ b }: { b: Business }) {
  const def = BUSINESSES[b.kind];
  return (
    <span className="trade-line">
      <GIcon name={b.kind} size={22} />
      <span>
        <strong>{def.name}</strong> <span className="muted">+{def.income} a month</span>
        <br />
        <small className="muted">{def.perkText}</small>
      </span>
    </span>
  );
}

/** Your standing with each part of society, and what a scandal would do to it. */
export function StandingList({ s, id }: { s: GameState; id: CharId }) {
  return (
    <ul className="standing">
      {ESTATES.map((e) => {
        const v = standingOf(s, id, e);
        const worst = standingOf(s, id, e, true);
        return (
          <li key={e}>
            <GIcon name={ESTATE_ICON[e]} size={16} />
            <span className="standing-name">{ESTATE_NAMES[e]}</span>
            <strong className={v >= 5 ? 'good' : v <= -5 ? 'bad' : ''}>{standingWord(v)}</strong>
            <span className="num muted">{signed(v)}</span>
            {worst !== v && <span className="standing-risk">if found out: {signed(worst)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
