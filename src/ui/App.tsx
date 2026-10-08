import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  afterPlayerAction,
  continueReign,
  endWeek as engineEndWeek,
  newGame,
  perform,
  resolveAudience,
  type GameState,
  type Intent,
  type Outcome,
} from '../engine';
import { Game } from './components/Game';
import { HowToPlay } from './components/HowToPlay';
import { TitleScreen } from './components/TitleScreen';
import { GameCtx, type Ctx, type DeedSpec, type TabId } from './context';
import { applyTheme, loadGame, loadPrefs, saveGame, savePrefs, type Prefs } from './store';

declare global {
  interface Window {
    claude?: { hot?: { snapshot?: (fn: () => unknown) => void; ready?: (fn: (d: unknown) => void) => void; data?: unknown } };
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
  const [dawn, setDawn] = useState(false);

  useEffect(() => applyTheme(prefs.theme), [prefs.theme]);

  // Keep the game across a live update of the page.
  useEffect(() => {
    window.claude?.hot?.snapshot?.(() => ({ game: gameRef.current }));
  }, []);

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    saveGame(gameRef.current);
  }, []);

  const start = (seed: number, name: string) => {
    gameRef.current = newGame(seed, { playerName: name });
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
          onContinue={() => {
            const g = loadGame();
            if (!g) return setHasSave(false);
            gameRef.current = g;
            setScreen('game');
            bump();
          }}
          onHelp={() => setHelp(true)}
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
            onTheme={toggleTheme}
            onQuit={() => {
              setHasSave(!!loadGame());
              setScreen('title');
            }}
            onRestart={(seed, name) => start(seed, name)}
            onRuleOn={() => {
              if (gameRef.current) continueReign(gameRef.current);
              bump();
            }}
          />
        </GameCtx.Provider>
      )}
      {help && <HowToPlay onClose={() => setHelp(false)} />}
    </>
  );
}
