# Game Design

The rulebook: every rule the game is built to. What's left to build and tune is in [`README.md`](README.md), and undecided ideas are in [`ideas.md`](ideas.md).

`src/data/` holds every number and all player text. This doc states the rules, with numbers only where they define one.

## Pitch

A landscape platformer: Chibi travels back to the apartment he shared with his former best friend, Furt, a ferret, after Furt mails him far away. V1 follows one linear route; branching routes are planned for Next.

## Setting

- **Characters:** Chibi is the male bird the player controls: a small, round, cream bird with tiny wings and feet, an orange bill and a dot eye. His full design is in the [art plan](../art/README.md). Animals talk; there are no humans.
- **Furt:** Chibi's male former best friend and apartment-mate: a champagne (cream-coloured) ferret, about twice Chibi's height, standing upright, with a tall plum stovepipe hat and a red bow tie. His full design is in the [art plan](../art/README.md)
- **Story:** Chibi and Furt share an apartment in a big city. After a big fight, while Chibi sleeps, Furt packages him and mails him far away. Chibi knows Furt is responsible and wants to get home. The cause of the fight and the outcome of their friendship are undecided
- **World:** the modern day, mixing fantasy and reality
- **Zones:** a zone is one themed map destination containing two playable stages, indoors, outdoors or a hybrid of both. V1 has six zones and twelve stages. The V1 route and current stage availability are listed below

## Cast

| Name   | Identity                     | Role                            |
| ------ | ---------------------------- | ------------------------------- |
| Archie | Dog                          | Blue cityscape antagonist       |
| Bini   | Bear                         | Woodland antagonist             |
| Chibi  | Bird                         | Player character                |
| Furt   | Ferret                       | Apartment building antagonist   |
| Kiwi   | Female raccoon               | Home city antagonist            |
| Pebble | Pigeon                       | Industrial outskirts antagonist |
| Trixi  | Goose with oversized glasses | Countryside antagonist          |

The named cast uses shared data-driven behaviours. The encounter rules below are delivered with their matching runtime, values and artwork.

## Core loop

1. **A stage:** travel through one place, mostly left to right and bottom to top: platforming and talking with animals. Each zone contains two stages; V1 follows a linear route.
2. **Between stages:** completing a zone's first stage shows a cutscene image and Continue, which enters its second stage directly. Completing the second stage shows the zone's outgoing exchange, then returns to the map and animates Chibi walking to the next zone, except for the final celebration. V1 continues along its linear route; Next adds branching routes.
3. **Home:** Chibi returns to the shared apartment. The outcome of his friendship with Furt is undecided.

## Voice

- **Data:** every string a player sees lives in the text data files, with `{placeholders}` the game fills, never as a literal in code
- **Fit:** text never shrinks to fit. Reword it or grow its box
- **Labels:** one label for one action, everywhere
- **Lengths:** text is Tiny5 drawn at 2×, about 6.5 base px a character on average; measure the width, don't count characters. A dialogue paragraph fits 3 lines of 504 px (about 72 characters a line). An answer fits 166 px (about 25 characters). A quip, with its speaker's name, fits 452 px (about 60 characters)
- **Spelling:** Canadian (colour, favourite, neighbour). No em dashes and no emojis
- **Style:** plain, short and consistent: no flourishes, no figures of speech, no redundancy
- **Terms:** the home page is the website's page at `/`; it is never shown inside an installed app. The start screen is the game's first screen, in a browser and in an installed app. Back to title always goes to the start screen, from any zone, the map or a card

## Rules

| Term               | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| Zone               | A themed map destination containing two stages                  |
| Stage              | The playable level, currently represented by `ZonePlan` in code |
| Section            | One continuous area within a stage, such as an apartment floor  |
| Encounter section  | A distinct enemy encounter segment within a stage               |
| Chunk              | A hand-designed unit used to assemble the randomized layout     |
| Opening and ending | The fixed caps around a stage's randomized middle               |
| Run                | One generated stage layout and its seed                         |
| Attempt            | One try to complete the stage within a run                      |

The V1 map has six themed destinations with two catalogued stages each. All twelve stages are built; building the route does not declare a V1 release.

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
- **Exact:** spacing sits on a fixed pixel grid: equal margins, aligned edges, and text clear of its box's edge by the same amount on both sides
- **Minimal:** show only what the player needs. No heading that repeats a tab's name, no label the picture already gives, and no decoration that competes with play
- **Options:** art mocks up visual options for the user to pick
- **Press areas:** apart from Jump and Use, a button's press area is the drawn button plus a quarter of its shorter side on each side, between 6 and 16 px, and at least 48×48. Where press areas overlap, the nearer button wins

