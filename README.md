# Crown of Whispers

A medieval court-intrigue game played entirely through the UI: no 3D, no armies, no one running about the screen. Only motives, the people who hide them, and what each of them believes.

Every game is a new court, generated from a seed. You are a minor lord new to court, with small lands, a wife, perhaps a brother, and a seat at the bottom of the hall. The King is old and has no heir; when he dies, the lords of the Witan choose who follows him. Rise to the throne, or die trying. There is no time limit.

## What a court looks like

The generator writes a court's history first, then its motives, then its schemes, so every motive has a reason:

- **The Crown**: an old King, perhaps a Queen, a Captain of the Guard and a Confessor.
- **Great houses** holding the great offices (Marshal, Chancellor, Master of Whispers), and **lesser houses**, each a household of lord, wife, brothers and servants.
- **A past**: forged wills and cheated brothers, old rivalries, a life saved in battle, insults, debts, broken betrothals, and secret lovers.
- **Situations** applied to whoever fits them: a soldier who means to kill the King; a rival who learns of it and uses a cleverer man to bring him down; that cleverer man forging letters to frame them both; an ambitious wife pushing a timid husband; disinherited brothers who feign loyalty and wait for the thief to rise before killing him and taking back their lands.
- **New trouble every season**: a feast where faces are seen and quarrels start, ambitions that wake, new affairs, a King's new favourite. New families arrive at court over time.

## How it plays

- **The court map** shows the King at the top and the houses in tiers below. People you have only heard of are hooded silhouettes; people you have never heard of are not shown at all.
- **You must find people, then be introduced**, before you can talk to them, bribe them or draw them into a scheme. You meet faces at court and at the seasonal feasts; your wife makes friends among the ladies; spies can map a household. Keep company and people become familiar; spies can unmask their true design.
- **Servants** hear what is said behind closed doors and may let it slip.
- **Secrets have belief and proof.** Whisper truths or forge lies. Clever forgers' seals are hard to see through.
- **Schemes**: murder plots need preparation and steady hands; ruin plots carry charges and witnesses to the King. Recruits may join sincerely or meaning to betray you, and you are never told which. Some schemes wait for a trigger ("when he holds an office").
- **The King's justice**: proof, witnesses and trust decide whether the accused is dismissed, sent to the Tower or beheaded. Prisoners confess and name names.
- **Strong wills**: a spouse can goad, restrain, or demand a deed. Heeding your wife's demand costs no time.
- **The Witan**: when the throne falls empty it meets at the end of the following week. The Briefing shows how it would vote today. Being crowned is a triumph; you may then rule on.
- **The truth**: when the game ends, everything hidden is revealed: every motive, every false oath, the real court, and everything that happened in the dark.

## Running it

```sh
npm install
npm run dev            # play at http://localhost:5173
npm test               # engine tests, including full random seasons for every character
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

Tools for tuning the simulation:

```sh
npx vite-node scripts/simulate.ts -- 7 40   # one court, 40 weeks, the full hidden chronicle
npx vite-node scripts/stats.ts -- 40 104    # outcomes across 40 courts over two years
npx vite-node scripts/pulse.ts -- 20 104    # how lively the court stays, season by season
npx vite-node scripts/fuzz.ts -- 120 40     # random legal play with invariant checks
node scripts/icons.mjs                      # regenerate the icon subset
```

A game is fully determined by its seed and the player's choices.

## Code layout

```
src/engine/        pure TypeScript simulation; no DOM
  types.ts         the data model (characters, houses, secrets, plots, knowledge, events)
  generate.ts      the court generator: houses, history, motives, situations, newcomers
  content/         names, places and archetypes
  tensions.ts      seasonal feasts and fresh trouble
  secrets.ts       belief, proof, and how secrets travel
  plots.ts         murder and ruin plots, leaks, strikes
  court.ts         judgment, questioning, executions, inheritance, offices, the Witan
  actions.ts       every deed, shared by the player and the AI
  ai.ts            how each courtier chooses their week, and how motives change
  audiences.ts     moments that need the player's answer
  turn.ts          the week loop
  objectives.ts    each character's aim and how it is judged
  view.ts          the player's perspective: only what they could know
src/ui/            React interface (court map, briefing, ledger, schemes, chronicle, dossier, end screen)
  icons/           game-icons.net glyphs (generated by scripts/icons.mjs)
test/              vitest suites; test/fixtures/osric.ts is the original hand-written court
scripts/           simulation and statistics tools
```

Games are saved in the browser's local storage as you play.

## Credits

Icons by Lorc, Delapouite and contributors from [game-icons.net](https://game-icons.net), licensed CC BY 3.0. Court map built with [React Flow](https://reactflow.dev).
