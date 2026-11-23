# Tuning and playtesting

Qualification methods, tuning targets and recorded observations for the [V1 route](stages.md#v1-route).

## Scope

Gameplay owns the rulebook and the values and content in the data value files (`src/data/*.ts` except `screen.ts`, `layout.ts` and tests). Gameplay tuning (speeds, jump and flutter heights, timings and counts) and every string a player sees live in those files; Tech owns screen and UI layout geometry, schemas and algorithm limits. Reusable behaviour patterns for animals and moving inanimate objects are gameplay-owned values in `src/data/`: their primitives, sequences or states, transitions, timing, animations and tuning. Tech owns the schema, primitives, condition evaluation and shared executor. A new field, key or shape goes through tech.

## Method

- **Bounded diagnostics:** compare pinned source and matching layout, motion and bot seeds with explicit executed-tick, retry, planning-work and wall-time limits. Report successful-attempt time separately from total active time, current and peak progress, observed area/chunk coverage, deaths, policy stalls and omitted cases. Budget exhaustion or an uncalibrated policy failure does not establish impossible geometry or human difficulty; check deliberate waits against mover cycles. A bot clear does not establish human enjoyment or calibrate the human successful-clear time target. Device playtesting remains necessary.
- **Decisions:** the user's. Gameplay asks with a prompt, recommendation first and the trade-off in a line; routine work needs no asking.
- **Design review:** apply the [stage design principles](stages.md#stage-design-principles) to required routes, including cross-chunk transitions. Preserve the rulebook’s fresh-entry and same-run retry lifecycle when comparing layouts. Use recorded residence, revisits and input metrics to identify locations for human playtesting, not as enjoyment scores.
- **Design sessions:** start with "design session" and a topic. Keep floated ideas apart from agreed ones, ask the question that unblocks a decision, and on "wrap up" propose doc changes and write them once confirmed.
- **Difficulty:** the rulebook's [Stages](stages.md#stages) and [Chunks](stages.md#chunks) rules own the zone bands, weights, fixed caps and challenge variety.
- **Jump tuning:** the rulebook's [Chibi](movement.md#chibi) jump rules and [Grid](movement.md#grid) reaches apply. Keep those reaches aligned with the simulator
- **Phone playtesting:** judge jump feel, touch input and readability on a landscape phone. The user performs device playtesting.
- **Required-route verification:** the rulebook's [chunk fairness](stages.md#chunks) rule applies. Continuous qualification uses ordinary controls and preserves every indexed grounded target within 600 executed ticks, unless an explicit exception is approved. A successful trajectory is not a native certification proof or pool admission. Native producers retain their own compiled search limits and source, target and profile provenance. Passing a scoped route check does not establish that every generated stage or a human pacing target passed
- **Tune to the targets:** a result inside its band needs no tuning. The user declares when the goal is met.

## Current scope

Every zone and stage on the [V1 route](stages.md#v1-route) is built. The rulebook owns their counts, names, IDs and rules, and recipe data owns lengths. See [later scope](next.md) and [release and tuning](#release-and-tuning).

## Targets

Targets are assessed per stage and player skill. Bands other than the successful-clear time target remain to be agreed with the user. The kinds of target:

- **Encounter distribution:** satisfy the rulebook's encounter quotas across each zone’s catalogued stages, with distinct encounter sections, ordinary platforming between them and varied layout. Encounter spacing is flexible; it is not a time-based encounter rate
- **Layout variety:** target at least 16 distinct certified physics layouts per zone, excluding cosmetic aliases, seeds and boss arenas. Only layouts with matching ordinary no-powerup required-route proofs count toward these targets. Legacy certificates keep existing pool eligibility until a pool change is admitted
- **Stage length:** the rulebook's [Stages](stages.md#stages) length rule sets the targets. Calibrate with no skill selected or an ordinary test profile. Active-time calibration remains limited. A target is not a direct conversion to tile length. Track this generated run's total active time including retries separately from the historically fastest successful-attempt time, using the rulebook's active-time exclusions
- **Reaches:** Chibi makes every jump at a reach in the rulebook's Grid, and never one tile beyond it. A pass or fail check, not a band
- **Restarts:** a failed attempt is one that ends in death (a fall, hazard or crush), followed by the retry choice. Restarts per stage, by skill: some attempts fail, and the band says how often
- **Route spread:** every route a choice opens lands within a narrow window of the stage's median clear time and restart rate, so no route is a lot easier or harder
- **Session length:** the time to finish the game, by skill

Blue cityscape’s generated middle pool contains 35 distinct certified layouts with ordinary no-powerup required-route proofs. City boundary’s separate authored approach and arena are outside that count.

## Boss playtest criteria

Apply the [arena qualification rule](bosses.md#boss-encounter-principles). For each placement, record the source, seed, starting support, active skills and whether entry is natural or staged. Check ordinary no-powerup forward passage, boss traversal and escape routes, visible tells, actual effects and contact, supported recovery and the next attack boundary. Include neighbouring terrain, cover and exits rather than checking an isolated animation alone.

Report observed outcomes separately from unobserved specials, incomplete recovery, controller limitations and exhausted work. A cooldown is not a contact grace period. Record any declared reaction delay and whether the cue was actually visible; automated success does not establish human fairness or enjoyment. Compare distinct physical encounter layouts rather than counting cosmetic aliases as variety.

## Reported playtimes

| Zone                 | Stage              | Reported clear time |
| -------------------- | ------------------ | ------------------- |
| Blue cityscape       | Parcel depot       | 1:06                |
| Blue cityscape       | Streets            | 1:18                |
| Blue cityscape       | City boundary      | 0:58                |
| Industrial outskirts | Warehouse district | 1:06                |

The user reports that most stages take about 60 seconds and are faster with powerups. The four recorded clears above total 4:28 and average 1:07; their layout seeds, retry counts, active powerups and timer basis were not recorded. These observations do not establish calibrated successful-attempt active times for every [route](stages.md#v1-route) stage. Recipe data owns current filled lengths.

## Active obstacle implementation targets

The transfer-gate crossing is implemented, with bounded real-physics qualification of its approach, commitment, landing, failure and retry reset; it does not establish a forced ride or whole-stage completion. Preserve current stage lengths, movement, encounter quotas and ordinary routes without skills.

Qualify each family's complete approach, commitment, safe landing and recovery using actual contact and support. Include missed boarding or delayed departure where relevant. A renamed existing pattern, cosmetic variant or unobserved phase does not establish a new physical challenge or a passing implementation. These targets add neither combat nor underwater movement.

## Release and tuning

Completing the built route does not declare a V1 release. Successful-clear active-time calibration and landscape-phone checks of jump feel, touch input and readability remain open.

Unresolved design questions are collected in [`ideas.md`](ideas.md#open-questions); agreed later scope is in [`next.md`](next.md).
