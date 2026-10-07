import {
  OFFICE_NAMES,
  ch,
  denounceOdds,
  first,
  isRemoved,
  offerLabel,
  plotViews,
  strikeChance,
  waitCleared,
  type PlotView,
} from '../../engine';
import { useGame } from '../context';

function Progress({ value }: { value: number }) {
  return (
    <span className="meter meter--wide" title={`${value}% prepared`}>
      <span className="meter-label">{value}% prepared</span>
      <span className="meter-bar meter-bar--plot">
        <span style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}

function PlotCard({ v }: { v: PlotView }) {
  const { s, openDeed, select } = useGame();
  const P = s.player;
  const { plot, role } = v;
  const owner = plot.owner === P;
  const ready = waitCleared(s, plot);
  const me = plot.members.find((m) => m.id === P);
  const active = plot.status === 'active';
  const odds = owner && plot.kind === 'ruin' && active && s.king && s.king !== P ? denounceOdds(s, P, { type: 'denounce', plotId: plot.id }) : [];
  return (
    <article className={`plot plot--${plot.kind} plot--${role} ${active ? '' : 'is-over'}`}>
      <header className="plot-head">
        <div>
          <p className="eyebrow">
            {plot.kind === 'murder' ? 'Murder' : 'Ruin'} · {role === 'owner' ? 'your scheme' : role === 'member' ? `sworn to ${first(s, plot.owner)}` : `${first(s, plot.owner)}'s scheme`}
            {!active && ` · ${plot.status}`}
          </p>
          <h3 className="plot-name">“{plot.name}”</h3>
        </div>
        {role === 'known' && <span className="chip chip--warn">You are {v.belief >= 65 ? 'sure' : 'fairly sure'} of it</span>}
      </header>
      <p>
        Against{' '}
        {plot.targets.length
          ? plot.targets.map((t, i) => (
              <span key={t}>
                {i > 0 && ', '}
                <button className="link" onClick={() => select(t)}>
                  {first(s, t)}
                </button>
              </span>
            ))
          : 'no one now'}
        .{role !== 'known' && <span className="muted"> {plot.intent}</span>}
      </p>
      {role !== 'known' && <Progress value={plot.progress} />}
      {plot.waitFor.length > 0 && role !== 'known' && (
        <p className="small">
          Waits until these are gone:{' '}
          {plot.waitFor.map((w, i) => (
            <span key={w} className={isRemoved(s, w) ? 'good' : ''}>
              {i > 0 && ', '}
              {first(s, w)}
              {isRemoved(s, w) ? ' ✓' : ''}
            </span>
          ))}
          {ready ? ' — the way is clear.' : ''}
        </p>
      )}
      {(role !== 'known' || plot.members.length > 0) && (
        <div className="members">
          <span className="muted small">{role === 'known' ? 'Owner and known members:' : 'Sworn:'}</span>
          <ul>
            {role === 'known' && <li>{first(s, plot.owner)} (leads it)</li>}
            {plot.members.map((m) => {
              const sincere = v.sincerity[m.id];
              return (
                <li key={m.id}>
                  <button className="link" onClick={() => select(m.id)}>
                    {first(s, m.id)}
                  </button>{' '}
                  <span className="muted">— {m.role}</span>
                  {m.offer && m.offer.kind !== 'none' && owner && <span className="muted"> · promised {offerLabel(s, m.offer)}</span>}
                  {m.id === P ? (
                    <span className={`chip ${m.sincere ? '' : 'chip--danger'}`}>{m.sincere ? 'You mean it' : 'You mean to betray it'}</span>
                  ) : sincere === undefined ? (
                    role !== 'known' && <span className="chip chip--muted" title="Spy on them (schemes) to learn whether they mean it">Sincere?</span>
                  ) : (
                    <span className={`chip ${sincere ? 'chip--good' : 'chip--danger'}`}>{sincere ? 'Means it' : 'Means to betray'}</span>
                  )}
                </li>
              );
            })}
            {plot.members.length === 0 && role !== 'known' && <li className="muted">No one else. Yet.</li>}
          </ul>
        </div>
      )}
      {owner && plot.kind === 'murder' && active && (
        <p className="small">
          Strike now: <strong>{strikeChance(s, plot)}%</strong> to kill. Hired blades: {plot.hiredBlades}.
        </p>
      )}
      {odds.length > 0 && (
        <p className="small">
          Denounce now: {odds.map((o) => `${first(s, o.accused)} ${o.pct}%`).join(' · ')}
        </p>
      )}
      {active && s.phase === 'playing' && role !== 'known' && ch(s, P).status === 'free' && (
        <div className="row-actions">
          <button className="btn btn--sm" disabled={s.ap < 1} onClick={() => openDeed({ type: 'advance', plotId: plot.id })}>
            Work on it
          </button>
          {owner && (
            <button className="btn btn--sm" disabled={s.ap < 1} onClick={() => openDeed({ type: 'recruit', plotId: plot.id })}>
              Draw someone in…
            </button>
          )}
          {owner && plot.kind === 'murder' && (
            <button className="btn btn--sm btn--danger" disabled={s.ap < 2} onClick={() => openDeed({ type: 'strike', plotId: plot.id })}>
              Strike…
            </button>
          )}
          {owner && plot.kind === 'ruin' && s.king && s.king !== P && (
            <button className="btn btn--sm btn--danger" disabled={s.ap < 2} onClick={() => openDeed({ type: 'denounce', plotId: plot.id })}>
              Denounce before the King…
            </button>
          )}
          <button className="btn btn--sm btn--ghost" onClick={() => openDeed({ type: 'abandon', plotId: plot.id })}>
            {owner ? 'Abandon' : 'Withdraw'}
          </button>
          {me && !me.sincere && s.king && s.king !== P && (
            <button className="btn btn--sm" disabled={s.ap < 2} onClick={() => openDeed({ type: 'denounce', secretId: plot.secretId })}>
              Betray it to the King…
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function Schemes() {
  const { s, openDeed } = useGame();
  const P = s.player;
  const views = plotViews(s, P);
  const active = views.filter((v) => v.plot.status === 'active');
  const over = views.filter((v) => v.plot.status !== 'active');
  const pledges = s.pledges.filter((p) => p.from === P || p.to === P);
  const sections: [string, PlotView[]][] = [
    ['Your schemes', active.filter((v) => v.role === 'owner')],
    ['Schemes you are sworn to', active.filter((v) => v.role === 'member')],
    ['Schemes you know of', active.filter((v) => v.role === 'known')],
  ];
  return (
    <div className="schemes">
      <header className="view-head">
        <h2 className="panel-title">Schemes</h2>
        <p className="muted">Murder needs preparation and steady hands. Ruin needs proof and witnesses. Every conspirator is a door that might open.</p>
        {s.phase === 'playing' && ch(s, P).status === 'free' && (
          <button className="btn btn--primary" disabled={s.ap < 1} onClick={() => openDeed({ type: 'scheme' })}>
            Begin a new scheme…
          </button>
        )}
      </header>
      {sections.map(([title, list]) => (
        <section key={title} className="scheme-group">
          <h3 className="panel-subtitle">{title}</h3>
          {list.length === 0 ? <p className="muted small">None.</p> : list.map((v) => <PlotCard key={v.plot.id} v={v} />)}
        </section>
      ))}
      {pledges.length > 0 && (
        <section className="scheme-group">
          <h3 className="panel-subtitle">Oaths and promises</h3>
          <ul className="mini-list">
            {pledges.map((p) => (
              <li key={p.id}>
                {p.text} <span className={`chip ${p.status === 'kept' ? 'chip--good' : p.status === 'broken' ? 'chip--danger' : ''}`}>{p.status}</span>
                {p.status === 'pending' && p.offer.office && <span className="muted"> ({OFFICE_NAMES[p.offer.office]} is {s.offices[p.offer.office] ? `held by ${first(s, s.offices[p.offer.office]!)}` : 'vacant'})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {over.length > 0 && (
        <details className="scheme-group">
          <summary className="panel-subtitle">Finished schemes ({over.length})</summary>
          {over.map((v) => (
            <PlotCard key={v.plot.id} v={v} />
          ))}
        </details>
      )}
    </div>
  );
}
