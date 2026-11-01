# Game Design

The rulebook: every rule the game is built to. What's left to build and tune is in [`README.md`](README.md), and undecided ideas are in [`ideas.md`](ideas.md).

`src/data/` holds every number and all player text. This doc states the rules, with numbers only where they define one.

## Pitch

A landscape platformer: Chibi travels back to the apartment he shared with his former best friend, Fert, a ferret, after Fert mails him far away. V1 follows one linear route; branching routes are planned for Next.

## Setting

- **Characters:** Chibi is the male bird the player controls: a small, round, cream bird with tiny wings and feet, an orange bill and a dot eye. His full design is in the [art plan](../art/README.md). Animals talk; there are no humans.
- **Fert:** Chibi's male former best friend and apartment-mate: a champagne (cream-coloured) ferret, about twice Chibi's height, standing upright, with a tall plum stovepipe hat and a red bow tie. His full design is in the [art plan](../art/README.md)
- **Story:** Chibi and Fert share an apartment in a big city. After a big fight, while Chibi sleeps, Fert packages him and mails him far away. Chibi knows Fert is responsible and wants to get home. The cause of the fight and the outcome of their friendship are undecided
- **World:** the modern day, mixing fantasy and reality
- **Zones:** a zone is one themed map destination containing three playable stages, indoors, outdoors or a hybrid of both. V1 has six zones and eighteen stages. The V1 route and current stage availability are listed below

## Cast

| Name   | Identity                     | Role                            |
| ------ | ---------------------------- | ------------------------------- |
| Archie | Dog                          | Blue cityscape antagonist       |
| Bini   | Bear                         | Woodland antagonist             |
| Chibi  | Bird                         | Player character                |
| Fert   | Ferret                       | Apartment building antagonist   |
| Kiwi   | Female raccoon               | Home city antagonist            |
| Pebble | Pigeon                       | Industrial outskirts antagonist |
| Trixi  | Goose with oversized glasses | Countryside antagonist          |

The named cast uses shared data-driven behaviours. The encounter rules below are delivered with their matching runtime, values and artwork.

## Core loop

1. **A stage:** travel through one place, mostly left to right and bottom to top: platforming and talking with animals. Each zone contains three stages; V1 follows a linear route.
2. **Between stages:** completing stage one or two shows an image-backed statistics interstitial and Continue, which enters the next stage directly. Completing stage three shows the zone's outgoing exchange and statistics, then returns to the map and animates Chibi walking to the next zone, except for the final celebration. V1 continues along its linear route; Next adds branching routes.
3. **Home:** Chibi returns to the shared apartment. The outcome of his friendship with Fert is undecided.

## Voice

- **Data:** every string a player sees lives in the text data files, with `{placeholders}` the game fills, never as a literal in code
- **Fit:** text never shrinks to fit. Reword it or grow its box
- **Labels:** one label for one action, everywhere
- **Lengths:** text is Tiny5 drawn at 2×, about 6.5 base px a character on average; measure the width, don't count characters. A dialogue paragraph fits 3 lines of 504 px (about 72 characters a line). An answer fits 166 px (about 25 characters). A quip, with its speaker's name, fits 452 px (about 60 characters)
- **Spelling:** Canadian (colour, favourite, neighbour). No em dashes and no emojis
- **Style:** concise exchanges with distinct voices and brief jokes. Chibi stays determined to reclaim his home. Archie is earnest about his territory, Pebble is smug about flying, Trixi invents convenient rules, Bini is a distracted gamer, Kiwi is dry and observant, and Fert is theatrical about his failed delivery. Do not resolve the initial fight or their friendship
- **Terms:** the home page is the website's page at `/`; it is never shown inside an installed app. The start screen is the game's first screen, in a browser and in an installed app. Back to title always goes to the start screen, from any zone, the map or a card

## Rules

| Term               | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| Zone               | A themed map destination containing three stages                |
| Stage              | The playable level, currently represented by `ZonePlan` in code |
| Section            | One continuous area within a stage, such as an apartment floor  |
| Encounter section  | A distinct enemy encounter segment within a stage               |
| Chunk              | A hand-designed unit used to assemble the randomized layout     |
| Opening and ending | The fixed caps around a stage's randomized middle               |
| Run                | One generated stage layout and its seed                         |
| Attempt            | One try to complete the stage within a run                      |

The V1 map has six themed destinations with three catalogued stages each. The route contains eighteen stages; completing its implementation does not declare a V1 release.

### Screen and controls

- Landscape, 720×360 base resolution. Phone browser first, with on-screen touch controls; keyboard on desktop. In portrait on a touch screen, the game draws turned a quarter turn to fill the screen, so the player turns the phone
- **Keyboard:** ←/→ or A/D to move; Space, ↑ or W to jump; E to use; P or Esc to open or close the pause card
- **Overlay:** the move hint and the touch buttons show by default. Settings hides each set on its own, and hidden controls still work
- **Touch buttons** (right thumb): Use above, Jump below. Each is an open ring with its icon and no label, reads clearly as a button and stands out against any background, while hiding little of the play area. Every control stays inside the game's view across, with its drawn edge at least 8 px from the edge it is placed against: Pause 8 px in from the view's top and left, Jump 8 px in from the view's right and 20 px up from the screen's bottom, and Use 100 px above Jump with its ring 85 px in from the view's right. On a screen taller than 2:1, Jump, Use and the move hint sit in the spare space below the game. Each presses within 100 base px of its centre (a clear circle of 63 plus the move hint's radius of 37, so the hint never reaches into the clear circle), the two cut along the line midway between them so they never overlap; Jump's also reaches into the bottom-right corner of the screen. A button animates subtly when pressed
- **Touch movement:** a touch anywhere except on a button or other interactive element sets the neutral point where it lands. Dragging left or right from it past a small dead zone moves Chibi that way at full speed; back inside the dead zone, he stops. Releasing ends the movement
- **Move hint** (left thumb): a left and right marker that rests level with Jump, as far in from the view's left edge as Use is from its right edge. It is only a drawing and has no press area of its own. While a touch is moving him, it sits on the neutral point; on release it returns to rest.
- **Use:** opens a room's door. PLACEHOLDER: what else it acts on

