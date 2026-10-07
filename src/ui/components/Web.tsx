import { useId, useState } from 'react';
import { ch, first, opinion, plotViews, visibleMods, type CharId, type GameState } from '../../engine';
import { useGame } from '../context';

const W = 980;
const H = 790;
const CX = W / 2;
const CY = H / 2 + 6;
const R = 285;
const NODE = 30;

interface Edge {
  a: CharId;
  b: CharId;
  kind: 'spouse' | 'sibling' | 'plot' | 'member' | 'love' | 'hate';
  label?: string;
  faint?: boolean;
}

function edgesFor(s: GameState, viewer: CharId, truth: boolean): Edge[] {
  const out: Edge[] = [];
  const seen = new Set<string>();
  for (const id of s.order) {
    const c = ch(s, id);
    if (c.spouse && id < c.spouse) out.push({ a: id, b: c.spouse, kind: 'spouse' });
    for (const b of c.siblings) if (id < b) out.push({ a: id, b, kind: 'sibling' });
  }
  const plots = truth
    ? Object.values(s.plots).filter((p) => p.status === 'active').map((plot) => ({ plot, belief: 100, sincere: Object.fromEntries(plot.members.map((m) => [m.id, m.sincere])) }))
    : plotViews(s, viewer)
        .filter((v) => v.plot.status === 'active')
        .map((v) => ({ plot: v.plot, belief: v.belief, sincere: v.sincerity }));
  for (const { plot, belief, sincere } of plots) {
    for (const t of plot.targets) out.push({ a: plot.owner, b: t, kind: 'plot', label: plot.name, faint: belief < 60 });
    for (const m of plot.members) {
      const sin = sincere[m.id];
      out.push({ a: m.id, b: plot.owner, kind: 'member', label: sin === false ? 'false oath' : 'sworn', faint: sin === false });
    }
  }
  for (const a of s.order) {
    for (const b of s.order) {
      if (a === b) continue;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      const visible = truth || a === viewer || b === viewer || visibleMods(s, viewer, a, b).length > 0;
      if (!visible) continue;
      const o = truth || a === viewer || b === viewer ? opinion(s, a, b) : visibleMods(s, viewer, a, b).reduce((m, x) => m + x.value, 0);
      if (Math.abs(o) < 30) continue;
      if (ch(s, a).spouse === b) continue;
      seen.add(key);
      out.push({ a, b, kind: o > 0 ? 'love' : 'hate', label: `${first(s, a)} → ${first(s, b)}: ${Math.round(o)}` });
    }
  }
  return out;
}

