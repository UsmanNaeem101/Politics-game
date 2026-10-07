# Crown of Whispers — design plan

This is the north star for building the game out over many sessions. It describes the game we are aiming for, the systems that produce it, and the order to build them in. The current prototype (a fixed opening at King Osric's court) proves the engine works; this plan replaces the fixed opening with a generated court and deepens every system.

## 1. What we are making

A single-player game of court intrigue in a medieval kingdom. No armies, no characters walking around the screen. The whole game is people: what they want, what they feel, what they believe, whom they are loyal to, and whom they only pretend to be loyal to.

The bar for depth is the example that started the project: a knight plots to kill the King; a second knight knows and uses a third to bring him down; the third pretends to help while planning to frame both and take the crown; a minor lord learns all of it through his wife; his cheated brothers pretend loyalty, planning to get close to the King, kill him, and petition for his lands; and he, being clever, sends his wife to befriend their wives so he hears of their plans first. **None of that should be scripted.** The systems should be rich enough that situations like it arise on their own, differently every game.

### Pillars

1. **People, not roles.** Everyone has a temperament, aspirations, feelings, memories and a history. They act for their own reasons.
2. **Nothing is what it seems.** What people say, what they show and what they do are three different things. Loyalty can be real or performed. Information can be true, mistaken or planted.
3. **You only see what your eyes and ears reach.** The court is hidden until you meet people, hear of them, or send someone to look.
4. **Power is people.** Money, favours, secrets, love, fear and debts are the only weapons.
5. **Generated, not scripted.** Every game is a new court with its own history.
6. **Shown, not listed.** A network map, icons and portraits carry most of the information. Text is for flavour and detail, not for scanning.

## 2. What the Witan is

The *witan* ("wise men") were the great nobles and bishops who advised Anglo-Saxon kings, witnessed their laws and land grants, and, when the throne was empty or disputed, chose the next king. Their meeting was the *witenagemot*. After Edward the Confessor died in January 1066, the witan backed Harold Godwinson as king.

In the game, the Witan is the council of great lords and churchmen. In the prototype it only meets when the King dies without an heir, to vote in a new king. In the full game it becomes a standing council with seats worth winning: it sits a few times a year, can block a royal decision, judges disputes between nobles, and chooses the next king when there is no clear heir. A seat on it is power; votes can be bought, promised, coerced or traded.

## 3. The world

### Structure

```
                         THE CROWN
              King · Queen · heir(s) · royal household
                             │
        ┌──────────── GREAT OFFICES ─────────────┐
   Marshal · Chancellor · Spymaster · Steward · Master of Coin · Captain · Confessor
                             │
                      THE WITAN (seats)
                             │
          ┌──────── GREAT HOUSES (3–4) ────────┐
          │                                    │
   LESSER HOUSES (4–6)                 CHURCH · GUILDS
          │
   HOUSEHOLDS: lord · wife · siblings · grown children · steward · chaplain · maid · groom · clerk · guards
          │
   THE TOWN: merchants · innkeepers · moneylenders · cutthroats · apothecaries · whores · fences
```

A court of roughly **40–70 people**: 25–35 nobles and their families, and the rest servants, clergy and townsfolk. Only a dozen or so matter at any moment, and the fog of war keeps the rest out of the way until they do.

### Households

The **household** is the basic unit of the map and of politics. A household has a head, a spouse, kin, retainers, servants, lands, money and businesses. Information leaks out of households through their weakest members: a gossiping maid, a resentful steward, a bored wife.

### Time

Proposed: one turn is a fortnight, with a **court calendar** of set pieces: feasts, hunts, tourneys, church festivals, Witan sittings and quarter days when rents fall due. Set pieces matter mechanically: they are where you get introduced to strangers, where poison goes in a cup, and where accidents happen on the hunt. A campaign runs a few years, and the old King's health is the clock everyone is watching.

## 4. Minds

This is the heart of the game. Each person has six layers.

| Layer | What it is | Changes | Example |
|---|---|---|---|
| **Temperament** | Stable traits, 0–100: ambition, cunning, honour, boldness, greed, wrath, suspicion, will, charm, piety, passion, vengefulness, patience | Barely | Isolde: iron will, ambitious, unscrupulous |
| **Aspirations** | 1–3 ranked long-term wants, hidden by default | When achieved, lost or replaced | Crown · Office · Wealth · Revenge on X · Restitution · Love of X · Protect X · Legacy for my son · Escape my marriage · Faith · Security |
| **Emotions** | Short-lived states aimed at someone, decaying weekly | Constantly | Anger at the King (humiliated at court) · fear of Cedric · jealousy over a wife · gratitude · grief · shame · desire |
| **Memories** | What was done to me, by whom, how much it mattered | Added by events; can be false | "Edmund forged our father's will" (−55, permanent) · "Hugh saved my life at Brackenford" |
| **Relationships** | Per pair: affection, trust, respect, fear, attraction, debt, plus labels (kin, spouse, lover, patron, sworn man, friend, rival, enemy) | From memories, emotions, deeds | Gareth→Edmund: affection −45, trust 15, debt 0, label *brother* |
| **Beliefs** | What I think is true, including what I think *others* want and whom I think they are loyal to | From information | Edmund believes Gareth is loyal (he is wrong) |

### Real and performed loyalty

Every person ranks whom they would truly protect, and separately whom they *appear* loyal to. Fake loyalty is a performed loyalty with no real loyalty behind it. The gap is a secret that spies, confessors and close observers can uncover, and it is what makes double-crosses possible.

### Decisions are made on beliefs, not truth

NPCs choose actions from what they *believe*. They never read the true state of the world (the prototype still peeks in places, and that has to go). That one rule is what makes deception work: feed someone a false belief and they act on it.

### Emotions bend decisions

Temperament sets the default; emotion pushes past it. A cautious man humiliated in front of the court may do something rash tonight. A frightened man strikes first. A jealous husband stops thinking. Spouses, lovers and friends can stoke or calm emotions (the prototype's "goad / restrain / demand" generalises to anyone close enough to move you).

## 5. Information

### Claims, not just facts

Everything that travels is a **claim**: "Gareth means to kill Edmund", "the Queen has a lover", "Aldric's horse went lame on purpose". A claim has a truth value the player never sees directly. Each person holds a belief in each claim they know, with a source and a date.

- **Belief** depends on who told you, how much you trust them, and whether it fits what you already think.
- **Proof** is separate: letters, witnesses, a confession, a bloody knife. Proof is what stands up before the King or the Witan.
- **Lies** are claims someone knows to be false. **Planted** information is a lie fed on purpose through a channel the liar knows is watched.

### Channels

Information moves only along channels, and each channel has its own character:

| Channel | Who | Strength | Weakness |
|---|---|---|---|
| Conversation | Anyone introduced | Direct, persuasive | You know who told you, and so do they |
| Letters | Literate people | Reach, proof | Can be intercepted, forged, kept as evidence |
| Servants' gossip | Within and between households | Constant leaks | Distorts as it spreads |
| **The ladies' circle** | Wives, daughters, widows | The best gossip at court; reaches inside households | Women can play it as well as you can |
| Confession | Priests | Deep truths | Sealed, unless the priest is corrupt or frightened |
| Taverns and the market | Town and underworld | Cheap, wide | Unreliable |
| Spies | Your agents | Targeted, ongoing | Can be caught, bought or turned |
| Public court | Everyone | Indisputable that it was *said* | Irreversible |

Rumours spread along the social graph with a chance to distort at each step: a name swapped, a detail added, a certainty upgraded.

### Fog of war

The player sees people and ties at increasing levels:

| Level | How you get there | What you see |
|---|---|---|
| **Unknown** | — | Nothing. Not on the map. |
| **Heard of** | Mentioned in gossip, a report, a letter | A dark silhouette with a name or a role ("Cedric's clerk") |
| **Seen** | Present at court or a set piece | Face or arms, rank, office, public ties |
| **Introduced** | Introduction by a mutual acquaintance, a feast, your spouse's visits, a bribe | You can deal with them directly; you see their attitude to you |
| **Familiar** | Time spent, shared secrets | Temperament, current mood |
| **Unmasked** | Spies, confession, betrayal by a confidant | Aspirations, real loyalties, secret ties |

Households also start partly dark: "Lord Ashby's household: 3 unknown servants." Placing a spy inside, or befriending someone who lives there, lights it up. Ties go through the same steps: **hidden → rumoured (dashed line) → confirmed (solid line)**.

## 6. Schemes

A scheme is a goal, a plan in stages, and people in roles. Each participant also holds a **private stance** toward it:

- **Sincere**: wants it to succeed as agreed.
- **Feigning**: pretends to help, to learn its secrets or wreck it.
- **Informant**: will sell it to someone.
- **Supplanter**: wants it to succeed, then to take the prize from its leader. This is the double-cross.

Stages can wait on **triggers** ("when Edmund holds an office", "when we are in the King's favour", "after the feast"). Every scheme leaks in proportion to how many people know, how careless they are, and who is watching.

Scheme types to support over time: murder, ruin (formal accusation), frame-up, smear (rumour campaign), seduction, blackmail, marriage alliance, infiltration (place a spy or win over a servant), theft of lands through a dead man's estate or a forged deed, coup.

### Your example, produced by systems rather than script

1. **Generation** gives House Ashby a history event: the father died, and the eldest forged the will (memory: *stole our inheritance*, −55 for both younger brothers; secret: *forged will*).
2. **The brothers' aspirations** become *Restitution* and *Revenge*. Their patience is high and their honour low, so the AI picks a plan template with a delayed trigger: join Edmund's rise feigning loyalty → win the King's favour → murder Edmund quietly (a traitor's lands go to the crown; a murdered man's go to his heirs) → petition the King for his lands.
3. **Edmund's suspicion** is high and his trust in his brothers low, so he wants information about them. His best channel into their households is his wife, because she can visit their wives without suspicion.
4. **Isolde** receives a household instruction: *befriend the wives of Gareth and Wystan*. Her charm and the wives' loneliness or grievances decide how fast she is let in. Each visit has a chance to surface claims the wives have overheard.
5. **The counter-play** is emergent. If the brothers grow suspicious of Isolde, they can feed their own wives false plans to pass on. If one of the brothers' wives is unhappy, Isolde may turn her into an informant. If Isolde has her own lover, she may sell all of it to him instead.

## 7. Households and the people in them

- **Wives** are full agents with their own aspirations. They run the household, manage the ladies' circle, broker marriages, influence their husbands (goad, restrain, demand), and can be sent on missions: befriend, listen, carry messages, plant rumours.
- **Affairs.** Attraction plus opportunity plus an unhappy marriage can start an affair. A lover changes loyalties. An unfaithful wife may help her lover against her husband and feed her husband false information. Discovery causes jealousy and humiliation, and can end in a duel, a petition to the Church, a quiet poisoning, or forgiveness.
- **Servants** are minor characters with names, grudges and prices. They are the doors into households: the steward who reads his master's letters, the maid who hears everything, the groom who knows who rode out at night.
- **Children and heirs** come later. They turn aspirations into *legacy* and make marriage alliances worth scheming over.

## 8. Spies

Spies are real characters you must recruit, place and keep.

- **Recruiting** costs something the recruit wants: gold, protection, a position, freedom from a debt, love, or silence about their own secret (blackmail). Their reason for serving decides how reliable they are. A paid spy can be outbid; a blackmailed spy hates you; family is loyal until it isn't.
- **Placement**: a spy works where they have access, such as a household, the ladies' circle, the chapel, the guardroom or a tavern. Better access means better reports.
- **Reports** arrive in an inbox each turn, each with a source you can judge.
- **Risk**: spies can be caught (and may name you), bought, or turned into a double agent who feeds you planted information. You can do the same to theirs.
- **Your own household leaks too.** Dismissing a suspicious maid is a deed.

## 9. Money, businesses and rackets

Every household needs income: rents from land, office stipends, and the business or racket the head runs. **What you run decides how the court sees you, and what doors it opens.**

| Business | Income | Standing | What it gives you for intrigue |
|---|---|---|---|
| Estates and harvest | Low, steady | Honourable | Retainers, food for feasts |
| Wool trade | Medium | Respectable; the guilds like you | Guild contacts, foreign letters |
| Mill or toll bridge (monopoly) | Medium | Resented by commons | Leverage over a district |
| Wine import | Medium | Fashionable | Access to every feast's cellar |
| Moneylending | High | Church disapproves; nobles resent their debts | **Debtors owe you favours** |
| Tax farming | High | Crown likes it; commons hate you | Royal favour, unrest risk |
| Gambling house | High | Disreputable if known | Gamblers' debts as leverage |
| Bathhouse or brothel | High | Scandalous if known | Informants among clients, blackmail material |
| Smuggling | High, risky | Criminal if known | Cutthroats for hire: cheaper, quieter murders |
| Forgery and fencing | Medium, risky | Criminal if known | **Better forged letters and seals** |
| Apothecary | Low | Respectable | Poisons |

**Standing** is tracked separately with each part of society: the **Crown**, the **nobility**, the **Church**, the **guilds**, the **commons** and the **underworld**. Standing opens or closes doors: who will receive you, who will believe you, who will lend to you, who will hide you. An illicit racket you keep secret is itself a secret that can be exposed. Hiding it behind a front, or behind a manager who might steal from you, is part of the game.

## 10. Generating a court

The generator builds history first, then motives, then schemes, so that motives always have reasons.

1. **Realm**: the King (age, health, heirs or none), the Queen, the great offices, Witan seats, the Church, the town.
2. **Houses**: 6–10 noble houses with rank, lands, wealth, arms and seat; each household populated with family, servants and (sometimes) a business.
3. **Temperaments**, sampled with archetype priors so the court has recognisable shapes: the soldier passed over, the careful official, the spider, the climber, the spur (an ambitious wife), the disinherited, the pious, the loyal shield, the unhappy wife, the charming rake, the moneylender.
4. **History**: a short simulated past (a decade of events) that leaves memories, grievances, debts and secrets: inheritance disputes, a battle where someone saved or abandoned someone, arranged and broken marriages, affairs, duels, debts, insults at court, a death no one explained.
5. **Aspirations**, derived from temperament plus history.
6. **Dramatic situations**: a library of patterns that wire motives together, such as:
   - *The knowledge chain*: one plots; another finds out and chooses to exploit rather than report.
   - *Disinherited kin*: stolen inheritance and feigned reconciliation.
   - *The cuckoo's nest*: an affair, and false information passed through the marriage bed.
   - *Two masters*: a servant spying for two houses.
   - *The rising nobody*: a minor lord with an ambitious spouse.
   - *The old debt*: a moneylender holding half the court's notes.
   - *The heir question*: a sickly heir, an ambitious uncle.

   The generator applies a handful of these to the people they fit.
7. **Checks**: every major figure has at least one hidden motive and one secret; there are at least three active schemes and two double-cross opportunities; the player is within two steps of something dangerous; no one knows everything. A generated court that fails is re-rolled.
8. **The player** picks a character, or a starting role ("a minor lord new to court", "the King's spymaster", "a lady married into a falling house"). Starting knowledge depends on who you are.

## 11. The interface

### The court map (main view)

A node network laid out as a hierarchy: **the King at the top**, then the royal family, the great offices, the Witan, the great houses, the lesser houses, and households fanning out beneath them, with the town at the bottom edge. Pan and zoom; households collapse into a single node until you open them.

- **Nodes** are portraits or arms with a ring showing their attitude to you, a mood icon, and status badges (office, prisoner, ill, wounded, in mourning).
- **People you have only heard of are dark silhouettes**, labelled with a question mark or a role. People you have never heard of are not on the map at all.
- **Lines**: hierarchy (vertical), kin, marriage, love affairs, alliances, enmities, debts, known schemes (red arrows), and *your* spies (a thread from you to their household). Rumoured ties are dashed; confirmed ties are solid.
- **Filters**: show only my spies; only schemes; only the ladies' circle; only debts.
- Clicking a node opens the **dossier card**; right-click or long-press opens a **radial menu of deeds** with icons.

### Icons first

A consistent icon language replaces most labels:

- **Deeds**: whisper, gift, introduce, feast, court/seduce, spy, intercept, plant rumour, bribe, promise, blackmail, threaten, scheme, recruit, accuse, strike, instruct spouse, dismiss servant.
- **Emotions**: anger, fear, love, jealousy, grief, gratitude, shame, desire.
- **Resources**: gold, favour, secrets, debts, standing (one icon per part of society).
- **Status**: office, prisoner, ill, pregnant, in mourning, exiled.
- **Businesses**: one icon each.

Source: the [game-icons.net](https://game-icons.net) library (thousands of medieval and fantasy icons, CC BY 3.0, so it needs an attribution line) for the bulk, with a few custom ones drawn to match.

### Other views

- **Dossier card**: portrait, arms, temperament icons, mood, what you know of their aspirations and loyalties (with how you know), their household, their ties, and the deeds you can do.
- **Inbox**: reports, letters, rumours and summonses, each with its source and your belief in it.
- **Schemes board**: your schemes as cards with role slots, progress, the stance you *believe* each member holds, and triggers.
- **Spy network**: your agents, where they are placed, their reliability, last report, cost.
- **Holdings**: lands and businesses, income, standing effects, managers.
- **Ledger and chronicle**: the prototype's secrets ledger and chronicle, kept.
- **Event cards** with portraits for audiences, set pieces and revelations.

### Portraits

Start with heraldry and procedural silhouettes. Then layered procedural SVG faces (head shape, hair, beard, headwear by rank and sex, age lines, a mood expression). Commissioned or generated art can replace them later without changing the systems.

### Recommended UI tools

React (already in use) with [React Flow](https://reactflow.dev) for the pannable, zoomable node map with custom node components, and `d3-hierarchy` or `elkjs` for the layered layout.

## 12. Architecture

### Keep

- The engine/UI split: a pure TypeScript simulation, with no DOM, deterministic from a seed.
- Secrets with separate belief and proof, and claims that travel with a source.
- Plots with sincere and false members, the King's judgment, interrogation, executions, inheritance and the Witan.
- Utility-scoring AI where every NPC uses the same deeds as the player.
- The tooling: headless simulation, statistics across seeds, and the random-play fuzzer with invariant checks.

### Change

- **The fixed opening goes.** A generator builds the court. The current opening can survive only as a test fixture.
- **AI uses beliefs, never truth.**
- **A single opinion number becomes** multi-dimensional relationships, plus emotions and memories.
- **Plots become schemes** with stages, roles, triggers and private stances.
- **The flat roster becomes the court map**, with fog of war on people, ties and households.
- **Content moves into data tables**: traits, archetypes, dramatic situations, scheme templates, businesses, set pieces, event text. Most future complexity should arrive as data, not code.

### Data model sketch

```ts
Person      { id, name, sex, age, rank, householdId, traits, aspirations[], emotions[], memories[],
              loyalty: { real: Ranked<PersonId>, performed: Ranked<PersonId> }, health, status }
Household   { id, head, members[], servants[], lands[], businesses[], gold, standing }
Tie         { a, b, affection, trust, respect, fear, attraction, debt, labels[] }   // directional
Claim       { id, about[], kind, truth, proof, origin, plantedBy? }
Belief      { holder, claimId, credence, source, when }
Scheme      { id, kind, goal, owner, stages[], roles[], participants: { id, role, stance }[], triggers[] }
Agent       { personId, handler, placement, reliability, motive, cost, turnedBy? }
Business    { id, kind, owner, manager?, income, risk, secret?, perks[] }
Standing    { holder, crown, nobility, church, guilds, commons, underworld }
Discovery   { viewer, subject, level }   // fog of war for people, ties and households
```

### Scale and testing

- Target 40–70 people with a full turn under 50 ms, so the map stays responsive.
- Every system gets **story metrics** in the simulation harness: betrayals per season, schemes completed and exposed, how far information travels, how often the player is touched by events, deaths and their causes. Tuning happens against those numbers, the way the prototype was tuned.
- The fuzzer keeps running random legal play for every role on every change.

## 13. Roadmap

Each phase ends with something playable.

| Phase | Build | Playable result |
|---|---|---|
| **0 — done** | Prototype: fixed opening, hidden agendas, secrets, plots with false members, spouse pressure, King's justice, Witan, end-screen reveal | Current game |
| **1 — The living court map** | Court generator (houses, families, servants, offices, simple history); fog-of-war discovery and introductions; court-map node network with the King at the top and silhouettes for strangers; icon set; dossier cards | Every game a new court you uncover as you play |
| **2 — Minds** | Emotions, memories, multi-dimensional ties, aspirations, real vs performed loyalty, belief-only AI, staged schemes with private stances and triggers | NPCs who hold grudges, panic, and double-cross on their own |
| **3 — Households and women** | Wives as agents, the ladies' circle as a channel, household instructions (befriend, listen, carry), affairs and lovers, planted information through intimates | The "send your wife to befriend their wives" play, and its counters |
| **4 — Spies** | Recruitable servants and townsfolk, placement, reports inbox, reliability, discovery, double agents | A spy network to build and protect |
| **5 — Money and standing** | Businesses and rackets, managers, fronts, standing with six parts of society, scandal | Your income decides who receives you |
| **6 — Institutions and succession** | Standing Witan with sittings and votes, heirs, marriage alliances, Church courts, trials by peers | Long campaigns across a succession crisis |
| **7 — Presentation** | Procedural portraits, event art, sound, onboarding | A finished-feeling game |

## 14. Open questions for the owner

1. **Setting**: a fictional kingdom with an English flavour (as now), or something closer to real history (Anglo-Saxon or Norman England)?
2. **Shape of a game**: a fixed span with personal goals, as now, or an open-ended campaign where you play until you die or rule?
3. **Starting role**: any member of the court, or always a minor lord climbing up?
4. **Tone**: how explicit should affairs, torture and executions be?
