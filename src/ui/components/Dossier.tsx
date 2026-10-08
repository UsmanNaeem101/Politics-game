import {
  ACQUAINTANCE,
  ACTION_INFO,
  COST,
  CONTACT,
  OFFICE_NAMES,
  TRAIT_WORDS,
  acquaintance,
  ch,
  first,
  incomeOf,
  knowsAgenda,
  landsOf,
  nm,
  officeEligible,
  officeOf,
  opinion,
  opinionWord,
  plotViews,
  secretsAbout,
  styleOf,
  trust,
  visibleMods,
  type CharId,
  type GameState,
  type IntentType,
  type OfficeId,
  type TraitKey,
} from '../../engine';
import { useGame } from '../context';
import { GIcon, type GIName } from '../icons/GIcon';
import { roleIcon, roleLabel } from './CourtMap';
import { Shield } from './Shield';

interface DeedButton {
  type: IntentType;
  why?: string;
}

const LEVEL_ICON: GIName[] = ['unknown', 'unknown', 'dossier', 'converse', 'family', 'motive'];

/** Which deeds to offer on this person's page, and why some cannot be done. */
export function deedsFor(s: GameState, target: CharId): DeedButton[] {
  const P = s.player;
  const me = ch(s, P);
  const t = ch(s, target);
  const out: DeedButton[] = [];
  const iAmKing = s.king === P;
  const jailed = me.status === 'imprisoned';
  if (t.status === 'dead' || t.status === 'fled') return [];
  const lvl = acquaintance(s, target);
  const servant = t.rank === 'servant';
  const known = Object.entries(s.knowledge[P] ?? {}).filter(([sid, k]) => (k.lie || k.credence >= 1) && s.secrets[sid] && !s.secrets[sid].guilty.includes(P));
  const against = known.filter(([sid, k]) => (k.lie || k.credence >= 40) && s.secrets[sid].guilty.includes(target));
  const myPlots = Object.values(s.plots).filter((p) => p.status === 'active' && p.owner === P);
  const needIntro = (type: IntentType) => CONTACT.includes(type) && lvl < (servant ? 2 : 3);
  const gate = (d: DeedButton): DeedButton => (needIntro(d.type) ? { ...d, why: lvl < 2 ? 'Find them first.' : 'You must be introduced first.' } : d);

  if (target === P) {
    if (jailed) return [{ type: 'escape' }];
    out.push({ type: 'scheme' }, { type: 'fabricate' }, { type: 'guard', why: me.gold < 20 ? 'You need 20 crowns.' : undefined });
    if (!iAmKing && s.king) out.push({ type: 'petition' });
    out.push({ type: 'flee' });
    return out;
  }
  if (t.status === 'imprisoned') {
    if (iAmKing) out.push({ type: 'execute' }, { type: 'release' });
    else if (s.king) out.push({ type: 'petition' });
    return out;
  }
  if (jailed) {
    out.push(gate({ type: 'whisper', why: known.length ? undefined : 'You know nothing worth a letter.' }));
    if (me.spouse === target) out.push({ type: 'counsel' });
    return out;
  }
  if (lvl === 2 && !servant) out.push({ type: 'introduce' });
  out.push({ type: 'spy', why: lvl < 1 ? 'You know nothing of them.' : undefined });
  out.push(gate({ type: 'converse' }));
  out.push(gate({ type: 'gift', why: me.gold <= 0 ? 'Your purse is empty.' : undefined }));
  out.push(gate({ type: 'whisper', why: known.length ? undefined : 'You know no secret to share.' }));
  if (me.spouse === target) out.push({ type: 'counsel' });
  if (!servant) {
    out.push(gate({ type: 'recruit', why: myPlots.some((p) => !p.targets.includes(target) && !p.members.some((m) => m.id === target)) ? undefined : 'You lead no scheme to draw them into.' }));
    if (!iAmKing) out.push({ type: 'denounce', why: !s.king ? 'There is no King to hear you.' : against.length ? undefined : 'You know nothing against them you could swear to.' });
    out.push(gate({ type: 'blackmail', why: against.length ? undefined : 'You know nothing to threaten them with.' }));
    out.push({ type: 'fabricate' });
    out.push({ type: 'scheme' });
    if (landsOf(s, P).length || (iAmKing && Object.values(s.lands).some((l) => l.holder === null))) out.push(gate({ type: 'grant' }));
    if (iAmKing) {
      out.push({ type: 'question' }, { type: 'arrest' });
      const vacant = (Object.keys(s.offices) as OfficeId[]).some((o) => !s.offices[o] && officeEligible(s, target, o));
      out.push({ type: 'appoint', why: vacant ? undefined : 'No vacant office they could hold.' });
    }
  }
  return out;
}

