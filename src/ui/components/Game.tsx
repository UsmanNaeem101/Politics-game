import { useState } from 'react';
import { calendar, canEndWeek, ch, knownThreats, opinion, opinionWord, styleOf, type Outcome } from '../../engine';
import { useGame, type DeedSpec, type TabId } from '../context';
import { GIcon, type GIName } from '../icons/GIcon';
import { Aftermath, AudienceModal } from './AudienceModal';
import { Briefing } from './Briefing';
import { Chronicle } from './Chronicle';
import { CourtMap } from './CourtMap';
import { DawnReport } from './DawnReport';
import { DeedDialog } from './DeedDialog';
import { Dossier } from './Dossier';
import { EndScreen } from './EndScreen';
import { Icon } from './Icon';
import { Ledger } from './Ledger';
import { Roster } from './Roster';
import { Schemes } from './Schemes';
import { Shield } from './Shield';

const TABS: { id: TabId; label: string; icon: GIName; mobileOnly?: boolean }[] = [
  { id: 'court', label: 'People', icon: 'people', mobileOnly: true },
  { id: 'map', label: 'Court', icon: 'map' },
  { id: 'briefing', label: 'Briefing', icon: 'briefing' },
  { id: 'secrets', label: 'Secrets', icon: 'secrets' },
  { id: 'schemes', label: 'Schemes', icon: 'schemes' },
  { id: 'chronicle', label: 'Chronicle', icon: 'chronicle' },
  { id: 'dossier', label: 'Dossier', icon: 'dossier', mobileOnly: true },
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
  onRestart: (seed: number, name: string) => void;
  onRuleOn: () => void;
}) {
  const { s, endWeek } = useGame();
  const { tab, setTab } = props;
  const [aftermath, setAftermath] = useState<{ title: string; outcome: Outcome } | null>(null);

  if (s.phase === 'ended') return <EndScreen onRestart={props.onRestart} onQuit={props.onQuit} onRuleOn={props.onRuleOn} />;

  const audience = s.audiences[0];
  const threats = knownThreats(s, s.player).length;
  const main = tab === 'court' || tab === 'dossier' ? 'map' : tab;

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
            <GIcon name={t.icon} size={17} />
            <span>{t.label}</span>
            {t.id === 'schemes' && threats ? (
              <span className="badge badge--danger" title="Plots against you that you know of">
                {threats}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className={`layout layout--${tab} ${main === 'map' ? 'layout--wide' : ''}`}>
        <aside className="col col--roster" aria-label="The court">
          <Roster />
        </aside>
        <main className={`col col--main col--${main}`}>
          {main === 'map' && <CourtMap />}
          {main === 'briefing' && <Briefing />}
          {main === 'secrets' && <Ledger />}
          {main === 'schemes' && <Schemes />}
          {main === 'chronicle' && <Chronicle />}
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
  const d = calendar(s.turn);
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="display brand">Crown of Whispers</span>
        <span className="week" title={`Week ${s.turn} of your time at court`}>
          <GIcon name={d.season === 'Winter' ? 'clergy' : 'feast'} size={13} /> {d.season}, year {d.year} · week <strong>{d.week}</strong>
        </span>
      </div>
      <button className="topbar-me" onClick={() => select(s.player)} title="Your own dossier">
        <Shield h={me.heraldry} size={28} status={me.status} crowned={s.king === s.player} />
        <span>
          <strong>{s.king === s.player ? `King ${me.short}` : me.name}</strong>
          <small>{styleOf(s, s.player)}</small>
        </span>
      </button>
      <dl className="stats">
        <div title="Gold">
          <dt>
            <GIcon name="gold" size={14} />
          </dt>
          <dd className="num">{me.gold}</dd>
        </div>
        <div title="Prestige">
          <dt>
            <GIcon name="ambition" size={14} />
          </dt>
          <dd className="num">{me.prestige}</dd>
        </div>
        {favour !== null && (
          <div title={`The King's favour: ${favour}`}>
            <dt>
              <GIcon name="favour" size={14} />
            </dt>
            <dd className={favour >= 10 ? 'good' : favour <= -10 ? 'bad' : ''}>{opinionWord(favour)}</dd>
          </div>
        )}
        {Math.abs(me.pressure) >= 10 && (
          <div title="Pressure from your spouse. Goaded men are bolder; restrained men more careful.">
            <dt>
              <GIcon name="counsel" size={14} />
            </dt>
            <dd>
              {me.pressure > 0 ? 'Goaded' : 'Restrained'} {Math.abs(me.pressure)}
            </dd>
          </div>
        )}
        {me.status === 'imprisoned' && (
          <div>
            <dt>
              <GIcon name="prisoner" size={14} />
            </dt>
            <dd className="bad">In the Tower</dd>
          </div>
        )}
      </dl>
      <div className="time" aria-label={`${s.ap} of ${s.apMax} hours left this week`} title="Time left this week">
        {Array.from({ length: s.apMax }, (_, i) => (
          <span key={i} className={`pip ${i < s.ap ? 'is-full' : ''}`}>
            <GIcon name="time" size={16} />
          </span>
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