### Interface

- **Consistent:** the same element looks and behaves the same on every screen: top bars, panels, close controls, buttons, headings
- **Disabled controls:** pressing an ordinary disabled control refuses activation with shared shake and red-label feedback. A locked stage card applies the refusal across its face, screenshot and both labels; keyboard selection skips locked stages. Reduced motion uses steady red feedback without shaking or flashing. Refusal never selects an answer or dismisses a card, and respects modal blocking, fresh-release and cancellation guards
- **Exact:** spacing sits on a fixed pixel grid: equal margins, aligned edges, and text clear of its box's edge by the same amount on both sides
- **Minimal:** show only what the player needs. No heading that repeats a tab's name, no label the picture already gives, and no decoration that competes with play
- **Options:** art mocks up visual options for the user to pick
- **Press areas:** apart from Jump and Use, a button's press area is the drawn button plus a quarter of its shorter side on each side, between 6 and 16 px, and at least 48×48. Where press areas overlap, the nearer button wins

### Grid

- **Chibi:** 2 tiles wide and 3 tall
- **Reaches:** stages are built to Chibi's reaches, measured in tiles from the top of the ground he leaves to the top of the ledge he lands on. A short press rises 3 tiles (clearing a 3-tile ledge with a little room); a full jump rises 6; a full running jump with flutter crosses a 19-tile gap at the same height, with the jump pressed at its best moment, coyote time included. A ledge at a reach is always makeable, and one tile beyond it never is
- **Tiles:** stages are built on a grid of 12 px tiles, so the screen is 60 columns by 30 rows. Every solid, ledge and door sits on whole tiles and spans whole tiles. Hazards follow the grid, except for the thickness of edge hazards

### Chibi

- **Flutter:** every fall flutters, after a jump or off a ledge: his fall is slow enough to use, and the player steers him in the air
- **Jump height:** every jump has one uninterrupted decelerating ascent, with no timed lift, upward reboost or pause at the apex while Jump is held. Releases within the first 100 ms produce the minimum hop of 40 px, about 3 tiles; releasing later blends continuously toward a higher apex, up to the full height of about 6.5 tiles, without a velocity snap, upward reboost or apex pause. Chibi flutters on the fall. A buffered jump whose button was already released is the low hop. Low ceilings are placed so a short jump clears the obstacle without touching the overhead red edge; a full hold hits that edge. Jump tuning lives in `src/data/bird.ts`
- **Jump timing:** a jump pressed just after he leaves a ledge still jumps (coyote time), and a jump pressed just before he lands jumps as he lands (jump buffering)
- **Movement:** he walks left and right and jumps. He is quick and responsive: about 0.1 s to reach full speed and 0.05 s to stop, on the ground and in the air. His speeds, jump, flutter and timing values are in `src/data/bird.ts`, tuned to the reaches under Grid

### Map

- **Availability:** all six V1 zones appear in route order, with three stages each as listed under V1 route. Unbuilt zones and stages are visibly unavailable and cannot be entered. The park is a debug prototype outside the V1 map
- **Backtracking:** unlocked built stages remain available for replay. Replaying an earlier stage never removes later unlocks
- **Between stages:** clearing every stage shows an image-backed statistics interstitial with Continue at the bottom right. After stage one or two, Continue enters the next stage directly without showing the map. Stage three first shows the outgoing zone exchange, then current-stage and actual-zone-visit statistics, before returning to the map and automatically animating Chibi walking along the existing route to the next zone. After the walk, the map waits for the player's selection; it does not enter that zone automatically. Completed stages and opened paths are marked. The final stage follows the celebration rule instead
- **Buttons:** Back to title is on the left; Continue is on the right and is the default keyboard action
- **Celebration:** only clearing Apartment building's third stage, Climb to the apartment, shows Fert's outgoing exchange and the final statistics interstitial followed by the finish celebration, including on replay. Clearing the depot does not finish V1. Continue returns to the map; Restart asks first, as on the start screen
- **Checkpoints:** each stage begins at its own checkpoint, with unlimited retries. Walking left from any stage entrance returns to the map. The entrance exit stays reachable and has no blocking wall; an apartment stage returns through its first section's left edge
- **Forks:** branching routes are deferred to Next. V1 is linear and has no laps
- **Progression:** Parcel depot is unlocked from the start. Clearing a stage unlocks the next built stage in the route table. Clearing stage three opens the next zone. Completed stages remain available for replay, and unbuilt content remains unavailable
- **Selection:** only manually pressing Continue on the map opens the selected zone's stage-selection modal. Three side-by-side cards stay in stage order, including locked stages, which remain grey and disabled. The latest available stage is highlighted and is the default. Each card shows an actual scene screenshot, the main stage name at the standard font size, and a smaller, lighter Stage 1, Stage 2 or Stage 3 label at the top right. Names never shrink to fit. Stage scenery differs slightly while preserving the zone's palette and visual style. Persisted unlocks survive replays
- **Walk:** Chibi stands on a zone. Left and Right move through available zones, and Continue selects the zone he stands on

### Stages