### Grid

- **Chibi:** 2 tiles wide and 3 tall
- **Reaches:** stages are built to Chibi's reaches, measured in tiles from the top of the ground he leaves to the top of the ledge he lands on. A short press rises 3 tiles (clearing a 3-tile ledge with a little room); a full jump rises 6; a full running jump with flutter crosses a 19-tile gap at the same height, with the jump pressed at its best moment, coyote time included. A ledge at a reach is always makeable, and one tile beyond it never is
- **Tiles:** stages are built on a grid of 12 px tiles, so the screen is 60 columns by 30 rows. Every solid, ledge and door sits on whole tiles and spans whole tiles. Hazards follow the grid, except for the 2 to 3 px thickness of edge hazards

### Chibi

- **Flutter:** every fall flutters, after a jump or off a ledge: his fall is slow enough to use, and the player steers him in the air
- **Jump height:** every jump has one uninterrupted ballistic ascent, with no timed lift or upward reboost while Jump is held. Releases within the first 80 ms produce the minimum hop of 40 px, about 3 tiles; releasing later retains more upward speed, increasing the jump toward the full height of about 6.5 tiles. Chibi flutters on the fall. A buffered jump whose button was already released is the low hop. Low ceilings are placed so a short jump clears the obstacle without touching the overhead red edge; a full hold hits that edge. Jump tuning lives in `src/data/bird.ts`
- **Jump timing:** a jump pressed just after he leaves a ledge still jumps (coyote time), and a jump pressed just before he lands jumps as he lands (jump buffering)
- **Movement:** he walks left and right and jumps. He is quick and responsive: about 0.1 s to reach full speed or stop, on the ground and in the air. His speeds, jump, flutter and timing values are in `src/data/bird.ts`, tuned to the reaches under Grid

### Map

- **Availability:** all six V1 zones appear in route order. Each has two catalogued stages. All twelve V1 stages are built: Parcel depot and streets (`street`), City boundary (`city-boundary`), Warehouse district (`warehouse-district`), Freight terminal (`freight-terminal`), Farmland (`farmland`), River crossing (`river-crossing`), Forest paths (`forest-paths`), Ravine (`ravine`), City outskirts (`city-outskirts`), Familiar neighbourhood (`familiar-neighbourhood`), Entrance and lobby (`entrance-and-lobby`) and Climb to the apartment (`climb-to-apartment`). Unbuilt zones and stages are visibly unavailable and cannot be entered. The park is a debug prototype outside the V1 map
- **Backtracking:** unlocked built stages remain available for replay. Replaying an earlier stage never removes later unlocks
- **Between stages:** clearing a zone's first stage shows a placeholder cutscene image with Continue, which enters stage two directly without showing the map. Clearing its second stage shows the outgoing zone exchange before returning to the map and automatically animating Chibi walking along the existing route to the next zone. After the walk, the map waits for the player's selection; it does not enter that zone automatically. Completed stages and opened paths are marked. The final stage follows the celebration rule instead
- **Buttons:** Back to title is on the left; Continue is on the right and is the default keyboard action
- **Celebration:** only clearing Apartment building's second stage, Climb to the apartment, shows Furt's outgoing exchange followed by the finish celebration, including on replay. Clearing the depot does not finish V1. Continue returns to the map; Restart asks first, as on the start screen
- **Checkpoints:** each stage begins at its own checkpoint, with unlimited retries. Walking left from any stage entrance returns to the map. The entrance exit stays reachable and has no blocking wall; an apartment stage returns through its first section's left edge
- **Forks:** branching routes are deferred to Next. V1 is linear and has no laps
- **Progression:** the first stage is unlocked from the start. Completing Parcel depot and streets unlocks City boundary; completing City boundary unlocks Warehouse district, which unlocks Freight terminal on completion. Completing Freight terminal unlocks Farmland; completing Farmland unlocks River crossing. Completing River crossing unlocks Forest paths; completing Forest paths unlocks Ravine. Completing Ravine unlocks City outskirts; completing City outskirts unlocks Familiar neighbourhood. Completing Familiar neighbourhood unlocks Entrance and lobby; completing Entrance and lobby unlocks Climb to the apartment, which ends at the apartment. Completing a zone's first stage unlocks its second stage when built; completing its second stage opens the next zone. Unbuilt content remains unavailable
- **Selection:** Only manually pressing Continue on the map opens a stage-selection modal for the selected zone, including when only stage one is unlocked. Two side-by-side cards stay in fixed positions: stage one on the left, stage two on the right. Stage two remains visible, grey and disabled until unlocked; unbuilt stages are unavailable. The latest available stage is highlighted and is the default. Each card shows an actual scene screenshot depicting its stage art, with the main stage name at the standard font size and a smaller, lighter Stage 1 or Stage 2 label at the top right. Stage names never shrink to fit. Scenery differs slightly between a zone's two stages so the images help distinguish them, while preserving the zone's palette and visual style. Persisted unlocks survive replays
- **Walk:** Chibi stands on a zone. Left and Right move through available zones, and Continue selects the zone he stands on

