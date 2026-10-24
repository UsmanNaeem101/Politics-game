import {
  MAX_SPIES,
  SPY_HOOKS,
  spiesOf,
  type SpyHook,
  OFFICE_NAMES,
  PLAYER_AIM,
  acquaintance,
  businessesOf,
  ch,
  first,
  incomeOf,
  knownThreats,
  nm,
  officeOf,
  opinion,
  opinionWord,
  plotViews,
  strikeChance,
  visibleEvents,
  weekLabel,
  witanForecast,
} from '../../engine';
import { useGame } from '../context';
import { GIcon, type GIName } from '../icons/GIcon';
import { Person } from './Roster';
import { StandingList, TradeLine, racketStatus } from './Trade';

const HOOK_ICON: Record<SpyHook, GIName> = { gold: 'gold', blackmail: 'blackmail', devotion: 'love', grudge: 'hate' };

const TONE_ICON: Record<string, GIName> = { neutral: 'neutral', good: 'good', bad: 'bad', dire: 'dire', secret: 'secret', court: 'court' };

export function Briefing() {
  const { s, setTab, openDeed, select } = useGame();
  const P = s.player;
  const me = ch(s, P);
  const king = s.king;
  const favour = king && king !== P ? opinion(s, king, P) : null;
  const office = officeOf(s, P);
  const forecast = witanForecast(s);
  const myRank = forecast.findIndex((f) => f.id === P);
  const mine = plotViews(s, P).filter((v) => v.plot.status === 'active' && v.role !== 'known');
  const threats = knownThreats(s, P);
  const latest = visibleEvents(s, P).slice(-8).reverse();
  const household = s.houses[me.householdId].members.filter((m) => m !== P && ch(s, m).status !== 'dead');
  const trades = businessesOf(s, P);
  const mySpies = spiesOf(s, P);

  return (
    <div className="briefing">
      <section className="card card--objective">
        <h3 className="card-title">
          <GIcon name="crown" size={16} /> {PLAYER_AIM.title}
        </h3>
        <p>{PLAYER_AIM.goal}</p>
        <div className="stat-row">
          <span className="stat" title="Your renown at court; it weighs your voice in the Witan">
            <GIcon name="ambition" size={18} /> <strong>{me.prestige}</strong> <small>prestige</small>
          </span>
          {favour !== null && (
            <span className="stat" title="How the King regards you">
              <GIcon name="favour" size={18} /> <strong className={favour >= 10 ? 'good' : favour <= -10 ? 'bad' : ''}>{opinionWord(favour)}</strong> <small>favour</small>
            </span>
          )}
          <span className="stat">
            <GIcon name="gold" size={18} /> <strong>{me.gold}</strong> <small>crowns</small>
          </span>
          <span className="stat">
            <GIcon name={office ?? 'lord'} size={18} /> <strong>{office ? OFFICE_NAMES[office] : 'No office'}</strong>
          </span>
        </div>
        {king && king !== P && (
          <p className="muted small">
            {first(s, king)} is {ch(s, king).age}. He has no heir: when he dies, the Witan chooses.
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">
          <GIcon name="trade" size={16} /> Your trade
          <span className="muted small">+{incomeOf(s, P)} crowns a week in all</span>
        </h3>
        {trades.length === 0 ? (
          <p className="muted">You run no trade. Your lands alone keep you.</p>
        ) : (
          <ul className="trade-list">
            {trades.map((b) => {
              const status = racketStatus(s, b, P);
              return (
                <li key={b.id}>
                  <TradeLine b={b} />
                  {status && <span className={`chip ${status === 'Secret' ? 'chip--muted' : 'chip--danger'}`}>{status}</span>}
                </li>
              );
            })}
          </ul>
        )}
        <div className="card-actions">
          <button className="btn btn--sm" onClick={() => openDeed({ type: 'invest' })} disabled={s.ap < 1}>
            <GIcon name="invest" size={14} /> Set up a trade…
          </button>
          {trades.length > 0 && (
            <button className="btn btn--sm" onClick={() => openDeed({ type: 'divest' })} disabled={s.ap < 1}>
              <GIcon name="divest" size={14} /> Sell…
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">
          <GIcon name="nobility" size={16} /> Your standing
        </h3>
        <StandingList s={s} id={P} />
        <p className="muted small">What each part of society makes of your trade. It colours how every lord, priest and servant regards you.</p>
      </section>

      <section className="card">
        <h3 className="card-title">
          <GIcon name="agent" size={16} /> Your spies
          <span className="muted small">
            {mySpies.length} of {MAX_SPIES}
          </span>
        </h3>
        {mySpies.length === 0 ? (
          <p className="muted">
            No one watches for you. A maid in a lord's house, a brother, a lover, a friend: recruit someone close to the person you want watched,
            from their page.
          </p>
        ) : (
          <ul className="spy-list">
            {mySpies.map((sp) => (
              <li key={sp.id}>
                <span className="spy-line">
                  <GIcon name={HOOK_ICON[sp.hook]} size={16} />{' '}
                  <button className="link" onClick={() => select(sp.agent)}>
                    {first(s, sp.agent)}
                  </button>{' '}
                  watches{' '}
                  <button className="link" onClick={() => select(sp.mark)}>
                    {nm(s, sp.mark)}
                  </button>
                  <br />
                  <small className="muted">
                    {sp.hook === 'gold' ? `${sp.wage} crowns a week` : `for ${SPY_HOOKS[sp.hook].name.toLowerCase()}`} · {sp.reports} {sp.reports === 1 ? 'report' : 'reports'} since{' '}
                    {weekLabel(sp.since)}
                  </small>
                </span>
                <button className="btn btn--sm" onClick={() => openDeed({ type: 'dismiss-spy', spyId: sp.id })}>
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">
          <GIcon name="witan" size={16} /> If the Witan met today
        </h3>
        {forecast.length === 0 ? (
          <p className="muted">No one could be acclaimed.</p>
        ) : (
          <ol className="forecast">
            {forecast.slice(0, 5).map((f, i) => {
              const known = f.id === P || acquaintance(s, f.id) >= 1;
              const max = forecast[0].votes || 1;
              return (
                <li key={f.id} className={f.id === P ? 'is-you' : ''}>
                  <span className="fc-rank">{i + 1}</span>
                  <span className="fc-name">{f.id === P ? 'You' : known ? nm(s, f.id) : 'Someone you do not know'}</span>
                  <span className="fc-bar">
                    <span style={{ width: `${(f.votes / max) * 100}%` }} />
                  </span>
                  <span className="fc-votes num">{f.votes}</span>
                </li>
              );
            })}
          </ol>
        )}
        {myRank >= 5 && (
          <p className="small">
            You stand <strong>{myRank + 1}th</strong> of {forecast.length}. Win friends among the electors, take an office, unmask a traitor.
          </p>
        )}
      </section>

      {threats.length > 0 && (
        <section className="card card--danger">
          <h3 className="card-title">
            <GIcon name="threat" size={16} /> Knives pointed at you
          </h3>
          <ul className="mini-list">
            {threats.map(({ plot, belief }) => (
              <li key={plot.id}>
                {first(s, plot.owner)} — {plot.kind === 'murder' ? 'means to kill you' : 'means to ruin you before the King'} <span className="muted">(you are {belief >= 65 ? 'sure' : 'fairly sure'})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3 className="card-title">
          <GIcon name="house" size={16} /> Your household
        </h3>
        <ul className="people-mini">
          {household.map((id) => (
            <li key={id}>
              <Person id={id} compact />
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="card-title">
          <GIcon name="schemes" size={16} /> Your schemes
        </h3>
        {mine.length === 0 ? (
          <p className="muted">You are part of no scheme. Begin one from the Schemes view, or wait to be asked.</p>
        ) : (
          <ul className="mini-list">
            {mine.map(({ plot, role }) => (
              <li key={plot.id}>
                <button className="link" onClick={() => setTab('schemes')}>
                  “{plot.name}”
                </button>{' '}
                <span className="muted">
                  {role === 'owner' ? 'yours' : `sworn to ${first(s, plot.owner)}`} · {plot.kind === 'murder' ? 'murder of' : 'ruin of'} {plot.targets.map((t) => first(s, t)).join(', ')} · {plot.progress}% ready
                  {plot.kind === 'murder' && role === 'owner' ? ` · strike ${strikeChance(s, plot)}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card--wide">
        <h3 className="card-title">
          <GIcon name="chronicle" size={16} /> Lately
          <button className="link small" onClick={() => setTab('chronicle')}>
            full chronicle
          </button>
        </h3>
        <ul className="events">
          {latest.map((e) => (
            <li key={e.id} className={`ev ev--${e.tone}`}>
              <GIcon name={TONE_ICON[e.tone] ?? 'neutral'} size={14} /> <span className="ev-week">{weekLabel(e.turn)}</span> {e.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