function TraitChips({ id }: { id: CharId }) {
  const { s } = useGame();
  const t = ch(s, id).traits;
  const chips = (Object.keys(TRAIT_WORDS) as TraitKey[])
    .map((k) => ({ k, v: t[k] }))
    .filter((x) => x.v >= 70 || x.v <= 25)
    .map((x) => ({ k: x.k, word: TRAIT_WORDS[x.k][x.v >= 70 ? 1 : 0], high: x.v >= 70 }));
  if (!chips.length) return <p className="muted small">An ordinary temperament.</p>;
  return (
    <div className="tags">
      {chips.map((c) => (
        <span key={c.k} className={`tag ${c.high ? '' : 'tag--low'}`} title={`${c.k}: ${t[c.k]}`}>
          <GIcon name={c.k as GIName} size={14} /> {c.word}
        </span>
      ))}
    </div>
  );
}

export function Dossier() {
  const { s, selected, openDeed, select } = useGame();
  const P = s.player;
  const id = selected ?? P;
  const c = ch(s, id);
  const isMe = id === P;
  const lvl = acquaintance(s, id);
  const dark = lvl <= 1;
  const off = officeOf(s, id);
  const lands = landsOf(s, id).map((l) => s.lands[l]);
  const motive = knowsAgenda(s, P, id);
  const house = s.houses[c.householdId];
  const theirView = isMe || lvl < 3 ? null : opinion(s, id, P);
  const myView = isMe ? null : opinion(s, P, id);
  const myMods = isMe ? [] : visibleMods(s, P, P, id);
  const theirMods = isMe || lvl < 3 ? [] : visibleMods(s, P, id, P);
  const known = secretsAbout(s, P, id);
  const plots = plotViews(s, P).filter((v) => v.plot.owner === id || v.plot.targets.includes(id) || (v.plot.members.some((m) => m.id === id) && v.role !== 'known'));
  const deeds = deedsFor(s, id);
  const close = isMe || (c.householdId === ch(s, P).householdId) || ch(s, P).siblings.includes(id);
  const knowsTheft = Object.values(s.secrets).some((x) => x.kind === 'theft' && x.guilty.includes(id) && (s.knowledge[P]?.[x.id]?.credence ?? 0) >= 40);

  return (
    <div className="dossier">
      <div className="dossier-head">
        {dark ? (
          <span className="dossier-dark">
            <GIcon name="unknown" size={64} />
          </span>
        ) : (
          <Shield h={c.heraldry} size={64} status={c.status} crowned={s.king === id} />
        )}
        <div className="dossier-id">
          <h2 className="display-sm">{nm(s, id)}</h2>
          <p className="muted">
            {!dark && <GIcon name={roleIcon(s, id)} size={14} />} {dark ? (house ? `of House ${house.name}` : 'Unknown') : `${roleLabel(s, id)}${c.epithet ? ` · ${c.epithet}` : ''}${lvl >= 3 ? ` · ${c.age}` : ''}`}
          </p>
          {!isMe && (
            <span className={`acq acq--${lvl}`} title="How well you know them">
              <GIcon name={LEVEL_ICON[lvl]} size={13} /> {ACQUAINTANCE[lvl]}
            </span>
          )}
          {c.status !== 'free' && <p className={`status-line ${c.status === 'dead' ? 'bad' : ''}`}>{c.status === 'imprisoned' ? 'Held in the Tower' : c.fate}</p>}
        </div>
      </div>

      {dark && !isMe && c.status !== 'dead' && (
        <div className="hint-card">
          <GIcon name="unknown" size={18} />
          <p>
            You have only heard of {first(s, id)}. To find them: set spies on {house ? `House ${house.name}` : 'their household'}, watch for them at the seasonal feast, or let your wife make friends.
          </p>
        </div>
      )}
      {lvl === 2 && !isMe && c.rank !== 'servant' && c.status === 'free' && (
        <div className="hint-card">
          <GIcon name="introduce" size={18} />
          <p>You know {first(s, id)} by sight. You must be introduced before you can deal with them.</p>
        </div>
      )}

      {!dark && (lvl >= 4 || close) && <TraitChips id={id} />}

      <dl className="facts">
        {!dark && (
          <>
            <dt>Presents as</dt>
            <dd className="italic">{c.facade}</dd>
          </>
        )}
        {!isMe && (
          <>
            <dt>
              <GIcon name="motive" size={12} /> True design
            </dt>
            <dd className={motive ? 'reveal' : 'muted'}>{motive ? c.agenda.summary : 'Hidden. Set spies on them (motive) to learn it.'}</dd>
          </>
        )}
        {theirView !== null && (
          <>
            <dt>Their attitude to you</dt>
            <dd>
              <span className={theirView >= 10 ? 'good' : theirView <= -10 ? 'bad' : ''}>
                {opinionWord(theirView)} ({theirView > 0 ? '+' : ''}
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
          </>
        )}
        {myView !== null && !dark && (
          <>
            <dt>Your view of them</dt>
            <dd>
              {opinionWord(myView)} ({myView > 0 ? '+' : ''}
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
        {!dark && (c.spouse || c.siblings.length > 0) && (
          <>
            <dt>
              <GIcon name="family" size={12} /> Family
            </dt>
            <dd className="links">
              {c.spouse && acquaintance(s, c.spouse) >= 1 && (
                <button className="link" onClick={() => select(c.spouse!)}>
                  {c.gender === 'f' ? 'husband' : 'wife'}: {first(s, c.spouse)}
                </button>
              )}
              {c.siblings
                .filter((b) => acquaintance(s, b) >= 1)
                .map((b) => (
                  <button key={b} className="link" onClick={() => select(b)}>
                    brother: {first(s, b)}
                  </button>
                ))}
            </dd>
          </>
        )}
        {!dark && (
          <>
            <dt>
              <GIcon name="land" size={12} /> Holds
            </dt>
            <dd>
              {[off ? OFFICE_NAMES[off] : '', ...lands.map((l) => l.name + (l.rightful && l.rightful !== id && (knowsTheft || isMe) ? ` (rightfully ${first(s, l.rightful)}'s)` : ''))]
                .filter(Boolean)
                .join(', ') || 'Nothing of note'}
              {isMe && (
                <span className="muted">
                  {' '}
                  · {c.gold} crowns, +{incomeOf(s, id)} a week
                </span>
              )}
            </dd>
          </>
        )}
        {isMe && Math.abs(c.pressure) >= 5 && (
          <>
            <dt>{c.pressure > 0 ? 'Goaded' : 'Restrained'}</dt>
            <dd>
              {c.spouse ? first(s, c.spouse) : 'Someone'} has been {c.pressure > 0 ? 'pushing you on' : 'holding you back'} ({Math.abs(c.pressure)}). It colours your nerve.
            </dd>
          </>
        )}
      </dl>

      {!isMe && known.length > 0 && (
        <section className="dossier-section">
          <h3 className="panel-subtitle">
            <GIcon name="secrets" size={14} /> What you hold against them
          </h3>
          <ul className="mini-list">
            {known.map((k) => (
              <li key={k.sec.id}>
                <GIcon name={k.sec.kind as GIName} size={13} /> {k.k.lie ? <span className="chip chip--info">Your forgery</span> : <span className="muted">{k.k.credence}% sure · </span>}
                {k.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plots.length > 0 && (
        <section className="dossier-section">
          <h3 className="panel-subtitle">
            <GIcon name="schemes" size={14} /> Schemes you know of
          </h3>
          <ul className="mini-list">
            {plots.map(({ plot, role }) => (
              <li key={plot.id}>
                “{plot.name}” — {first(s, plot.owner)} against {plot.targets.map((t) => first(s, t)).join(', ') || 'no one now'}{' '}
                <span className="muted">({plot.status !== 'active' ? plot.status : role === 'known' ? 'you know of it' : role === 'owner' ? 'yours' : 'you are sworn'})</span>
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
                <button key={d.type} className="deed" disabled={!!why} title={why ?? ACTION_INFO[d.type].desc} onClick={() => openDeed({ type: d.type, target: isMe ? undefined : id })}>
                  <GIcon name={d.type as GIName} size={20} />
                  <span className="deed-name">{ACTION_INFO[d.type].name}</span>
                  <span className="cost" aria-label={`${cost} time`}>
                    {cost ? Array.from({ length: cost }, (_, i) => <GIcon key={i} name="time" size={11} />) : 'free'}
                  </span>
                  {why && <span className="deed-why">{why}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isMe && <p className="bio">{c.bio}</p>}
      {isMe && <p className="muted small">{styleOf(s, id)}</p>}
    </div>
  );
}
