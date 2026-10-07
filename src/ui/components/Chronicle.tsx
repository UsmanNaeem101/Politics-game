import { useState } from 'react';
import { visibleEvents, type EventTone, type GameEvent, type GameState } from '../../engine';
import { useGame } from '../context';

const TONES: { id: 'all' | 'public' | 'private'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'public', label: 'What the court saw' },
  { id: 'private', label: 'What only you know' },
];

export function EventList({ events, showHidden }: { events: GameEvent[]; showHidden?: boolean }) {
  const byWeek = new Map<number, GameEvent[]>();
  for (const e of events) {
    const list = byWeek.get(e.turn) ?? [];
    list.push(e);
    byWeek.set(e.turn, list);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => b - a);
  return (
    <div className="chronicle-weeks">
      {weeks.map((w) => (
        <section key={w} className="chron-week">
          <h3 className="chron-week-title">Week {w}</h3>
          <ul className="events">
            {byWeek.get(w)!.map((e) => (
              <li key={e.id} className={`ev ev--${e.tone as EventTone} ${showHidden && e.visibleTo !== 'all' ? 'ev--hidden' : ''}`}>
                {showHidden && e.visibleTo !== 'all' && <span className="chip chip--muted">{e.visibleTo.length ? 'secret' : 'unseen'}</span>} {e.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function Chronicle() {
  const { s } = useGame();
  const [f, setF] = useState<'all' | 'public' | 'private'>('all');
  const events = filterEvents(s, f);
  return (
    <div className="chronicle">
      <header className="view-head">
        <h2 className="panel-title">The Chronicle</h2>
        <p className="muted">Newest first. Only what you witnessed, were told, or did yourself.</p>
        <div className="filters" role="group" aria-label="Filter">
          {TONES.map((t) => (
            <button key={t.id} className={`filter ${f === t.id ? 'is-on' : ''}`} onClick={() => setF(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <EventList events={events} />
    </div>
  );
}

function filterEvents(s: GameState, f: 'all' | 'public' | 'private'): GameEvent[] {
  const evs = visibleEvents(s, s.player);
  if (f === 'public') return evs.filter((e) => e.visibleTo === 'all');
  if (f === 'private') return evs.filter((e) => e.visibleTo !== 'all');
  return evs;
}
