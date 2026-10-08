import {
  OFFICE_NAMES,
  PLAYER_AIM,
  acquaintance,
  ch,
  first,
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

const TONE_ICON: Record<string, GIName> = { neutral: 'neutral', good: 'good', bad: 'bad', dire: 'dire', secret: 'secret', court: 'court' };

export function Briefing() {
  const { s, setTab } = useGame();
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
