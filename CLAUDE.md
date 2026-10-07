# Crown of Whispers — orientation for a Claude Code session

A browser game of medieval court intrigue: hidden motives, secrets, lies, false loyalty,
double-crosses. No 3D, no armies, no characters moving on screen. Read **docs/DESIGN.md**
before changing anything substantial; it is the plan we are building toward.

## Decisions already made by the owner — do not relitigate

- **No fixed scenario.** Courts are generated. The original Osric/Aldric/Ashby opening
  is an example of the depth wanted, not content to ship. It may survive only as a test fixture.
- **Human-like people**: emotions, memories, aspirations, real vs performed loyalty.
  Wives are full agents (helping husbands, spying through other wives, affairs, feeding false info).
- **Fog of war on the court**: a node network with the King at the top and hierarchy below;
  people you have only heard of are dark silhouettes; you discover others through introductions,
  set pieces and spies.
- **Spies are recruited characters** who must be offered something, and can be caught or turned.
- **Money comes from a business or racket**, and its kind affects social standing.
- **Icons over text** in the UI.

## Engineering rules

- `src/engine` is pure TypeScript, deterministic from a seed (state RNG lives in `GameState.rng`).
  The UI never mutates state except through engine functions.
- NPCs and the player use the same deeds (`actions.ts`). NPC decisions should rest on what the
  NPC believes, not on the true state.
- New complexity should arrive as data tables where possible.

## Run

    npm install
    npm run dev                                  # play
    npx tsc --noEmit && npx vitest run           # typecheck + tests
    npx vite-node scripts/fuzz.ts -- 30          # random legal play for every role, invariant checks
    npx vite-node scripts/stats.ts -- 60 anselm  # outcome statistics across seeds
    npm run build:single                         # dist-single/crown-of-whispers.html, the published page

The published page is https://claude.ai/artifact/KQZsENkaYDgd8Go729tuUj — republish from
`dist-single/crown-of-whispers.html` after `npm run build:single`.
