// How a name is made at court, and how it mends. Prestige is what the court thinks a man is
// worth: it places his house on the map (45 for the great houses), weighs his voice in the
// Witan, and counts in his suits and matches.

export const RENOWN = {
  /** Standing lost to charges and disgrace comes back this much a month, while free. */
  mends: 2,
  /** Held this warmly by the King, each month at his side is worth `gain` prestige, up to `upTo`. */
  favour: { opinion: 70, gain: 1, upTo: 60 },
  /** A feast for the court: its cost, how often, how many guests, and what they think of it. */
  feast: { cost: 30, every: 2, guests: 4, warmth: 6, kingComes: 25, kingBonus: 1 },
  /** Prestige a feast brings, by the host's prestige before it: a lesser name gains more. */
  feastGain: [
    { below: 30, gain: 4 },
    { below: 45, gain: 3 },
    { below: 60, gain: 2 },
    { below: Infinity, gain: 1 },
  ],
  /** A match into a house whose head stands higher: this share of the difference, at most `max`. */
  match: { share: 0.25, max: 8 },
  /** A charge you laid that the King upheld: the court remembers who brought it. */
  upheld: { execute: 5, imprison: 3, disgrace: 3 },
} as const;
