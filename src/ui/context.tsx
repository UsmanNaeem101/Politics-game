import { createContext, useContext } from 'react';
import type { CharId, GameState, Intent, IntentType, Outcome } from '../engine';

export interface DeedSpec {
  type: IntentType;
  target?: CharId;
  secretId?: string;
  plotId?: string;
}

export interface Ctx {
  s: GameState;
  tick: number;
  selected: CharId | null;
  select(id: CharId | null): void;
  act(intent: Intent): Outcome;
  resolve(audienceId: string, optionId: string): Outcome;
  endWeek(): void;
  openDeed(spec: DeedSpec): void;
  setTab(tab: TabId): void;
}

export type TabId = 'hall' | 'web' | 'secrets' | 'schemes' | 'chronicle' | 'court' | 'dossier';

export const GameCtx = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('no game');
  return c;
}