- **Camera:** on the ground he sits about two thirds down the screen. In an assembled stage, the ground line follows the chunk he is in, blending across half a screen at each seam. The camera rises only when he climbs above the middle, and never shows below the lowest ground. Every stage guarantees visible parallax in appropriate exterior chunks and retains plain chunks elsewhere. Farther decorative layers scroll more slowly, clipped to their selected chunk; Woodland tree layers cover horizontal challenges and terraces while vertical climbs remain plain; opaque interiors retain their coherent walls, and ground props stay attached to the terrain
- **Challenge:** platforming, hazards and choices. Routes use ledges and cliffs, not ladders, with both short-press jumps beneath low ceilings and full jumps. There is no combat
- **Checkpoint:** the start of a stage is its only checkpoint. Falling or touching a hazard enters the death flow; Try again restarts the stage from its start, with unlimited retries and no permadeath. Progress is saved: the stages he has completed and where he stands on the map. Clearing a stage marks it completed and follows the stage-one or stage-two cutscene, stage-three map travel or final-stage celebration flow; a stage left before its end is played again from its start
- **Crush:** a moving platform that pushes him sideways carries him to its leading edge. If it squeezes him into terrain or another solid, he is crushed and enters the death flow, as a hazard does. Layouts leave room beside every moving platform's path so he is never pinned on a required route
- **Difficulty:** per-zone bands and chunk-selection weights in `src/data/` set a demanding first-zone base and increase difficulty in every following zone. Blue cityscape selects grades 3 to 4, Industrial outskirts and Countryside grades 3 to 5, and Woodland, Home city and Apartment building grades 4 to 5. Increasing weights for harder chunks distinguish successive zones even when their bands match. Seeded variation remains inside each band
- **Doors:** optional room doors lead only into rooms; marked main-route stairs automatically link stage areas and are distinct from room doors. Use enters a door when any part of his drawn frame overlaps the door's drawn art; where he overlaps more than one, the door whose centre is nearest his wins
- **Edge hazards:** a common solid bright red strip, 4 px thick, can cover the top, bottom, left or right edge of terrain. Terrain hazards and floor traps use red contact edges. Pebble's falling white blocks are lethal projectiles. Animals have no red contact outlines. There are no spikes. Touching any edge hazard enters the death flow. Actual red hazard contact shakes the world and Chibi through the main camera while the HUD stays fixed. Reduced motion replaces the shake with a static border cue. Animal contact, white blocks, falls and ordinary crushes do not trigger the red-contact cue
- **Encounters:** stage one has zero combat encounter sections. Its staged antagonist introduction is a cinematic sequence, not a combat encounter; the antagonist leaves before normal play. Stages two and three each have one normal enemy encounter in their randomized middles, for two hostile encounters per zone. Only the scripted first-stage introduction is fixed. No normal antagonist is placed in a fixed opening or ending cap. Counts apply across the whole stage, not per floor. Every second-stage opening has a protected first half-screen, then a mandatory noncombat obstacle, with its door and left map exit accessible. No physical antagonist or lethal attack enters that opening. Ordinary platforming separates encounters; generated runs vary layout while preserving these quotas, and death retries retain the same run
- **Exit:** reaching the end of a stage's final area clears the stage. Stage one and two show their image-backed statistics interstitials; stage three shows its outgoing zone exchange and statistics before map travel, except for Fert's final exchange and statistics followed by celebration. An internal floor transition does not clear the stage
- **Going back:** walking all the way back to the stage's left edge leaves it without completing it: the screen fades and the map shows with him on that stage's zone. Completion progress is unchanged; a fresh stage entry starts a new run and its own statistics. Every stage starts him clear of that edge and has no wall in front of it
- **Kinds:** indoor, outdoor, or a hybrid with both
- **Length:** target two minutes for a successful clear of each stage. This target is unmeasured. Every catalogued stage fills 840 to 960 columns, counting fixed caps and all linked sections. Recipe data owns the shared range and derives linked-section budgets from it; the debug park keeps its own recipe
- **Layout:** every built and future stage, including the first tutorial and final stage, has a randomized layout assembled from hand-designed chunks: a fixed start chunk, a seeded run of chunks whose entry and exit heights match, then a fixed finish chunk. A multi-area apartment stage applies this structure across its linked sections, with fixed first and last caps and seeded runs of shared templates in intermediate areas. The rules for chunks are under Chunks
- **Scale:** outdoors, the scenery is drawn at a quarter of indoor scale; Chibi, the tiles and the reaches stay the same everywhere
- **Shape:** each playable stage area is at most 2 screens (60 tiles, 720 px) tall and as wide as it needs, and scrolls sideways and up. Indoors, to a small bird the ceilings are high: a door is 15 tiles tall, half the screen

### Runs and attempts

- **Continue:** reopening the app shows the start screen. Continue and Restart appear only after an actual catalogued stage has been entered. Manually choosing Continue shows the map with Chibi on his saved zone, without opening a stage chooser or entering a stage
- **Entry:** entering a stage from the map, replaying it or continuing through an inter-stage cutscene starts a new run
- **Pause:** pausing and resuming keeps the same run and position
- **Restart:** a full restart resets progress to its beginning state; the next actual stage entry starts a fresh run
- **Retry:** death ends the attempt; Try again restarts the same stage directly, without the map or stage chooser, as another attempt of the same run, preserving its seed and generated layout

### Stage design principles

- **Encounters:** build each arena around observing and responding to its antagonist’s special attack, with reachable refuges and exposed routes that make the choice meaningful
- **Learning:** teach a demand clearly, vary it, then combine it with another demand. Introduce the response before requiring it under combined pressure
- **Moving platforms:** author and validate the complete approach, boarding, cycle, transfer and recovery sequence, not only jump reach. Validate and clearly present the available recovery options after missed boarding or transfers
- **Primary demand:** each challenge has a clear required action. Judge variety by the primary route, including required climbs rather than optional upper detours; decorative or bypassable obstacles do not establish a new demand
- **Readability:** show the hazard, approach and safe response before commitment. Provide observation positions and usable refuges so success does not depend solely on reacting after a short attack tell
- **Rhythm:** alternate pressure with recovery that permits observation and preparation for the next challenge. Preserve meaningful movement rather than filling stage duration with repeated waits
- **Variation:** vary required actions, not just chunk IDs. Repeated demanding sequences need variation in their required response; inserting a connector or changing a skin does not by itself provide that variation
- **Zone identity:** give each zone a recognizable combination and rhythm of traversal demands and antagonist interactions while using the shared layouts and physics

