# Crown of Whispers

A medieval court-intrigue game played entirely through the UI: no 3D, no armies, no one running about the screen. Only motives, the people who hide them, and what each of them believes.

King Osric is old, and his only son is dead. When he dies, the lords of the Witan will acclaim a new king, and everyone at court can count.

## The opening: the Season of Knives

The game starts from this position. Every part of it is a live, simulated scheme, not a script.

- **Sir Aldric**, the Lord Marshal, means to murder the King and take the crown.
- **Sir Bertrand**, the Chancellor, knows. He tells the King nothing. He tells **Sir Cedric**, hoping to make him the knife that brings Aldric down.
- **Sir Cedric**, Master of Whispers, says he will carry the charge to the King. He has forged letters that make Aldric *and* Bertrand partners in a pact. Once the axe has taken both, he means to murder the King himself.
- **Lord Edmund Ashby** is a minor lord nobody watches. His wife **Isolde** has learned Cedric's design through her maid, and she will not let Edmund stay small. Edmund means to lay all three great lords' secrets before the King, step into their offices with his brothers, and kill the King "if the time comes."
- But Edmund forged their father's will and took the lands of his brothers **Gareth** and **Wystan**. He offers them offices as the bigger dream. They swear to his scheme only to let him do the killing, then murder him and take everything back. A murdered man's lands pass to his brothers; a traitor's go to the crown, so they want him dead by a stranger's hand, not the headsman's.
- Around them: **Lady Rowena**, Aldric's wife, who tries to hold him back; **Father Anselm**, the King's confessor; and **Sir Hugh**, Captain of the Guard, who would die for the King and trusts the wrong people.

You can play any of the eleven. Each has their own aim and a harder triumph.

## How it plays

- **Weeks and time.** A season is 20 weeks. Each week you have three measures of time to spend on deeds. Then the night passes, everyone else acts, and at dawn you learn what reached your ears.
- **Hidden motives.** You can read temperament and attitude, but not what someone wants. Spies reveal a person's true design, the schemes they belong to, and whether they meant the oaths they swore.
- **Secrets have belief and proof.** Belief is personal: it depends on who told you and how you feel about the accused. Proof is how well a secret would stand up before the King. You can whisper truths or forge lies. Clever forgers' seals are hard to see through.
- **Schemes.** Murder plots need preparation, sworn blades and hired swords, and even a clean kill can be traced. Ruin plots gather charges and witnesses to lay before the King. When you draw someone in you offer a carrot: gold, land, a great office for when you rise, a shared enemy. They may join sincerely or meaning to betray you, and you are never told which. Every extra conspirator makes a plot leak more.
- **The King's justice.** Denunciations are weighed on proof, witnesses willing to speak, and whom the King trusts. The accused may be dismissed, taken to the Tower to be questioned, or beheaded. Prisoners confess or name other names. The condemned sometimes shout one last secret from the scaffold.
- **Strong wills.** A spouse can goad, restrain, or demand a specific deed. When your spouse demands something of you, heeding her costs no time, because her will carries you.
- **Motives move.** A lord whose enemy is dead may start to look at the throne. A widow may want vengeance. A brother given back his land may let the grudge go.
- **Succession.** If the King dies, the Witan meets at the end of the following week. A man the whole court knows to be the regicide cannot be acclaimed.
- **The truth.** At Midsummer, the end screen reveals every motive, every false oath, the real web of loyalties, and everything that happened in the dark.

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
npx vite-node scripts/simulate.ts -- 7 edmund   # print one season's full hidden chronicle
npx vite-node scripts/stats.ts -- 60 anselm     # outcomes across 60 seeds
```

A game is fully determined by its seed and the player's choices. The same seed played as a different character shows the same court from another pair of eyes.

## Code layout

```
src/engine/        pure TypeScript simulation; no DOM
  types.ts         the data model (characters, secrets, plots, knowledge, events)
  scenario.ts      the opening position described above
  secrets.ts       belief, proof, and how secrets travel
  plots.ts         murder and ruin plots, leaks, strikes
  court.ts         judgment, questioning, executions, inheritance, offices, the Witan
  actions.ts       every deed, shared by the player and the AI
  ai.ts            how each courtier chooses their week, and how motives change
  audiences.ts     moments that need the player's answer
  turn.ts          the week loop
  objectives.ts    each character's aim and how it is judged
  view.ts          the player's perspective: only what they could know
src/ui/            React interface (title, hall, web of intrigue, ledger, schemes, chronicle, dossier, end screen)
test/              vitest suites
scripts/           simulation and statistics tools
```

Games are saved in the browser's local storage as you play.
