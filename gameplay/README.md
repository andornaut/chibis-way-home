# Gameplay

Gameplay ownership, tuning targets, playtesting and current release work. Chibi's Way Home is a landscape platformer about Chibi, a lost bird, travelling zone to zone across a map to get home. Phone browser first, with keyboard on desktop.

## Docs

| Doc                                 | Owns                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| [`README.md`](README.md)            | Gameplay scope, method, targets and playtesting                                     |
| [`design.md`](design.md)            | Current rules, player voice, story and stage content                                |
| [`ideas.md`](ideas.md)              | Undecided questions, proposals and rejected ideas                                   |
| [`narrative/`](narrative/README.md) | Homeward journey notes: connective scenes and unapproved optional-content proposals |
| [`next.md`](next.md)                | Agreed future scope, unscheduled and outside the current build                      |

Docs state current decisions; git keeps their history. An undecided proposal stays in `ideas.md`. Agreed current rules belong in `design.md`; agreed later work belongs in `next.md`. Chibi's story, cast and stage route remain in the rulebook because they define this game's content.

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `screen.ts` and the tests). Every number (speeds, jump and flutter heights, timings, counts) and every string a player sees lives in those files, never in code. Reusable behaviour patterns for animals and moving inanimate objects are gameplay-owned values in `src/data/`: their primitives, sequences or states, transitions, timing, animations and tuning. Tech owns the schema, primitives, condition evaluation and shared executor. A new field, key or shape goes through tech.

## Method

