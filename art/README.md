# Art

The art plan and pipeline for Chibi's Way Home. Art owns `art/` and the served art directory, `public/art/`.

## Direction

- Pixel art: minimalist, cute, a little retro, refined.
- Everything, UI included, is pixel art at one base resolution, 720x360. The game scales it to fill the screen at 2:1 with nearest-neighbour sampling and no smoothing, by a fractional factor, so on most screens some pixels come out one device pixel wider than others. On a landscape phone 1 base pixel is about 1 CSS pixel. Judge art at a fractional scale as well as at 3x, and avoid 1px patterns (checks, dashes, alternating rows) that turn uneven when pixels vary in width.
- Chibi proportions: the head at least as big as the body, so a character reads from head shape and markings alone.

## Zone design guide

- Accents: reserve amber for doors and small points of interest. Other hues add restrained foliage, signs and character details. Red contact edges always mean danger in every theme.
- Colour: each V1 destination uses its canonical muted primary from [Zone primary colours](#zone-primary-colours), carried through atmosphere, materials, map identity and progress. Keep distant colours close to the sky and spend saturation on a few useful accents. The park remains a separate prototype outside the V1 route.
- Detail: distant scenery uses broad silhouettes without window grids. Near architecture uses sparse window groups and quiet surfaces. Avoid repeated stripes and single-pixel texture that compete with the bird.
- Layouts: every stage, including the first and final stages, assembles seeded middle chunks between fixed start and finish sections. Reusable tiles, scenery and gameplay chunks assemble independently; a background image never encodes a required route. Stages are at most two screens tall (720px, 60 rows).
- Obstacles: use ledges, cliffs, walls and ceilings. Short-clearance jumps and full-height jumps share the same visual vocabulary. Ladders are not part of the obstacle set. Difficulty and jump requirements belong to gameplay data, with variation around a common configurable difficulty.
- Readability: safe walkable tops use a dark edge and a bright two-pixel lip. On darker scenery the lip holds at least 2:1 against its backdrop; against a pale sky the dark edge supplies the separation, so retain both parts of the edge. Dangerous faces instead use the shared red band, without spikes or a safe light lip. Text keeps 4.5:1 and meaningful UI marks 3:1 contrast.

### Parallax building blocks

Sky, distant skyline and middle-distance scenery are separate repeating images. Architecture that supports a ledge, and every attached door, railing or other prop, stays on the same plane as terrain. All physical surfaces move together, so the art never suggests that a landing slides away from its building.

The design starts with horizontal camera factors of 0 for sky, 0.15 for the far skyline, 0.4 for middle scenery and 1 for play. Gameplay owns the runtime values; initial far and middle vertical factors are 0.05 and 0.15. Vertical movement should be weaker on distant layers to keep climbs legible. Windows between near buildings reveal the distant layers; do not fill every opening with foreground decoration. Repeating layers must cover camera travel without exposing an empty edge.

### Reusable element skins

Every stage element separates its behaviour, configuration and placement from its appearance. Reusable layout structures name logical roles; data bindings select their configuration and skin. This applies to terrain, static structures, ledges, hazards, enemies, doors, triggers, props and backdrop layers. Zones mix these elements and structures without introducing zone-specific behaviour types.

Terrain skins bind the common ground and raised looks to tile families. Other visible skins select sprite, tile or backdrop assets. Keep the canonical footprint, collision profile and anchor compatible across skins; changing appearance must not change physics. Animation tags retain their logical state conventions, or use an explicit binding at the skin boundary. Invisible triggers need no artwork. Physical elements and attached art share the gameplay plane; independent backdrop layers keep their data-defined parallax.

## Process: critique and revise

Every asset goes through 2 to 4 loops of render, critique against the checklist, and revise, until nothing on the checklist fails. A higher quality bar means more loops, not one bigger pass.

### Rendering for critique

- Judge every piece at the size it is shown, never zoomed. Anything that scales is judged at its smallest size.
- Render each candidate at 1x and 3x (nearest neighbour), and composited into a real game frame: the actual screen, on the actual ground, beside the neighbouring objects it must be told apart from.

### Checklist

In order:

1. Silhouette: filled solid black, it still says what it is. Fix the shape before any detail.
2. Value: in greyscale, the subject separates from its ground, and its main parts (head and body, rider and mount) separate by lightness, not only by hue.
3. Colour budget: about 6 to 8 fills plus the outline and rim, with one accent. Merge near-duplicate shades.
4. Detail budget: clusters of 2px or more at the smallest size. No single-pixel noise, speckle or dithering on small sprites, and no texture that shimmers when it scrolls.
5. Focal point: one per sprite, card or screen. Background and filler sit lower in contrast and saturation.
6. Clean lines: a closed 1px outline, no doubled or broken edges, no orphan pixels, no jaggy curves, and one light direction everywhere (top-left).
7. Consistency across the set: proportions, outline weight, palette, facing and detail density.
8. Look-alikes: a hazard never reads as a pickup. Pickup shapes and colours are reserved; a round gold or orange blob reads as a coin.

### Options and decisions

- Routine refinements within the approved scope use judgement and contextual review where useful. Obtain explicit user approval for controversial changes.
- When comparing visual directions, show distinct alternatives side by side in context at the same display scale.
- Mocks live in scratch, never in the repo.

### Asset handoff

Include asset keys, frame sizes, animation tags and timings, anchors, hit boxes, relevant light offsets and a contextual contact sheet. State any requirements for runtime code.

### Rebuild discipline

- After a refactor or rename, confirm every other output is byte- or pixel-identical, and restore any file a build re-saved with no change.
- When the game's layout or camera changes, rebuild whatever derives from it, then check the joins in a real capture.

## Pipeline

- All art is drawn by Python scripts, never by hand in an editor: `art/tools/<set>.py`, each with `build` and `preview OUT.png` commands.
- A shared module holds the grid (rect, ellipse, line, cel shading, outline pass), the palette with ramp names, and the export.
- A build writes the Aseprite sources (`art/<set>/<key>.aseprite`) and exports them as PNG plus JSON, with Aseprite tags for animations, to `public/art/sprites/<key>.png` and `.json`.
- Change the script, never the `.aseprite`: a build overwrites it.
- Each script's docstring is its spec: every asset's size, tags, frame timings and placement.
- Every manifest sprite entry has `once`: the tags that play once and hold their last frame, `[]` when none. Every other tag loops. A script declares them in a `ONCE` dict beside its `sprites()`.
- A sprite with a hit box carries `hitbox` in its manifest entry, `{"x", "y", "width", "height"}` in frame pixels for the facing it is drawn in. A script declares them in a `HITBOX` dict beside `ONCE`; only sprites that declare one have it, and a box outside the frame fails the build.
- A nine-slice texture carries its margins as an Aseprite slice named after its key and as `slice` in its manifest entry.
- `art/tools/fonts.py` rasterizes the fonts in `art/fonts/` into BMFonts in `public/art/fonts/`, white for tinting: printable ASCII and the middle dot (·).
- `art/tools/palette.py` writes `public/art/palette.json`, listed under `data` in the manifest: `colours` maps each palette name to `#rrggbb`, `darker` maps each colour one ramp step down, and `dim2` two steps down, the settings card's dim. Keys are sorted.
- `art/tools/icons.py` draws the favicon and app icons, the bird on a sky-blue sunburst disc (whole from 32px up, her head and back at 16px on flat sky, where the rays do not hold), as plain PNGs, not sprites or manifest entries: `public/favicon.ico` (16 and 32), `public/art/favicon-16.png` and `public/art/favicon.png`, and in `public/icons/` the 180 apple-touch icon on a full-bleed sunburst square, the 192 and 512 icons on a sunburst disc with a transparent outside, and a 512 maskable icon with the subject inside the central 80%. The 16 and 32 are drawn natively; the larger icons are 64 and 90 drawings scaled by whole numbers.
- `art/inventory.md` lists every asset (key, type, size, tags).
- `art/tools/floor<n>.py` draws one zone's tilesets and backdrop pieces as plain PNGs, not Aseprite sprites, so the game builds each zone from stage data instead of a fixed panorama (`floor1.py` draws Zone 1). A chunk theme has its own module, such as `art/tools/park.py`, with the same `build` and `preview OUT.png` commands; each tool merges its own keys into the manifest's `tilesets` and `backdrops` and keeps the others.
- A tileset is `public/art/tilesets/<key>.png`, 12x12 tiles in rows of 8 with no spacing or margin, plus `<key>.json`: `{"tileSize": 12, "columns": 8, "tiles": {"<name>": <index>}, "pieces": {"<name>": [[<index>, ...], ...]}, "hitboxes": {"<name>": {"x", "y", "width", "height"}}}`. An index counts row by row. A piece is a multi-tile unit as rows of indices, top row first. `hitboxes` is optional and written only when a tile has one: a `hazard-*` tile's hit box in pixels within its 12x12 tile, the same shape as a sprite's `hitbox`. A tile without an entry hits its whole cell. `pixel.write_tileset` writes every tileset. A tile named `one-way-*` is a one-way ledge, which stops only a fall onto its top edge. A tile named `door-*` or `exit-*` is a doorway with no collision. A doorway leads only to a room: where the stage gives it one, the game puts a Use zone over its piece. A zone is cleared at its right edge, never through a doorway. A tile named `pit-*` is a pit with no collision, so she falls through it and out of the stage. A tile named `hazard-*` has no collision and is drawn for a hazard instance placed with a width: touching its hit box restarts her. Every other tile with art is solid. The manifest lists each under `tilesets` as `{"key", "png", "json"}`.
- A backdrop piece is `public/art/backdrops/<key>.png`, drawn behind the play layer. The manifest lists each under `backdrops` as `{"key", "png", "width", "height", "anchor": "bottom-left", "y", "repeat"}`: its bottom edge sits at world `y`, at an x the stage data chooses, and `"repeat": "x"` tiles it across a run while `"none"` places it once.
- Art reads game layout and data from the generated export files the game writes, never from `src/`. The export files are in `shared/export/`. Art writes the shared data files the game reads (`lights.json`, `palette.json`).
- Keys are kebab-case, named after what the player sees. Internal names match displayed names.
- Checks run in a container: the art manifest, art tests that assert every key the game uses exists with its tags, and prettier on the docs. PLACEHOLDER: the image and command.

## Style rules

### Palette

- One fixed house palette, plus a few game-specific ramps that each end on a house colour. The house palette is [Endesga 32](https://lospec.com/palette-list/endesga-32); colour names are the `K` names in `art/tools/pixel.py`.
- Every pixel is fully opaque or fully transparent.
- Each colour has a one-step-darker mapping (its ramp). Shadows and dimming step each colour down its ramp, never blend with black.
- Greys (lgrey, grey) may be used for environment scenery and characters. Disabled UI keeps its own treatment: greyed with the grey ramp and changed in shape, so it stays recognisable.

### Zone primary colours

Each V1 destination has one muted primary, chosen for its materials and atmosphere. `art/tools/zone_themes.py` is the canonical assignment and ramp source. It generates `public/art/zone-themes.json`, registered as manifest data key `zone-themes`: each destination maps to `{ "primary": "palette-token" }`. Runtime code resolves the token through `palette.json`; it does not duplicate the hex values.

| Destination          | Primary token | Base    | Material and atmosphere                  |
| -------------------- | ------------- | ------- | ---------------------------------------- |
| Blue cityscape       | zone-blue     | #a8bfd4 | Powder blue haze and distant buildings   |
| Industrial outskirts | zone-purple   | #b6aecb | Smoky lavender steel and factory shadows |
| Countryside          | zone-yellow   | #d8c994 | Butter-yellow wheat fields               |
| Woodland             | zone-green    | #a9bea0 | Sage foliage                             |
| Home city            | zone-peach    | #d6b39d | Warm peach neighbourhood plaster         |
| Apartment            | zone-red      | #d0a7aa | Dusty rose apartment interior            |

- Application: the primary dominates each map region's silhouette and backs its icon. Essential outlines and symbols remain ink or dslate, so the pastel fill is not responsible for contrast. Locked and unbuilt markers retain the coloured illustration around them.
- Progress: fill uses the same primary on a dslate track, with no brighter substitute. Standard primary buttons remain dslate with white text. Hazard red remains the existing saturated `red`; muted `zone-red` is the apartment interior colour and never signals lethal contact.
- Ramps: every zone primary has one muted `-shade` colour, then joins a house ramp. The six bases and six shades extend the house palette without changing any existing colour. `palette.py` exports their darker and two-step dim mappings with every other palette colour.
- Planned stage use: backgrounds follow the destination's primary family, with far silhouettes low in contrast and nearer layers using its shade. Quiet secondary colours provide restrained highlights. Far scenery scrolls more slowly than the gameplay plane; attached ledges, doors and props stay with terrain. This is an art plan for later themes, not a claim that those stages exist.

### Outlines

- Outlines are coloured: two ramp steps darker than the fill they border.
- Against the play ground, keep stepping down the ramp until the outline holds 3:1 contrast on every ground it can appear on.
- A dark area takes a light rim on its top-left-facing edges, so it separates from dark ground.
- Faces and portraits take one ink outer line.
- Effects take a fixed 1px rim instead of a ramp outline.

### Shading and faces

- Cel shading: per material a light, a base and a shade. The shade is a crescent along the lower-right rim that follows the form, never a diagonal plane or per-pixel texture.
- Markings are a few flat patches.
- Front-facing faces stay clean: flat skin with at most a 1px shadow down one side.
- Eyes are matched pairs, at least 3x3 at small sizes.

### Sizes

- Draw on a small design grid, then rasterize at a fixed scale. Shapes scale; 1px lines and single pixels stay 1px.
- Feet sit on the frame's bottom rows.
- Size classes step evenly. Draw each to a target inked area, not just a frame size, so small and large read as distinct steps.

| Sprite          | Frame                        |
| --------------- | ---------------------------- |
| Bird            | 48x42                        |
| Bird portrait   | 64x64                        |
| Ferret          | 64x80                        |
| Ferret portrait | 64x64                        |
| Pigeon          | 22x22                        |
| Pug             | 44x32                        |
| Pedestrian      | 34x50 (cat), 36x50 (raccoon) |

### Text

- Fonts: `font-body` (Tiny5, mixed case) for body text, dialogue and quips; `font-title` (Silkscreen, capitals) for titles and names. Button labels use `font-body`, mixed case. Both are native at 8px and drawn at 2x, so a line is 16 base pixels tall. Sprites keep 1px detail.
- Text holds 4.5:1 against what it sits on; essential icons and marks hold 3:1. A state never relies on colour alone.
- Text never shrinks to fit: reword it or grow the box. Each text role keeps one size and one font.
- Words in effects and labels are set in a font, never baked into sprites.
- A backdrop never shows its own place's name; the HUD names it.

## Chibi

Chibi is the male protagonist, a wide, round, cream-coloured bird drawn facing right and mirrored for left. `art/tools/bird.py` draws his; its docstring gives every frame's pose, timing and squash and stretch table.

- Shape: a wide, round blob of a body with a small round head set into its top at the front, a square ink dot eye and a short, plain orange bill. His back dips at the nape, so his round head sits up above the back line, and ends in a short tail tip at the rear. No bow.
- Colour: cream, with tan cel crescents and a white rim light. The wing is a flat tan patch, the feet tiny orange stubs. Dark-slate outline.
- Every jump flutters (a slow, steerable fall), so the flutter is his signature: the wing raised up and back from the top of his back, the body 2px higher, and the feet tucked under his belly.
- Frame 48x42, feet on rows 39 and 40 and the outline on row 41.
- Collision body 24x36 (2x3 tiles), anchored bottom-centre: the frame's bottom edge sits on the body's bottom edge, and his body-centre x, 24 (the frame's centre line, between columns 23 and 24), sits on the body's centre, so mirroring him does not move it.
- Overhang of the 24x36 body at rest: his back and tail 8px on the left, his head and bill 10px on the right, and 2px of the body's height above his head left empty. The raised wing reaches 5px above the body, and the jump crouch and land squash push his tail out to 12px on the left.
- Portrait: 64x64, his head set into the top of his body, facing right, cut off by the bottom edge, with one ink outer line on a transparent ground. The dialogue box's 68x68 frame supplies the backing.

## Logo

The logo uses a full canonical cream bird standing on a simple platform above a flat dark-steel sign carrying the Chibi's Way Home wordmark. `art/tools/logo.py` draws three transparent PNGs with declared canvases: `logo` (558x193) for the title screen, `logo-nav` (226x30) for the site's nav bar, and `logo-icon` (53x41) for the /play/ nav column. The nav mark has one line of lettering beside the bird; the icon shows the bird and platform without lettering.

- The dominant lettering and platform colour is `zone-blue`. The flat dark-steel sign, quiet light edge and ink outline separate the wordmark on pale steel and dark navy. There is no extrusion, bright cyan highlight or drop shadow.
- The bird retains the protagonist's cream body, tan wing, orange bill and ink dot eye, redrawn from the canonical sprite shapes with a one-pixel outline.
- The title is supplied by `WORDMARK`; the 5x7 alphabet in `GLYPHS` provides its letters. All three image keys, paths and canvas sizes stay fixed so navigation and title-screen placements remain compatible.

## Stage cutscene placeholder

<!-- CLEANUP (added 2026-10-31): Replace the neutral illustration when authored stage cutscenes are approved. -->

`art/tools/cutscene.py` draws `stage-cutscene-placeholder`, a plain opaque 720x360 image registered under `images`. Its neutral palette and canonical bird add no plot, location or dialogue. Keep the bottom 80px quiet for the runtime's standard Continue button; the image contains no words or controls. Gameplay owns the transition and its text.

Map travel reuses the existing `bird` sprite's looping `walk` tag, four 130ms frames on the 48x42 canvas, with bottom-centre anchor 24,42. Direction uses horizontal mirroring, and a stopped bird can return to `idle`. No separate map character artwork is required.

## Furt

Furt is the champagne ferret standing up on his hind legs in a stovepipe hat and bow tie, a talking animal that schemes against the bird's climb: in dialogue, in quips and through the hazards it sets. It is cute with a touch of slyness (round glinting eyes under a soft lid, a small smile, steepled paws), never scary or cross, and is never fought. `art/tools/ferret.py` draws it; its docstring gives every frame's pose and timing.

- Shape: modelled on a natural ferret rather than a chibi. A long, slinky body stood upright with a small forward arch (a Bezier spine from the low hip to the high neck, stamped as overlapping discs), a small wedge head held level, short dark legs, and a tapering tail touching the ground behind as a third contact point.
- Fur: a champagne (skin1) coat with a skin2 shade crescent along the belly and a cream rim on the back; brown legs and tail with dark-brown far legs; a white face band, a skin2 mask round the eye and a pink nose.
- Eyes: round, 5px across with the corners cut, ink with a 2x2 white glint and a 1px cream glint, under a soft brown lid line that dips at the outer corner. Scheming, the lid drops to half.
- Kept apart from the bird: the coat is 1.24:1 against her cream and the shade 2.12:1, its outline is dark brown where hers is dark slate, its legs, tail and mask sit well below anything on her, and it stands tall where she is round.
- Hat: a tall, narrow plum stovepipe with a dark-brown rim light and a red band. Nothing touches it. Red (the band and bow tie) is the one accent; the hat and bow tie take an ink outline.
- Frame 64x80, facing left (mirrored for right), feet on rows 76 to 78 and the outline on row 79.
- Anchor: the frame's bottom edge sits on the collision box's bottom edge, and its body-centre x, 32 (between columns 31 and 32), sits on the box centre, so mirroring it does not move it.
- Portrait: 64x64, its head and neck facing right towards the text, as the bird's does, cut off by the bottom edge, with one ink outer line on a transparent ground. Neutral, smug (the lid at half) and annoyed (a brow dipped towards the snout).

## UI

The [form control style guide](controls.md) defines standard buttons, selection controls, shared states, spacing and explicit exceptions. The screen layouts below specify their placement.

All positions are in base pixels (x, y, w, h) of the 720x360 layout as drawn. The game derives every press area from the drawn button at runtime: the button plus 25% of its shorter side on each side, clamped between 6 and 16px, and at least 48x48. Use and Jump instead press within 100 of each one's centre (a clear circle of 63 plus the move hint's radius of 37), cut along the line midway between their centres so the two never overlap; Jump's also reaches the screen's bottom-right corner, as the rect from its centre to the corner. Art gives only the drawn rects and centres.

### Dialogue box

- The dialogue panel is at the top, 40,8,640,96. One paragraph of at most three lines shows at a time; advancing replaces that paragraph rather than adding a chat history. Play is frozen and touch controls hide while the conversation is open.
- The bird's portrait is on the left. Other speakers' portraits are on the right; consecutive paragraphs from the same speaker keep that side. Reposition the 68x68 portrait frame and 64x64 portrait without mirroring either artwork.
- Name tabs sit inside the panel. Their fill is the speaker's colour: amber, green, pink or tan. Ink text holds at least 6.6:1 on each, and each holds at least 5:1 on the panel's navy.
- Continue is the primary `ui-button-primary`, 488,112,192,48, with a white label. Skip is the secondary `ui-button`, 288,112,192,48, with an ink label. Both remain visible below the panel, separated by 8px; labels begin 13px below the top and sink 2px when pressed. Primary actions omit the dark play mark.
- Continue advances the current conversation. Skip skips its remaining paragraphs but opens any required terminal choice without selecting an answer. A required choice uses a modal card with ordinary form buttons; while it shows, Continue and Skip underneath cannot activate. No live conversation currently configures a choice.

| Speaker | Portrait frame | Portrait origin | Name origin | Paragraph origin and width |
| ------- | -------------- | --------------- | ----------- | -------------------------- |
| Bird    | 48,22,68,68    | 50,24           | 124,13      | 128,42, width 504          |
| Other   | 604,22,68,68   | 606,24          | 84,13       | 88,42, width 504           |

Both paragraph regions use `font-body` at 2x with a 20px line pitch. Labels, portraits and text move as layout elements; their textures keep their authored orientation and scale.

### Stage progress and retry

Approved target for paired runtime integration. The rulebook owns failure behaviour, timing, progress calculation and time accumulation; the game supplies every label and value.

- Progress is a restrained 2px line at the top of the game view. Its filled length shows percentage through the stage, using the current destination's canonical primary from `zone-themes` over a `dslate` track. Keep it separate from UI buttons, with no glow or pulse.
- On failure, show a small recoil, a pronounced falling tilt to support, a brief impact squash and a small rebound into a round grounded sit. Its belly has a short flat centre and rounded contact ends. Feet remain visible during recoil and fall, and are hidden during impact and seated rest. Keep the camera at the failure view; the sprite has no baked world movement. Show the retry card as soon as the seated pose is reached, holding that pose beneath it without an extra timed pause or automatic retry.
- Dim the frozen environment two palette ramp steps. Keep the bird and the small hazard contact area readable at their world positions, without an added ring or flash. The compact card stays above the ground-level contact area rather than covering it.
- Reuse the content-fitted `ui-settings-card`, top-centred at y16, with no close X or title bar. Its four text rows stay in this order: zone name; `Stage <number>: <stage name>`; `Progress: X%`; `Time: 0:00`. Stage numbers are 1 or 2 within the selected zone, not global route numbers. Keep the standard fonts and sizes; never shrink text to fit.
- Use the [shared modal content-fitting rule](controls.md#modal-content-fitting): 16px padding on all four sides, four 16px text line boxes with 4px gaps, then an 8px gap before the 48px action row. Each equal-width action fits the widest action label's visible ink plus 32px. Apply the shared 320px minimum and safe-view cap to the larger of the widest stat line and the complete action row, plus 32px; card height is 164px for four single-line rows.
- Measured example: Blue cityscape / `Stage 2: City boundary`, `Progress: 50%`, `Time: 0:42`. The widest stat ink is 152px; Back to title is 82px wide and Try again is 60px at 2x. Equal 114px actions with their 8px gap make a 236px action row. Its natural padded width is 268px, so the 320px minimum determines the fitted 320x164 card, top-left 200,16 in the 720px view. The action row remains centred without stretching its buttons. Glyph ink is centred in its line boxes without changing font size. Longer actual strings grow the fitted width or wrap permitted paragraphs.
- The time is cumulative play time on this stage across attempts since its last clear (or first entry). It is not the current attempt's duration and resets on clear. Progress is percentage at the current position through the stage.
- Place the secondary Back to title action on the left and primary Try again on the right, using the standard faces, equal sizes, label font and focus treatment in [the form control guide](controls.md#retry-actions). Neither an outside tap nor an elapsed timer retries the stage.

### Quip

A one-line strip at the top centre (x 360), y 8, height 24, sized to its text and at most 452 wide (x 138 to 590), led by the speaker's name in their name-tab colour. It never pauses play and never reaches the lower corners.

### Touch controls

Two round buttons for the right thumb, Use above and to the left of Jump. Each is the move hint's open ring, 73px across with no face: a 2px cream band between 1px ink lines, with its icon centred and fringed in ink, so it holds 3:1 on any ground, the sky and any character. No label. Hidden on desktop and when the setting is off.

| Control | Centre, as drawn | Frame | Ring      | Icon       |
| ------- | ---------------- | ----- | --------- | ---------- |
| Use     | 592,210          | 75x75 | 73px wide | three dots |
| Jump    | 667,307          | 75x75 | 73px wide | caret      |

- Centres are the base 720x360 layout, as drawn. At runtime the game anchors Jump, Use and the pause button to the screen's corners, so on a wide or tall screen they sit in the spare space outside the game.
- Press: the band and icon turn white and the ring swells 1px for the first frame (frame 0, then frame 1, 60ms each), then hold until release, which snaps back to rest.
- Movement: a touch anywhere off a button sets its own neutral point. The move hint (`ui-move-hint`, 75x75) shows where to put the left thumb: an open ring 73px across with no face, a 2px cream band between 1px ink lines and an ink-fringed chevron each side, so it reads on any ground, the sky and any character. It is a drawing only, with no press area. At rest its centre is level with Jump's and its ring as far in from the view's left as Use's is from its right: 121,303 at 720 wide. While a touch moves her, the game draws it on that touch's neutral point, anywhere on screen, lights the dragged side's chevron (`held-left`, `held-right`) and slides its knob (`ui-move-knob`, 11x11) up to 12px left or right; on release it returns to rest.

### Start screen

The game boots into the start screen; Start goes to the map. A nav bar runs across the top with icon buttons at its right, and Start sits below the logo.

- Nav bar `ui-nav-bar`, 0,0,720,48.
- Icon buttons `ui-icon-button`, 36x36 at y 6, each with a 20x20 icon 8 in and 6 down (8 down while pressed). With Exit: Settings at x 632 and Exit at x 676, so Exit is at the far right. Without Exit (Firefox for Android's installed app hides it): Settings alone at x 676.
- Logo (`logo`, 558x193) at 81,60, with Start (`ui-button-primary`, 192x48, dslate with a white label) at 264,268, 15 below it. With saved progress, Restart uses the secondary `ui-button` (grey with an ink label) at 164,268 on the left, and Continue the primary style at 364,268 on the right: both 192x48, with an 8px gap, centred under the logo. Continue remains the default action for keyboard activation. Nav and icon controls keep their separate styles.
- Icons share their shapes with dog-walker-game's: the cog (8 square teeth round a ring with a round hole), the exit (a doorway in 2px strokes, open on the right, with a solid arrow leaving it) and the home (a solid house with a 1:1 pitched roof, a chimney on the right slope and a door gap). Each comes as a 20x20 nav icon and a 16x16 row icon.
- Button labels are centred: origin x = the button's centre x minus floor(ink width / 2), where the ink width is the label's visible width. Start-screen labels begin 13px below the button top and sink 2px while pressed, using the shared text-button press and focus handling. Start and Continue on this screen omit the ink play mark, which does not read on dslate; a light variant remains unimplemented. The map uses the same standard primary and secondary button styles.

### Pause, settings and install cards

A pause button at the top left opens the pause card over the game, dimmed two palette ramp steps. The pause card offers Resume, Settings and Back to title, stacked in that order with Resume primary. Settings replaces it over the same dim, and Install opens the browser-specific steps. One card shows at a time.

Every ordinary modal uses the [shared content-fitting rule](controls.md#modal-content-fitting): its actual title, full positioned close press target, body rows and actions determine its size. Ordinary body content keeps 16px clear padding and a 320px minimum panel width, capped at the safe available view. The shared `MODAL_CONTENT` and `modalWidth` rule in the control guide add outer padding once; height remains content-fitted without a minimum. This is not a fixed modal canvas. A 24x24 close face sits exactly 6px from the panel's top and right edges and retains its 48x48 press target. Reserve the full positioned close target plus an 8px gap symmetrically around the centred title. Keep every other interactive control's expanded press rectangle below that target plus the same gap; never clamp or shift the close target to fit the panel. The pale steel `ui-settings-card` frame has an ink border, no title bar, an ink title and an ink close X where closing is allowed. Text remains at its normal size. Settings rows have no box: a dslate icon, ink label and switch or compact action form a measured group, and the complete 48px row responds.

- Pause button: a disc 33px across (an ink edge, a 2px cream ring and a navy face, the ring white and 1px thicker and the face a step lighter while pressed), with two pause bars and no label, centred at 24,24 as drawn (35x35 frame, top-left 7,7), its edge 8px in from the game view's top and left. Every control stays inside the view across; Use, Jump and the move hint sit at the screen's bottom, so on a screen taller than 2:1 they move into the bar below, with Jump's ring 8px in from the view's right and 20px up from the bottom, and no drawn edge closer than 8px to the edge it is placed against. It is a touch control: hidden on desktop and while a dialogue box is open. Its press area is the drawn frame grown by the rect rule above.

| Card     | Title    | Contents                                                                        |
| -------- | -------- | ------------------------------------------------------------------------------- |
| Pause    | Paused   | Resume, Settings and Back to title buttons                                      |
| Settings | Settings | Move controls and Action buttons rows; Install only when available; build label |
| Steps    | Install  | Two browser-specific instruction steps                                          |

- Buttons: `ui-button-primary` has a dslate face on a navy lip with a white label; `ui-button` has a grey face on a slate lip with an ink label. Both keep their 16x28 nine-slice shape and margins 2,4,2,6. Labels sink 2px while pressed. Equal actions share a width measured from their content, with the standard padding and gaps.
- Settings rows: `icon-move-controls` and `icon-touch-controls` remain 16x16; `ui-switch` remains 32x16. Its knob is right with a tick on green when on, left with a cross on slate when off. Rows align their icon, label and switch within the fitted content column. Hiding a control hides only its drawing.
- Install row: its 16x16 icon and compact secondary action form one full-height interactive row. Removing Install also removes its row and gap before the build label; no blank slot remains.
- Build label: dslate in `font-body`, centred within the fitted card and included in its measured content.
- Keyboard focus: `ui-focus`, with nine-slice margins 4, stays 4px outside the focused element on every side. Its 2px yellow band between ink lines remains visible on the card, rows, buttons and dim. Focus follows each fitted row, button or close control.
- Install steps: each uses a 16x16 glyph and up to two lines of text at the existing font size. The first shows Share or the browser-menu glyph; the second shows the install glyph. Fit the frame to the actual wrapped steps and close control instead of a shared modal canvas.

### Update notice

The update notice is an ordinary modal over the dimmed home view. It has the title Update available, one primary Update now button and a close X that defers the update. It needs no redundant body paragraph or separate Later button. Runtime presents it once per home visit or notice-mode change; only the explicit Update now action accepts, never a tap on the card face. The game supplies the words and behaviour.

- Assets: existing `ui-settings-card`, `ui-button-primary` and `ui-close`, with the standard 2x title and body fonts. Use the ordinary focus, press and dismissal treatment, without new art or palette colours.
- Fit: apply the [shared modal sizing rule](controls.md#modal-content-fitting), with a 320px minimum width capped at the safe available view, 16px ordinary body padding and the close face's separate 6px top-right inset. Height remains content-fitted. The header accounts for the entire positioned 48px close press target, not only its face. Keep at least an 8px gap between the close target's bottom and the primary action's own expanded press target, not merely its 48px drawn face. Centre the title across the card, reserving the full target and its clearance symmetrically.
- Measurement: derive the header from the actual title ink plus the mirrored 50px close-target reservations. Fit the primary action to its visible label with the standard content padding, and place its complete expanded press target below the y50 clearance. Apply the shared minimum-width rule to the measured content width, excluding outer padding from its input. Derive the card height from the actual bounds and ordinary body padding, without a minimum height. Longer copy grows the frame rather than shrinking the font or forcing a shared modal size.

## Map

The map presents the six V1 zone destinations on a cool pastel overview. `art/tools/map.py` draws the frame, zone markers, theme icons and small regional illustrations. Names, availability, stage choices and route positions belong to game data; the illustrations describe themes, not playable layouts.

| Destination          | Grid centre (col,row) | Pixel centre | Icon and region suffix |
| -------------------- | --------------------- | ------------ | ---------------------- |
| Blue cityscape       | 10,7                  | 126,90       | blue-cityscape         |
| Industrial outskirts | 29,7                  | 354,90       | industrial             |
| Countryside          | 48,7                  | 582,90       | countryside            |
| Woodland             | 48,18                 | 582,222      | woodland               |
| Home city            | 29,18                 | 354,222      | home-city              |
| Apartment            | 10,18                 | 126,222      | apartment              |

- Frame: `map-paper`, a 32x32 nine-slice with margins 13 on each side, drawn at 0,0,720,360. Its face is lgrey with grey and slate inset rules. Text and meaningful marks are ink, dslate, navy or slate. Selection uses dslate, never lethal red.
- Regions: `map-region-<suffix>`, 120x60, tag `rest`, at cx-60,cy-36 behind paths and markers. The destination's muted primary dominates its building, field or tree silhouettes. The central opening leaves each marker clear. These illustrations remain visible for locked and unbuilt destinations.
- Route: one linear path follows the table's order, left to right across the top row, then right to left across the bottom row. There are no fork markers on the V1 route. Runtime paths use 4px solid dslate for open paths, 2px slate dashes (6 on, 4 off) for built paths still locked, and 2x2 slate dots every 6px for unbuilt paths. State is carried by the pattern as well as colour.
- Zone marker: `map-zone`, 35x35 centred on the node. `normal` is a cream disc with a dslate ring; `current` adds a second dslate ring; `visited` is navy with a cream tick badge. `locked` replaces the zone icon with a dslate padlock. `unbuilt` uses a broken slate ring and a question mark. Tags retain their existing order and frame indices.
- Zone icons: `map-icon-<suffix>`, 14x14, centred on normal, current and visited markers. Both tags use a muted primary backing with an ink landmark and a dslate outer edge. The visited marker's navy disc and tick carry completion. Locked and unbuilt markers show no icon. `map-icon-street` and `map-icon-zone` remain available for other maps and unspecified icons.
- Bird: `map-bird`, 26x22, tag `idle`, two frames at 400ms. He stands above the current node's ring, top-left cx-13,cy-39. The current marker's double ring also carries selection when the bird is not visible.
- Labels: names in `font-title` at 2x, ink, centred below the markers. Names fit within 212px of visible ink, leaving at least 16px between adjacent 228px-spaced centres. With advance width A, origin is cx-floor((A-4)/2)-2,cy+12, so visible capitals occupy cy+20 through cy+29. An lgrey knock-out behind the name keeps paths and regional art clear of the letters. Optional availability text uses `font-body` at 2x, dslate, origin cy+32, with strings supplied by gameplay.
- Footer: Back to title uses secondary `ui-button` at 164,300,192,48, with an ink label; Continue uses `ui-button-primary` at 364,300,192,48, with a white label. Neither uses a play mark. Continue is the default keyboard action; a tap on an open zone marker selects that destination.
- Legacy assets: `map-fork`, `map-hill`, `map-wave` and `map-compass` remain available. The six-destination layout does not require fork or pen-mark decorations.

### Stage picker

Selecting a zone with only one unlocked stage enters that stage directly. With more than one unlocked stage, the picker reuses the standard modal card and controls, with no new asset shapes.

- Frame: content-fitted `ui-settings-card`, centred in the view, with the zone heading and 24x24 close X included in its measured header. Apply the shared 16px body padding and 6px top-right close-face inset; reserve the whole 48px close press target in the header.
- Rows: two standard 48px stage actions stacked with the shared gap and equal content-fitted widths. The latest reached available stage uses `ui-button-primary` and white text; the other uses `ui-button` and ink text. Labels use `font-body` at 2x, centred with the standard button-label inset.
- Return: close, back and outside taps close the picker and return to the map. No extra Back button repeats the close action. The normal modal input isolation and keyboard focus apply.
- Unbuilt stages stay unavailable. A preview showing two unlocked choices illustrates the future state, not the current content's availability.

The celebration and restart screens remain placeholders using the standard card and buttons.

## Animation

- Motion is in whole pixels. Tag names are the animation names. New tags go after existing ones so frame indices hold.
- Squash and stretch are per-frame tables of height, squash, stretch and shadow size. Volume stays roughly constant during normal locomotion; the death squat deliberately deflates it. The contact frame's shadow is the largest. Effects have a clear peak frame.
- Short reactions run 60 to 80ms per frame (shake 60ms, tap burst 4 x 60ms). Anything that opens a modal waits for the tap burst to finish.

### Failure poses

The bird's 48x42 `death` tag is appended after `land`, leaving all earlier frames and tags unchanged. Relative frame 0 is the small recoil with visible feet, frame 1 a pronounced falling tilt with visible tucked soles, frame 2 a brief stronger impact squash and frame 3 a full, round seated rest. The last two poses hide the feet completely. The seated body is 34x21 with a nearly full-height head, a short flat belly centre and rounded contact ends resting at the frame bottom; it springs slightly up from the 38x16 impact pose rather than holding a flattened body. `death` plays once and holds its last frame. Its authored durations are 100, 120, 80 and 400ms; these are art playback defaults, not gameplay state durations. Runtime holds frame 1 until support is reached, then plays frames 2 and 3 once. The retry card opens when frame 3 is reached, with that seated pose held underneath it. Keep the body-centre and frame-bottom anchor fixed across the poses; world movement belongs to the runtime. Existing `jump` and `land` do not supply the seated terminal pose.

### Enemy frustration

The shared stage-enemy reaction uses the looping `frustration` tag. The cycle has four 120ms frames, lasting 480ms before repeating. Its head, paw, wing or ear gesture clearly differs from standing rest and preparation, while retaining the animal's cute silhouette. No world movement, text, effect outline or new story is baked into the reaction.

The new frames follow every existing tag without changing their global frame indices, pixels or timings. Frame sizes, bottom-centre anchors, fixed contact boxes and mirrored bounds remain unchanged. `once` remains empty, so the runtime may keep playing the loop while the route is blocked. Gameplay owns the state duration, target loss and recovery transition; its state name may differ from the animation tag. Contact remains lethal throughout the reaction. Existing dialogue portraits and the original story ferret are unchanged.

### Cycles

| Cycle           | Frames | Timing       | Motion                                                                                     |
| --------------- | ------ | ------------ | ------------------------------------------------------------------------------------------ |
| Idle, character | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted                                    |
| Idle, prop      | 3 to 4 | 2 to 5s loop | Holds the rest pose most of the loop, then steps away and back over 2s or less             |
| Walk, four legs | 4      | 100 to 160ms | Diagonal pairs swap, the body bobs on passing frames, ears lag 1px                         |
| Walk, two legs  | 4      | 100 to 160ms | One foot lifted, passing (both feet down, body 1px higher), the other foot lifted, passing |

- Frame 0 of every idle is the rest pose, and every sprite that stands or waits loops one.
- A prop's idle changes colour in 2px clusters, never as a hard blink, and never brighter than the rest pose.

### Character states

A placed thing combines an archetype (its behaviour), a character configuration (its canonical animations, hit box, dialogue and quip pools and quirks) and an instance (one placement). Its resolved skin supplies compatible artwork. A character's data names the tag that plays for each state, so every character sprite lists its tags by state (idle, move, react, talk, quirk) in its script docstring and in the table below. A state with no tag of its own says "none" or names the tag it falls back to. A state with more than one tag names each.

| Character          | idle   | move                                         | react                        | talk                       | quirk    |
| ------------------ | ------ | -------------------------------------------- | ---------------------------- | -------------------------- | -------- |
| bird               | `idle` | `walk`; in the air `jump`, `flutter`, `land` | none, falls back to `land`   | none, falls back to `idle` | none     |
| ferret             | `idle` | none, falls back to `idle`                   | none, falls back to `scheme` | `talk`                     | `scheme` |
| frog-courier       | `idle` | `ride`                                       | none, falls back to `idle`   | none, falls back to `idle` | none     |
| pigeon             | `idle` | `fly`                                        | `flee`, then `fly`           | none, falls back to `idle` | none     |
| dog-pug            | `idle` | `walk`                                       | `perk`                       | `talk`                     | none     |
| pedestrian-cat     | `idle` | `walk`                                       | none, falls back to `idle`   | none, falls back to `idle` | none     |
| pedestrian-raccoon | `idle` | `walk`                                       | none, falls back to `idle`   | none, falls back to `idle` | none     |

- ferret-trap-snap is a hazard, not a character: it has no character states, only `set` and `snap`.

### Reduced motion

- Every loop shows frame 0, and effects hold their peak frame.
- A white flash becomes one 120ms blink.

## Effects and lighting

### Lights

- Lights are data, not baked pixels. Art writes `lights.json`: each light is an ellipse, band (rect) or cone, with a width and height at full size, a palette colour, and 1 to 3 hard concentric rings, outermost first, each brighter.
- The game draws lights additively, over the ground and under the sprites. Hard rings keep it pixel art, and because they add rather than cover, the ground's texture shows through.
- Lights read on dark ground. On mid or pale ground they read as stains: use softer rings, or none by day.
- Glow is amber, never cream or gold, which go grey or khaki.
- Tune strength by rebaking several levels on the same paused frame and comparing them side by side.
- A sprite attaches its lights by offsets from its feet, mirrored on the other side, limited per zone, optionally pulsing with its idle. A cone shines from a lit bulb pixel drawn on the sprite (a white core with a cream ring).
- Cull a light by its own rect, never its emitter's.
- Space repeated lamps in an even rhythm, not randomly.

### Hit effects

- An impact frame is an eight-point star in the event's colour with a white core.
- Edge flashes pair a light ink with a dark fringe on the inward edge, so they hold 3:1 on light and dark grounds.

## Hazards

A hazard restarts the floor on contact. `art/tools/hazards.py` draws the hazard sprites and `art/tools/floor1.py` the hazard tiles; their docstrings give every frame and tile.

- Every hazard sprite has an ink outline, so it holds 3:1 on every street ground, and is drawn at outdoor scale beside the bird.
- Steel (the hatch and its leaves, the bike's wheels) uses the slate ramp (slate, dslate, navy), not grey: the leaves are slate because dslate does not separate from the dark facades in greyscale.
- The ferret's calling card: every trap the ferret sets carries his badge, a 13x13 cream plate with his hat-and-bow mark (a plum stovepipe with a red band over a red bow tie). `badge()` in `hazards.py` draws it for every trap. A floor's own hazards (traffic, open hatches) never carry it.

| Hazard           | Kind                                                          | Size                        | Collision                                    | Tags and timing                                                      |
| ---------------- | ------------------------------------------------------------- | --------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Cellar hatch     | tiles in `tiles-street`: `hatch-left`, `pit-*`, `hatch-right` | any width; leaves 2 rows up | edges solid; `pit-*` none, she falls through | none                                                                 |
| frog-courier     | sprite, a frog on a delivery bike, facing right               | 60x36 (5x3 tiles)           | hit box 6,6,48,30                            | `ride` 4 x 100ms, `idle` frame 0 at 400ms                            |
| ferret-trap-snap | sprite, the ferret's giant spring mousetrap with his badge    | 50x26 (about 4x2 tiles)     | hit box 4,14,42,12                           | `set` 1 x 400ms, `snap` 60, 60, 80, 80ms, plays once and ends closed |

- Cellar hatch: on the sidewalk row `hatch-left`, one `pit-opening` per opening tile, `hatch-right`; `pit-opening` down every row below the opening; `pit-leaf-left-top` over `pit-leaf-left` above `hatch-left`, and the right leaf above `hatch-right`. It reads as a hole from several tiles away: two steel leaves standing up over a dark gap in the sidewalk line.
- frog-courier rolls back and forth along the sidewalk and is mirrored for left. Its wheels roll without slipping at 51 px/s; the hit box leaves out his eye bump, the bag's top and 2px of each tyre.
- ferret-trap-snap waits on `set` and plays `snap` once when the bird touches its hit box.

## Animal placement

Every non-player animal in the main stage or foreground is an enemy. Read an enemy from its silhouette, movement and stronger colour against the muted environment, without a red contact rectangle or red silhouette outline. Natural coloured sprite outlines remain part of the house style. The shared red bands still identify dangerous terrain surfaces.

Friendly animals appear only as muted background flavour, never in the foreground, or inside rooms reached through doors for shops, quests and conversations. Background animals stay below play in contrast, saturation and detail; their placement never suggests a usable platform or foreground interaction. There are no friendly animal background replacements in the current scenery. Stage enemies use their dedicated antagonist artwork; room casts are retained.

## Street cast

The character catalogue drawn by `art/tools/cast.py` is retained for room use and reference, without current world placements. Its docstring gives every frame. These assets have no portraits or hit boxes; they are not foreground friendly animals or pickups. Their existing brighter palettes must be muted before any future background flavour placement. Each faces right (mirrored for left) at outdoor scale beside the bird, with its feet on the frame's bottom rows and its body centre on the frame's centre line, so mirroring it does not move it. Outlines are coloured: two ramp steps darker, stepped further down until they hold 3:1 on the sidewalk.

| Key                | Character                                                        | Frame | Tags and timing                                                                               |
| ------------------ | ---------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| pigeon             | a small pigeon at true street scale, placed in groups            | 22x22 | `idle` 600, 140, 140, 140ms (stand, peck, stand, peck); `flee` 2 x 80ms, once; `fly` 2 x 90ms |
| dog-pug            | a fawn pug with a black mask and a sky-blue collar               | 44x32 | `idle` 2 x 400ms; `walk` 4 x 120ms; `perk` 2 x 80ms, once; `talk` 2 x 150ms                   |
| pedestrian-cat     | an orange tabby in a mauve coat with a cream tote bag            | 34x50 | `walk` 4 x 140ms; `idle` 2 x 400ms                                                            |
| pedestrian-raccoon | a knitted-style raccoon: cream face band, ink masks, banded tail | 36x50 | `walk` 4 x 140ms; `idle` 2 x 400ms                                                            |

- The pigeon flees in two steps: `flee` plays once (crouch, leap) and the game then loops `fly` while it moves the pigeon up and away. It reads at 1x by its grey body, lgrey rim light, bold green-and-mauve neck sheen and pink feet.
- The cat has the coat body: a big round head over an A-line coat and two stub legs. The raccoon has its own front-on body after a knitted raccoon: a cream face band over ink masks, a wide round muzzle and belly, its head low on a round body, and a banded tail. Both walk the two-leg cycle: a foot lifted 2px, passing (body 1px up), the other foot lifted, passing.

## Dog antagonist

The sprite and portrait integrate with the dog encounter and its frozen introduction. The runtime selects the movement-state animation without drawing a red contact outline. The pug remains a separate retained asset, with no current world placement.

`dog-antagonist` is a separate floppy-eared, ochre-and-brown dog, drawn facing right in a 60x40 frame and mirrored for left. It does not repurpose `dog-pug` as an enemy. The brighter coat separates the animal from the muted blue environment; the long floppy ears and round cream muzzle identify it independently of colour.

The contact box is fixed across all poses: x 2, y 2, width 56, height 38, in frame pixels. The contact box is collision data, not a visible red rectangle or silhouette outline. The sprite has no baked red danger line. All drawn body parts remain inside the contact envelope, which does not shrink when the dog crouches or rests. Contact is always lethal; a crouch or rest is a movement cue, never a safe state.

| State  | Tag      | Art cycle               | Pose                                     |
| ------ | -------- | ----------------------- | ---------------------------------------- |
| Crouch | `crouch` | one frame, 400ms        | body low and legs tucked before the rush |
| Idle   | `idle`   | two frames, 400ms each  | breathing with feet planted              |
| Patrol | `walk`   | four frames, 120ms each | alternating legs and a small passing bob |
| Rest   | `rest`   | two frames, 400ms each  | settled body after the rush              |
| Rush   | `rush`   | two frames, 80ms each   | stretched body and reaching legs         |

These animation tags are available as loops. The runtime selects a tag for each active gameplay state. Gameplay data owns the duration and transition of patrol, crouch, committed rush and rest; art cycle durations do not set encounter timing. The five-column by four-row placement (60x48) bottom-anchors the 60x40 frame, putting the contact box ten pixels below the placement's top and ending at its bottom.

`portrait-dog` is 64x64, authored facing right, with the matching floppy ears and coat, an ink outline and a transparent ground, cut off at the bottom. Its `neutral` tag is one frame at 1000ms. It uses the existing dialogue portrait frame; no proper name or specific breed is encoded in the art.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

## Environment aesthetic

Every environment theme (a zone's street, a chunk theme's park) follows these rules. The park theme (`art/tools/park.py`) is the reference; its values are given after each rule.

- One sky hue and a limited, tonal palette built around it. Every background layer is a step or two along that hue's ramp, and saturated colour is kept for the few things that matter. Park: a skin1 (`#e8b796`) sky, stepping to tan (`#e4a672`) from y 200 behind play.
- Background layers read as atmosphere: the far city, the distant trees and the tall treetops sit close to the sky's value and saturation, low in contrast, and step down in value only slightly as they come nearer. Park: the city and the treetops' base skin2 (`#c28569`, 1.46:1 against the tan sky), shaded brown (`#b86f50`), lit tan; no windows in the far city.
- Walkable tops are the brightest edges in the scene: a 2px light lip under a 1px dark edge. Against darker scenery the lip holds at least 2:1 in greyscale; against pale sky the dark edge carries separation. Cream (`#ead4aa`) is the default lip; use white where cream falls short. Park: cream on grass, paths, benches and branches (2.12:1 against skin2); white on the stone stairs and the bandstand roof, which stand against the tan treetops (2.10:1, where cream would be 1.45:1); dark edges dark green, dark brown or plum.
- Ground is a bright top band two or three rows deep over a soft, low-contrast fill, never a busy or dark mass. Clusters in the fill are 2px and sparse (about one tile in five), and an exposed side shows a narrow band of a darker step. Park: a grass top (dark-green edge, cream lip, green body) over a green turf row with 2px dark-green roots, then brown soil with dark-brown 2px pebbles; a 3px dark-brown band and a plum edge on an exposed side.
- Tree crowns are lobed and cel-shaded, never round blobs: a mass of overlapping lobes in the shade colour, the base colour over it a little up and left, then a few small lit lobes on the top-left only, so the edge is broken and no colour sits as a round blob inside another (a round orange or gold blob reads as a coin). Park: near crowns rust over dark brown with ochre lit lobes; background crowns skin2 over brown, unlit.
- Steps are soft: a step of 1 or 2 rows is a tap's walk-up, drawn as a rounded grass lip with a stone stair tread on about every other step; a taller terrace face is turf over soil, any height. Collision is the full tile, and there are no slopes. Park: steps 2 columns deep and 2 rows high; terrace faces run `soil-left` or `soil-right` down under the turf.
- Saturation is spent where it matters: the walkable lips, the hazards, the accents that guide the eye (an awning, a lit door, a crown in the foreground). Props and backdrops otherwise stay within the palette's tones.
- Hazard surfaces use the same flat red contact band in every zone, never spikes, a safe light lip or a pickup shape. The pond and thorn images remain in the asset catalogue for compatibility; new contact-edge obstacles use the shared strips.
- Zone 1, the street, is the cool counterpart: a pale steel morning. Its sky is flat lgrey (`#c0cbdc`); separate window-free city silhouettes use grey (`#8b9bb4`) and slate (`#5a6988`); buildings and shopfronts are slate, dslate and grey with quiet dslate windows; the sidewalk is a white-lipped pale concrete band (lgrey slabs) over a slate face; every ledge pairs a navy edge with a white lip: white holds 2.82:1 against grey and 5.51:1 against slate; navy holds 8.48:1 against the pale sky; the warm accents are the ochre-and-cream awnings, the cream sign icons and the amber door and cab. `floor1.py` draws the pieces with warm ramp names and recolours them through its `COOL_*` maps.
- Repeating backdrops tile at widths that divide 720, so seams never show.
- Every scene is checked in greyscale: each walkable top separates from what is behind it, the ground band reads over its fill, and the background stays behind play.

## Modular platforming tiles

`art/tools/obstacles.py` builds `tiles-platforming`: 17 tiles, each 12x12, packed into a 96x36 PNG with eight columns. Solid blue blocks and one-way ledges assemble independently of scenery. A stage chooses the terrain look `platform`; individual characters can choose this tileset while their area uses a different theme.

- `one-way-ledge-left`, `one-way-ledge-middle`, `one-way-ledge-right`: thin safe ledges, transparent underneath. Only falling onto the top lands on them.
- `platform-bottom`, `platform-bottom-left`, `platform-bottom-right`: solid underside and lower corners for floating blocks and ceilings.
- `platform-face`, `platform-face-left`, `platform-face-right`: solid fill and exposed cliff or wall edges, repeated to any height.
- `platform-top`, `platform-top-joint`, `platform-top-left`, `platform-top-right`: solid safe tops, repeated to any width.

### Shared red contact edges

For a dangerous top, use a plain solid face under the hazard instead of a safe white-lipped top. All themes use the same flat strip: two pixels of Endesga red (`#e43b44`) with a one-pixel ink backing. No spikes. Contact with any part of the three-pixel strip restarts the stage at its beginning. These tiles are hazards with no solid collision; place them in the cell immediately outside the supporting solid, which retains its ordinary collision. Repeat horizontally for floors and ceilings, vertically for walls. The orientation names describe the face of the supporting solid, not the edge of the hazard's own cell.

| Tile            | Placement relative to solid | Hit box within its 12x12 cell (x, y, width, height) |
| --------------- | --------------------------- | --------------------------------------------------- |
| `hazard-bottom` | below                       | 0, 0, 12, 3                                         |
| `hazard-left`   | left                        | 9, 0, 3, 12                                         |
| `hazard-right`  | right                       | 0, 0, 3, 12                                         |
| `hazard-top`    | above                       | 0, 9, 12, 3                                         |

Red strips never carry the bright safe lip. Red is a consistent danger cue across zones; the contrasting ink backing keeps the thin edge visible against both pale and dark scenery. Gameplay chooses the placement and clearance, including dangerous ceilings over short-jump routes and dangerous sides beside landings.

## Zone 1: parcel depot and New York street

The first Blue cityscape stage has fixed start and finish sections with a seeded street middle. Its opening preserves the opened parcel, depot movement lessons and first dog introduction; the middle assembles reusable street chunks in randomized order. It is two screens tall: the sidewalk runs along the bottom and the buildings support climbs into the upper screen. `art/tools/depot.py` draws the depot modules and `art/tools/floor1.py` the street pieces. Their docstrings specify each reusable asset; gameplay data defines their arrangement.

- Depot: blue-grey ribbed wall modules, roller loading bays and cream parcel icons, with warm cardboard reserved for the opened parcel. No labels are baked into the art. The three modules are static backdrops with no collision, animation or interaction; gameplay places solid surfaces separately. All stay on the play plane, with parallax factors 1,1.
- Outdoor scale: the street is drawn as if zoomed out 4x while the bird and the 12px tiles keep their size. A storey is 180px and a door is about 45px, so the bird (42px) stands almost as tall as a street door.
- The street is 720px (60 tiles) tall: the sidewalk's top is y 600 (row 50), with sidewalk and road filling rows 50 to 59 below it so the camera can hold her feet two thirds down the screen. The ground storey runs from y 420 to the sidewalk, and storeys stack every 180px above: a two-storey roof is at y 240 (row 20) and a three-storey roof at y 60 (row 5), the tallest that fits. A water tower (its tank top 6 tiles above its roof) fits on a two-storey roof, not a three-storey one. Every street piece's bottom y below is in that frame.
- Street tiles (`tiles-street`): a pale concrete sidewalk (tops alternating with a 2px joint every 24px, ends, a slate face), a pale stone kerb where it meets a cross street, the road one tile lower, an ochre-and-cream one-way shop awning, a dark-brown one-way canopy with a white lip, a 2-tile planter with a hedge top, the cellar hatch and its pit, and the door as a 3x4 piece: a pair of lit amber glass doors, 36x48, the brightest thing at the door, for a room's door where the stage has one.
- Climbing tiles, appended so every earlier index holds: one-way fire-escape landings (black iron), window sills, a rooftop cornice and a water tower's flat top, each with left, middle and right tiles at any width. Every ledge's top carries the same 2px white lip under a 1px dark edge, so it reads against any facade in greyscale.
- Climbing backdrops: upper storeys and rooflines stack as reusable facade pieces. Standable ledges and solid faces come from modular tiles, placed independently of the scenery. Existing fire-escape ladder images remain available for compatibility; new platforming layouts use ledges and cliffs instead.
- Backdrops are modular: a sky and a far skyline of faded downtown skyscrapers in two layers that cover both screens and rise above the near roofs, one repeating facade per building type (one-storey, walk-up, brownstone, and a tall stone building), facade pieces, one storefront per shop, and street furniture placed singly (a cab, a hot-dog cart, a subway railing, a street tree, a walk signal, the doorman's podium, the canopy's poles). A cross street is a gap with no facade, where the skyline shows over the far avenue.
- The door, the canopy, `facade-hotel`, `hotel-crest`, `hotel-window` and the doorman's podium are generic building pieces, kept from the hotel this street used to belong to.
- Signs are icons, never text: a cup, a flower, a gift box, a lipstick, a paw, a fork and knife, a noodle bowl, and a crest.

| Backdrop                | Size    | Bottom y | Repeat |
| ----------------------- | ------- | -------- | ------ |
| street-sky              | 48x600  | 600      | x      |
| street-skyline          | 336x600 | 600      | x      |
| facade-one-storey       | 48x192  | 600      | x      |
| facade-walkup           | 48x312  | 600      | x      |
| facade-walkup-upper     | 48x180  | 288      | x      |
| roofline-walkup         | 48x48   | 108      | x      |
| facade-brownstone       | 48x312  | 600      | x      |
| facade-brownstone-upper | 48x180  | 288      | x      |
| roofline-brownstone     | 48x48   | 108      | x      |
| facade-hotel            | 48x312  | 600      | x      |
| facade-hotel-upper      | 48x180  | 288      | x      |
| roofline-hotel          | 48x48   | 108      | x      |
| fire-escape             | 196x185 | 473      | none   |
| fire-escape-railing     | 48x24   | 432      | x      |
| fire-escape-ladder      | 24x96   | 432      | none   |
| fire-escape-ladder-4    | 24x48   | 432      | none   |
| fire-escape-ladder-5    | 24x60   | 432      | none   |
| fire-escape-ladder-6    | 24x72   | 432      | none   |
| fire-escape-ladder-7    | 24x84   | 432      | none   |
| water-tower             | 48x84   | 240      | none   |
| hotel-crest             | 98x44   | 478      | none   |
| hotel-window            | 32x152  | 592      | none   |
| storefront-cafe         | 84x120  | 600      | none   |
| storefront-florist      | 84x120  | 600      | none   |
| storefront-gift-shop    | 96x120  | 600      | none   |
| storefront-makeup-store | 96x120  | 600      | none   |
| storefront-pet-shop     | 108x120 | 600      | none   |
| storefront-diner        | 108x120 | 600      | none   |
| storefront-noodle-bar   | 120x120 | 600      | none   |
| cab                     | 96x40   | 600      | none   |
| hot-dog-cart            | 40x70   | 600      | none   |
| subway-railing          | 72x62   | 600      | none   |
| street-tree             | 64x136  | 600      | none   |
| walk-signal             | 12x82   | 600      | none   |
| doorman-podium          | 18x24   | 600      | none   |
| canopy-poles            | 60x60   | 600      | none   |
| cross-street            | 120x26  | 600      | none   |

Below the sidewalk's top, the sidewalk and road tiles fill rows 50 to 59.

### Depot modules

| Key               | Size    | Bottom y | Repeat | Placement                                                       |
| ----------------- | ------- | -------- | ------ | --------------------------------------------------------------- |
| depot-loading-bay | 120x120 | 600      | none   | Ten columns by ten rows, top at row 40 on a row-50 floor        |
| depot-wall        | 48x180  | 600      | x      | Four columns by fifteen rows, top at row 35 on a row-50 floor   |
| parcel-open       | 72x36   | 600      | none   | Six columns by three rows, top at row 47; drawn behind the bird |

The opened parcel is scenery, without the bright safe ledge lip or a red danger strip. It marks the starting location without blocking movement. The depot wall can repeat to any run width; loading bays and parcels are independently placed pieces. No panorama or scene-specific bird drawing is exported.

The separate atmosphere layers `street-city-far` and `street-city-mid` are each 720x600, bottom-left anchored at y 600 and repeating in x. Place them with the flat `street-sky`, back to front in that order. The legacy `street-skyline` is a composite compatibility asset: do not place it alongside the two separate layers. Physical facades, doors and attached ledges remain on the play plane.

### City boundary

City boundary is Blue cityscape, Zone 1 Stage 2. It reuses the street's existing art. Sparse low facades and short service-railing groups reveal broad views of the hazy city, distinguishing the city edge from the dense shop street without introducing another zone palette.

- Atmosphere: `street-sky`, `street-city-far` and `street-city-mid` retain the street's parallax setup and the destination's `zone-blue` identity.
- Near scenery: short `facade-one-storey` runs leave the finish open. Decorative `fire-escape-railing` groups sit on refuge ledges, sharing their gameplay plane and local floor alignment. No ladder art is required.
- Play surfaces: `tiles-street` supplies the sidewalk ground, raised steps and safe ledges. Existing red contact-edge art remains distinct from safe white lips. Gameplay data owns the randomized layout, hazards and encounter placement.
- Room: the existing street-door piece supplies the start room's entrance. There are no new story props, characters, palette colours or asset keys.

## Apartment appearance pack

`art/tools/apartment.py`, `art/tools/apartment_props.py` and `art/tools/apartment_wayfinding.py` provide reusable building blocks for Entrance and lobby and Climb to the apartment. The canonical dusty-rose `zone-red` ties together the entrance, restaurant, pool, spa, residential sections and exterior fire escapes. Wood, sage and muted blue are secondary accents. Saturated hazard red retains its separate meaning.

The artwork separates geometry from appearance. `tiles-apartment` contains 42 cells of 12x12 in eight columns, exported as a 96x72 sheet. Its six families are `apartment-wood`, `apartment-tile`, `apartment-plaster`, `apartment-stone`, `apartment-brick` and `apartment-metal`. Each supplies the common `top`, `top-left`, `top-right`, `top-joint`, `face`, `face-left` and `face-right` suffixes. Data can mix these families across short floor sections while using the existing ground, raised, wall and ceiling structures. Standable tops retain the dark edge and white lip. Shared ledges, movers and red contact bands keep their existing geometry and skins.

| Section     | Wall or facade             | Material cues    | Decorative cues                     |
| ----------- | -------------------------- | ---------------- | ----------------------------------- |
| Exterior    | apartment-facade           | Brick and metal  | Existing fire-escape railing        |
| Lobby       | apartment-wall-lobby       | Wood and plaster | Desk, sofa and plant                |
| Pool        | apartment-wall-pool        | Tile and stone   | Water panel and bench               |
| Residential | apartment-wall-residential | Wood and plaster | Shelf and existing room furnishings |
| Restaurant  | apartment-wall-restaurant  | Wood and tile    | Counter and booth                   |
| Spa         | apartment-wall-spa         | Tile and plaster | Folding screen and bench            |

Short wall pieces belong to each section, rather than repeating one indoor wall over an entire stage. Leave exterior sections open to the sky, far city and middle-distance silhouettes. Whole-stage atmosphere may repeat with sky factors 0,0; far factors 0.15,0.05; middle factors 0.4,0.15. Wall panels, facades, props, doors and stairwell markers stay on the gameplay plane at factors 1,1 and align through placement data to their local floor. All new backdrop metadata uses a bottom-left anchor and default bottom y 720; this default does not prescribe world placement.

| Backdrop                   | Size    | Repeat | Plane                |
| -------------------------- | ------- | ------ | -------------------- |
| apartment-exterior-mid     | 720x720 | x      | Middle distance      |
| apartment-facade           | 48x180  | x      | Gameplay, decorative |
| apartment-far              | 720x720 | x      | Far distance         |
| apartment-sky              | 48x720  | x      | Fixed sky            |
| apartment-wall-lobby       | 48x144  | x      | Gameplay, decorative |
| apartment-wall-pool        | 48x144  | x      | Gameplay, decorative |
| apartment-wall-residential | 48x144  | x      | Gameplay, decorative |
| apartment-wall-restaurant  | 48x144  | x      | Gameplay, decorative |
| apartment-wall-spa         | 48x144  | x      | Gameplay, decorative |

| Prop                         | Size  | Repeat |
| ---------------------------- | ----- | ------ |
| apartment-lobby-desk         | 96x48 | none   |
| apartment-lobby-plant        | 36x60 | none   |
| apartment-lobby-sofa         | 96x48 | none   |
| apartment-pool-bench         | 72x36 | none   |
| apartment-pool-water         | 96x24 | x      |
| apartment-residential-shelf  | 72x96 | none   |
| apartment-restaurant-booth   | 72x48 | none   |
| apartment-restaurant-counter | 96x48 | none   |
| apartment-room-door          | 48x72 | none   |
| apartment-spa-bench          | 72x36 | none   |
| apartment-spa-screen         | 72x96 | none   |
| apartment-stairwell          | 48x72 | none   |
| apartment-stairwell-down     | 48x72 | none   |

The marked stairwells and optional room door share a 48x72 canvas at the bird's scale. The stairwells' ascending or descending silhouettes and white directional arrows on dark signs identify the reversible main route. `apartment-stairwell` is the up marker; `apartment-stairwell-down` is the down marker. The optional room door uses warm framing and a handle without an up arrow. These images contain no input prompt or text; the runtime owns their interaction. The approved stair trigger activates when walked into. It is distinct from an optional room entrance.

Props are decorative, with no collision, continuous white safe lip or hazard band. Place actual platforms independently using the common structures. Pool water does not imply lethal contact; only an explicitly marked red hazard does. Room scenery contains no foreground friendly animals, people or new story details. The existing ferret story sprite and portrait remain available; his obstacle skin does not decide the friendship's outcome.

### Ferret obstacle skin

`art/tools/ferret_antagonist.py` draws `ferret-antagonist`, a compact encounter skin for the familiar patrol and charge pattern. It retains the champagne coat, small wedge head, plum stovepipe hat, red band and bow tie, and warm brown legs and tail. The original 64x80 story sprite and dialogue portrait remain unchanged. Costume accents do not replace the shared red terrain hazard markings, and the enemy has no red outline.

The frame is 48x48, bottom-centre anchor 24,48, with constant contact box x 2, y 2, width 44, height 46. All visible poses fit this box, including mirrored versions. Every state remains lethal; this is a regular obstacle using the existing generic behaviour graph. Gameplay owns movement, warning and recovery durations.

| Tag    | Art cycle               | Pose                       |
| ------ | ----------------------- | -------------------------- |
| crouch | Two frames, 140ms each  | Preparation for the charge |
| idle   | Two frames, 400ms each  | Quiet standing             |
| rest   | Two frames, 400ms each  | Recovery pause             |
| rush   | Four frames, 80ms each  | Committed charge           |
| walk   | Four frames, 120ms each | Patrol steps               |

All tags loop, with `once: []`. These are art playback defaults, not gameplay state durations. There is no boss-specific visual system or new ending artwork.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

## Countryside material pack

Farmland and River crossing use the countryside destination's muted straw primary, `zone-yellow`. `art/tools/countryside.py` supplies appearance bindings for the same terrain roles and structures used by the other zones. It adds no collision rules or obstacle behaviours.

| Stage appearance | Logical ground look | Logical raised look |
| ---------------- | ------------------- | ------------------- |
| Farmland         | country-ground      | hay-stack           |
| River crossing   | riverbank           | timber-crossing     |

`tiles-countryside` contains 28 cells of 12x12 in eight columns, exported as a 96x48 sheet. Every family supplies `top`, `top-left`, `top-right`, `top-joint`, `face`, `face-left` and `face-right`. Safe tops retain the dark edge and white lip. One-way ledges, moving elements and red contact strips reuse the shared skins and geometry.

| Backdrop        | Size    | Repeat | Plane                |
| --------------- | ------- | ------ | -------------------- |
| countryside-far | 720x600 | x      | Far distance         |
| countryside-sky | 48x600  | x      | Fixed sky            |
| farmland-barn   | 120x144 | none   | Gameplay, decorative |
| farmland-fence  | 48x48   | x      | Gameplay, decorative |
| farmland-mid    | 720x600 | x      | Middle distance      |
| river-mid       | 720x600 | x      | Middle distance      |
| river-reeds     | 48x72   | x      | Gameplay, decorative |

Backdrops use bottom-left anchors with default bottom y 600. Use sky factors 0,0; far factors 0.15,0.05; middle factors 0.4,0.15. Select the stage's middle-distance layer. Near props use factors 1,1 and align to the local floor through placement data. Decorative river scenery does not define water collision or danger. Barns, fences and reeds have no safe lip or contact band; keep their silhouettes clear of usable surfaces. Existing street-door artwork may supply room entrances.

## Goose antagonist

`art/tools/goose.py` draws Trixi as the countryside's `goose-antagonist`. A long neck, small head, pale body and oversized ink-rimmed glasses distinguish her from Chibi; a warm beak and feet keep her silhouette readable against the muted scenery. Its warning raises its wing and neck before the short committed charge. It has no red outline or dialogue portrait.

The frame is 48x48 with bottom-centre anchor 24,48. Its constant contact box is x 2, y 2, width 44, height 46, containing every pose and its mirrored version. The skin uses the shared enemy state graph; gameplay owns warning, charge and recovery durations. Contact remains lethal in every state.

| Tag  | Art cycle               | Pose                            |
| ---- | ----------------------- | ------------------------------- |
| idle | Two frames, 400ms each  | Quiet standing                  |
| rest | Two frames, 400ms each  | Recovery pause                  |
| rush | Four frames, 80ms each  | Neck extended during the charge |
| walk | Four frames, 120ms each | Alternating steps               |
| warn | Two frames, 160ms each  | Raised wing and neck signal     |

All tags loop; state transitions belong to the runtime. These art timings do not define the charge's distance or duration.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

The appended `set-trap` tag contains four looping 120ms placement frames. Existing poses and all prior frame indices and timings remain unchanged apart from the glasses overlay.

`goose-trap` is a 24x12 floor overlay, bottom-centre anchor 12,12, with contact box x 0, y 9, width 24, height 3. Its `warning` tag loops four 120ms frames: an amber two-pixel edge, moving two-pixel yellow tick and ink rim provide the visible arming interval. Its `armed` tag loops one 400ms frame with the shared red two-pixel contact edge and ink rim. The red pixels derive from the same `hazard-top` geometry as ordinary floor hazards, repeated twice. Rows 0 through 8 remain transparent, with no spikes, teeth or safe white lip. Gameplay owns the delay and collision activation: warning is nonlethal; only the armed state uses the declared contact box. Retry and lifetime cleanup belong to the runtime. Both actor and trap retain empty `once` lists.

## Bini bear

`art/tools/bear.py` draws `bear-antagonist`: Bini, a cute brown bear with round ears, a cream muzzle and a seated phone-playing idle. The tiny phone screen uses a road, cream dog and red-bandana motif for Archie's Dog Walks, without miniature text or external runtime dependencies. His annoyed preparation, growl and forward paw gestures remain cute, without teeth, gore or a red contact outline.

The frame is 48x48 with bottom-centre anchor 24,48 and fixed contact box x 2, y 2, width 44, height 46, containing every pose and its mirror. Contact remains lethal. The phone and seated pose do not create another collision profile.

| Tag         | Art cycle                | Pose                           |
| ----------- | ------------------------ | ------------------------------ |
| frustration | Shared four-frame loop   | Blocked-route reaction         |
| growl       | Four frames, 120ms each  | Mouth opens for the sonic push |
| idle        | Two frames, 400ms each   | Seated, playing on the phone   |
| maul        | Three frames, 100ms each | Forward paw gesture            |
| prepare     | Two frames, 160ms each   | Annoyed look up from the phone |
| rest        | Two frames, 400ms each   | Settled recovery               |
| rush        | Four frames, 80ms each   | Committed charge               |
| walk        | Four frames, 120ms each  | Grounded steps                 |

All actor tags loop. `portrait-bear` is 64x64, authored facing right, with `neutral` and `annoyed` tags of one 1000ms frame each. Dialogue text belongs to gameplay data.

`bear-growl-wave` is a noncolliding 48x32 directional effect. Its `pulse` tag has four 100ms frames, plays once and requires runtime removal when finished. Place its left-centre anchor 0,16 at the bear's mouth, frame-local 36,22; the unmirrored image origin is therefore actor origin plus 36,6. Mirror this attachment for left-facing use. The effect does not define reach or force. Gameplay supplies the height-limited push volume and solid cover checks, with high ground as the primary avoidance route. Keep the drawn pulse within that configured band.

## Owl antagonist

This artwork is retained; Bini supplies the approved replacement woodland encounter.

`art/tools/owl.py` draws `owl-antagonist`. A compact round head and broad wings distinguish the owl. Its preparation pose signals a descending swoop before it returns and rests. There is no red outline or dialogue portrait.

The frame is 48x48 with bottom-centre anchor 24,48. Its fixed contact box is x 2, y 2, width 44, height 46, containing all visible poses and mirrored versions. All states remain lethal. The appearance uses the generic enemy state graph; gameplay owns physical movement and state durations.

| Tag     | Art cycle               | Pose                      |
| ------- | ----------------------- | ------------------------- |
| drop    | Two frames, 100ms each  | Descending swoop          |
| idle    | Two frames, 400ms each  | Perched breathing         |
| prepare | Two frames, 160ms each  | Readable wing preparation |
| rest    | Two frames, 400ms each  | Settled recovery          |
| return  | Four frames, 120ms each | Wingbeat on the return    |

Every tag loops. These frame timings are art cycle defaults, not the runtime motion or warning durations.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

## Woodland material pack

`art/tools/woodland.py` draws reusable skins for Forest paths and Ravine, using the destination's canonical `zone-green` primary. Appearance bindings retain the common terrain geometry, obstacle behaviours and collision profiles.

| Stage appearance | Logical ground look | Logical raised look |
| ---------------- | ------------------- | ------------------- |
| Forest paths     | forest-ground       | root-stack          |
| Ravine           | ravine-ground       | stone-stack         |

`tiles-woodland` contains 28 cells of 12x12 in eight columns, exported as a 96x48 sheet. Every family supplies `top`, `top-left`, `top-right`, `top-joint`, `face`, `face-left` and `face-right`. Safe tops keep the dark edge and white lip. Shared one-way ledges, moving elements and red hazard strips retain their existing skins and geometry.

| Backdrop     | Size    | Repeat | Plane                |
| ------------ | ------- | ------ | -------------------- |
| forest-mid   | 720x600 | x      | Middle distance      |
| forest-shrub | 48x48   | x      | Gameplay, decorative |
| forest-tree  | 96x216  | none   | Gameplay, decorative |
| ravine-mid   | 720x600 | x      | Middle distance      |
| ravine-rock  | 72x72   | none   | Gameplay, decorative |
| woodland-far | 720x600 | x      | Far distance         |
| woodland-sky | 48x600  | x      | Fixed sky            |

All backdrops use bottom-left anchors and default bottom y 600. Sky factors are 0,0; far factors 0.15,0.05; middle factors 0.4,0.15. Select the appropriate stage middle layer. Near props use factors 1,1 and placement data aligns them to the local floor. Decorative silhouettes carry no white safe lips or red contact bands and must not imply usable platforms. Scenery adds no collision, hidden hazard or movement rules. Room entrances may reuse the existing street-door artwork.

## Rabbit antagonist

`art/tools/rabbit.py` draws `rabbit-antagonist`. Upright ears and a small tail distinguish the rabbit. Its hop cycle and settled pauses accompany the shared bounded movement pattern. There is no red outline or dialogue portrait.

The frame is 48x48 with bottom-centre anchor 24,48. Its fixed contact box is x 2, y 2, width 44, height 46, containing all visible poses and mirrored versions. All states remain lethal. The appearance uses the generic enemy state graph; gameplay owns physical movement and state durations.

| Tag  | Art cycle               | Pose                       |
| ---- | ----------------------- | -------------------------- |
| hop  | Four frames, 100ms each | Hop cycle                  |
| idle | Two frames, 400ms each  | Quiet standing             |
| rest | Two frames, 400ms each  | Predictable recovery pause |

Every tag loops. These frame timings are art cycle defaults, not the runtime motion or warning durations.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

## Home city material pack

`art/tools/homecity.py` draws reusable skins for City outskirts and Familiar neighbourhood, using the destination's canonical `zone-peach` primary. Appearance bindings retain the common terrain geometry, obstacle behaviours and collision profiles.

| Stage appearance       | Logical ground look  | Logical raised look |
| ---------------------- | -------------------- | ------------------- |
| City outskirts         | outskirts-ground     | brick-stack         |
| Familiar neighbourhood | neighbourhood-ground | stoop-stack         |

`tiles-homecity` contains 28 cells of 12x12 in eight columns, exported as a 96x48 sheet. Every family supplies `top`, `top-left`, `top-right`, `top-joint`, `face`, `face-left` and `face-right`. Safe tops keep the dark edge and white lip. Shared one-way ledges, moving elements and red hazard strips retain their existing skins and geometry.

| Backdrop           | Size    | Repeat | Plane                |
| ------------------ | ------- | ------ | -------------------- |
| homecity-awning    | 96x36   | none   | Gameplay, decorative |
| homecity-far       | 720x600 | x      | Far distance         |
| homecity-sky       | 48x600  | x      | Fixed sky            |
| neighbourhood-mid  | 720x600 | x      | Middle distance      |
| neighbourhood-wall | 48x180  | x      | Gameplay, decorative |
| outskirts-mid      | 720x600 | x      | Middle distance      |
| outskirts-wall     | 48x144  | x      | Gameplay, decorative |

All backdrops use bottom-left anchors and default bottom y 600. Sky factors are 0,0; far factors 0.15,0.05; middle factors 0.4,0.15. Select the appropriate stage middle layer. Near props use factors 1,1 and placement data aligns them to the local floor. Decorative silhouettes carry no white safe lips or red contact bands and must not imply usable platforms. Scenery adds no collision, hidden hazard or movement rules. Room entrances may reuse the existing street-door artwork.

## Pebble pigeon

`art/tools/pigeon_antagonist.py` draws Pebble as `pigeon-antagonist`, a cute grey and lilac pigeon with a cream chest. The 48x48 frame has bottom-centre anchor 24,48 and fixed contact box x 2, y 2, width 44, height 46, including mirrored poses. Existing generic posts provide perches; no special post artwork or collision is introduced.

| Tag         | Art cycle               | Pose                       |
| ----------- | ----------------------- | -------------------------- |
| drop        | Two frames, 100ms each  | Airborne release gesture   |
| fly         | Four frames, 100ms each | Wingbeat during flight     |
| frustration | Shared four-frame loop  | Blocked-route wing gesture |
| idle        | Two frames, 400ms each  | Perched breathing          |
| prepare     | Two frames, 160ms each  | Notices Chibi              |
| rest        | Two frames, 400ms each  | Perched recovery           |

All tags loop. Gameplay owns flight, spotting and release timing. `pigeon-poop` is a 12x12 white block with a one-pixel ink border and full-frame contact box, tag `idle`, one 400ms looping frame. It is the approved white projectile exception to the shared red terrain-contact rule. The code supplies its straight downward motion, lethal contact and removal on landing; none is baked into the drawing. There is no new dialogue portrait or story artwork.

## Industrial material pack

Warehouse district and Freight terminal use the industrial destination's canonical smoky lavender, `zone-purple`. `art/tools/industrial.py` draws reusable material skins and scenery. The pack adds no obstacle types, collision rules or stage-specific physics; data may combine these skins with shared structures in any zone.

| Stage appearance | Logical ground look | Logical raised look |
| ---------------- | ------------------- | ------------------- |
| Warehouse        | industrial-floor    | crate-stack         |
| Freight          | terminal-floor      | container-stack     |

`tiles-industrial` contains 28 cells of 12x12 in eight columns, exported as a 96x48 sheet. Each of the four families supplies the common `top`, `top-left`, `top-right`, `top-joint`, `face`, `face-left` and `face-right` tiles. Safe tops retain the dark edge and white lip. Existing `tiles-platforming` ledges and directional red contact strips remain shared across skins; moving elements retain their generic behaviour and geometry.

| Backdrop              | Size    | Repeat | Plane                |
| --------------------- | ------- | ------ | -------------------- |
| freight-gantry        | 144x192 | none   | Gameplay, decorative |
| freight-mid           | 720x600 | x      | Middle distance      |
| industrial-far        | 720x600 | x      | Far distance         |
| industrial-sky        | 48x600  | x      | Fixed sky            |
| warehouse-loading-bay | 120x144 | none   | Gameplay, decorative |
| warehouse-mid         | 720x600 | x      | Middle distance      |
| warehouse-wall        | 48x240  | x      | Gameplay, decorative |

The repeated atmosphere layers have a default bottom of y 600. Use sky factors 0,0; far factors 0.15,0.05; middle factors 0.4,0.15. Select the middle layer for the chosen appearance, rather than stacking both. Near pieces use factors 1,1 and align to the local floor: their top row is the floor row minus their height in tiles. Placement data supplies the character size and row; the manifest's default bottom is not a placement instruction. Decorative beams and the closed loading bay have no collision, white safe lip or red contact band. Keep them clear of routes where their shapes would imply a usable surface. Room doors may reuse the existing street-door art.

## Raccoon antagonist

`art/tools/raccoon.py` draws `raccoon-antagonist`, a separate enemy asset for the industrial stages. It retains a cute grey coat, cream face and belly, dark mask, rounded ears and banded tail. The existing room raccoon is unchanged. The frame is 48x48 with a bottom-centre anchor at 24,48, within a four-column by four-row placement. Its fixed contact box is x 2, y 2, width 44, height 46 in every pose, including mirrored poses. Contact remains lethal during preparation and rest; neither the sprite nor the runtime adds a red outline.

| Tag     | Art cycle               | Pose                                  |
| ------- | ----------------------- | ------------------------------------- |
| climb   | Four frames, 120ms each | Alternate grips and feet on the climb |
| drop    | Two frames, 100ms each  | Splayed and tucked falling poses      |
| idle    | Two frames, 400ms each  | Standing breathing fallback           |
| prepare | One frame, 400ms        | Compressed body before the drop       |
| rest    | Two frames, 400ms each  | Settled pause after landing           |

All tags loop; gameplay data owns state durations, motion and transitions through the shared behaviour graph. A skin supplies compatible artwork without changing the canonical footprint or contact box. No portrait or new conversation is supplied by this asset.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

## Kept for a later indoor zone: the boutique lobby

The lobby set is no longer in Zone 1. It is kept, unchanged, for a later indoor zone.

- The lobby is a boutique at indoor scale: wood-panelled walls, a sofa, a reception desk, a tall bookcase, plants, pendant lamps and a tall window. A door is 180px (15 tiles) and the zone is 720px (60 tiles) tall, so the camera scrolls up through it; the floor line is y 672 (row 56).
- Contrast: the walls are dark wood, and every walkable top (the floor and each one-way ledge) carries the same 2px cream lip under a 1px plum edge, so the standable edges are the brightest lines in the room in greyscale, and the cream bird stays the focal point.
- Lobby tiles (`tiles-lobby`): a wood floor (tops with a 2px board end every 24px, ends, face), one-way balcony, shelf, cushion and desk ledges, a solid wood post 2 tiles wide, and the stairwell as a 7x15 doorway piece (84x180) with a white up-arrow on a green sign. The inside of the front door is a backdrop.
- Lobby pieces line up with the reaches: the sofa's seat and back are 3 and 6 tiles up, the desk top 8, and the bookcase boards 8, 16, 24 and 32.

| Backdrop         | Size    | Bottom y           | Repeat |
| ---------------- | ------- | ------------------ | ------ |
| lobby-wall       | 48x720  | 720                | x      |
| lobby-balustrade | 48x36   | balcony floor line | x      |
| lobby-bookcase   | 84x384  | 672                | none   |
| lobby-sofa       | 120x72  | 672                | none   |
| lobby-desk       | 120x96  | 672                | none   |
| lobby-plant      | 48x120  | 672                | none   |
| lobby-lamp       | 48x192  | 220                | none   |
| lobby-window     | 96x240  | 552                | none   |
| lobby-front-door | 156x180 | 672                | none   |

## Park theme

The autumn park is a prototype chunk theme outside the V1 route. Its hand-built chunks are each a screen or two wide and assemble in a seeded order; a theme carries one tileset, its terrain and its repeated backdrops, drawn across the whole stage so seams never show, and chunks add their own props. `art/tools/park.py` draws it; its docstring lists every tile and piece.

- Frame and scale as the street: outdoor scale, 12px tiles, zones 60 rows (720px) tall.
- Chunk seams sit at ground rows 50, 40 and 30 (y 600, 480 and 360): a chunk's left and right edges meet the next chunk's at one of those heights. A step of 1 or 2 rows is a tap's walk-up; a taller terrace face is turf over soil (`soil-left` or `soil-right` running down the face), any height. There are no slopes.
- Look: a peach sky with cream clouds, tall tan treetops and a skin2 city behind, close to the sky's value; the ground two bright rows deep (a cream-lipped grass top over green turf), then warm brown soil with sparse 2px pebbles. Every walkable top's lip holds at least 2:1 against what is behind it: cream lips, and white on the stone stairs and the bandstand roof, which stand against the tan treetops.

| Tile                                              | Collision                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grass-top`, `grass-top-left`, `grass-top-right`  | solid; the walkable top, the end tiles rounded on an exposed side                                                                                                                                                               |
| `turf`, `turf-left`, `turf-right`                 | solid; the row under a grass top                                                                                                                                                                                                |
| `soil`, `soil-pebbles`, `soil-left`, `soil-right` | solid; the fill, pebbles on about one tile in five                                                                                                                                                                              |
| `path-top`, `path-top-joint`                      | solid; a gravel path top, alternated                                                                                                                                                                                            |
| `step-stair`, `step-stair-left`                   | solid; a stone tread in a step's top, every other step                                                                                                                                                                          |
| `one-way-bench-*` (left, middle, right)           | one-way; a bench's top, 2 rows up                                                                                                                                                                                               |
| `one-way-branch-*`                                | one-way; a tree's branch, 6 rows up                                                                                                                                                                                             |
| `one-way-bandstand-*`                             | one-way; the bandstand roof, 6 rows above its base                                                                                                                                                                              |
| `hazard-pond-*`, `hazard-pond-bed-*`              | none; a pond hazard two rows deep, placed with a width. The first row's tiles hit `{x 0, y 4, width 12, height 8}` (`hitboxes`) and the bed row its whole cell: 20px from the water surface down. The banks beside it are solid |
| `hazard-thorn-*`                                  | none; a thorn-hedge hazard one row tall, placed with a width. Each tile hits `{x 0, y 2, width 12, height 10}` (`hitboxes`)                                                                                                     |

Sprites, in the manifest's `sprites`:

- `park-boat`, 72x18, facing right: a rowing boat, the moving platform on a pond. Its collision is 6x1 tiles (72x12) with its top on the frame's row 0, the deck line: a 1px dark-brown edge on row 0 and a 2px cream lip on rows 1 and 2, like every walkable top, and nothing drawn above it. A tan gunwale, then a rust hull lit ochre and shaded dark brown underneath, rounded to the keel, dipping into the pond's water rows. Tag `idle`, 2 frames at 400ms: frame 1 drops the keel 1px; the deck line stays fixed.
- `park-gate`, 36x60 (3x5 tiles), the park's room door: no collision, and the game puts a Use zone over it. Anchor: the frame's bottom-left on the ground's top, centred in the door's slot. A wrought-iron arch on two posts with leaf finials and ochre and rust leaves, over a pale opening and a brown path. Tags `idle` (closed, 1 frame at 400ms) and `open` (4 frames at 80ms, plays once and holds open) when she uses it.

Backdrops repeat in x at widths that divide 720, so chunk seams never show; props stand on the ground (their bottom y is given for row 50; subtract 120 per seam row up).

| Backdrop        | Size    | Bottom y | Repeat |
| --------------- | ------- | -------- | ------ |
| park-sky        | 48x600  | 600      | x      |
| park-clouds     | 360x160 | 200      | x      |
| park-treetops   | 360x420 | 600      | x      |
| park-city       | 360x200 | 540      | x      |
| park-far-trees  | 240x120 | 600      | x      |
| park-tree       | 96x150  | 600      | none   |
| park-bench      | 36x24   | 600      | none   |
| park-bandstand  | 120x84  | 600      | none   |
| park-lamp       | 16x84   | 600      | none   |
| park-fountain   | 96x48   | 600      | none   |
| park-flower-bed | 72x16   | 600      | none   |
| park-bin        | 16x24   | 600      | none   |
| park-sign       | 24x40   | 600      | none   |
| park-reeds      | 24x30   | 610      | none   |
| park-lily-pad   | 14x4    | 608      | none   |

## Remaining for the first build

- Any further encounter-specific animation or trap artwork requires an approved behaviour and asset contract.
- Runtime placement and integration of the apartment appearance pack remain with the stage implementation.
