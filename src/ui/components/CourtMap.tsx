import { useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  OFFICE_NAMES,
  acquaintance,
  ch,
  knowsAgenda,
  knownThreats,
  officeOf,
  opinion,
  plotViews,
  suspects,
  visibleMods,
  type CharId,
  type GameState,
  type House,
  type OfficeId,
} from '../../engine';
import { useGame } from '../context';
import { GIcon, type GIName } from '../icons/GIcon';
import { Shield } from './Shield';

const PW = 112; // person cell width
const PH = 118; // person cell height
const HEADER = 34;
const PAD = 14;
const GAP_X = 36;
const GAP_Y = 70;

interface PersonData extends Record<string, unknown> {
  id: CharId;
  truth: boolean;
}
interface HouseData extends Record<string, unknown> {
  house: House;
  unknown: number;
  mine: boolean;
}

export function roleIcon(s: GameState, id: CharId): GIName {
  const c = ch(s, id);
  if (s.king === id) return 'crown';
  const off = officeOf(s, id) as OfficeId | undefined;
  if (off) return off;
  if (c.rank === 'queen') return 'queen';
  if (c.rank === 'servant') return 'servant';
  if (c.rank === 'clergy') return 'clergy';
  if (c.rank === 'lady') return 'lady';
  if (c.rank === 'knight') return 'knight';
  return 'lord';
}

export function roleLabel(s: GameState, id: CharId): string {
  const c = ch(s, id);
  if (s.king === id) return 'The King';
  const off = officeOf(s, id) as OfficeId | undefined;
  if (off) return OFFICE_NAMES[off];
  if (c.rank === 'servant') return c.role ?? 'servant';
  if (c.rank === 'queen') return 'Queen';
  const house = s.houses[c.householdId];
  if (house?.head === id && house.rank !== 'royal' && house.rank !== 'church') return 'Head of house';
  if (c.spouse && house?.head === c.spouse) return 'His wife';
  if (c.siblings.length) return 'Brother';
  return c.title;
}

function attitudeClass(v: number | null): string {
  if (v === null) return '';
  if (v >= 30) return 'att-warm';
  if (v >= 10) return 'att-cordial';
  if (v > -10) return 'att-neutral';
  if (v > -30) return 'att-cool';
  return 'att-hostile';
}

function PersonNode({ data }: NodeProps<Node<PersonData>>) {
  const { s, selected } = useGame();
  const id = data.id;
  const c = ch(s, id);
  const P = s.player;
  const lvl = data.truth ? 5 : acquaintance(s, id);
  const att = id === P || lvl < 3 ? null : opinion(s, id, P);
  const dark = lvl <= 1;
  const threat = id !== P && knownThreats(s, P).some((v) => v.plot.owner === id || v.plot.members.some((m) => m.id === id));
  const sus = id !== P && !threat && suspects(s, P, id) >= 45;
  const unmasked = id !== P && !data.truth && knowsAgenda(s, P, id);
  return (
    <div className={`pnode ${dark ? 'is-dark' : ''} is-${c.status} ${selected === id ? 'is-selected' : ''} ${id === P ? 'is-you' : ''} ${s.king === id ? 'is-king' : ''}`}>
      <Handle type="target" position={Position.Top} className="h" isConnectable={false} />
      <div className={`pdisc ${attitudeClass(att)}`} title={att === null ? undefined : `Attitude to you: ${att}`}>
        {dark ? <GIcon name="unknown" size={34} /> : <Shield h={c.heraldry} size={34} status={c.status} />}
        {!dark && (
          <span className="pbadge pbadge--role" title={roleLabel(s, id)}>
            <GIcon name={roleIcon(s, id)} size={14} />
          </span>
        )}
        {c.status === 'imprisoned' && (
          <span className="pbadge pbadge--status" title="In the Tower">
            <GIcon name="prisoner" size={13} />
          </span>
        )}
        {c.status === 'dead' && (
          <span className="pbadge pbadge--status" title={c.fate}>
            <GIcon name="dead" size={13} />
          </span>
        )}
      </div>
      <div className="pname">{lvl >= 1 ? (s.king === id ? `King ${c.short}` : c.short) : '?'}</div>
      <div className="psub">{dark ? 'heard of' : roleLabel(s, id)}</div>
      <div className="pmarks">
        {id === P && <GIcon name="you" size={13} title="You" className="mk-you" />}
        {threat && <GIcon name="threat" size={13} title="Plots against you" className="mk-threat" />}
        {sus && <GIcon name="suspect" size={13} title="You suspect them" className="mk-sus" />}
        {unmasked && <GIcon name="motive" size={13} title="You know their true design" className="mk-motive" />}
      </div>
      <Handle type="source" position={Position.Bottom} className="h" isConnectable={false} />
    </div>
  );
}