- **Bounded diagnostics:** compare pinned source and matching layout, motion and bot seeds with explicit executed-tick, retry, planning-work and wall-time limits. Report successful-attempt time separately from total active time, current and peak progress, observed area/chunk coverage, deaths, policy stalls and omitted cases. Budget exhaustion or an uncalibrated policy failure does not establish impossible geometry or human difficulty; check deliberate waits against mover cycles. A bot clear does not establish human enjoyment or calibrate the human successful-clear time target. Device playtesting remains necessary.
- **Decisions:** the user's. Gameplay asks with a prompt, recommendation first and the trade-off in a line; routine work needs no asking.
- **Design review:** apply the [stage design principles](design.md#stage-design-principles) to required routes, including cross-chunk transitions. Preserve the rulebook’s fresh-entry and same-run retry lifecycle when comparing layouts. Use recorded residence, revisits and input metrics to identify locations for human playtesting, not as enjoyment scores.
- **Design sessions:** start with "design session" and a topic. Claude keeps floated ideas apart from agreed ones, asks the question that unblocks a decision, and on "wrap up" proposes doc changes, writing them once confirmed.
- **Difficulty:** use configurable per-zone difficulty targets and variation bands from `src/data/`, with a demanding first zone and a difficulty increase in every following zone. Vary required climbing chunks, moving obstacles, ground hazards and enemy yards; a seed need not include every challenge type. Every built and future stage, including the first tutorial and final stage, has a fixed opening and ending around randomized middle chunks. Vary meaningful challenge combinations and order within the zone band and valid chunk connections. Run and attempt lifecycle rules are in the rulebook.
- **Jump tuning:** use one uninterrupted decelerating ascent, with a minimum hop for short presses and the full jump on a hold. Place overhead short-jump challenges to match the measured hop. Keep the reaches in the rulebook aligned with the simulator, including coyote time in the running gap reach
- **Phone playtesting:** judge jump feel, touch input and readability on a landscape phone. The user performs device playtesting.
- **Required-route verification:** routine chunk checks use the explicit required-route registry and real physics to reach declared entry-connected targets and clear the exit, with slots empty and filled. Grounded target intervals are enforced where authored. Exhaustive optional-surface exploration belongs to diagnostics and synthetic fixtures, not the production required-route gate. Passing a scoped route check does not establish that every generated stage or a human pacing target passed
- **Tune to the targets:** a result inside its band needs no tuning. The user declares when the goal is met.

## Current scope

The linear route has six themed zones and twenty-one stages, all built. The [rulebook](design.md#v1-route) owns their names, IDs and rules, and recipe data owns lengths. The park remains a debug prototype outside V1; later scope is listed in [`next.md`](next.md). Completing the route does not declare a V1 release.

## Targets

Targets are assessed per stage and player skill. Bands other than the successful-clear time target remain to be agreed with the user. The kinds of target:

- **Encounter distribution:** satisfy the rulebook's encounter quotas across each zone’s catalogued stages, with distinct encounter sections, ordinary platforming between them and varied layout. Encounter spacing is flexible; it is not a time-based encounter rate
- **Stage length:** target about 60 seconds of successful active play on the ordinary required route in the first five zones with no powerup active. Apartment retains about 90 seconds per floor (about nine minutes total). Dash, Double jump and Speedy are never required on ordinary routes. Because the first grant automatically selects a skill, no-powerup calibration uses an allowed test harness or an ungranted save, not a new player-facing off toggle. Active-time calibration remains limited. It is a tuning target, not a hard time limit or a direct conversion to tile length. Track this generated run's total active time including retries separately from the historically fastest successful-attempt time, using the rulebook's active-time exclusions
- **Reaches:** Chibi makes every jump at a reach in the rulebook's Grid, and never one tile beyond it. A pass or fail check, not a band
- **Restarts:** a failed attempt is one that ends in death (a fall, hazard or crush), followed by the retry choice. Restarts per stage, by skill: some attempts fail, and the band says how often
- **Route spread:** every route a choice opens lands within a narrow window of the stage's median clear time and restart rate, so no route is a lot easier or harder
- **Session length:** the time to finish the game, by skill

### Boss playtest criteria

For each placement, record the source, seed, starting support, active skills and whether entry is natural or staged. Check ordinary no-powerup forward passage, boss traversal and escape routes, visible tells, actual effects and contact, supported recovery and the next attack boundary. Include neighbouring terrain, cover and exits rather than checking an isolated animation alone.

Report observed outcomes separately from unobserved specials, incomplete recovery, controller limitations and exhausted work. A cooldown is not a contact grace period. Record any declared reaction delay and whether the cue was actually visible; automated success does not establish human fairness or enjoyment. Compare distinct physical encounter layouts rather than counting cosmetic aliases as variety.

### Reported playtimes

| Zone                 | Stage              | Reported clear time |
| -------------------- | ------------------ | ------------------- |
| Blue cityscape       | Parcel depot       | 1:06                |
| Blue cityscape       | Streets            | 1:18                |
| Blue cityscape       | City boundary      | 0:58                |
| Industrial outskirts | Warehouse district | 1:06                |

The user reports that most stages take about 60 seconds and are faster with powerups. The four recorded clears above total 4:28 and average 1:07; their layout seeds, retry counts, active powerups and timer basis were not recorded. These observations do not establish calibrated successful-attempt active times for all twenty-one stages. Recipe data owns current filled lengths.

## Active obstacle implementation targets

The transfer-gate crossing, crumbling support and warned vent are implemented, each with bounded real-physics qualification of its approach, commitment, landing, failure and retry reset. None establishes a forced ride or whole-stage completion. The remaining target is the forced-transit attack deferral below. Preserve current stage lengths, movement, encounter quotas and ordinary routes without skills.

Qualify each family's complete approach, commitment, safe landing and recovery using actual contact and support. Include missed boarding or delayed departure where relevant. A renamed existing pattern, cosmetic variant or unobserved phase does not establish a new physical challenge or a passing implementation. These targets add neither combat nor underwater movement.

### Forced-transit attack deferral target

This approved target awaits Pebble's data opt-in and authored-range qualification. The [rulebook](design.md#forced-transit) owns its rules. Scope the exit-offer proof to that rule, not an impossibility claim about every future controller.

## Release and tuning

Successful-clear active-time calibration remains limited; landscape-phone checks of jump feel, touch input and readability remain.

Unresolved design questions are collected in [`ideas.md`](ideas.md#open-questions); agreed later scope is in [`next.md`](next.md).