### Stages

- **Camera:** on the ground he sits about two thirds down the screen. In an assembled stage, the ground line follows the chunk he is in, blending across half a screen at each seam. The camera rises only when he climbs above the middle, and never shows below the lowest ground. Decorative background layers use tunable parallax, with farther layers scrolling more slowly; ground props stay attached to the terrain
- **Challenge:** platforming, hazards and choices. Routes use ledges and cliffs, not ladders, with both short-press jumps beneath low ceilings and full jumps. There is no combat
- **Checkpoint:** the start of a stage is its only checkpoint. Falling or touching a hazard enters the death flow; Try again restarts the stage from its start, with unlimited retries and no permadeath. Progress is saved: the stages he has completed and where he stands on the map. Clearing a stage marks it completed and follows the first-stage cutscene, second-stage map travel or final-stage celebration flow; a stage left before its end is played again from its start
- **Crush:** a moving platform that pushes him sideways carries him to its leading edge. If it squeezes him into terrain or another solid, he is crushed and enters the death flow, as a hazard does. Layouts leave room beside every moving platform's path so he is never pinned on a required route
- **Difficulty:** per-zone bands and chunk-selection weights in `src/data/` set a demanding first-zone base and increase difficulty in every following zone. Blue cityscape selects grades 3 to 4, Industrial outskirts and Countryside grades 3 to 5, and Woodland, Home city and Apartment building grades 4 to 5. Increasing weights for harder chunks distinguish successive zones even when their bands match. Seeded variation remains inside each band
- **Doors:** optional room doors lead only into rooms; marked main-route stairs automatically link stage areas and are distinct from room doors. Use enters a door when any part of his drawn frame overlaps the door's drawn art; where he overlaps more than one, the door whose centre is nearest his wins
- **Edge hazards:** a common red strip, 2 to 3 px thick, can cover the top, bottom, left or right edge of terrain. Terrain hazards and floor traps use red contact edges. Pebble's falling white blocks are lethal projectiles. Animals have no red contact outlines. There are no spikes. Touching any edge hazard enters the death flow
- **Encounters:** every zone has exactly two distinct encounter sections in its first stage and three in its second stage, counted across the whole stage rather than per floor. Ordinary platforming separates the encounters, with flexible spacing. Generated runs vary encounter order and layout while preserving the quota; death retries retain the same run and encounter count. The quota is independent of the successful-clear time target
- **Exit:** reaching the end of a stage's final area clears the stage. A first stage shows the inter-stage cutscene; a second stage shows its outgoing zone exchange before map travel to the next zone, except for the final outgoing exchange followed by celebration. An internal floor transition does not clear the stage
- **Going back:** walking all the way back to the stage's left edge leaves it without completing it: the screen fades and the map shows with him on that stage's zone. Completion progress is unchanged, and cumulative active time is retained. Every stage starts him clear of that edge and has no wall in front of it
- **Kinds:** indoor, outdoor, or a hybrid with both
- **Length:** the ten continuous V1 stages have recipe ranges of 720 to 960 columns, fixed start and finish caps included. Entrance and lobby has an aggregate range of 528 to 600 columns across its two sections; Climb to the apartment has 1272 to 1440 across seven sections. These aggregate ranges include the fixed caps. The debug park keeps its own recipe
- **Layout:** every built and future stage, including the first tutorial and final stage, has a randomized layout assembled from hand-designed chunks: a fixed start chunk, a seeded run of chunks whose entry and exit heights match, then a fixed finish chunk. A multi-area apartment stage applies this structure across its linked sections, with fixed first and last caps and seeded runs of shared templates in intermediate areas. The rules for chunks are under Chunks
- **Scale:** outdoors, the scenery is drawn at a quarter of indoor scale; Chibi, the tiles and the reaches stay the same everywhere
- **Shape:** each playable stage area is at most 2 screens (60 tiles, 720 px) tall and as wide as it needs, and scrolls sideways and up. Indoors, to a small bird the ceilings are high: a door is 15 tiles tall, half the screen

### Runs and attempts

