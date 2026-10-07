import { ch, knowsAgenda, knownThreats, opinion, opinionWord, styleOf, suspects, type CharId, type GameState } from '../../engine';
import { useGame } from '../context';
import { Shield } from './Shield';

const STATUS_RANK = { free: 0, imprisoned: 1, fled: 2, dead: 3 } as const;

export function sortCourt(s: GameState): CharId[] {
  return s.order.slice().sort((a, b) => {
    const ca = ch(s, a);
    const cb = ch(s, b);
    if (STATUS_RANK[ca.status] !== STATUS_RANK[cb.status]) return STATUS_RANK[ca.status] - STATUS_RANK[cb.status];
    if (a === s.king) return -1;
    if (b === s.king) return 1;
    return cb.prestige - ca.prestige;
  });
}

export function Marks({ id }: { id: CharId }) {
  const { s } = useGame();
  if (id === s.player) return <span className="chip chip--you">You</span>;
  const threat = knownThreats(s, s.player).some((v) => v.plot.owner === id || v.plot.members.some((m) => m.id === id));
  const sus = suspects(s, s.player, id);
  return (
    <span className="marks">
      {threat && (
        <span className="chip chip--danger" title="You know of a plot against you that they are part of">
          Threat
        </span>
      )}
      {!threat && sus >= 45 && (
        <span className="chip chip--warn" title="You believe they are guilty of something">
          Suspect
        </span>
      )}
      {knowsAgenda(s, s.player, id) && (
        <span className="chip chip--info" title="You know their true design">
          Motive
        </span>
      )}
    </span>
  );
}

export function Roster() {
  const { s, selected, select } = useGame();
  return (
    <div className="roster">
      <h2 className="panel-title">The Court</h2>
      <ul>
        {sortCourt(s).map((id) => {
          const c = ch(s, id);
          const att = id === s.player ? null : opinion(s, id, s.player);
          return (
            <li key={id}>
              <button className={`roster-item ${selected === id ? 'is-selected' : ''} is-${c.status}`} onClick={() => select(id)}>
                <Shield h={c.heraldry} size={30} status={c.status} crowned={s.king === id} />
                <span className="roster-name">
                  <span className="name">{c.name}</span>
                  <small>
                    {c.status === 'free' ? styleOf(s, id) : c.status === 'imprisoned' ? 'In the Tower' : c.status === 'fled' ? 'Fled' : 'Dead'}
                  </small>
                </span>
                <span className="roster-side">
                  {att !== null && c.status !== 'dead' && (
                    <span className={`att ${att >= 10 ? 'good' : att <= -10 ? 'bad' : ''}`} title={`Their attitude to you: ${att}`}>
                      {opinionWord(att)}
                    </span>
                  )}
                  <Marks id={id} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
