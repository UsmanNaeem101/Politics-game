import { useState } from 'react';
import { SECRET_KIND_LABEL, credenceWord, evidenceWord, first, knownSecrets, nm, type KnownSecret } from '../../engine';
import { useGame } from '../context';

type Group = 'treason' | 'crimes' | 'forged' | 'rumours' | 'own';

function groupOf(k: KnownSecret, me: string): Group {
  if (k.k.lie) return 'forged';
  if (k.sec.guilty.includes(me)) return 'own';
  if (k.k.credence < 45) return 'rumours';
  return k.sec.treason ? 'treason' : 'crimes';
}

const GROUPS: { id: Group; title: string; note: string }[] = [
  { id: 'treason', title: 'Treason', note: 'Plots against the crown. Laid before the King, these can end in the axe.' },
  { id: 'crimes', title: 'Crimes and schemes', note: 'Theft, false witness, private murder, ruin. Enough to disgrace, sometimes more.' },
  { id: 'forged', title: 'Your forgeries', note: 'Lies of your own making. Spread them, or bring them before the King — if the seals hold.' },
  { id: 'own', title: 'Your own guilt', note: 'Secrets that would hang you. Others may know them too.' },
  { id: 'rumours', title: 'Rumours', note: 'Things you have heard but do not quite believe.' },
];

export function Ledger() {
  const { s, openDeed, select } = useGame();
  const P = s.player;
  const all = knownSecrets(s, P).filter((k) => !(k.sec.plotId && s.plots[k.sec.plotId]?.status !== 'active' && !k.sec.treason && !k.sec.exposed && k.sec.kind === 'ruin'));
  const [filter, setFilter] = useState<Group | 'all'>('all');
  return (
    <div className="ledger">
      <header className="view-head">
        <h2 className="panel-title">The Ledger of Secrets</h2>
        <p className="muted">Everything you know, half-know, or have invented. Each secret is only as good as the people who believe it.</p>
        <div className="filters" role="group" aria-label="Filter">
          {(['all', ...GROUPS.map((g) => g.id)] as const).map((g) => (
            <button key={g} className={`filter ${filter === g ? 'is-on' : ''}`} onClick={() => setFilter(g)}>
              {g === 'all' ? 'All' : GROUPS.find((x) => x.id === g)!.title}
            </button>
          ))}
        </div>
      </header>
      {all.length === 0 && <p className="muted">You know nothing yet. Keep company, set spies, listen.</p>}
      {GROUPS.filter((g) => filter === 'all' || filter === g.id).map((g) => {
        const items = all.filter((k) => groupOf(k, P) === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} className="ledger-group">
            <h3 className="panel-subtitle">{g.title}</h3>
            <p className="muted small">{g.note}</p>
            <ul className="secrets">
              {items.map((k) => (
                <li key={k.sec.id} className={`secret secret--${g.id} ${k.sec.exposed ? 'is-exposed' : ''}`}>
                  <div className="secret-top">
                    <span className="chip">{SECRET_KIND_LABEL[k.sec.kind]}</span>
                    {k.sec.exposed && <span className="chip chip--warn">Proven at court</span>}
                    {k.k.lie && <span className="chip chip--info">Forged by you</span>}
                  </div>
                  <p className="secret-text">{k.text}</p>
                  <div className="secret-meta">
                    {!k.k.lie && g.id !== 'own' && (
                      <span className="meter" title={`Your belief: ${k.k.credence}`}>
                        <span className="meter-label">You are {credenceWord(k.k.credence)}</span>
                        <span className="meter-bar">
                          <span style={{ width: `${k.k.credence}%` }} />
                        </span>
                      </span>
                    )}
                    <span className="meter" title={`Proof: ${k.sec.evidence}`}>
                      <span className="meter-label">Proof: {evidenceWord(k.sec.evidence)}</span>
                      <span className="meter-bar meter-bar--proof">
                        <span style={{ width: `${k.sec.evidence}%` }} />
                      </span>
                    </span>
                  </div>
                  <p className="muted small">
                    {k.k.source === 'self'
                      ? k.k.lie
                        ? `You forged this in week ${k.k.turn}.`
                        : 'You know this first-hand.'
                      : k.k.source === 'spies'
                        ? `Your spies brought it, week ${k.k.turn}.`
                        : k.k.source === 'rumour'
                          ? `A rumour, week ${k.k.turn}.`
                          : k.k.source === 'court' || k.k.source === 'confession'
                            ? `Heard at court, week ${k.k.turn}.`
                            : `Told you by ${nm(s, k.k.source)}, week ${k.k.turn}.`}
                    {k.told.length > 0 && ` You have told ${k.told.map((t) => first(s, t)).join(', ')}.`}{' '}
                    Concerns:{' '}
                    {k.sec.guilty.map((g2, i) => (
                      <span key={g2}>
                        {i > 0 && ', '}
                        <button className="link" onClick={() => select(g2)}>
                          {first(s, g2)}
                        </button>
                      </span>
                    ))}
                  </p>
                  {s.phase === 'playing' && g.id !== 'own' && (
                    <div className="row-actions">
                      <button className="btn btn--sm" onClick={() => openDeed({ type: 'whisper', secretId: k.sec.id })} disabled={s.ap < 1}>
                        Whisper it…
                      </button>
                      {s.king && s.king !== P && (k.k.lie || k.k.credence >= 40) && (
                        <button className="btn btn--sm" onClick={() => openDeed({ type: 'denounce', secretId: k.sec.id })} disabled={s.ap < 2}>
                          Denounce…
                        </button>
                      )}
                      {(k.k.lie || k.k.credence >= 40) && k.sec.guilty.some((x) => x !== P && s.chars[x].status === 'free') && (
                        <button
                          className="btn btn--sm"
                          onClick={() => openDeed({ type: 'blackmail', secretId: k.sec.id, target: k.sec.guilty.find((x) => x !== P && s.chars[x].status === 'free') })}
                          disabled={s.ap < 1}
                        >
                          Blackmail…
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