- **Continue:** reopening the app with saved progress or choosing Continue on the title screen shows the map with Chibi on his saved zone, without opening a stage chooser or entering a stage
- **Entry:** entering a stage from the map, replaying it or continuing through an inter-stage cutscene starts a new run
- **Pause:** pausing and resuming keeps the same run and position
- **Restart:** a full restart starts a new run
- **Retry:** death ends the attempt; Try again restarts the same stage directly, without the map or stage chooser, as another attempt of the same run, preserving its seed and generated layout

### Death and retry

This is the approved implementation scope for the current change, including the death sequence, required card and persistent stage metrics.

- **Active time:** count only time actually spent playing the current stage, excluding pause, dialogue, menus, the death sequence, the death card, floor-transition presentation, inter-stage cutscenes and map travel. Floor transitions preserve the same stage clock. Retries add to the same cumulative time. It persists through the map, title screen and app restarts until the stage is cleared; every clear resets it, including a replay clear
- **Card:** after the animation, hold the final pose beneath a required modal with four rows in this order: the zone name; `Stage {number}: {stage name}`; `Progress: X%` for the current attempt; and `Time: 0:00` for cumulative active stage time. Back to title is the secondary button on the left; Try again is the primary button on the right. Keep the card compact and position it so Chibi remains visible. The card stays until a button is pressed; outside taps, back and Escape do not dismiss it
- **Progress:** a subtle, visible line 2 px high at the top uses the stage's theme. It tracks Chibi's current position during play and his death point on death, not the furthest point reached. In a multi-area stage it uses shared weighted current-position progress across the floor sections, including the death point; returning to an earlier section can lower it. Retrying starts the percentage at zero
- **Retry:** Try again restarts the current stage directly from its checkpoint in the same run, without the map or stage chooser. In a multi-area stage this is the first floor, not the current floor. Back to title opens the title screen. There is no permadeath
- **Sequence:** lethal contact starts a small recoil, then Chibi falls to support, squashes more deeply on landing and makes a small upward bounce into a deflated sitting pose with his feet hidden. The stage and camera freeze at the death context while Chibi plays a dedicated death animation, then holds its final pose for the card
- **Storage:** active stage time uses a separate stats save. Restart clears progress only and does not wipe stats

### Chunks

- **Assembly:** a stage's recipe names its theme, start and finish chunks, a length range (start and finish included), a configurable difficulty band, and the events and doors to place. The seed varies the middle chunks within that band, without requiring difficulty to rise; the start and finish chunks are exempt. It never picks the same chunk twice in a row, and it fills the slots
- **Difficulty:** 1 to 5. 1: walking and taps. 2: full jumps and still hazards. 3: gaps near the reach, single moving platforms and single low-ceiling tap spots. 4: timed platforms or moving hazards on the required path. 5: compounded tap-only, timed or platform-to-platform challenges
- **Challenge variety:** the city and street middle pools include required climbing routes, moving ledges, red ground strips and enemy yards. A climbing chunk requires ascent on its route rather than offering an optional upper detour. Generation varies challenge combinations and order within the zone's difficulty band, preserving valid connections; a stage is not guaranteed to contain every challenge type
- **Fairness:** every chunk is walked on its own from entry to exit, with its slots empty and filled, and a sample of seeds per recipe is walked end to end
- **Seams:** a chunk's entry and exit are the ground rows at its left and right edges: 50, 40 or 30. The seam surface is terrain and runs at least 4 tiles in from the edge, with no gap there, and nothing (no solid, ledge, hazard or moving platform) in the 6 rows above it
- **Shape:** one or two screens wide (60 to 120 tiles) and at most 60 rows (720 px) tall
- **Slots:** marked regions where the seed places an event or a door. A chunk must pass with every slot empty
- **Shared layouts:** every zone uses the same layout templates and object/archetype library. Theme configuration supplies terrain, structures, props, enemies, doors, triggers, backgrounds, parallax and recipes; it does not add zone-specific mechanics
- **Themes:** a theme sets the tileset, terrain looks and repeated backdrops for every chunk of that theme, so seams never show. A chunk can still place its own scenery. The park is an outdoor prototype theme

### Objects

Everything in a stage except its terrain is placed in data through archetypes, characters and instances.

