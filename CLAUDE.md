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
- **Setting**: a made-up kingdom with an English feel (Wendmere).
- **Open-ended**: the game runs until the player dies, flees or is crowned (they may then rule on).
- **The player starts as a minor lord** new to court.
- **Tone**: violence, torture and affairs are told as a brief, plain summary. Never graphic.

## Where things are

- `src/engine/generate.ts` builds courts; `tensions.ts` adds seasonal trouble; `turn.ts` is the week loop.
- Fog of war: `GameState.known` (player's acquaintance 0–5), `hearOf()` in `world.ts`, `fogProblem()` in `actions.ts`.
- Trades and rackets: the table is `content/businesses.ts`; `economy.ts` opens, runs and endows them. Standing is not
  stored: `tradeRegard()` in `world.ts` adds each trade's effect into `opinion()` by the viewer's estate, and a racket's
  `ifKnown` only for those who know its secret (kind `racket`). Perks are looked up with `hasPerk()` where they apply.
- Spies: `spies.ts` (access, odds, recruiting, weekly `runSpies`, capture, turning, planted lies, household
  searches); why a spy serves is the table in `content/spies.ts`. The old one-off "spy" deed survives as
  "Have them watched". `secretMatters()` in `secrets.ts` decides what is old news (the dead, finished plots);
  deed lists and validation use it. A plot member can betray it to the King (`betrayable()` in `plots.ts`,
  `turnInformer` in `actions.ts`).
- Houses rise and fall: `houseTier()` in `world.ts` places them on the map by the head's prestige and office; a house
  kept by a woman or a minor stands among the lesser, below every house a man leads (`houseStanding()`), until a man
  marries into it and takes it in hand (`wed()` in `family.ts`).
- Families: `family.ts` (children with rank `child`, births, coming of age, weddings, NPC matchmaking, outsiders from the
  provinces, the player's proposals). An unfaithful wife is an affair spy (`Spy.affair`) for her lover in `spies.ts`.
- Justice: a charge once judged is recorded by crime, not by letter (`GameState.judged`, keyed by `chargeKey()` in
  `court.ts`); `alreadyJudged()` keeps it from being heard again without +15 proof. The UI keeps two earlier saves (`store.ts`: the start of this month, and
  before the last month ended) so an ending, or a game in progress, can be turned back. A traced killing by the player
  is answered at a hearing (`hearingAccuser()` in `actions.ts`); mercy there sets `Imprisonment.spared`.
- Births: `births()` in `family.ts`; a planned child (`try-child`) sets `Character.expecting` and is delivered nine months
  on (`deliver()`), binding the mother to the father. Widows pay upkeep monthly (`widowsUpkeep()`).
- Matches are courtships (`GameState.courtships`, `matchmaking()` in `family.ts`): suitors are announced and the answer
  comes after `DELIBERATION` months; no one is matched during `MOURNING`.
- Time: a turn is a month (`MONTHS_PER_YEAR`, `dateLabel()` in `world.ts`); ages tick yearly in `mortality()` (`turn.ts`),
  which never takes the player or the player's spouse.
- Wives at table: `wives.ts` (the `dine` deed: a wife dines with another lady and brings home what was said).
- Love and the night: `love.ts` (seduction odds and deed, `becomeLovers`, `discoverAffair`, killing someone under your own
  roof, a mistress brought into the household: `takeMistress`, `Character.mistressOf`). Having someone followed: `tails.ts`, places in `content/haunts.ts`.
- `test/fixtures/osric.ts` is the original fixed court, kept only for mechanics tests.

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
    npx vite-node scripts/fuzz.ts -- 120 40      # random legal play over generated courts, invariant checks
    npx vite-node scripts/stats.ts -- 40 104     # outcome statistics across seeds (courts × weeks)
    npx vite-node scripts/pulse.ts -- 20 104     # is the court still lively in year two?
    npm run build:single                         # dist-single/crown-of-whispers.html, the published page

The published page is https://claude.ai/artifact/KQZsENkaYDgd8Go729tuUj — republish from
`dist-single/crown-of-whispers.html` after `npm run build:single`.

Desktop apps (Electron, `electron/main.cjs`): `npm run app` runs one from source. The Windows .exe and
macOS .dmg are built only by `.github/workflows/desktop.yml` (a .dmg needs a Mac), which also launches
each app with `scripts/desktop-smoke.cjs` and publishes both to the `desktop` GitHub release. They are
unsigned (ad-hoc on macOS). The desktop build bundles its fonts (`virtual:fonts` in vite.config.ts) so it
runs offline; keep it free of network requests, the smoke test fails on any.