function HouseNode({ data }: NodeProps<Node<HouseData>>) {
  const h = data.house;
  return (
    <div className={`hnode hnode--${h.rank} ${data.mine ? 'is-mine' : ''}`}>
      <div className="hhead">
        <Shield h={h.heraldry} size={16} />
        <span className="hname">{h.rank === 'royal' ? `The Crown · House ${h.name}` : h.rank === 'church' ? 'The Church' : `House ${h.name}`}</span>
        {data.unknown > 0 && (
          <span className="hunknown" title="Members you have never heard of. Spy on the household to learn who they are.">
            +{data.unknown} unknown
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { person: PersonNode, house: HouseNode };

interface Layers {
  schemes: boolean;
  feelings: boolean;
  lovers: boolean;
  fealty: boolean;
}

/** Lay out the court as tiers: the Crown, then great houses, then lesser houses. */
function buildGraph(s: GameState, layers: Layers, truth: boolean): { nodes: Node[]; edges: Edge[] } {
  const P = s.player;
  const visible = (id: CharId) => truth || acquaintance(s, id) >= 1;
  const nodes: Node[] = [];
  const pos = new Map<CharId, { x: number; y: number }>();

  // The reigning king (and his queen) always sit at the top, whatever house they came from.
  const king0 = s.king;
  const crownSet = new Set<CharId>(king0 ? [king0, ...(ch(s, king0).spouse && ch(s, ch(s, king0).spouse!).status !== 'dead' ? [ch(s, king0).spouse!] : [])] : []);
  const royalHouse = Object.values(s.houses).find((h) => h.rank === 'royal');
  const membersOf = (h: House) => {
    const own = h.members.filter((m) => s.chars[m] && (!crownSet.has(m) || h === royalHouse));
    return h === royalHouse ? [...crownSet].filter((m) => !own.includes(m)).concat(own) : own;
  };
  const houseBox = (h: House, x: number, y: number) => {
    const members = membersOf(h);
    const shown = members.filter(visible);
    const rank = (id: CharId) => {
      const c = ch(s, id);
      if (s.king === id) return 0;
      if (h === royalHouse && crownSet.has(id)) return 1;
      if (h === royalHouse && id === h.head && s.king && s.king !== id) return 2;
      if (id === h.head) return 0;
      if (c.spouse === h.head || c.rank === 'queen') return 1;
      if (c.rank === 'servant') return 3;
      return 2;
    };
    const rows: CharId[][] = [[], [], []];
    for (const m of shown.sort((a, b) => rank(a) - rank(b))) {
      const r = rank(m);
      rows[r === 3 ? 2 : r === 2 ? 1 : 0].push(m);
    }
    const used = rows.filter((r) => r.length);
    const width = Math.max(1, ...used.map((r) => r.length)) * PW + PAD * 2;
    const height = HEADER + Math.max(1, used.length) * PH + PAD;
    nodes.push({
      id: `house-${h.id}`,
      type: 'house',
      position: { x, y },
      data: { house: h, unknown: members.length - shown.length, mine: s.chars[P]?.householdId === h.id },
      draggable: false,
      selectable: false,
      zIndex: -1,
      style: { width, height },
    });
    used.forEach((row, ri) => {
      const rowW = row.length * PW;
      const x0 = x + (width - rowW) / 2;
      row.forEach((id, i) => {
        const p = { x: x0 + i * PW, y: y + HEADER + ri * PH };
        pos.set(id, p);
        nodes.push({ id, type: 'person', position: p, data: { id, truth }, draggable: false, width: PW, height: PH });
      });
    });
    return { width, height };
  };

  const houses = Object.values(s.houses);
  const royal = houses.filter((h) => h.rank === 'royal' || h.rank === 'church');
  const greats = houses.filter((h) => h.rank === 'great');
  const lessers = houses.filter((h) => h.rank === 'lesser').sort((a, b) => a.arrived - b.arrived);
  const measure = (h: House) => {
    const shown = membersOf(h).filter((m) => visible(m));
    const rows = new Set(shown.map((m) => (m === h.head ? 0 : ch(s, m).rank === 'servant' ? 2 : ch(s, m).spouse === h.head ? 0 : 1)));
    const perRow = [0, 0, 0];
    for (const m of shown) perRow[crownSet.has(m) || m === h.head || ch(s, m).spouse === h.head || ch(s, m).rank === 'queen' ? 0 : ch(s, m).rank === 'servant' ? 2 : 1]++;
    return { w: Math.max(1, ...perRow) * PW + PAD * 2, h: HEADER + Math.max(1, rows.size) * PH + PAD };
  };
  const tier = (list: House[], y: number, maxPerRow = 5) => {
    let rowY = y;
    let bottom = y;
    for (let i = 0; i < list.length; i += maxPerRow) {
      const row = list.slice(i, i + maxPerRow);
      const sizes = row.map(measure);
      const total = sizes.reduce((m, z) => m + z.w, 0) + GAP_X * (row.length - 1);
      let x = -total / 2;
      let rowH = 0;
      row.forEach((h, j) => {
        const { height } = houseBox(h, x, rowY);
        x += sizes[j].w + GAP_X;
        rowH = Math.max(rowH, height);
      });
      bottom = rowY + rowH;
      rowY = bottom + GAP_Y / 2;
    }
    return bottom;
  };
  const y1 = tier(royal, 0);
  const y2 = tier(greats, y1 + GAP_Y);
  tier(lessers, y2 + GAP_Y, 4);

  const edges: Edge[] = [];
  const has = (id: CharId) => pos.has(id);
  const king = s.king;
  if (layers.fealty && king && has(king)) {
    for (const h of [...greats, ...lessers]) {
      if (h.head && has(h.head)) {
        edges.push({
          id: `f-${h.head}`,
          source: king,
          target: h.head,
          type: 'smoothstep',
          style: { stroke: 'var(--gold)', strokeOpacity: 0.28, strokeWidth: 1.2 },
          focusable: false,
        });
      }
    }
  }
  if (layers.schemes) {
    const plots = truth
      ? Object.values(s.plots).filter((p) => p.status === 'active').map((plot) => ({ plot, belief: 100, sincerity: Object.fromEntries(plot.members.map((m) => [m.id, m.sincere])) }))
      : plotViews(s, P).filter((v) => v.plot.status === 'active');
    for (const { plot, belief, sincerity } of plots) {
      for (const t of plot.targets) {
        if (!has(plot.owner) || !has(t)) continue;
        edges.push({
          id: `p-${plot.id}-${t}`,
          source: plot.owner,
          target: t,
          animated: true,
          style: { stroke: 'var(--rubric)', strokeWidth: 2, strokeDasharray: belief < 60 ? '4 5' : undefined },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--rubric)' },
          zIndex: 2,
        });
      }
      for (const m of plot.members) {
        if (!has(m.id) || !has(plot.owner)) continue;
        const sin = sincerity[m.id];
        edges.push({
          id: `m-${plot.id}-${m.id}`,
          source: m.id,
          target: plot.owner,
          style: { stroke: 'var(--rubric)', strokeWidth: 1, strokeOpacity: 0.7, strokeDasharray: sin === false ? '2 4' : undefined },
          zIndex: 1,
        });
      }
    }
  }
  if (layers.lovers) {
    for (const sec of Object.values(s.secrets)) {
      if (sec.kind !== 'affair' || !sec.truth) continue;
      const k = s.knowledge[P]?.[sec.id];
      if (!truth && (!k || k.credence < 40)) continue;
      const [a, b] = sec.guilty;
      if (has(a) && has(b)) {
        edges.push({ id: `love-${sec.id}`, source: a, target: b, style: { stroke: 'var(--lapis)', strokeWidth: 2, strokeDasharray: '6 3' } });
      }
    }
  }
  if (layers.feelings) {
    const seen = new Set<string>();
    for (const a of pos.keys()) {
      for (const b of pos.keys()) {
        if (a === b) continue;
        const key = [a, b].sort().join('|');
        if (seen.has(key)) continue;
        const mine = a === P || b === P;
        const pub = visibleMods(s, P, a, b);
        if (!truth && !mine && !pub.length) continue;
        const o = truth || mine ? opinion(s, a, b) : pub.reduce((m, x) => m + x.value, 0);
        if (Math.abs(o) < 30 || ch(s, a).spouse === b || ch(s, a).householdId === ch(s, b).householdId) continue;
        seen.add(key);
        edges.push({
          id: `o-${key}`,
          source: a,
          target: b,
          style: { stroke: o > 0 ? 'var(--verdigris)' : 'var(--amber)', strokeOpacity: 0.55, strokeDasharray: o > 0 ? undefined : '6 4' },
        });
      }
    }
  }
  return { nodes, edges };
}

export function CourtMap({ truth = false }: { truth?: boolean }) {
  const { s, tick, select } = useGame();
  const [layers, setLayers] = useState<Layers>({ schemes: true, feelings: false, lovers: true, fealty: true });
  const { nodes, edges } = useMemo(() => buildGraph(s, layers, truth), [s, tick, layers, truth]);
  const toggle = (k: keyof Layers) => setLayers({ ...layers, [k]: !layers[k] });
  const LAYER: { k: keyof Layers; label: string; icon: GIName }[] = [
    { k: 'schemes', label: 'Schemes', icon: 'schemes' },
    { k: 'lovers', label: 'Lovers', icon: 'lover' },
    { k: 'feelings', label: 'Love & hatred', icon: 'love' },
    { k: 'fealty', label: 'Fealty', icon: 'crown' },
  ];
  return (
    <div className="court-map">
      <div className="map-toolbar" role="group" aria-label="Layers">
        {LAYER.map((l) => (
          <button key={l.k} className={`filter ${layers[l.k] ? 'is-on' : ''}`} aria-pressed={layers[l.k]} onClick={() => toggle(l.k)}>
            <GIcon name={l.icon} size={14} /> {l.label}
          </button>
        ))}
        {!truth && (
          <span className="map-legend muted small">
            <GIcon name="unknown" size={14} /> heard of · ring = their attitude to you
          </span>
        )}
      </div>
      <div className="map-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesConnectable={false}
          nodesDraggable={false}
          edgesFocusable={false}
          onNodeClick={(_, n) => n.type === 'person' && select((n.data as PersonData).id)}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="var(--rule)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
