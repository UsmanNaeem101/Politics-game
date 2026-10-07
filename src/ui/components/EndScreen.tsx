import { useState } from 'react';
import { OBJECTIVES, PLAYABLE, VERDICT_LABEL, ch, evaluate, first, nm, styleOf, type CharId } from '../../engine';
import { useGame } from '../context';
import { EventList } from './Chronicle';
import { Shield } from './Shield';
import { Web } from './Web';

export function EndScreen({ onRestart, onQuit }: { onRestart: (p: CharId, seed: number) => void; onQuit: () => void }) {
  const { s } = useGame();
  const P = s.player;
  const end = s.ending!;
  const r = end.result;
  const [tab, setTab] = useState<'fates' | 'truth' | 'web' | 'chronicle'>('fates');
  const [next, setNext] = useState<CharId>(PLAYABLE.find((id) => id !== P) ?? P);

  return (
    <div className="end">
      <header className={`end-banner end-banner--${r.verdict}`}>
        <p className="eyebrow">
          {end.reason === 'season-end' ? `Midsummer · the season ends` : end.reason === 'player-dead' ? `Week ${end.turn} · your story ends` : `Week ${end.turn} · you fled the court`}
        </p>
        <h1 className="display">{VERDICT_LABEL[r.verdict]}</h1>
        <p className="end-headline">{r.headline}</p>
        <p className="muted">
          {nm(s, P)} — {OBJECTIVES[P].title}: {OBJECTIVES[P].goal}
        </p>
        {r.notes.length > 0 && (
          <ul className="end-notes">
            {r.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <div className="end-actions">
          <button className="btn btn--primary" onClick={() => onRestart(P, Math.floor(Math.random() * 99999) + 1)}>
            Play {first(s, P)} again, new seed
          </button>
          <span className="field field--inline">
            <select id="next-char" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Character for the same seed">
              {PLAYABLE.map((id) => (
                <option key={id} value={id}>
                  {s.chars[id].name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => onRestart(next, s.seed)}>
              Same seed ({s.seed}) as them
            </button>
          </span>
          <button className="btn btn--ghost" onClick={onQuit}>
            Title
          </button>
        </div>
      </header>

      <nav className="tabs tabs--end" aria-label="After the season">
        {(
          [
            ['fates', 'Fates'],
            ['truth', 'The truth'],
            ['web', 'The real web'],
            ['chronicle', 'Everything that happened'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="end-body">
        {tab === 'fates' && (
          <ul className="fates">
            {s.order.map((id) => {
              const c = ch(s, id);
              const res = evaluate(s, id);
              return (
                <li key={id} className={`fate is-${c.status}`}>
                  <Shield h={c.heraldry} size={44} status={c.status} crowned={s.king === id} />
                  <div>
                    <h3>
                      {nm(s, id)} {id === P && <span className="chip chip--you">You</span>}
                    </h3>
                    <p className="muted small">{c.status === 'free' ? styleOf(s, id) : c.status === 'imprisoned' ? 'In the Tower' : c.fate}</p>
                    <p className="small">
                      <span className={`verdict verdict--${res.verdict}`}>{VERDICT_LABEL[res.verdict]}</span> {res.headline}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'truth' && (
          <div className="truth">
            {s.order.map((id) => {
              const c = ch(s, id);
              const plots = Object.values(s.plots).filter((p) => p.owner === id);
              const oaths = Object.values(s.plots).filter((p) => p.members.some((m) => m.id === id));
              return (
                <article key={id} className="truth-card">
                  <header>
                    <Shield h={c.heraldry} size={36} status={c.status} crowned={s.king === id} />
                    <h3>{c.name}</h3>
                  </header>
                  <p>
                    <span className="muted">Seemed:</span> <em>{c.facade}</em>
                  </p>
                  <p>
                    <span className="muted">Wanted:</span> {(c.firstAgenda ?? c.agenda).summary}
                  </p>
                  {c.firstAgenda && c.firstAgenda.summary !== c.agenda.summary && (
                    <p>
                      <span className="muted">By the end:</span> {c.agenda.summary}
                    </p>
                  )}
                  <p className="small muted">{c.bio}</p>
                  {plots.length > 0 && (
                    <ul className="mini-list small">
                      {plots.map((p) => (
                        <li key={p.id}>
                          Led “{p.name}” ({p.kind}) — {p.status}
                        </li>
                      ))}
                    </ul>
                  )}
                  {oaths.length > 0 && (
                    <ul className="mini-list small">
                      {oaths.map((p) => {
                        const m = p.members.find((x) => x.id === id)!;
                        return (
                          <li key={p.id}>
                            Swore to {first(s, p.owner)}'s “{p.name}” — {m.sincere ? 'and meant it' : <strong className="bad">meaning to betray it</strong>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {tab === 'web' && <Web truth />}
        {tab === 'chronicle' && <EventList events={s.events} showHidden />}
      </div>
    </div>
  );
}