- **Animals:** every animal in the main stage foreground, apart from Chibi, is an enemy and always lethal on actual body contact, including idle, tells, attacks and rest. Antagonist contact closely follows the drawn body footprint of the current animated pose; transparent frame space around wings or tails and gaps between drawn parts cannot kill on a visual near miss. Frame boxes may bound the contact check but do not make transparent space lethal. Chibi's movement and platform physics and the explicit red-hazard and projectile collider contracts are unchanged. Every antagonist periodically attempts direct charge or body contact and has a distinct special attack; attack frequency varies in data. Animals have no red contact outlines. Archie, Pebble, Trixi, Bini, Kiwi and Furt are the only world-stage animals currently placed; there are no friendly background animals in the current stages
- **Archetypes:** a behaviour: collision (none, solid, one-way ledge, hazard or Use), movement, reaction, interaction (such as talking on Use or a quip on approach) and default tuning
- **Attack tells:** every aggressive charge or special action has a visible pre-action tell lasting about one second or less; the action begins only after the tell. This includes swoops, drops, growls, pounces, throws and trap placement. A trap-placement tell is separate from the trap's warning and arming delay after placement. Body contact stays lethal during tells and recovery
- **Behaviour patterns:** reusable patterns in the data choose behaviour primitives, their sequence or states, transition conditions, timing, animations and tuning. Animals and moving inanimate objects use the same composition approach. Code implements the primitives, condition evaluation and shared executor; character-specific cycles are composed in data rather than hardcoded in code
- **Characters:** who something is: one archetype plus tuning overrides, its art and animations, hit box, size, its dialogue and quip lines, and quirks. No character inherits from another. Props (platforms, hazards, doors and backdrops) are characters with art but no voice
- **Decoration:** friendly animals are allowed only as muted background flavour, never in the main stage foreground, or inside rooms reached through doors for shops and quests. Room animals remain in place
- **Enemy awareness:** all six enemy animals detect Chibi from at least half a screen away, independently of whether they can reach him. They pursue persistently only over reachable terrain inside their movement bounds, using shared data-driven movement and reach conditions. Ground pursuit follows reachable terrain; vertical attacks stay in their committed lanes. Movement speeds and travel ranges use the aggressive profiles tuned in data. Losing a reachable target or finding Chibi unreachable triggers a looping visible frustration reaction
- **Instances:** one placement in a stage: a character, a position, size and phase, last-word overrides, its own lines or dialogue scene, a door's room, and flags for carried choices
- **Movement:** an algorithm (static, linear, ease, hop or wander), a direction, a distance, a speed, a pause at each end, and a random variance that rolls fresh on every attempt
- **Overrides:** flow one way: an instance overrides its character, which overrides its archetype. Everything resolves and is checked when the game loads
- **Reaction:** none, avoiding Chibi, or approaching him, within a range
- **Static art:** a behaviour state can use `animation: null` for static art, including a moving inanimate object. Motion and transitions still come from its reusable behaviour graph

### V1 route

The route spans six themed zones of two stages, in this order. Stage length is defined by the recipes; no total play-time estimate is prescribed. All twelve stages across the six V1 zones are built; this does not declare the first release complete. The six-zone map and manual stage-selection flow preserve unlocked stages for replay. Every stage, including the depot tutorial and final climb, has a fixed opening and ending with a randomized middle.

| Zone                 | First stage              | Second stage           |
| -------------------- | ------------------------ | ---------------------- |
| Blue cityscape       | Parcel depot and streets | City boundary          |
| Industrial outskirts | Warehouse district       | Freight terminal       |
| Countryside          | Farmland                 | River crossing         |
| Woodland             | Forest paths             | Ravine                 |
| Home city            | City outskirts           | Familiar neighbourhood |
| Apartment building   | Entrance and lobby       | Climb to the apartment |

### First stage

- **Ending:** the fixed finish retains the final short-jump ceiling, red-edged gap and canopy
- **Layout:** the tutorial combines the parcel depot and streets of the blue cityscape with a fixed opening and ending around seeded hand-designed street chunks. The middle uses matching city scenery and the zone's difficulty band, with varied climbing, moving-platform and enemy-yard chunks
- **Opening:** the fixed start retains the opened parcel on safe ground, depot jump lessons and first Archie introduction
- **Rooms:** the street door leads to the prototype test room
- **Route:** the main path continues right toward the city boundary; middle chunks can include upper street ledges. City boundary is the zone's second stage and unlocks when this tutorial is completed

The park is a prototype for randomized stages, not V1's second stage. The identities of Furt's friends beyond Archie, Pebble, Trixi, Bini and Kiwi and the later encounters along the route are undecided.

### City boundary

- **Encounter:** the finish uses the same Archie behaviour and timing as the first stage, with refuge ledges on either side of its patrol. his first-sighting introduction follows the shared once-per-zone rule across both stages
- **Layout:** the second Blue cityscape stage is randomized from a fixed start, seeded middle chunks and a fixed finish. It uses the existing street backgrounds and sidewalk terrain, with steps, required climbing routes, moving ledges, enemy yards, red ground strips, red-edged gaps and low-ceiling short-jump challenges inside the zone's difficulty band. The finish has sparse facades and an open outward view
- **Replay:** entering from the map draws a fresh assembly seed; retries keep that layout. Completing Parcel depot and streets unlocks this stage, and the existing stage-choice modal keeps both available for replay
- **Rooms:** one door in the fixed start leads to the existing prototype test room