### Stage statistics and interstitials

The same four fields appear after every stage clear, on the death/retry card and at zone end:

| Field             | Meaning                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Last attempt time | Active play time in the attempt that just ended                                                 |
| Run total time    | Active play time across all attempts of this generated run, including failed attempts           |
| Best time         | Historically fastest successful attempt for this stage, excluding time spent in failed attempts |
| Attempt count     | All attempts in this run, including the initial attempt and the attempt that just finished      |

- **New runs:** a fresh generated run starts with zero run-total time and attempt count one. Death Retry preserves the run and its accumulated time, and starts the next attempt. Fresh map entry or replay generates a new seed and starts fresh run statistics; historical best times remain
- **Presentation:** after every stage, an interstitial uses an actual image of the cleared stage's art and shows its four statistics. Continue is at the bottom right. Outgoing dialogue uses image-backed presentation with Skip; it does not add new plot imagery
- **Zone visits:** zone-end statistics show the same four fields for the actual current zone visit alongside the current-stage statistics. Zone last-attempt time sums the latest finished attempt time from each visited stage; zone run-total time sums all active attempt time in those current-visit stage runs; zone attempt count sums their attempt counts. A zone best requires successful clears of all three stages in the same visit and sums only those successful-attempt times. Compare it only with other complete visits. Partial visits show their completed-stage count as N/3, set no new zone best and never combine historical stage bests into a fictitious full-zone result

### Death and retry

This is the approved implementation scope for the current change, including the death sequence, required card and persistent stage metrics.

- **Active time:** count only time spent playing the stage. The introductory approach, paused exchange and departure do not count. Pause, other paused conversations, menus, the death sequence and card, floor-transition presentation, interstitials and map travel do not count. Floor transitions preserve the same run clock; its attempt and total times follow Stage statistics and interstitials
- **Card:** after the animation, hold the final pose beneath a required modal showing the zone and stage, current-attempt progress percentage and the four stage statistics. Back to title is the secondary button on the left; Try again is the primary button on the right. Keep the card compact and centred horizontally and vertically in the viewport. Reposition the death camera so Chibi’s seated drawn pose is horizontally centred and visible slightly below the card; his world position stays unchanged. The card stays until a button is pressed; outside taps, back and Escape do not dismiss it
- **Progress:** a subtle, visible line 2 px high at the top uses the stage's theme. It tracks Chibi's current position during play and his death point on death, not the furthest point reached. In a multi-area stage it uses shared weighted current-position progress across the floor sections, including the death point; returning to an earlier section can lower it. Retrying starts the percentage at zero
- **Retry:** Try again restarts the current stage directly from its checkpoint in the same run, without the map or stage chooser. In a multi-area stage this is the first floor, not the current floor. Back to title opens the title screen. There is no permadeath
- **Sequence:** lethal contact starts a small recoil, then Chibi falls to support, squashes more deeply on landing and makes a small upward bounce into a deflated sitting pose with his feet hidden. The world freezes at the death context while Chibi plays a dedicated death animation, then holds its final pose for the card. Camera repositioning for the card does not advance physics or change input, retry or statistics rules
- **Storage:** historical best times use a separate stats save. Restart clears progress only; it starts fresh run statistics without wiping historical bests

### Chunks

- **Assembly:** every chunk, including fixed opening and ending caps, is exactly one screen wide: 720 px or 60 columns. Areas retain their two-screen height and vertical scrolling. A stage's recipe names its theme, start and finish chunks, a length range (start and finish included), a configurable difficulty band, and the events and doors to place. The seed varies the middle chunks within that band, without requiring difficulty to rise; the start and finish chunks are exempt. It never picks the same chunk twice in a row, and it fills the slots
- **Difficulty:** 1 to 5. 1: walking and taps. 2: full jumps and still hazards. 3: gaps near the reach, single moving platforms and single low-ceiling tap spots. 4: timed platforms or moving hazards on the required path. 5: compounded tap-only, timed or platform-to-platform challenges
- **Challenge variety:** the shared middle pools include required climbing routes, moving ledges, red ground strips and enemy yards. Mandatory challenges include climbs, moving ledges, overhead and vertical red surfaces, and blocks comparable to Chibi’s size. The primary route never has more than one screen of unchallenged flat travel, including across chunk seams. Blue cityscape has grade-four returns from upper routes, and later zones retain grade-four and grade-five low-ceiling challenges within their bands. Generation varies challenge combinations and order within the zone's difficulty band, preserving valid connections; a stage is not guaranteed to contain every challenge type
- **Fairness:** isolated chunk physics checks cover entry to exit with slots empty and filled; synthetic zone and no-cross checks protect movement constraints, and recipe assembly contracts protect generated layouts. Gameplay may use one bounded stage playtest after major changes to answer a concrete reachability question. Exhaustive whole-stage searches are not a routine gate
- **Seams:** a chunk's entry and exit are the ground rows at its left and right edges: 50, 40 or 30. The seam surface is terrain and runs at least 4 tiles in from the edge, with no gap there, and nothing (no solid, ledge, hazard or moving platform) in the 6 rows above it
- **Shape:** at most 60 rows (720 px) tall
- **Slots:** marked regions where the seed places an event or a door. A chunk must pass with every slot empty
- **Shared layouts:** every zone uses the same layout templates and object/archetype library. Theme configuration supplies terrain, structures, props, enemies, doors, triggers, backgrounds, parallax and recipes; it does not add zone-specific mechanics
- **Themes:** a theme sets the tileset, terrain looks and repeated backdrops for every chunk of that theme, so seams never show. A chunk can still place its own scenery. The park is an outdoor prototype theme

