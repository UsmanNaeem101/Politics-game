import {
  OBJECTIVES,
  OFFICE_NAMES,
  ch,
  dawnEvents,
  first,
  knownThreats,
  officeOf,
  plotViews,
  strikeChance,
  visibleEvents,
  type CharId,
} from '../../engine';
import { useGame } from '../context';
import { Marks } from './Roster';
import { Shield } from './Shield';

function Seat({ id, size = 46 }: { id: CharId; size?: number }) {
  const { s, selected, select } = useGame();
  const c = ch(s, id);
  const off = officeOf(s, id);
  return (
    <button className={`seat ${selected === id ? 'is-selected' : ''} is-${c.status}`} onClick={() => select(id)}>
      <Shield h={c.heraldry} size={size} status={c.status} crowned={s.king === id} title={c.name} />
      <span className="seat-name">{c.short}</span>
      <span className="seat-role">{s.king === id ? 'The King' : off ? OFFICE_NAMES[off] : c.status === 'free' ? c.title : c.fate?.split(',')[0] ?? ''}</span>
      <Marks id={id} />
    </button>
  );
}

export function Hall() {
  const { s, setTab } = useGame();
  const P = s.player;
  const king = s.king;
  const court = s.order.filter((id) => id !== king && ch(s, id).status === 'free');
  const great = court.filter((id) => ['great', 'queen'].includes(ch(s, id).rank) || officeOf(s, id));
  const lesser = court.filter((id) => !great.includes(id));
  const tower = s.order.filter((id) => ch(s, id).status === 'imprisoned');
  const gone = s.order.filter((id) => ['dead', 'fled'].includes(ch(s, id).status));
  const obj = OBJECTIVES[P];
  const mine = plotViews(s, P).filter((v) => v.plot.status === 'active' && v.role !== 'known');
  const threats = knownThreats(s, P);
  const latest = visibleEvents(s, P).slice(-6).reverse();
  const night = dawnEvents(s, P).length;

  return (
    <div className="hall">
      <section className="throne-room" aria-label="The great hall">
        <div className="dais">
          {king ? (
            <Seat id={king} size={64} />
          ) : (
            <div className="empty-throne">
              <span className="display-sm">The throne is empty</span>
              <small>The Witan will acclaim a new king at the week’s end.</small>
            </div>
          )}
        </div>
        <div className="benches">
          <div className="bench">
            <h3 className="bench-title">Great lords &amp; officers</h3>
            <div className="seats">
              {great.map((id) => (
                <Seat key={id} id={id} />
              ))}
            </div>
          </div>
          <div className="bench">
            <h3 className="bench-title">Lesser nobles &amp; household</h3>
            <div className="seats">
              {lesser.map((id) => (
                <Seat key={id} id={id} />
              ))}
            </div>
          </div>
        </div>
        {(tower.length > 0 || gone.length > 0) && (
          <div className="below">
            {tower.length > 0 && (
              <div className="bench bench--tower">
                <h3 className="bench-title">The Tower</h3>
                <div className="seats">
                  {tower.map((id) => (
                    <Seat key={id} id={id} size={38} />
                  ))}
                </div>
              </div>
            )}
            {gone.length > 0 && (
              <div className="bench bench--crypt">
                <h3 className="bench-title">Gone from court</h3>
                <div className="seats">
                  {gone.map((id) => (
                    <Seat key={id} id={id} size={38} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="briefing">
        <div className="card card--objective">
          <h3 className="card-title">Your aim · {obj.title}</h3>
          <p>{obj.goal}</p>
          <p className="muted">Triumph: {obj.triumph}</p>
          <p className="muted">
            {s.maxTurns - s.turn + 1} week{s.maxTurns - s.turn + 1 === 1 ? '' : 's'} remain before Midsummer.
          </p>
        </div>

        <div className="card">
          <h3 className="card-title">Your schemes</h3>
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
                    {role === 'owner' ? 'yours' : `sworn to ${first(s, plot.owner)}`} · {plot.kind === 'murder' ? 'murder of' : 'ruin of'}{' '}
                    {plot.targets.map((t) => first(s, t)).join(', ')} · {plot.progress}% ready
                    {plot.kind === 'murder' && role === 'owner' ? ` · strike ${strikeChance(s, plot)}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {threats.length > 0 && (
          <div className="card card--danger">
            <h3 className="card-title">Knives pointed at you</h3>
            <ul className="mini-list">
              {threats.map(({ plot, belief }) => (
                <li key={plot.id}>
                  {first(s, plot.owner)} — {plot.kind === 'murder' ? 'means to kill you' : 'means to ruin you before the King'}{' '}
                  <span className="muted">(you are {belief >= 65 ? 'sure' : 'fairly sure'})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card">
          <h3 className="card-title">
            Lately{' '}
            {night > 0 && (
              <button className="link small" onClick={() => setTab('chronicle')}>
                full chronicle
              </button>
            )}
          </h3>
          <ul className="events">
            {latest.map((e) => (
              <li key={e.id} className={`ev ev--${e.tone}`}>
                <span className="ev-week">W{e.turn}</span> {e.text}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