### Industrial outskirts

- **Appearance:** purple industrial scenery uses floor, crate and container art, shared moving platforms and red-edged inanimate hazards
- **Encounters:** both stages feature Pebble through the shared data-driven behaviour system. Archie and Pebble use the shared enemy detection, pursuit and frustration rules
- **Layout:** Warehouse district and Freight terminal each have fixed openings and endings with randomized middle chunks, 720 to 960 columns long, inside the zone's difficulty band. Required climbing sections, moving ledges and red-edged hazards use the shared layouts and primitives
- **Progression:** clearing City boundary opens Warehouse district; clearing Warehouse district opens Freight terminal. Both remain replayable through the existing stage-choice flow. Catalogue IDs and save shape are unchanged
- **Rooms:** doors use the existing prototype test room. These stages add no new room, plot or dialogue

### Pebble encounter

- **Contact:** Pebble is always lethal on contact, including while perched, without a red contact outline
- **Cycle:** perch on posts, spot Chibi and launch into flight. Pebble periodically swoops at Chibi for body contact and separately drops white-block poop projectiles as his special attack. Behaviour timing and flight tuning live in data
- **Projectiles:** each white block falls straight down and is lethal on contact. It disappears on landing, including on a ledge, leaving no residue and never homing on Chibi

### Countryside

- **Appearance:** muted yellow countryside scenery distinguishes Farmland's soil and hay from River crossing's banks and timber. Water is decorative scenery, not an implicit contact hazard; only explicit red surfaces are hazards, and falling follows the normal death rules
- **Encounters:** both stages feature Trixi through shared behaviour primitives. Trixi, Archie and Pebble use the shared enemy detection, pursuit and frustration rules
- **Layout:** Farmland and River crossing each use fixed 60-column openings and endings around shared randomized middle layouts, for a total of 720 to 960 columns in the zone's difficulty band. Mandatory climbs, ledge lifts, shuttles and red hazards use the common object and layout system with countryside art and configuration
- **Progression:** clearing Freight terminal opens Farmland; clearing Farmland opens River crossing. Both preserve replay unlocks. Catalogue IDs and save shape are unchanged
- **Rooms:** doors use the existing prototype test room; these stages add no new rooms, plot, dialogue or bosses

### Trixi encounter

- **Appearance:** Trixi wears oversized glasses
- **Contact:** Trixi is always lethal on contact, including while placing traps, without a red contact outline
- **Rush:** Trixi periodically rushes along the ground to make contact with Chibi
- **Traps:** Trixi's special attack places red-edged floor traps. A visible arming delay precedes their lethal contact state; trap timing and placement values live in data

### Woodland

- **Appearance:** woodland uses its canonical green theme through shared terrain, structure, prop and background skins
- **Encounters:** both stages feature Bini through shared growl, charge and contact behaviours. Bini and earlier enemies use the shared detection, pursuit and frustration rules
- **Layout:** Forest paths and Ravine each use fixed 60-column openings and endings around shared randomized middle layouts, for a total of 720 to 960 columns in the zone's difficulty band. Mandatory climbs, moving ledges and red hazards use the common stage object and layout system
- **Progression:** clearing River crossing opens Forest paths; clearing Forest paths opens Ravine. Both preserve replay unlocks. Catalogue IDs and save shape are unchanged
- **Rooms:** doors use the existing prototype test room; there are no new rooms, plot, dialogue, bosses or combat. Water does not add hidden hazards

### Bini encounter

- **Contact:** Bini is always lethal on contact, including while resting, without a red contact outline. His charge and maul are contact threats, not a combat encounter
- **Cycle:** idle with the phone, use the sonic growl special attack, then charge and maul for direct contact using shared behaviour primitives. Timing and movement values live in data
- **Growl:** the sonic growl creates a brief gust that pushes Chibi only while he overlaps its finite volume. The push stops when he is above or outside it, or behind solid cover; it is not a single impulse that leaves momentum. It does not kill directly, but can push him into a hazard or off a ledge. High ground is the primary way to avoid it; solid cover also blocks it
- **Introduction:** Bini sits with a phone playing Archie's Dog Walks. His annoyed first-sighting introduction follows the once-per-zone rule and precedes his aggressive behaviour

### Home city