export function Web({ truth = false }: { truth?: boolean }) {
  const { s, select, selected } = useGame();
  const P = s.player;
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<CharId | null>(null);
  const [layers, setLayers] = useState({ family: true, plots: true, feelings: true });
  const n = s.order.length;
  const pos: Record<CharId, { x: number; y: number; ang: number }> = {};
  const king = s.king ?? s.order[0];
  const ordered = [king, ...s.order.filter((id) => id !== king)];
  ordered.forEach((id, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pos[id] = { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang), ang };
  });
  const edges = edgesFor(s, P, truth).filter(
    (e) =>
      (layers.family || !['spouse', 'sibling'].includes(e.kind)) &&
      (layers.plots || !['plot', 'member'].includes(e.kind)) &&
      (layers.feelings || !['love', 'hate'].includes(e.kind)),
  );
  const focus = hover ?? selected;

  const line = (e: Edge, i: number) => {
    const A = pos[e.a];
    const B = pos[e.b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const x1 = A.x + ux * (NODE + 4);
    const y1 = A.y + uy * (NODE + 4);
    const x2 = B.x - ux * (NODE + 8);
    const y2 = B.y - uy * (NODE + 8);
    // Bow plot lines so two-way hatreds do not overlap.
    const bow = e.kind === 'plot' || e.kind === 'member' ? 28 : e.kind === 'hate' || e.kind === 'love' ? -18 : 0;
    const mx = (x1 + x2) / 2 - uy * bow;
    const my = (y1 + y2) / 2 + ux * bow;
    const dim = focus && e.a !== focus && e.b !== focus;
    return (
      <path
        key={i}
        d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
        className={`edge edge--${e.kind} ${e.faint ? 'edge--faint' : ''} ${dim ? 'edge--dim' : ''}`}
        markerEnd={e.kind === 'plot' ? `url(#arrow-${uid})` : e.kind === 'member' ? `url(#dot-${uid})` : undefined}
      >
        {e.label && <title>{e.label}</title>}
      </path>
    );
  };

  return (
    <div className="web">
      <header className="view-head">
        <h2 className="panel-title">{truth ? 'The web as it truly was' : 'The Web of Intrigue'}</h2>
        <p className="muted">
          {truth
            ? 'Every scheme, every false oath, every hatred at the end of the season.'
            : 'Only what you know or suspect. Red arrows are schemes (faint if you are unsure); thin lines run from a sworn member to the scheme’s leader.'}
        </p>
        <div className="filters" role="group" aria-label="Layers">
          {(['family', 'plots', 'feelings'] as const).map((k) => (
            <button key={k} className={`filter ${layers[k] ? 'is-on' : ''}`} aria-pressed={layers[k]} onClick={() => setLayers({ ...layers, [k]: !layers[k] })}>
              {k === 'family' ? 'Family' : k === 'plots' ? 'Schemes' : 'Love & hatred'}
            </button>
          ))}
        </div>
      </header>
      <div className="web-scroll">
        <svg className="web-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Relationship diagram of the court">
          <defs>
            <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="var(--rubric)" />
            </marker>
            <marker id={`dot-${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
              <circle cx="5" cy="5" r="4" fill="var(--rubric)" />
            </marker>
          </defs>
          <circle cx={CX} cy={CY} r={R} className="web-ring" />
          {edges.map(line)}
          {ordered.map((id) => {
            const c = ch(s, id);
            const p = pos[id];
            const lx = CX + (R + 58) * Math.cos(p.ang);
            const ly = CY + (R + 50) * Math.sin(p.ang);
            const anchor = Math.abs(Math.cos(p.ang)) < 0.3 ? 'middle' : Math.cos(p.ang) > 0 ? 'start' : 'end';
            return (
              <g
                key={id}
                className={`node ${c.status !== 'free' ? `node--${c.status}` : ''} ${focus === id ? 'is-focus' : ''} ${id === P ? 'node--you' : ''}`}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => select(id)}
                tabIndex={0}
                role="button"
                aria-label={c.name}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(id)}
              >
                <circle cx={p.x} cy={p.y} r={NODE} fill={c.heraldry.field} className="node-disc" />
                <circle cx={p.x} cy={p.y} r={NODE * 0.42} fill={c.heraldry.tincture} opacity={0.9} />
                {c.status === 'dead' && <path d={`M${p.x - 18},${p.y - 18} L${p.x + 18},${p.y + 18} M${p.x + 18},${p.y - 18} L${p.x - 18},${p.y + 18}`} className="node-x" />}
                <text x={lx} y={ly} textAnchor={anchor} className="node-label">
                  {first(s, id)}
                </text>
                <text x={lx} y={ly + 17} textAnchor={anchor} className="node-sub">
                  {c.status === 'free' ? (s.king === id ? 'the King' : c.house) : c.status === 'imprisoned' ? 'in the Tower' : c.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="legend">
        <li>
          <span className="sw sw--plot" /> scheme against
        </li>
        <li>
          <span className="sw sw--member" /> sworn to (dotted: a false oath)
        </li>
        <li>
          <span className="sw sw--spouse" /> married
        </li>
        <li>
          <span className="sw sw--sibling" /> brothers
        </li>
        <li>
          <span className="sw sw--love" /> warm regard
        </li>
        <li>
          <span className="sw sw--hate" /> hatred
        </li>
      </ul>
    </div>
  );
}
