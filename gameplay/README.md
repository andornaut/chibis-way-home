# Gameplay

Gameplay ownership, tuning targets, playtesting and current release work. Chibi's Way Home is a landscape platformer about Chibi, a lost bird, travelling zone to zone across a map to get home. Phone browser first, with keyboard on desktop.

## Docs

| Doc                                 | Owns                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| [`README.md`](README.md)            | Gameplay scope, method, targets and playtesting                |
| [`design.md`](design.md)            | Current rules, player voice, story and stage content           |
| [`ideas.md`](ideas.md)              | Undecided rule proposals, open questions and rejected ideas    |
| [`narrative/`](narrative/README.md) | Connective scenes and story beats of the homeward journey      |
| [`next.md`](next.md)                | Agreed future scope, unscheduled and outside the current build |

Docs state current decisions; git keeps their history. An undecided proposal stays in `ideas.md`. Agreed current rules belong in `design.md`; agreed later work belongs in `next.md`. Chibi's story, cast and stage route remain in the rulebook because they define this game's content.

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `screen.ts` and the tests). Every number (speeds, jump and flutter heights, timings, counts) and every string a player sees lives in those files, never in code. Reusable behaviour patterns for animals and moving inanimate objects are gameplay-owned values in `src/data/`: their primitives, sequences or states, transitions, timing, animations and tuning. Tech owns the schema, primitives, condition evaluation and shared executor. A new field, key or shape goes through tech.

## Method

- **Bounded diagnostics:** compare pinned source and matching layout, motion and bot seeds with explicit executed-tick, retry, planning-work and wall-time limits. Report successful-attempt time separately from total active time, current and peak progress, observed area/chunk coverage, deaths, policy stalls and omitted cases. Budget exhaustion or an uncalibrated policy failure does not establish impossible geometry or human difficulty; check deliberate waits against mover cycles. A bot clear does not establish human enjoyment or calibrate the human successful-clear time target. Device playtesting remains necessary.
- **Decisions:** the user's. Gameplay asks with a prompt, recommendation first and the trade-off in a line; routine work needs no asking.
- **Design review:** apply the [stage design principles](design.md#stage-design-principles) to required routes, including cross-chunk transitions. Preserve the rulebook’s fresh-entry and same-run retry lifecycle when comparing layouts. Use recorded residence, revisits and input metrics to identify locations for human playtesting, not as enjoyment scores.
- **Design sessions:** start with "design session" and a topic. Claude keeps floated ideas apart from agreed ones, asks the question that unblocks a decision, and on "wrap up" proposes doc changes, writing them once confirmed.
- **Difficulty:** the rulebook's [Stages](design.md#stages) and [Chunks](design.md#chunks) rules own the zone bands, weights, fixed caps and challenge variety.
- **Jump tuning:** the rulebook's [Chibi](design.md#chibi) jump rules and [Grid](design.md#grid) reaches apply. Keep those reaches aligned with the simulator
- **Phone playtesting:** judge jump feel, touch input and readability on a landscape phone. The user performs device playtesting.
- **Required-route verification:** the rulebook's [chunk fairness](design.md#chunks) rule applies. Passing a scoped route check does not establish that every generated stage or a human pacing target passed
- **Tune to the targets:** a result inside its band needs no tuning. The user declares when the goal is met.

## Current scope

Every zone and stage on the [V1 route](design.md#v1-route) is built. The rulebook owns their counts, names, IDs and rules, and recipe data owns lengths. The park remains a debug prototype outside V1; later scope is listed in [`next.md`](next.md). Completing the route does not declare a V1 release.

## Targets

Targets are assessed per stage and player skill. Bands other than the successful-clear time target remain to be agreed with the user. The kinds of target:

- **Encounter distribution:** satisfy the rulebook's encounter quotas across each zone’s catalogued stages, with distinct encounter sections, ordinary platforming between them and varied layout. Encounter spacing is flexible; it is not a time-based encounter rate
- **Opening:** the storybook opening grows to five shots, with packing and postal transit as separate shots in the third beat, and layered actor poses, gestures, parcel closure, travel and waking giving motion beyond still pictures
- **Stage length:** the rulebook's [Stages](design.md#stages) length rule sets the targets. No grant selects a skill by itself, so no-skill calibration uses a save with no skill selected or an allowed test harness, not a player-facing off toggle. Active-time calibration remains limited. A target is not a direct conversion to tile length. Track this generated run's total active time including retries separately from the historically fastest successful-attempt time, using the rulebook's active-time exclusions
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

The user reports that most stages take about 60 seconds and are faster with powerups. The four recorded clears above total 4:28 and average 1:07; their layout seeds, retry counts, active powerups and timer basis were not recorded. These observations do not establish calibrated successful-attempt active times for every [route](design.md#v1-route) stage. Recipe data owns current filled lengths.

## Active obstacle implementation targets

The transfer-gate crossing is implemented, with bounded real-physics qualification of its approach, commitment, landing, failure and retry reset; it does not establish a forced ride or whole-stage completion. Preserve current stage lengths, movement, encounter quotas and ordinary routes without skills.

Qualify each family's complete approach, commitment, safe landing and recovery using actual contact and support. Include missed boarding or delayed departure where relevant. A renamed existing pattern, cosmetic variant or unobserved phase does not establish a new physical challenge or a passing implementation. These targets add neither combat nor underwater movement.

## Release and tuning

Successful-clear active-time calibration remains limited; landscape-phone checks of jump feel, touch input and readability remain.

Unresolved design questions are collected in [`ideas.md`](ideas.md#open-questions); agreed later scope is in [`next.md`](next.md).