- **Appearance:** City outskirts and Familiar neighbourhood use the canonical peach theme through shared terrain, structure, prop and background skins
- **Encounters:** both stages feature Kiwi through shared ground-charge and vertical climb-and-drop behaviours. Kiwi and earlier enemies use the shared detection, pursuit and frustration rules
- **Layout:** each stage uses fixed 60-column openings and endings around shared randomized middle layouts, for a total of 720 to 960 columns in the zone's difficulty band. Mandatory climbs, moving ledges and red hazards use the common stage object and layout system
- **Progression:** clearing Ravine opens City outskirts; clearing City outskirts opens Familiar neighbourhood. Both preserve replay unlocks. Catalogue IDs and save shape are unchanged
- **Rooms:** doors use the existing prototype test room; there are no new rooms, plot, dialogue, bosses or combat. Water does not add hidden hazards

### Kiwi encounter

- **Contact:** Kiwi is always lethal on contact, including while preparing and resting, without a red contact outline
- **Cycle:** Kiwi periodically charges along the ground for direct contact. Her distinct special attack climbs, prepares and drops vertically before resting. Ground movement, vertical movement and state timings live in shared behaviour data

### Apartment building

- **Areas:** Entrance and lobby has two short linked sections. Climb to the apartment has seven short floor sections, in order: restaurant, exterior, pool, exterior, spa, exterior, residential. Varied indoor and outdoor skins accompany stronger vertical traversal
- **Checkpoint:** each stage has one checkpoint at its first section. Death anywhere restarts that whole stage on Try again. No floor transition creates a checkpoint
- **Encounters:** Furt is a normal lethal-contact antagonist who periodically charges for direct contact and throws parcels as his distinct special attack. He uses shared behaviour primitives and has no red contact outline; this is not a boss encounter and adds no combat
- **Goal:** reaching the apartment at the end of the final residential section clears the final stage and shows Furt's outgoing exchange, then the celebration, every time including replays. The cause of the fight and the outcome of the friendship remain undecided
- **Layout:** fixed openings and endings surround randomized shared middle templates. Intermediate areas use seeded runs of shared templates; the first and last caps remain fixed. These short linked sections do not use the other zones' total stage-length range
- **Progression:** clearing Familiar neighbourhood opens Entrance and lobby; clearing Entrance and lobby opens Climb to the apartment. The final map path ends at the apartment. Stage IDs, save format and replay unlocks are unchanged
- **Rooms:** optional doors still require Use and lead to the existing prototype test room. These stages add no new room, quest or dialogue. Walls and pool water are decorative unless an explicit red hazard marks a contact surface
- **Stairs:** walking into marked main-route stairs changes floor automatically, without Use. Stairs are reversible; Chibi can return through earlier sections and leave for the map at the first section's left edge

### First Archie encounter

- **Activation:** the first-sighting introduction follows the once-per-zone rule and freezes play. Completing or skipping it activates Archie and resumes play
- **Appearance:** Archie uses his design from Archie's Dog Walks
- **Approach:** the loading yard follows the basic hop and full-jump lessons and precedes the streets. A refuge ledge before the ground patrol and another beyond it give safe observation and landing points. Neither requires a maximum-height jump. The first encounter has no other hazards
- **Contact:** Archie is always lethal on contact, including during crouch and rest. It has no red contact outline
- **Cycle:** patrol, crouch, rush, rest, then patrol again. Detection and pursuit use the shared enemy rules; the rush direction locks when crouching starts
- **Dialogue:** the first introduction has three lines: Archie says Furt asked him to stop Chibi; Chibi says he is going home; Archie tells him to get past. The player-facing wording lives in the text data files, with Skip available
- **Special:** Archie makes a leaping pounce as his distinct special attack, alongside periodic ground rushes for direct contact
- **Timing:** Archie uses the same timing across both stages of the first zone; their layouts vary. The first encounter is in the first stage

### Rooms

- **Contents:** usually dialogue, and any of: items to buy or sell, quests to take, rewards, threats, and talk that advances the story or adds flavour
- **Enter:** Use at a room's door plays the door's opening animation, if it has one, with play held, then shows the room as a full-screen still scene with a little animation, such as a bartender behind his bar. Play pauses until he leaves, and leaving returns him to the door, shown closed. He leaves with the Leave button in a corner, back, or Esc
- **Per stage:** every stage has at least one room. PLACEHOLDER: each is an empty test room for now, showing only its name
- **World:** the side-scrolling stages are the game world; rooms are the only other places, each reached through a door

### Dialogue

