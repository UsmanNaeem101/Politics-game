# Handoff: Crown of Whispers, from the cloud session to this Mac

You are picking up a game that was built over many sessions in a cloud container. Everything is
on GitHub; nothing lives anywhere else. Read this, then `CLAUDE.md` (the map of the code and the
owner's standing decisions), then `docs/DESIGN.md` before anything substantial.

## Where it is

- Repo: https://github.com/UsmanNaeem101/Politics-game
- Branch: `claude/medieval-politics-game-4tlmoa` (all work is here; `main` is behind)
- Published page (claude.ai artifact): https://claude.ai/artifact/KQZsENkaYDgd8Go729tuUj

## Run it

```
npm install
npm run dev                                   # play in the browser
npm run app                                   # play as a desktop app (Electron)
npm run dist:mac                              # build release/*.dmg (unsigned: right-click > Open the first time)
npx tsc --noEmit && npx vitest run            # typecheck + tests (about 165, all should pass)
npx vite-node scripts/fuzz.ts -- 80 60        # random play, invariant checks: expect 0 problems
npx vite-node scripts/stats.ts -- 20 104      # balance: ~11-13 deaths/court, ~4-5 murders, ~5-6 executions
npx vite-node scripts/pulse.ts -- 20 104      # is the court still lively in year two?
npm run build:single                          # dist-single/crown-of-whispers.html (the published page)
```

## How the owner works

- Plays a lot and reports what feels wrong in plain words; wants the cause explained simply, with
  the numbers (odds, points a month), then fixed. Measure with a quick simulation before and after
  a balance change, and say what the numbers were.
- **Saves must always carry over.** Old saves are repaired on load in `repairSave()` (`src/engine/turn.ts`);
  any change to state shape or to a rate the owner asked for needs a repair there.
- After a change: typecheck, tests, fuzz (and stats if balance moved), then commit and push to the
  branch above. Pushing works. GitHub Actions does not run on this account (a billing lock), so the
  desktop build workflow is manual-only; build the `.dmg` here instead.
- The published page is republished from `dist-single/crown-of-whispers.html` with
  `capabilities: {downloads: true}` (needed for "Save to a file"). If this session has no Artifact
  tool, skip it: the owner can play with `npm run dev` or the desktop app.
- NPCs and the player use the same deeds. When a change makes the player stronger, check the court
  (stats) and, if NPCs turn it bloody, change NPC decisions (`src/engine/ai.ts`), not the deed.

## Settings the owner asked for (do not undo without asking)

- Strike odds rise freely to 92%, then at half the rate, capped at 98%. A month's work on a murder
  scheme counts triple (about +35% with one blade); against a lady (not the Queen) half again more,
  10 less defence, and strike-ready at 20 prepared instead of 30. NPC schemers wait 4 months to strike.
- Hired blades cost 10 crowns (5 against a lady), up to 10 a scheme, paid only when hired.
- Suspicion and guilty verdicts fade 7 points a month; every grudge the King holds fades 7 a month.
- Old friendship grows +8 a conversation to +30 and fades slowly; friends petition for you unasked.
  The King softens with months served (+3 each, to +20) and with refused pleas (+8 each, to +24).
- Children age a year every month until 17; your grown children are put forward for marriage at once;
  you can arrange matches (betroth) for them. At most 15 new houses arrive in a game.
- Solo schemes rarely leak (hired blades are the risk); you are told every month who has heard of
  your scheme and roughly how. A seen-through forgery is traced teller by teller, not straight to you.
  The King's inquiry ends in a hearing for the player, never a seizure.
- Prestige lost to charges or disgrace comes back 2 points a month. It is earned by feasts (30 crowns, every 2 months,
  +4 under 30 prestige down to +1 above 60, +1 if the King comes), the King's favour (a point a month while he holds you
  at 70+, up to 60), upheld charges (+3 to +5), a match into a higher house (up to +8), and office (+10).
- "Offer to kill them for the King" (on the traitor's page, the King's page, Secrets, Schemes) gives a
  royal warrant: no crime, King's favour.

## Saves on this Mac

The game saves itself in the browser's database (IndexedDB) for the page it is played in. The
browser page and the desktop app keep separate saves. To move a game between them: **Save to a
file** (top bar, or title screen) in one, **Load from a file** in the other.

## Open items

- The Mac `.dmg` has never been built: do `npm run dist:mac` here and check it opens and resumes a save.
- Nothing else is outstanding; the owner will bring new requests.
