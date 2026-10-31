# Gameplay

The design of the game, how it's tuned and tested, and what's left for the first build. Chibi's Way Home is a landscape platformer about Chibi, a lost bird, travelling zone to zone across a map to get home. Phone browser first, with keyboard on desktop.

## Docs

| Doc                      | What it holds                   | Changes when            |
| ------------------------ | ------------------------------- | ----------------------- |
| [`design.md`](design.md) | The rulebook: rules and content | A design decision lands |
| [`ideas.md`](ideas.md)   | Undecided and cut ideas         | Every design session    |

Docs state the current rule only; git keeps the history. An idea stays in `ideas.md` until agreed, then moves to the doc it belongs in.

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `types.ts`, `screen.ts`, the index and the tests). Every number (speeds, jump and flutter heights, timings, counts) and every string a player sees lives in those files, never in code. Reusable behaviour patterns for animals and moving inanimate objects are gameplay-owned values in `src/data/`: their primitives, sequences or states, transitions, timing, animations and tuning. Tech owns the schema, primitives, condition evaluation and shared executor. A new field, key or shape goes through tech.

## Method

- **Bounded diagnostics:** compare pinned source and matching layout, motion and bot seeds with explicit executed-tick, retry, planning-work and wall-time limits. Report successful-attempt time separately from total active time, current and peak progress, observed area/chunk coverage, deaths, policy stalls and omitted cases. Budget exhaustion or an uncalibrated policy failure does not establish impossible geometry or human difficulty; check deliberate waits against mover cycles. Device playtesting remains necessary.
- **Decisions:** the user's. Gameplay asks with a prompt, recommendation first and the trade-off in a line; routine work needs no asking.
- **Design sessions:** start with "design session" and a topic. Claude keeps floated ideas apart from agreed ones, asks the question that unblocks a decision, and on "wrap up" proposes doc changes, writing them once confirmed.
- **Difficulty:** use configurable per-zone difficulty targets and variation bands from `src/data/`, with a demanding first zone and a difficulty increase in every following zone. Vary required climbing chunks, moving obstacles, ground hazards and enemy yards; a seed need not include every challenge type. Every built and future stage, including the first tutorial and final stage, has a fixed opening and ending around randomized middle chunks. Vary meaningful challenge combinations and order within the zone band and valid chunk connections. Run and attempt lifecycle rules are in the rulebook.
- **Jump tuning:** use one uninterrupted decelerating ascent, with a minimum hop for short presses and the full jump on a hold. Place overhead short-jump challenges to match the measured hop. Keep the reaches in the rulebook aligned with the simulator, including coyote time in the running gap reach
- **Phone playtesting:** judge jump feel, touch input and readability on a landscape phone. The user performs device playtesting.
- **Tune to the targets:** a result inside its band needs no tuning. The user declares when the goal is met.

## V1 plan

The linear route has six themed zones with three stages each, eighteen stages in total. The route table in [`design.md`](design.md) owns all stage names and IDs, from Parcel depot through Climb to the apartment. Every stage has fixed opening and ending chunks around a randomized middle. Recipe data owns lengths. The park is a debug prototype outside the V1 map; branching routes and boss encounters are deferred to Next. Completing the route does not declare a V1 release.