- **Box:** a fixed box along the top, not a speech bubble, for a conversation between two characters, sometimes three. It shows one paragraph at a time, with the current speaker's 64 px portrait and name tab inside the panel. Chibi's portrait is on the left; other speakers' portraits are on the right. Consecutive paragraphs from the same speaker keep the same alignment. Each paragraph has at most 3 lines. A paragraph that runs to a 4th line is reworded
- **Forward:** Continue advances one paragraph; a tap or keypress also advances. Continue and Skip are visible controls. There is no back, timer or scrolling chat history
- **Introductions:** the first sighting of a zone's antagonist starts an introduction once per zone per playthrough, always with Skip. Its seen state is shared across both stages and survives death, retries and stage replay; a new game resets it
- **Outgoing exchanges:** completing a zone's second stage shows its outgoing exchange on a black or placeholder interstitial, with Continue at the bottom right and Skip available. Completing or skipping the exchange proceeds to the map walk; Furt's final exchange proceeds to the existing celebration instead
- **Restarts:** other stage dialogue plays again after a stage restart; the zone introduction keeps its seen state
- **Skip:** Skip skips all remaining dialogue. If the conversation ends in a choice, Skip opens its modal without choosing an answer or bypassing the choice

### Quips

- Short messages during play, for cutscenes, notices and quips. They never pause play
- One line in a strip at the top centre, starting with the speaker's name

### Furt

- **Appearances:** Furt enlists his friends as a favour. A friend or group is responsible for a themed zone and appears in person or through dialogue overlays; identities beyond Archie, Pebble, Trixi, Bini and Kiwi are undecided
- **Boss encounters:** deferred to Next, outside V1
- **Calling card:** every trap Furt sets carries a badge of his stovepipe hat and bow tie
- **Ending:** Chibi returns home; the outcome of their friendship is undecided. There is no combat

### Choices

- **Effect:** a choice changes where Chibi goes, what he does and what he sees
- **Kinds:** dialogue choices always appear in a modal. Route forks in zones and on the map are planned for Next
- **Reach:** choice effects on later zones or the ending are undecided. Branching routes are planned for Next

### Start screen

- **Back:** back with no card open leaves the game, the same way as Exit, wherever Exit shows; elsewhere back is the browser's own
- **Boot:** the game opens in landscape. With saved progress it opens on the map where he stands, without opening a stage chooser; with no save it opens on the start screen. It never opens straight into a zone
- **Exit:** at the top right, at the far end. In a browser tab it goes straight to the home page. In an installed app it closes the app, and it shows only in apps that can close themselves (Chrome's Android app, and Chrome or Edge desktop app windows); in every other installed app (iOS, Firefox for Android, Samsung Internet and Edge for Android) it is hidden, and Settings sits at the far right
- **Restart:** on the start screen with a save, and on the celebration. It asks first on a card: a short question, Restart, which confirms, and Cancel; back and Esc cancel. Confirming clears only the saved progress and opens the map with him on the first zone and nothing completed. It never clears stats or achievements, which keep their own save
- **Settings:** at the top right, beside Exit. It opens the settings card
- **Start:** with no save it reads Start and opens the map with him on the first zone. With a save (reached through Back to title) Start gives way to Continue, which opens the map where he stands without a stage chooser, and Restart beside it. There is one save

- **Updates:** an offered update uses a compact modal with a concise title and one primary Update now button. Its close X defers the update and restores control to the underlying screen. There is no redundant body text or separate Later button

### Settings

- **Back:** back during play opens the pause card, and back with the card open closes it. Where the browser can't hand back to the game (Firefox for Android's installed app, and before the first tap or key in browsers without CloseWatcher), back is the browser's own
- **Back to title:** always goes to the start screen
- **Modals:** size each card's width to its content plus 16 px of shared padding on each side, with a minimum of half the full logical viewport width, then clamp it to the viewport's safe available width. Keep its height compact around the content with consistent padding. Preserve the standard text and control sizes; do not shrink them to fit a card. Every card over the game (the death card, the pause card, the settings card and its install steps, the restart question) has no title bar: its title is centred near the top, and a closable card has a close X at its top-right corner. While one is open, only the card responds: nothing under it does, not the start screen's nav bar, the pause button, the touch controls, the map or doors. A tap anywhere outside a card that can close only closes it, as its close X or back would, the margins beside the game included; on a card with no close, a required choice, it does nothing at all. A press that drags does nothing
- **Open:** the pause button at the top left, shown only while a zone plays, P or Esc, or back. It also opens by itself when the frame turns, or stops turning, while a zone plays, and only then; Resume continues
- **Pause card:** a card titled Paused, over the dimmed game, which pauses play, with a close X. Its buttons, all one shape, stacked: Resume first, the primary in green, then Settings and Back to title
- **Settings card:** opened from Settings on the pause card or the start screen. Its rows: Move controls (the move hint) and Action buttons (Use and Jump), each a switch, on by default, then Install while the game can be installed, which opens the install steps. The build label sits at its foot. Its close X, P, Esc and back each return to whichever opened it
