import {
  ACTION_INFO,
  COST,
  OFFICE_NAMES,
  ch,
  first,
  incomeOf,
  knowsAgenda,
  landsOf,
  nm,
  officeOf,
  officeEligible,
  opinion,
  opinionWord,
  plotViews,
  secretsAbout,
  styleOf,
  temperament,
  trust,
  visibleMods,
  type CharId,
  type GameState,
  type IntentType,
  type OfficeId,
} from '../../engine';
import { useGame } from '../context';
import { Shield } from './Shield';

interface DeedButton {
  type: IntentType;
  why?: string;
}

/** Which deeds to offer on this person's page, and why some cannot be done. */
export function deedsFor(s: GameState, target: CharId): DeedButton[] {
  const P = s.player;
  const me = ch(s, P);
  const t = ch(s, target);
  const out: DeedButton[] = [];
  const iAmKing = s.king === P;
  const jailed = me.status === 'imprisoned';
  const gone = t.status === 'dead' || t.status === 'fled';
  if (gone) return [];
  const known = Object.entries(s.knowledge[P] ?? {}).filter(([sid, k]) => (k.lie || k.credence >= 1) && s.secrets[sid] && !s.secrets[sid].guilty.includes(P));
  const against = known.filter(([sid, k]) => (k.lie || k.credence >= 40) && s.secrets[sid].guilty.includes(target));
  const myPlots = Object.values(s.plots).filter((p) => p.status === 'active' && p.owner === P);

  if (target === P) {
    if (jailed) return [{ type: 'escape' }];
    out.push({ type: 'scheme' }, { type: 'fabricate' }, { type: 'guard', why: me.gold < 20 ? 'You need 20 crowns.' : undefined });
    if (!iAmKing && s.king) out.push({ type: 'petition' });
    out.push({ type: 'flee' });
    return out;
  }
  if (t.status === 'imprisoned') {
    if (iAmKing) out.push({ type: 'question', why: 'They are already in the Tower; the questioners are at work.' }, { type: 'execute' }, { type: 'release' });
    else if (s.king) out.push({ type: 'petition' });
    out.push({ type: 'whisper', why: 'They are in the Tower.' });
    return out;
  }
  if (jailed) {
    out.push({ type: 'whisper', why: known.length ? undefined : 'You know nothing worth a letter.' });
    if (me.spouse === target) out.push({ type: 'counsel' });
    return out;
  }
  out.push({ type: 'converse' });
  out.push({ type: 'gift', why: me.gold <= 0 ? 'Your purse is empty.' : undefined });
  out.push({ type: 'whisper', why: known.length ? undefined : 'You know no secret to share.' });
  out.push({ type: 'spy' });
  if (me.spouse === target) out.push({ type: 'counsel' });
  out.push({ type: 'recruit', why: myPlots.some((p) => !p.targets.includes(target) && !p.members.some((m) => m.id === target)) ? undefined : 'You lead no scheme to draw them into.' });
  if (!iAmKing) {
    out.push({
      type: 'denounce',
      why: !s.king ? 'There is no King to hear you.' : against.length ? undefined : 'You know nothing against them you could swear to.',
    });
  }
  out.push({ type: 'blackmail', why: against.length ? undefined : 'You know nothing to threaten them with.' });
  out.push({ type: 'fabricate' });
  out.push({ type: 'scheme' });
  if (landsOf(s, P).length || (iAmKing && Object.values(s.lands).some((l) => l.holder === null))) out.push({ type: 'grant' });
  if (iAmKing) {
    out.push({ type: 'question' }, { type: 'arrest' });
    const vacant = (Object.keys(s.offices) as OfficeId[]).some((o) => !s.offices[o] && officeEligible(s, target, o));
    out.push({ type: 'appoint', why: vacant ? undefined : 'No vacant office they could hold.' });
  }
  return out;
}