### Objects

Everything in a stage except its terrain is placed in data through archetypes, characters and instances.

- **Animals:** during normal gameplay, every animal in the main stage foreground, apart from Chibi, is an enemy and always lethal on actual body contact, including idle, tells, attacks and rest. Antagonist contact closely follows the drawn body footprint of the current animated pose; transparent frame space around wings or tails and gaps between drawn parts cannot kill on a visual near miss. Frame boxes may bound the contact check but do not make transparent space lethal. Chibi's movement and platform physics and the explicit red-hazard and projectile collider contracts are unchanged. Every antagonist regularly attempts direct charge or body contact and has a distinct recurring special attack; attack cadence and brief recovery windows are configured in data. Animals have no red contact outlines. Archie, Pebble, Trixi, Bini, Kiwi and Fert are the only world-stage animals currently placed; there are no friendly background animals in the current stages
- **Archetypes:** a behaviour: collision (none, solid, one-way ledge, hazard or Use), movement, reaction, interaction (such as talking on Use or a quip on approach) and default tuning
- **Attack tells:** every aggressive charge or special action has a visible 0.12-second pre-action tell; the action begins only after the tell. This includes swoops, drops, growls, pounces, throws and trap placement. A trap-placement tell is separate from the trap's warning and arming delay after placement. Body contact stays lethal during tells and recovery
- **Behaviour patterns:** reusable patterns in the data choose behaviour primitives, their sequence or states, transition conditions, timing, animations and tuning. Animals and moving inanimate objects use the same composition approach. Code implements the primitives, condition evaluation and shared executor; character-specific cycles are composed in data rather than hardcoded in code
- **Characters:** who something is: one archetype plus tuning overrides, its art and animations, hit box, size, its dialogue and quip lines, and quirks. No character inherits from another. Props (platforms, hazards, doors and backdrops) are characters with art but no voice
- **Decoration:** friendly animals are allowed only as muted background flavour, never in the main stage foreground, or inside rooms reached through doors for shops and quests. Room animals remain in place
- **Enemy awareness:** initial acquisition requires both enemy and Chibi centres inside the current 720×360 camera view, with an unobstructed centre-to-centre line through solid terrain and solid objects. One-way ledges, decoration and the observer’s own body do not occlude sight. Acquisition is independent of ground reach. Noticing Chibi produces one four-second nonmodal bark without pausing play or adding buttons
- **Enemy pursuit:** an acquired antagonist can chase across chunks in the same area, within three screen widths horizontally from its original encounter position. Brief loss of sight, a jump or temporary unreachability does not end pursuit. Pursuit ends when Chibi leaves that original boundary or remains physically unreachable for three continuous seconds, producing one four-second escape bark. Unreachable targets can trigger the existing looping frustration reaction while the grace interval runs. An escaped antagonist completes its committed physical recovery without starting another attack, then resumes normal behaviour near its stopping position without teleporting home. Ground pursuit uses connected supported ground and solid clearance, without gravity or pathfinding across gaps; flying pursuit follows its target within physical clearance. After escape, Pebble flies to nearby actual supported ground or a perch before resuming normal behaviour near his stopping position. If no safe reachable landing exists, he stays escaped with recovery pending, without attacking or teleporting. Existing charges, pounces, throws, traps, growls, vertical drops, swoops and physical perch returns retain their local extents, headings, speeds and timing. Reacquisition requires Chibi inside the original boundary and reachable again, followed by normal current-screen and line-of-sight detection
- **Instances:** one placement in a stage: a character, a position, size and phase, last-word overrides, its own lines or dialogue scene, a door's room, and flags for carried choices
- **Movement:** an algorithm (static, linear, ease, hop or wander), a direction, a distance, a speed, a pause at each end, and a random variance that rolls fresh on every attempt
- **Overrides:** flow one way: an instance overrides its character, which overrides its archetype. Everything resolves and is checked when the game loads
- **Reaction:** none, avoiding Chibi, or approaching him, within a range
- **Static art:** a behaviour state can use `animation: null` for static art, including a moving inanimate object. Motion and transitions still come from its reusable behaviour graph

### V1 route

The route spans six themed zones of three stages in this order. Each stage targets a two-minute successful clear; this target is unmeasured. Recipe data owns lengths. The six-zone map preserves unlocked stages for replay. Every stage has a fixed opening and ending with a randomized middle.

| Zone                 | First stage                               | Second stage                    | Third stage                                       |
| -------------------- | ----------------------------------------- | ------------------------------- | ------------------------------------------------- |
| Blue cityscape       | Parcel depot (`street`)                   | Streets (`city-streets`)        | City boundary (`city-boundary`)                   |
| Industrial outskirts | Warehouse district (`warehouse-district`) | Loading yards (`loading-yards`) | Freight terminal (`freight-terminal`)             |
| Countryside          | Farmland (`farmland`)                     | Country lanes (`country-lanes`) | River crossing (`river-crossing`)                 |
| Woodland             | Forest paths (`forest-paths`)             | Deep woods (`deep-woods`)       | Ravine (`ravine`)                                 |
| Home city            | City outskirts (`city-outskirts`)         | Back streets (`back-streets`)   | Familiar neighbourhood (`familiar-neighbourhood`) |
| Apartment building   | Entrance and lobby (`entrance-and-lobby`) | Shared floors (`shared-floors`) | Climb to the apartment (`climb-to-apartment`)     |

