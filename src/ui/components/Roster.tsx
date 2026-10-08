import {
  ACQUAINTANCE,
  acquaintance,
  ch,
  knowsAgenda,
  knownThreats,
  opinion,
  opinionWord,
  suspects,
  type CharId,
  type GameState,
  type House,
} from '../../engine';
import { useGame } from '../context';
import { GIcon } from '../icons/GIcon';
import { roleIcon, roleLabel } from './CourtMap';
import { Shield } from './Shield';

const HOUSE_ORDER = { royal: 0, church: 1, great: 2, lesser: 3 } as const;

export function housesInOrder(s: GameState): House[] {
  return Object.values(s.houses).sort((a, b) => HOUSE_ORDER[a.rank] - HOUSE_ORDER[b.rank] || a.arrived - b.arrived || a.name.localeCompare(b.name));
}

export function Marks({ id }: { id: CharId }) {
  const { s } = useGame();
  if (id === s.player) return <span className="chip chip--you">You</span>;
  const threat = knownThreats(s, s.player).some((v) => v.plot.owner === id || v.plot.members.some((m) => m.id === id));
  const sus = suspects(s, s.player, id);
  return (
    <span className="marks">
      {threat && <GIcon name="threat" size={14} title="Plots against you" className="mk-threat" />}
      {!threat && sus >= 45 && <GIcon name="suspect" size={14} title="You suspect them of something" className="mk-sus" />}
      {knowsAgenda(s, s.player, id) && <GIcon name="motive" size={14} title="You know their true design" className="mk-motive" />}
    </span>
  );
}

export function Person({ id, compact = false }: { id: CharId; compact?: boolean }) {
  const { s, selected, select } = useGame();
  const c = ch(s, id);
  const lvl = acquaintance(s, id);
  const att = id === s.player || lvl < 3 || c.status === 'dead' ? null : opinion(s, id, s.player);
  const dark = lvl <= 1;
  return (
    <button className={`roster-item ${selected === id ? 'is-selected' : ''} is-${c.status} ${dark ? 'is-dark' : ''}`} onClick={() => select(id)}>
      <span className="roster-face">
        {dark ? <GIcon name="unknown" size={26} /> : <Shield h={c.heraldry} size={24} status={c.status} crowned={s.king === id} />}
      </span>
      <span className="roster-name">
        <span className="name">{s.king === id ? `King ${c.short}` : c.name}</span>
        <small>
          {!dark && <GIcon name={roleIcon(s, id)} size={12} />} {dark ? ACQUAINTANCE[lvl] : c.status === 'free' ? roleLabel(s, id) : c.status === 'imprisoned' ? 'In the Tower' : c.status === 'fled' ? 'Fled' : 'Dead'}
        </small>
      </span>
      {!compact && (
        <span className="roster-side">
          {att !== null && (
            <span className={`att ${att >= 10 ? 'good' : att <= -10 ? 'bad' : ''}`} title={`Their attitude to you: ${att}`}>
              {opinionWord(att)}
            </span>
          )}
          <Marks id={id} />
        </span>
      )}
    </button>
  );
}

export function Roster() {
  const { s } = useGame();
  const known = s.order.filter((id) => acquaintance(s, id) >= 2).length;
  const heard = s.order.filter((id) => acquaintance(s, id) === 1).length;
  return (
    <div className="roster">
      <h2 className="panel-title">
        <GIcon name="people" size={16} /> The court
      </h2>
      <p className="muted small">
        You know {known} faces, and {heard} more by name only.
      </p>
      {housesInOrder(s).map((h) => {
        const members = h.members.filter((m) => acquaintance(s, m) >= 1);
        if (!members.length) return null;
        const hidden = h.members.length - members.length;
        return (
          <section key={h.id} className="roster-house">
            <h3 className="roster-house-title">
              <Shield h={h.heraldry} size={13} /> {h.rank === 'royal' ? 'The Crown' : h.rank === 'church' ? 'The Church' : `House ${h.name}`}
              {hidden > 0 && <span className="muted"> · {hidden} unknown</span>}
            </h3>
            <ul>
              {members.map((id) => (
                <li key={id}>
                  <Person id={id} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