export function Dossier() {
  const { s, selected, openDeed } = useGame();
  const P = s.player;
  const id = selected ?? P;
  const c = ch(s, id);
  const isMe = id === P;
  const off = officeOf(s, id);
  const lands = landsOf(s, id).map((l) => s.lands[l]);
  const motive = knowsAgenda(s, P, id);
  const theirView = isMe ? null : opinion(s, id, P);
  const myView = isMe ? null : opinion(s, P, id);
  const myMods = isMe ? [] : visibleMods(s, P, P, id);
  const theirMods = isMe ? [] : visibleMods(s, P, id, P);
  const known = secretsAbout(s, P, id);
  const plots = plotViews(s, P).filter((v) => v.plot.owner === id || v.plot.targets.includes(id) || (v.plot.members.some((m) => m.id === id) && v.role !== 'known'));
  const deeds = deedsFor(s, id);
  const tags = temperament(s, id);
  const knowsTheft = Object.values(s.secrets).some((x) => x.kind === 'theft' && x.guilty.includes(id) && (s.knowledge[P]?.[x.id]?.credence ?? 0) >= 40);

  return (
    <div className="dossier">
      <div className="dossier-head">
        <Shield h={c.heraldry} size={72} status={c.status} crowned={s.king === id} />
        <div className="dossier-id">
          <h2 className="display-sm">{nm(s, id)}</h2>
          <p className="muted">
            {styleOf(s, id)} · {c.epithet} · {c.age}
          </p>
          {c.status !== 'free' && <p className={`status-line ${c.status === 'dead' ? 'bad' : ''}`}>{c.status === 'imprisoned' ? 'Held in the Tower' : c.fate}</p>}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tags" aria-label="Temperament">
          {tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}

      <dl className="facts">
        <dt>Presents as</dt>
        <dd className="italic">{c.facade}</dd>
        <dt>True design</dt>
        <dd className={motive ? 'reveal' : 'muted'}>{motive ? c.agenda.summary : 'Hidden. Set spies on them (motive) to learn it.'}</dd>
        {!isMe && (
          <>
            <dt>Their attitude to you</dt>
            <dd>
              <span className={theirView! >= 10 ? 'good' : theirView! <= -10 ? 'bad' : ''}>
                {opinionWord(theirView!)} ({theirView! > 0 ? '+' : ''}
                {theirView})
              </span>
              {theirMods.length > 0 && (
                <ul className="mods">
                  {theirMods.map((m) => (
                    <li key={m.key}>
                      <span className={m.value > 0 ? 'good' : 'bad'}>{m.value > 0 ? `+${Math.round(m.value)}` : Math.round(m.value)}</span> {m.label}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Your view of them</dt>
            <dd>
              {opinionWord(myView!)} ({myView! > 0 ? '+' : ''}
              {myView}) · trust {trust(s, P, id)}
              {myMods.length > 0 && (
                <ul className="mods">
                  {myMods.map((m) => (
                    <li key={m.key}>
                      <span className={m.value > 0 ? 'good' : 'bad'}>{m.value > 0 ? `+${Math.round(m.value)}` : Math.round(m.value)}</span> {m.label}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </>
        )}
        {(c.spouse || c.siblings.length > 0) && (
          <>
            <dt>Family</dt>
            <dd>
              {[c.spouse ? `married to ${first(s, c.spouse)}` : '', c.siblings.length ? `brother of ${c.siblings.map((b) => first(s, b)).join(' and ')}` : '']
                .filter(Boolean)
                .join('; ')}
            </dd>
          </>
        )}
        <dt>Holds</dt>
        <dd>
          {[off ? OFFICE_NAMES[off] : '', ...lands.map((l) => l.name + (l.rightful && l.rightful !== id && knowsTheft ? ` (rightfully ${first(s, l.rightful)}'s)` : ''))]
            .filter(Boolean)
            .join(', ') ||
            'Nothing of note'}
          {isMe && (
            <span className="muted">
              {' '}
              · {c.gold} crowns, +{incomeOf(s, id)} a week
            </span>
          )}
        </dd>
        {isMe && Math.abs(c.pressure) >= 5 && (
          <>
            <dt>{c.pressure > 0 ? 'Goaded' : 'Restrained'}</dt>
            <dd>
              {c.spouse ? first(s, c.spouse) : 'Someone'} has been {c.pressure > 0 ? 'pushing you on' : 'holding you back'} ({Math.abs(c.pressure)}). It
              colours your nerve.
            </dd>
          </>
        )}
      </dl>

      {!isMe && known.length > 0 && (
        <section className="dossier-section">
          <h3 className="panel-subtitle">What you hold against them</h3>
          <ul className="mini-list">
            {known.map((k) => (
              <li key={k.sec.id}>
                {k.k.lie ? <span className="chip chip--info">Your forgery</span> : <span className="muted">{k.k.credence}% sure · </span>}
                {k.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plots.length > 0 && (
        <section className="dossier-section">
          <h3 className="panel-subtitle">Schemes you know of</h3>
          <ul className="mini-list">
            {plots.map(({ plot, role }) => (
              <li key={plot.id}>
                “{plot.name}” — {first(s, plot.owner)} against {plot.targets.map((t) => first(s, t)).join(', ') || 'no one now'}{' '}
                <span className="muted">
                  ({plot.status !== 'active' ? plot.status : role === 'known' ? 'you know of it' : role === 'owner' ? 'yours' : 'you are sworn'})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deeds.length > 0 && s.phase === 'playing' && (
        <section className="dossier-section">
          <h3 className="panel-subtitle">{isMe ? 'Your own business' : `Deal with ${c.short}`}</h3>
          <div className="deeds">
            {deeds.map((d) => {
              const cost = COST[d.type];
              const noTime = cost > s.ap;
              const why = d.why ?? (noTime ? 'Not enough time left this week.' : undefined);
              return (
                <button
                  key={d.type}
                  className="deed"
                  disabled={!!why}
                  title={why ?? ACTION_INFO[d.type].desc}
                  onClick={() => openDeed({ type: d.type, target: isMe ? undefined : id })}
                >
                  <span>{ACTION_INFO[d.type].name}</span>
                  <span className="cost" aria-label={`${cost} time`}>
                    {cost ? '●'.repeat(cost) : 'free'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isMe && <p className="bio">{c.bio}</p>}
    </div>
  );
}