### First stage

- **Ending:** the fixed finish retains the final short-jump ceiling, red-edged gap and canopy
- **Layout:** the tutorial introduces the parcel depot of the blue cityscape with a fixed opening and ending around seeded hand-designed street chunks. The middle uses matching city scenery and the zone's difficulty band, with varied climbing and moving-platform chunks
- **Opening:** the fixed start retains the opened parcel on safe ground, depot jump lessons and a staged Archie introduction before normal gameplay
- **Rooms:** the street door leads to the prototype test room
- **Route:** the main path continues right toward the city boundary; middle chunks can include upper street ledges. Streets is the second stage and unlocks when this tutorial is completed; City boundary is third

The park is a randomized-stage prototype outside the V1 route. The identities of Fert's friends beyond Archie, Pebble, Trixi, Bini and Kiwi are undecided.

### City boundary

- **Encounter:** the randomized middle contains one Archie encounter using the same behaviour and timing as Streets, with refuge ledges on either side of his patrol. His staged introduction occurs at the beginning of Parcel depot and follows the shared once-per-zone rule
- **Layout:** the third Blue cityscape stage is randomized from a fixed start, seeded middle chunks and a fixed finish. It uses the existing street backgrounds and sidewalk terrain, with steps, required climbing routes, moving ledges, enemy yards, red ground strips, red-edged gaps and low-ceiling short-jump challenges inside the zone's difficulty band. The finish has sparse facades and an open outward view
- **Replay:** entering from the map draws a fresh assembly seed; retries keep that layout. Completing Streets unlocks this stage; unlocked stages remain available for replay
- **Rooms:** one door in the fixed start leads to the existing prototype test room

### Industrial outskirts

- **Appearance:** purple industrial scenery uses floor, crate and container art, shared moving platforms and red-edged inanimate hazards
- **Encounters:** stage two and stage three feature Pebble through the shared data-driven behaviour system. Archie and Pebble use the shared enemy detection, pursuit and frustration rules
- **Layout:** Warehouse district, Loading yards and Freight terminal each have fixed openings and endings with randomized middle chunks, inside the zone's difficulty band. Required climbing sections, moving ledges and red-edged hazards use the shared layouts and primitives
- **Progression:** clearing City boundary opens Warehouse district; clearing Warehouse district opens Loading yards, then Freight terminal. Unlocked stages remain replayable
- **Rooms:** doors use the existing prototype test room. These stages add no new room or plot

### Pebble encounter

- **Contact:** Pebble is always lethal on contact, including while perched, without a red contact outline
- **Cycle:** perch on posts, spot Chibi and launch into flight. Pebble periodically swoops at Chibi for body contact and separately drops white-block poop projectiles as his special attack. Behaviour timing and flight tuning live in data
- **Layout:** seeded pigeon yards combine solid overhead hiding cover with exposed flight and projectile lanes
- **Projectiles:** each white block falls straight down and is lethal on contact. It disappears on landing, including on a ledge, leaving no residue and never homing on Chibi

### Countryside

- **Appearance:** muted yellow countryside scenery distinguishes Farmland's soil and hay from River crossing's banks and timber. Water is decorative scenery, not an implicit contact hazard; only explicit red surfaces are hazards, and falling follows the normal death rules
- **Encounters:** stage two and stage three feature Trixi through shared behaviour primitives. Trixi, Archie and Pebble use the shared enemy detection, pursuit and frustration rules
- **Layout:** Farmland, Country lanes and River crossing each use fixed openings and endings around shared randomized middle layouts within the zone's difficulty band. Mandatory climbs, ledge lifts, shuttles and red hazards use the common object and layout system with countryside art and configuration
- **Progression:** clearing Freight terminal opens Farmland; clearing Farmland opens Country lanes, then River crossing. Unlocked stages remain replayable
- **Rooms:** doors use the existing prototype test room; these stages add no new rooms, plot or bosses

### Trixi encounter

- **Appearance:** Trixi wears oversized glasses
- **Contact:** Trixi is always lethal on contact, including while placing traps, without a red contact outline
- **Rush:** Trixi periodically rushes along the ground to make contact with Chibi
- **Traps:** Trixi's special attack places red-edged floor traps. A visible arming delay precedes their lethal contact state; trap timing and placement values live in data

### Woodland

- **Appearance:** woodland uses its canonical green theme through shared terrain, structure, prop and background skins
- **Encounters:** stage two and stage three feature Bini through shared growl, charge and contact behaviours. Bini and earlier enemies use the shared detection, pursuit and frustration rules
- **Layout:** Forest paths, Deep woods and Ravine each use fixed openings and endings around shared randomized middle layouts within the zone's difficulty band. Mandatory climbs, moving ledges and red hazards use the common stage object and layout system
- **Progression:** clearing River crossing opens Forest paths; clearing Forest paths opens Deep woods, then Ravine. Unlocked stages remain replayable
- **Rooms:** doors use the existing prototype test room; there are no new rooms, plot, bosses or combat. Water does not add hidden hazards

### Bini encounter

- **Contact:** Bini is always lethal on contact, including while resting, without a red contact outline. His charge and maul are contact threats, not a combat encounter
- **Cycle:** idle with the phone, use the sonic growl special attack, then charge and maul for direct contact using shared behaviour primitives. Timing and movement values live in data
- **Growl:** the sonic growl creates a brief gust that pushes Chibi only while he overlaps its finite volume. The push stops when he is above or outside it, or behind solid cover; it is not a single impulse that leaves momentum. It does not kill directly, but can push him into a hazard or off a ledge. High ground is the primary way to avoid it; solid cover also blocks it
- **Layout:** seeded bear arenas provide accessible high ground before or at line-of-sight acquisition, alongside exposed low lanes where a connected growl can push Chibi into a visible red hazard or off a ledge
- **Introduction:** Bini sits with a phone playing Archie's Dog Walks. His annoyed first-sighting introduction follows the once-per-zone rule and precedes his aggressive behaviour