- **Apartment sections:** Entrance and lobby has entrance and lobby; Shared floors has restaurant, first fire escape and pool; Climb to the apartment has second fire escape, spa, third fire escape and residential. Each stage has one checkpoint at its beginning.
- **Dialogue and encounters:** stage one has no visible physical antagonist and zero encounters. Each fresh entry plays live top-panel foreshadowing with Skip; death retries do not replay it. Stage two begins with the first physical meeting and has one further encounter; stage three has two encounters. The physical introduction plays once per zone per playthrough, separately from foreshadowing, and always offers Skip. Death, retries and replays preserve its seen state; a new game resets it.
- **Entry and retry:** app reopening shows the start screen, with Start alone until an actual catalogued stage has been entered. Map browsing, chooser cancellation and returning to the title do not enable Restart. Actual stage entry enables Continue and Restart; confirmed Restart restores the beginning state. Manual title Continue shows Chibi on the map without a modal. Only manual map Continue opens the stage chooser. Entering from the map starts a fresh run; death Retry restarts the same stage directly in the same run. Pause and Resume preserve position and run. Walking left from a stage entrance returns to the map; apartment stages use the first section's left edge.
- **Selection:** three fixed side-by-side cards show actual scene screenshots with slight scenery differences within the zone's palette. Locked stages remain visible, grey and disabled. The latest available stage is the highlighted default. Main names retain the standard font size; smaller, lighter stage-number labels sit at the top right. Screenshot mappings derive from zone and stage order.
- **Transitions:** every clear shows an actual image of the cleared stage's art with the four statistics defined in the rulebook and Continue at the bottom right. Stages one and two then enter the next stage directly without the map. Stage three shows the outgoing exchange with Skip, then current-stage and actual-zone-visit statistics, before the map walk. Furt's final exchange and statistics lead to the existing celebration. Clearing a stage unlocks the next built stage; replays preserve unlocks.

Current code calls an individual stage `ZonePlan`.

Run statistics count the initial attempt and reset for a fresh generated run. Death Retry accumulates attempts in the same run; historical successful bests remain. A whole-zone best requires all three successful stage clears from one actual visit. Partial visits show N/3 and cannot set a zone best or mix historical stage bests. The rulebook owns field definitions and active-time rules, including live foreshadowing that counts while play continues.

## Targets

Targets are assessed per stage and player skill. Bands other than the successful-clear time target remain to be agreed with the user. The kinds of target:

- **Encounter distribution:** satisfy the rulebook's zero, two and two encounter quotas across each zone's three stages, with distinct encounter sections, ordinary platforming between them and varied layout. Encounter spacing is flexible; it is not a time-based encounter rate
- **Stage length:** target about three minutes of active play in a successful attempt. This target is unmeasured. It is a tuning target, not a hard time limit or a direct conversion to tile length. Track this generated run's total active time including retries separately from the historically fastest successful-attempt time, using the rulebook's active-time exclusions
- **Reaches:** Chibi makes every jump at a reach in the rulebook's Grid, and never one tile beyond it. A pass or fail check, not a band
- **Restarts:** a failed attempt is one that ends in death (a fall, hazard or crush), followed by the retry choice. Restarts per stage, by skill: some attempts fail, and the band says how often
- **Route spread:** every route a choice opens lands within a narrow window of the stage's median clear time and restart rate, so no route is a lot easier or harder
- **Session length:** the time to finish the game, by skill

## Remaining for the first build

**Current implementation scope:** all six antagonists are always lethal on contact, periodically attempt a direct charge or body contact, and have distinct specials with data-driven frequencies. Archie adds a leaping pounce; Pebble pairs contact swoops with falling white-block poop; Trixi pairs ground rushes with visibly arming red-edged traps; Bini pairs charge and maul with the finite growl gust; Kiwi pairs ground charges with a vertical drop; Furt pairs charges with thrown parcels. Pebble's blocks disappear on landing, and Bini's push stops outside the gust or behind cover, with high ground the primary avoidance. These rules are paired with the matching runtime, values and art. Jump rules and the unresolved friendship outcome are unchanged.

All eighteen V1 stages are built. Successful-clear durations remain unmeasured; duration tuning and landscape-phone checks of jump feel, touch input and readability remain.

Open questions:

- **Beginning:** the cause of Chibi and Furt's fight
- **Confirm, keyboard has no overlay:** assumed, the touch control overlay shows only with touch
- **Confirm, one-way ledges:** assumed, he jumps up through an awning or other one-way ledge from below and lands on top of it
- **Confirm, restarts reset choices:** assumed, a zone restart also resets the choices made in that zone
- **Ending:** the outcome of their friendship when Chibi returns to the shared apartment
- **Friends:** the identities of the friends Furt enlists beyond Archie, Pebble, Trixi, Bini and Kiwi, and their encounters
- **Map:** Next's branching routes
- **Rooms:** the currency and what items do; what quests and rewards give and how they are tracked; what a threat leads to; whether a room can be revisited, and whether its dialogue changes
- **Use:** what it acts on besides doors (assumed: talking to animals, and objects at route forks)
