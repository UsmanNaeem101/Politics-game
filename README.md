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
- **Spies are people.** Recruit someone close to the one you want watched (a maid in their house, a brother, a lover, a friend) and offer them a wage, silence about their own secret, or nothing if they adore you or hate the mark. They report each week until caught, unpaid or turned. A caught spy may name you; a cunning mark may turn them, and then every report is a lie. Others set spies in your house: search it, and send them away or turn them to carry your forgeries home.
- **Turning informer**: sworn into a plot, or leading one, you can lay it before the King: draw a man into a scheme, then hand him over. Believed, you are pardoned; disbelieved, your fellow plotters know, and your scheme is finished either way.
- **Keeping company** is the commonest source of intelligence: gossip, warnings of plots against you, introductions to friends, grudges and loves (shown on the map), ambitions spoken aloud or let slip. It depends on how warm and trusting they are, and how loose their tongue.
- **Secrets have belief and proof.** Whisper truths or forge lies. Clever forgers' seals are hard to see through.
- **Schemes**: murder plots need preparation and steady hands; ruin plots carry charges and witnesses to the King. Recruits may join sincerely or meaning to betray you, and you are never told which. Some schemes wait for a trigger ("when he holds an office").
- **The King's justice**: proof, witnesses and trust decide whether the accused is dismissed, sent to the Tower or beheaded. Prisoners confess and name names. Treason and a murder actually done are hanging matters. A dismissed charge still muddies the accused before the whole hall, and for a grave one (or a lord found murdered) the King's people keep digging; if they find enough, the Guard comes weeks later. Once judged, a charge is not heard again without new proof. From the Tower you can ask a friend or kin to plead your case.
- **Strong wills**: a spouse can goad, restrain, or demand a deed. Heeding your wife's demand costs no time.
- **Wives at table**: send your wife to dine with another lady for gossip, her husband's aims and faces from her house; she may let your own secrets slip. Clever lords send their wives to dine with yours.
- **Families**: couples have children, who come of age at sixteen and inherit before their uncles. An unfaithful wife spies for her lover and carries his lies home; her husband may find the letters. A child may not be her husband's, and a widow or a maid may bear her lover's child out of wedlock; the father is told. The widowed mourn a year before they are matched again (no rival courts a new widow for six months), then marry from court or the provinces; the player can seek a match or ask for a hand.
- **Time**: a turn is a month. Everyone ages; children grow up and the old die. The player and the player's wife never die of old age.
- **Love**: court any woman as a lover; a married lover reports what her husband says at home. Rakes court other men's wives, yours included. **Track their movements** to have someone followed for a month (places, company, lovers, fellow plotters). Someone under your own roof can be killed in the night; a widower can choose a new wife from a roster.
- **A bad end** can be turned back: the game keeps how things stood at the start of this month and before the last month ended, and offers both after an ending or from the title screen.
- **Money and standing**: you run a trade, chosen at the start and changed later: estates, wool, a mill, wine, moneylending, a tax farm, an apothecary, or a racket (gambling house, bathhouse, smuggling, forgery). Each pays weekly and wins or loses standing with the Crown, the nobility, the Church, the guilds, the commons and the underworld, which colours how every character regards you. Each gives an edge in intrigue: retainers, foreign letters, a district's leverage, every feast's cellar, debtors, the King's ear, gamblers' debts, informants, cutthroats, forged seals, poisons. A racket is a secret: if it gets out, it is a scandal and a charge.
- **The Witan**: when the throne falls empty it meets at the end of the following week. The Briefing shows how it would vote today. Being crowned is a triumph; you may then rule on.
- **The truth**: when the game ends, everything hidden is revealed: every motive, every false oath, the real court, and everything that happened in the dark.

## Running it

```sh
npm install
npm run dev            # play at http://localhost:5173
npm test               # engine tests, including full random seasons for every character
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
npm run app            # the desktop app, run from source (Electron)
```

### Desktop apps

The game also ships as a desktop app that runs offline: a Windows installer (.exe) and a macOS disk image (.dmg). GitHub Actions builds both on every push that touches the game (`.github/workflows/desktop.yml`), launches each one and plays a week, then publishes them to the [desktop release](https://github.com/UsmanNaeem101/Politics-game/releases/tag/desktop).

The apps are not signed with a paid certificate. On Windows, click *More info* then *Run anyway* the first time. On a Mac, open the app once, then go to *System Settings → Privacy & Security* and click *Open Anyway*.

`electron/main.cjs` is the whole desktop shell; `electron-builder.yml` describes the packages; `npm run build:desktop` bundles the fonts so nothing is fetched from the web. A .dmg can only be built on a Mac, and a Windows installer needs Windows (or Wine). `node scripts/app-icon.mjs` redraws `build/icon.png`.

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
  economy.ts       trades and rackets: income, trouble, leaks, inheritance (table in content/businesses.ts)
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
