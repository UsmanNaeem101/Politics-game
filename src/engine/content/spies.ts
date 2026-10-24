// Why a spy serves decides everything about them: what it costs you, whether
// they name you when caught, and how easily they are turned against you.

import type { SpyHook } from '../types';

export interface HookDef {
  hook: SpyHook;
  name: string;
  desc: string;
  /** Chance (%) that a caught spy names whoever sent them. */
  names: number;
  /** Chance (%) that a cunning mark turns a caught spy instead of dismissing them. */
  turns: number;
}

export const SPY_HOOKS: Record<SpyHook, HookDef> = {
  gold: {
    hook: 'gold',
    name: 'A wage',
    desc: 'Crowns every month. Reliable while you pay, and for sale to anyone who pays more.',
    names: 70,
    turns: 60,
  },
  blackmail: {
    hook: 'blackmail',
    name: 'Their secret',
    desc: 'Serve, or you tell. They will serve, and hate you for it.',
    names: 90,
    turns: 70,
  },
  devotion: {
    hook: 'devotion',
    name: 'Devotion',
    desc: 'They think well enough of you to do it for nothing. The most loyal of all.',
    names: 15,
    turns: 15,
  },
  grudge: {
    hook: 'grudge',
    name: 'A shared enemy',
    desc: 'They hate the one they would watch, and need no paying.',
    names: 40,
    turns: 5,
  },
};

export const SPY_HOOK_KINDS = Object.keys(SPY_HOOKS) as SpyHook[];

/** How a report reaches you. `{agent}` and `{mark}` are filled in. */
export const REPORT_OPENERS = [
  '{agent} sends word about {mark}:',
  'A note in {agent}’s hand, left where you would find it:',
  '{agent} caught your eye in the passage and whispered:',
  'From {agent}, by way of a kitchen boy:',
];