### Home city

- **Appearance:** City outskirts and Familiar neighbourhood use the canonical peach theme through shared terrain, structure, prop and background skins
- **Encounters:** stage two and stage three feature Kiwi through shared ground-charge and vertical climb-and-drop behaviours. Kiwi and earlier enemies use the shared detection, pursuit and frustration rules
- **Layout:** each stage uses fixed openings and endings around shared randomized middle layouts within the zone's difficulty band. Mandatory climbs, moving ledges and red hazards use the common stage object and layout system
- **Progression:** clearing Ravine opens City outskirts; clearing City outskirts opens Back streets, then Familiar neighbourhood. Unlocked stages remain replayable
- **Rooms:** doors use the existing prototype test room; there are no new rooms, plot, bosses or combat. Water does not add hidden hazards

### Kiwi encounter

- **Contact:** Kiwi is always lethal on contact, including while preparing and resting, without a red contact outline
- **Cycle:** Kiwi periodically charges along the ground for direct contact. Her distinct special attack climbs, prepares and drops vertically before resting. Ground movement, vertical movement and state timings live in shared behaviour data

### Apartment building

- **Areas:** Entrance and lobby has two linked sections: entrance and lobby. Shared floors has three: restaurant, first fire escape and pool. Climb to the apartment has four: second fire escape, spa, third fire escape and residential. Varied indoor and outdoor skins accompany stronger vertical traversal
- **Checkpoint:** each stage has one checkpoint at its first section. Death anywhere restarts that whole stage on Try again. No floor transition creates a checkpoint
- **Encounters:** Fert is a normal lethal-contact antagonist who periodically charges for direct contact and throws parcels as his distinct special attack. He uses shared behaviour primitives and has no red contact outline; this is not a boss encounter and adds no combat
- **Goal:** reaching the apartment at the end of the final residential section clears the final stage and shows Fert's outgoing exchange, then the image-backed statistics interstitial and celebration, every time including replays. The cause of the fight and the outcome of the friendship remain undecided
- **Layout:** fixed openings and endings surround randomized shared middle templates. Intermediate areas use seeded runs of shared templates; the first and last caps remain fixed. Recipe data defines each linked stage's aggregate length
- **Progression:** clearing Familiar neighbourhood opens Entrance and lobby; clearing Entrance and lobby opens Shared floors, then Climb to the apartment. The final map path ends at the apartment; unlocked stages remain replayable
- **Rooms:** optional doors still require Use and lead to the existing prototype test room. These stages add no new room or quest. Walls and pool water are decorative unless an explicit red hazard marks a contact surface
- **Stairs:** walking into marked main-route stairs changes floor automatically, without Use. Stairs are reversible; Chibi can return through earlier sections and leave for the map at the first section's left edge

### Archie introductions and encounters

- **Activation:** the staged introduction at the beginning of Parcel depot follows the once-per-zone rule. Completing or skipping the exchange starts Archie's departure; normal gameplay begins after he leaves
- **Appearance:** Archie uses his design from Archie's Dog Walks
- **Approach:** the first physical encounter is selected in Streets’ randomized middle after its protected opening. Shared yards provide observation and landing refuges around the hostile lane
- **Contact:** Archie is always lethal on contact, including during crouch and rest. It has no red contact outline
- **Cycle:** patrol, crouch, rush, rest, then patrol again. Detection and pursuit use the shared enemy rules; the rush direction locks when crouching starts
- **Dialogue:** the first introduction has three lines: Archie treats Chibi as a parcel Fert asked him to stop; Chibi insists on walking home; Archie resolves to stop him. The player-facing wording lives in the text data files, with Skip available
- **Special:** Archie makes a leaping pounce as his distinct special attack, alongside periodic ground rushes for direct contact
- **Timing:** Archie uses the same timing across physical encounters in the first zone; their layouts vary. The first physical encounter occurs in the randomized middle of stage two

### Rooms

- **Contents:** usually dialogue, and any of: items to buy or sell, quests to take, rewards, threats, and talk that advances the story or adds flavour
- **Enter:** Use at a room's door plays the door's opening animation, if it has one, with play held, then shows the room as a full-screen still scene with a little animation, such as a bartender behind his bar. Play pauses until he leaves, and leaving returns him to the door, shown closed. He leaves with the Leave button in a corner, back, or Esc
- **Per stage:** every stage has at least one room. PLACEHOLDER: each is an empty test room for now, showing only its name
- **World:** the side-scrolling stages are the game world; rooms are the only other places, each reached through a door

### Dialogue

- **Box:** a fixed box along the top, not a speech bubble, for a conversation between two characters, sometimes three. It shows one paragraph at a time, with the current speaker's name tab and, when available, a 64 px portrait inside the panel. Pebble, Trixi and Kiwi currently have no portrait; missing portraits use neutral presentation. Chibi's portrait is on the left; other speakers' portraits are on the right. Consecutive paragraphs from the same speaker keep the same alignment. Each paragraph has at most 3 lines. A paragraph that runs to a 4th line is reworded
- **Forward:** every multi-exchange conversation pauses gameplay. Continue advances one paragraph; a tap or keypress also advances. Continue and Skip are visible controls. Exchanges never advance on a timer; there is no back or scrolling chat history
- **Introductions:** at the beginning of stage one, the antagonist enters from offscreen on the right and reaches about the midpoint of the current viewport before the paused manual exchange begins. The cinematic sprite is separate from world-stage objects and has no combat collision or attacks. The world and all underlying controls stay paused during its approach, the manually advanced Continue/Skip exchange and its departure. Completing or skipping the exchange marks the introduction seen. After the exchange, the antagonist turns right and runs offscreen, then is removed before normal gameplay resumes. Both approach and departure use its maximum charge or dash speed from shared behaviour data. This cinematic sequence is outside the combat encounter quota; it does not make enemy contact safe during normal play. The introduction plays once per zone per playthrough. Its seen state is shared across all three stages and survives death, retries and stage replay; a new game resets it
- **Outgoing exchanges:** completing a zone's third stage shows its outgoing exchange over an actual image of the cleared stage's art, with Continue at the bottom right and Skip available. Completing or skipping the exchange proceeds to stage and zone-visit statistics, then the map walk; Fert's final exchange and statistics proceed to the existing celebration instead
- **Restarts:** death retries and stage replays do not repeat a seen introduction; a new game resets the once-per-zone seen state
- **Skip:** Skip skips all remaining dialogue. If the conversation ends in a choice, Skip opens its modal without choosing an answer or bypassing the choice

