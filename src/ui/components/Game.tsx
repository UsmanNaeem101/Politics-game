import { useState } from 'react';
import { OBJECTIVES, canEndWeek, ch, opinion, opinionWord, styleOf, knownThreats, type CharId, type Outcome } from '../../engine';
import { useGame, type DeedSpec, type TabId } from '../context';
import { Aftermath, AudienceModal } from './AudienceModal';
import { Chronicle } from './Chronicle';
import { DawnReport } from './DawnReport';
import { DeedDialog } from './DeedDialog';
import { Dossier } from './Dossier';
import { EndScreen } from './EndScreen';
import { Hall } from './Hall';
import { Icon, type IconName } from './Icon';
import { Ledger } from './Ledger';
import { Roster } from './Roster';
import { Schemes } from './Schemes';
import { Shield } from './Shield';
import { Web } from './Web';

const TABS: { id: TabId; label: string; icon: IconName; mobileOnly?: boolean }[] = [
  { id: 'court', label: 'Court', icon: 'people', mobileOnly: true },
  { id: 'hall', label: 'Hall', icon: 'hall' },
  { id: 'web', label: 'Web', icon: 'web' },
  { id: 'secrets', label: 'Secrets', icon: 'key' },
  { id: 'schemes', label: 'Schemes', icon: 'dagger' },
  { id: 'chronicle', label: 'Chronicle', icon: 'book' },
  { id: 'dossier', label: 'Dossier', icon: 'eye', mobileOnly: true },
];

export function Game(props: {
  tab: TabId;
  setTab: (t: TabId) => void;
  deed: DeedSpec | null;
  closeDeed: () => void;
  dawn: boolean;
  closeDawn: () => void;
  onHelp: () => void;
  onTheme: () => void;
  onQuit: () => void;
  onRestart: (player: CharId, seed: number) => void;
}) {
  const { s, endWeek } = useGame();
  const { tab, setTab } = props;
  const [aftermath, setAftermath] = useState<{ title: string; outcome: Outcome } | null>(null);

  if (s.phase === 'ended') return <EndScreen onRestart={props.onRestart} onQuit={props.onQuit} />;

  const audience = s.audiences[0];
  const counts: Partial<Record<TabId, number>> = {
    secrets: Object.keys(s.knowledge[s.player] ?? {}).length,
    schemes: knownThreats(s, s.player).length,
  };

  return (
    <div className="game">
      <TopBar onHelp={props.onHelp} onTheme={props.onTheme} onQuit={props.onQuit} onEnd={endWeek} />
      <nav className="tabs" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'is-active' : ''} ${t.mobileOnly ? 'tab--mobile' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
            {t.id === 'schemes' && counts.schemes ? <span className="badge badge--danger" title="Plots against you that you know of">{counts.schemes}</span> : null}
          </button>
        ))}
      </nav>
      <div className={`layout layout--${tab}`}>
        <aside className="col col--roster" aria-label="The court">
          <Roster />
        </aside>
        <main className="col col--main">
          {(tab === 'hall' || tab === 'court' || tab === 'dossier') && <Hall />}
          {tab === 'web' && <Web />}
          {tab === 'secrets' && <Ledger />}
          {tab === 'schemes' && <Schemes />}
          {tab === 'chronicle' && <Chronicle />}
        </main>
        <aside className="col col--dossier" aria-label="Dossier">
          <Dossier />
        </aside>
      </div>
      {props.dawn ? (
        <DawnReport onClose={props.closeDawn} />
      ) : aftermath ? (
        <Aftermath title={aftermath.title} outcome={aftermath.outcome} onClose={() => setAftermath(null)} />
      ) : audience ? (
        <AudienceModal key={audience.id} audience={audience} onDone={(title, outcome) => setAftermath({ title, outcome })} />
      ) : props.deed ? (
        <DeedDialog key={JSON.stringify(props.deed)} spec={props.deed} onClose={props.closeDeed} />
      ) : null}
    </div>
  );
}

function TopBar({ onHelp, onTheme, onQuit, onEnd }: { onHelp: () => void; onTheme: () => void; onQuit: () => void; onEnd: () => void }) {
  const { s, select } = useGame();
  const me = ch(s, s.player);
  const blocked = canEndWeek(s);
  const favour = s.king && s.king !== s.player ? opinion(s, s.king, s.player) : null;
  const obj = OBJECTIVES[s.player];
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="display brand">Crown of Whispers</span>
        <span className="week">
          Week <strong>{s.turn}</strong> of {s.maxTurns}
          <span className="season" aria-hidden>
            <span style={{ width: `${(s.turn / s.maxTurns) * 100}%` }} />
          </span>
        </span>
      </div>
      <button className="topbar-me" onClick={() => select(s.player)} title="Your own dossier">
        <Shield h={me.heraldry} size={28} status={me.status} crowned={s.king === s.player} />
        <span>
          <strong>{me.name}</strong>
          <small>
            {styleOf(s, s.player)} · {obj.title}
          </small>
        </span>
      </button>
      <dl className="stats">
        <div>
          <dt>Gold</dt>
          <dd className="num">{me.gold}</dd>
        </div>
        {favour !== null && (
          <div>
            <dt>Favour</dt>
            <dd className={favour >= 10 ? 'good' : favour <= -10 ? 'bad' : ''}>{opinionWord(favour)}</dd>
          </div>
        )}
        {Math.abs(me.pressure) >= 10 && (
          <div title="Pressure from your spouse. Goaded men are bolder; restrained men more careful.">
            <dt>{me.pressure > 0 ? 'Goaded' : 'Restrained'}</dt>
            <dd className="num">{Math.abs(me.pressure)}</dd>
          </div>
        )}
        {me.status === 'imprisoned' && (
          <div>
            <dt>Status</dt>
            <dd className="bad">In the Tower</dd>
          </div>
        )}
      </dl>
      <div className="time" aria-label={`${s.ap} of ${s.apMax} hours left this week`}>
        <span className="time-label">Time</span>
        {Array.from({ length: s.apMax }, (_, i) => (
          <span key={i} className={`pip ${i < s.ap ? 'is-full' : ''}`} />
        ))}
      </div>
      <button className="btn btn--primary end-week" onClick={onEnd} disabled={!!blocked} title={blocked ?? 'Let the night pass'}>
        End the week <Icon name="arrow" />
      </button>
      <div className="topbar-menu">
        <button className="icon-btn" onClick={onHelp} title="How to play" aria-label="How to play">
          ?
        </button>
        <button className="icon-btn" onClick={onTheme} title="Light or dark" aria-label="Toggle light or dark">
          <Icon name="moon" />
        </button>
        <button className="icon-btn" onClick={onQuit} title="Back to the title (your game is saved)" aria-label="Back to title">
          <Icon name="close" />
        </button>
      </div>
    </header>
  );
}
