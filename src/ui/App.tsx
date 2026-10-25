import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dateLabel,
  afterPlayerAction,
  continueReign,
  endWeek as engineEndWeek,
  newGame,
  perform,
  resolveAudience,
  type BusinessKind,
  type GameState,
  type Intent,
  type Outcome,
} from '../engine';
import { Game } from './components/Game';
import { HowToPlay } from './components/HowToPlay';
import { TitleScreen } from './components/TitleScreen';
import { GameCtx, type Ctx, type DeedSpec, type TabId } from './context';
import { applyTheme, backPoints, importGame, loadGame, loadPrefs, saveFailed, saveGame, savePrefs, savedText, turnBack, type BackPoint, type Prefs } from './store';
import { pickSaveFile, saveFileName, saveToFile } from './saveFile';

declare global {
  interface Window {
    claude?: {
      hot?: { snapshot?: (fn: () => unknown) => void; ready?: (fn: (d: unknown) => void) => void; data?: unknown };
      /** The claude.ai viewer's capabilities, where the page is published there. */
      use?: (name: string) => Promise<unknown>;
    };
  }
}

export function App({ initial }: { initial?: GameState | null }) {
  const gameRef = useRef<GameState | null>(initial ?? null);
  const [tick, setTick] = useState(0);
  const [screen, setScreen] = useState<'title' | 'game'>(initial ? 'game' : 'title');
  const [selected, setSelected] = useState<string | null>(null);
  const [deed, setDeed] = useState<DeedSpec | null>(null);
  const [tab, setTab] = useState<TabId>('map');
  const [help, setHelp] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [hasSave, setHasSave] = useState(() => !!loadGame());
  const [backTo, setBackTo] = useState(() => backPoints());
  const [dawn, setDawn] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const say = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 6000);
  };

  // Keep the game in a file, or bring one back from a file.
  const exportSave = async () => {
    const g = gameRef.current ?? loadGame();
    const raw = gameRef.current ? JSON.stringify(gameRef.current) : savedText();
    if (!g || !raw) return say('There is no game to save.');
    const result = await saveToFile(raw, saveFileName(g.chars[g.player].short, dateLabel(g.turn)));
    say(result === 'saved' ? 'Your game is saved to a file.' : result === 'declined' ? 'Not saved.' : 'This view cannot save files.');
  };
  const importSave = async () => {
    const raw = await pickSaveFile();
    if (!raw) return;
    if (gameRef.current?.phase === 'playing' || hasSave) {
      if (!window.confirm('Load this save? The game you have now will be replaced by it.')) return;
    }
    const g = importGame(raw);
    if (!g) return say('That file is not a Crown of Whispers game in play.');
    gameRef.current = g;
    setHasSave(true);
    setBackTo(backPoints());
    setSelected(null);
    setTab('map');
    setScreen('game');
    bump();
    say(`Loaded: ${g.chars[g.player].name}, ${dateLabel(g.turn)}.`);
  };

  useEffect(() => applyTheme(prefs.theme), [prefs.theme]);

  // Keep the game across a live update of the page.
  useEffect(() => {
    window.claude?.hot?.snapshot?.(() => ({ game: gameRef.current }));
  }, []);

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    saveGame(gameRef.current);
    setUnsaved(saveFailed());
  }, []);

  const start = (seed: number, name: string, trade?: BusinessKind) => {
    gameRef.current = newGame(seed, { playerName: name, trade });
    setSelected(null);
    setTab('map');
    setScreen('game');
    setDawn(false);
    bump();
    if (!prefs.seenHelp) {
      setHelp(true);
      const p = { ...prefs, seenHelp: true };
      setPrefs(p);
      savePrefs(p);
    }
  };

  const goBack = (point: BackPoint) => {
    // Turning back from a game still being played throws away everything since.
    if (gameRef.current?.phase === 'playing' || (screen === 'title' && hasSave)) {
      const ok = window.confirm('Turn back? Your game as it stands now will be lost, and you will play on from that earlier point.');
      if (!ok) return;
    }
    const g = turnBack(point);
    if (!g) return setBackTo(backPoints());
    gameRef.current = g;
    setSelected(null);
    setScreen('game');
    setDawn(false);
    bump();
  };

  const toggleTheme = () => {
    const isDark =
      prefs.theme === 'dark' || (!prefs.theme && !window.matchMedia?.('(prefers-color-scheme: light)').matches);
    const p: Prefs = { ...prefs, theme: isDark ? 'light' : 'dark' };
    setPrefs(p);
    savePrefs(p);
  };

  const ctx = useMemo<Ctx | null>(() => {
    const s = gameRef.current;
    if (!s) return null;
    return {
      s,
      tick,
      selected,
      select: (id) => {
        setSelected(id);
        if (id && window.matchMedia?.('(max-width: 899px)').matches) setTab('dossier');
      },
      act: (intent: Intent): Outcome => {
        const out = perform(s, s.player, intent);
        afterPlayerAction(s);
        bump();
        return out;
      },
      resolve: (aid, opt) => {
        const out = resolveAudience(s, aid, opt);
        afterPlayerAction(s);
        bump();
        return out;
      },
      endWeek: () => {
        engineEndWeek(s);
        setDawn(true);
        bump();
      },
      openDeed: (spec) => setDeed(spec),
      setTab,
    };
    // tick forces a fresh context after every mutation of the game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, selected, bump]);

  return (
    <>
      {screen === 'title' || !ctx ? (
        <TitleScreen
          onStart={start}
          hasSave={hasSave}
          backTo={backTo}
          onTurnBack={goBack}
          onContinue={() => {
            const g = loadGame();
            if (!g) return setHasSave(false);
            gameRef.current = g;
            setScreen('game');
            bump();
          }}
          onHelp={() => setHelp(true)}
          onExport={exportSave}
          onImport={importSave}
        />
      ) : (
        <GameCtx.Provider value={ctx}>
          <Game
            tab={tab}
            setTab={setTab}
            deed={deed}
            closeDeed={() => setDeed(null)}
            dawn={dawn}
            closeDawn={() => setDawn(false)}
            onHelp={() => setHelp(true)}
            onSaveFile={exportSave}
            onTheme={toggleTheme}
            onQuit={() => {
              setHasSave(!!loadGame());
              setBackTo(backPoints());
              setScreen('title');
            }}
            onTurnBack={goBack}
            onRestart={(seed, name) => start(seed, name)}
            onRuleOn={() => {
              if (gameRef.current) continueReign(gameRef.current);
              bump();
            }}
          />
        </GameCtx.Provider>
      )}
      {help && <HowToPlay onClose={() => setHelp(false)} />}
      {notice && (
        <p className="app-notice" role="status">
          {notice}
        </p>
      )}
      {unsaved && (
        <p className="save-warning" role="alert">
          Your game could not be saved: this browser’s storage is full. Play on, but a refresh will lose what has happened since.
        </p>
      )}
    </>
  );
}