### Quips

- **Barks:** each of the six antagonists has a single live spotting message with no Continue, Skip or other controls. Gameplay continues while it shows for four seconds, using `BARK_DURATION_SECONDS` in `src/data/dialogues.ts`. It appears once per area, object and attempt. Re-entering an area in the same attempt retains the seen state; retrying clears it. Pausing the world freezes its timer, and modal cards appear above it. Paused multi-exchange conversations remain manually advanced and untimed

### Fert

- **Appearances:** Fert enlists his friends as a favour. A friend or group is responsible for a themed zone and appears in person or through dialogue overlays; identities beyond Archie, Pebble, Trixi, Bini and Kiwi are undecided
- **Boss encounters:** deferred to Next, outside V1
- **Calling card:** every trap Fert sets carries a badge of his stovepipe hat and bow tie
- **Ending:** Chibi returns home; the outcome of their friendship is undecided. There is no combat

### Choices

- **Effect:** a choice changes where Chibi goes, what he does and what he sees
- **Kinds:** dialogue choices always appear in a modal. Route forks in zones and on the map are planned for Next
- **Reach:** choice effects on later zones or the ending are undecided. Branching routes are planned for Next

### Start screen

- **Back:** back with no card open leaves the game, the same way as Exit, wherever Exit shows; elsewhere back is the browser's own
- **Boot:** the game opens in landscape. It always opens on the start screen, with Start alone until an actual catalogued stage has been entered; after that it offers Continue and Restart. It never opens automatically on the map or straight into a zone
- **Exit:** at the top right, at the far end. In a browser tab it goes straight to the home page. In an installed app it closes the app, and it shows only in apps that can close themselves (Chrome's Android app, and Chrome or Edge desktop app windows); in every other installed app (iOS, Firefox for Android, Samsung Internet and Edge for Android) it is hidden, and Settings sits at the far right
- **Restart:** on the start screen after an actual catalogued stage has been entered, and on the celebration. It asks first on a card: a short question, Restart, which confirms, and Cancel; back and Esc cancel. Cancelling changes neither progress nor action visibility. Confirming resets progress to its beginning state and opens the map with him on the first zone and nothing completed. The start screen then shows Start alone until an actual catalogued stage is entered. Restart never clears stats or achievements, which keep their own save
- **Settings:** at the top right, beside Exit. It opens the settings card
- **Start:** before an actual catalogued stage has been entered, Start opens the map with him on the first zone. Browsing the map, cancelling the stage chooser, returning to the title and reopening the app do not count as starting gameplay: Start remains the only play action, and Restart stays absent. Actual catalogued stage entry enables Continue, which opens the map where he stands without a stage chooser, and Restart beside it. There is one progress save

- **Updates:** an offered update uses a compact modal with a concise title and one primary Update now button. Its close X defers the update and restores control to the underlying screen. There is no redundant body text or separate Later button

### Settings

- **Back:** back during play opens the pause card, and back with the card open closes it. Where the browser can't hand back to the game (Firefox for Android's installed app, and before the first tap or key in browsers without CloseWatcher), back is the browser's own
- **Back to title:** always goes to the start screen
- **Modals:** always centre every actual modal card horizontally and vertically in the viewport. Size each card's width to its content plus 16 px of shared padding on each side, with a minimum of half the full logical viewport width, then clamp it to the viewport's safe available width. Keep its height compact around the content with consistent padding. Preserve the standard text and control sizes; do not shrink them to fit a card. Every card over the game (the death card, the pause card, the settings card and its install steps, the restart question) has no title bar: its full title is centred across the full modal near the top, with symmetric clearance for the full close hit target and its gap on both sides. A closable card has a close X at its top-right corner. Keep the full standard font size: wrap the title or grow the card when needed, never shrink the text. Every actual modal card dims its background and blocks all underlying game, native, page and window controls, including keyboard input. Only the top modal receives input. Single-message barks are nonmodal and keep gameplay interactive; full-screen story and room pages are not modal cards. A tap anywhere outside a card that can close only closes it, as its close X or back would, the margins beside the game included; on a card with no close, a required choice, it does nothing at all. A press that drags does nothing
- **Open:** the pause button at the top left, shown only while a zone plays, P or Esc, or back. It also opens by itself when the frame turns, or stops turning, while a zone plays, and only then; Resume continues
- **Pause card:** a card titled Paused, over the dimmed game, which pauses play, with a close X. Its buttons, all one shape, stacked: Resume first, the primary in dark slate with white text, then Settings and Back to title
- **Settings card:** opened from Settings on the pause card or the start screen. Its rows: Move controls (the move hint) and Action buttons (Use and Jump), each a switch, on by default, then Install while the game can be installed, which opens the install steps. The build label sits at its foot. Its close X, P, Esc and back each return to whichever opened it
