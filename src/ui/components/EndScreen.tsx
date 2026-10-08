import { useState } from 'react';
import { PLAYER_AIM, VERDICT_LABEL, ch, evaluate, first, nm, styleOf, weekLabel } from '../../engine';
import { useGame } from '../context';
import { GIcon } from '../icons/GIcon';
import { EventList } from './Chronicle';
import { CourtMap } from './CourtMap';
import { housesInOrder } from './Roster';
import { Shield } from './Shield';

export function EndScreen({ onRestart, onQuit, onRuleOn }: { onRestart: (seed: number, name: string) => void; onQuit: () => void; onRuleOn: () => void }) {
  const { s } = useGame();
  const P = s.player;
  const end = s.ending!;
  const r = end.result;
  const [tab, setTab] = useState<'fates' | 'truth' | 'web' | 'chronicle'>('fates');

  const reasonLine =
    end.reason === 'crowned'
      ? `${weekLabel(end.turn)} · the Witan has chosen`
      : end.reason === 'player-dead'
        ? `${weekLabel(end.turn)} · your story ends`
        : end.reason === 'player-fled'
          ? `${weekLabel(end.turn)} · you fled the court`
          : `${weekLabel(end.turn)} · the season ends`;

  return (
    <div className="end">
      <header className={`end-banner end-banner--${r.verdict}`}>
        <p className="eyebrow">{reasonLine}</p>
        <h1 className="display">{VERDICT_LABEL[r.verdict]}</h1>
        <p className="end-headline">{r.headline}</p>
        <p className="muted">
          {nm(s, P)} — {PLAYER_AIM.goal}
        </p>
        {r.notes.length > 0 && (
          <ul className="end-notes">
            {r.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <div className="end-actions">
          {end.reason === 'crowned' && (
            <button className="btn btn--primary" onClick={onRuleOn}>
              <GIcon name="crown" size={16} /> Rule on
            </button>
          )}
          <button className={`btn ${end.reason === 'crowned' ? '' : 'btn--primary'}`} onClick={() => onRestart(Math.floor(Math.random() * 999999) + 1, '')}>
            A new court
          </button>
          <button className="btn" onClick={() => onRestart(s.seed, ch(s, P).short)}>
            This court again (seed {s.seed})
          </button>
          <button className="btn btn--ghost" onClick={onQuit}>
            Title
          </button>
        </div>
      </header>

      <nav className="tabs tabs--end" aria-label="After the game">
        {(
          [
            ['fates', 'Fates', 'tombstone'],
            ['truth', 'The truth', 'motive'],
            ['web', 'The real court', 'map'],
            ['chronicle', 'Everything that happened', 'chronicle'],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            className={`tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <GIcon name={icon === 'tombstone' ? 'dead' : icon} size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="end-body">
        {tab === 'fates' &&
          housesInOrder(s).map((h) => (
            <section key={h.id} className="fate-house">
              <h3 className="roster-house-title">
                <Shield h={h.heraldry} size={14} /> {h.rank === 'royal' ? 'The Crown' : h.rank === 'church' ? 'The Church' : `House ${h.name}`}
              </h3>
              <ul className="fates">
                {h.members.map((id) => {
                  const c = ch(s, id);
                  const res = evaluate(s, id);
                  return (
                    <li key={id} className={`fate is-${c.status}`}>
                      <Shield h={c.heraldry} size={36} status={c.status} crowned={s.king === id} />
                      <div>
                        <h4>
                          {nm(s, id)} {id === P && <span className="chip chip--you">You</span>}
                        </h4>
                        <p className="muted small">{c.status === 'free' ? styleOf(s, id) : c.status === 'imprisoned' ? 'In the Tower' : c.fate}</p>
                        {id !== P && (
                          <p className="small">
                            <span className={`verdict verdict--${res.verdict}`}>{VERDICT_LABEL[res.verdict]}</span> {res.headline}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {tab === 'truth' && (
          <div className="truth">
            {s.order
              .filter((id) => ch(s, id).rank !== 'servant')
              .map((id) => {
                const c = ch(s, id);
                const plots = Object.values(s.plots).filter((p) => p.owner === id);
                const oaths = Object.values(s.plots).filter((p) => p.members.some((m) => m.id === id));
                return (
                  <article key={id} className="truth-card">
                    <header>
                      <Shield h={c.heraldry} size={30} status={c.status} crowned={s.king === id} />
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
                            Led “{p.name}” ({p.kind} of {p.targets.map((t) => first(s, t)).join(', ') || 'no one'}) — {p.status}
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
        {tab === 'web' && (
          <div className="end-map">
            <CourtMap truth />
          </div>
        )}
        {tab === 'chronicle' && <EventList events={s.events} showHidden />}
      </div>
    </div>
  );
}
