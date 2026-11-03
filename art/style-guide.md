# Art Style Guide

The visual rules for Chibi's Way Home. [Art](README.md) owns the drawing pipeline and navigation; [controls](controls.md), [inventory](inventory.md) and [layout](layout.md) retain their specific contracts.

## Direction

- Pixel art: minimalist, cute, a little retro, refined.
- Game artwork and native UI glyphs use pixel art at one base resolution, 720x360. Artwork scales to fill the screen at 2:1 with nearest-neighbour sampling; native font textures, procedural skill-button circles, live touch-control chrome and filled action-help illustrations are isolated antialiased exceptions. Fractional scaling can make some art pixels one device pixel wider than others. On a landscape phone 1 base pixel is about 1 CSS pixel. Judge art at a fractional scale as well as at 3x, and avoid 1px patterns (checks, dashes, alternating rows) that turn uneven when pixels vary in width.
- Playable and speaking characters use chibi proportions: the head at least as big as the body, so a character reads from head shape and markings alone. All natural background objects, including foliage, bushes, trees and animals, use realistic or naturalistic proportions, forms, silhouettes and motion within the pixel-art style and muted pastel palette. Avoid cute cartoon shapes, oversized eyes, clothing and character expressions in background nature. Playable and speaking chibi characters remain the exception.

### Naturalistic animal anatomy

- Build silhouettes from species references. In quadrupeds, hindlimbs attach to the pelvis near the rump, not the middle of the flank; forelimbs connect through the shoulder and chest.
- Keep a continuous back and rump contour. Show anatomical landmarks without adding separate round humps at limb roots.
- Taper broad upper limbs into narrower lower limbs, with correctly placed elbows, stifles, knees and hocks. Check joints and limb attachments in enlarged crops and the complete silhouette at native size.
- Ground each pose through its supporting hooves or feet. For planted idle and grazing cycles, keep support points fixed while the neck, head, ears and tail articulate; do not rotate the torso or slide the roots to lower the head.

## Zone design guide

- Accents: retain muted pastel zone themes, using brighter, more saturated colours for points of interest and highlight areas. Amber remains a door accent. Reserve canonical bright red for hazard signalling in these callouts, so a point of interest never falsely reads as a dangerous contact surface. Existing character costume colours do not define collision.
- Colour: each V1 destination uses its canonical muted primary from [Zone primary colours](#zone-primary-colours), carried through atmosphere, materials, map identity and progress. Keep distant colours close to the sky and spend saturation on a few useful accents. The park remains a separate prototype outside the V1 route.
- Detail: decorative foliage and rocks use adjacent material shades rather than heavy dark contour bands. Buildings retain complete, distinct wall faces and tonal material boundaries; doors and windows attach to their enclosing walls. Distant scenery uses broad silhouettes without window grids. Near architecture uses sparse window groups and quiet surfaces. Avoid repeated stripes and single-pixel texture that compete with the bird.
- Layouts: every stage, including the first and final stages, assembles seeded middle chunks between fixed start and finish sections. Reusable tiles, scenery and gameplay chunks assemble independently; a background image never encodes a required route. Ordinary zones remain at most two screens tall (720px, 60 rows). Apartment floors use the approved 90-row (1080px) height exception.
- Obstacles: use ledges, cliffs, walls and ceilings. Short-clearance jumps and full-height jumps share the same visual vocabulary. Ladders are not part of the obstacle set. Difficulty and jump requirements belong to gameplay data, with variation around a common configurable difficulty.
- Readability: safe walkable tops use a dark edge and a bright two-pixel lip. On darker scenery the lip holds at least 2:1 against its backdrop; against a pale sky the dark edge supplies the separation, so retain both parts of the edge. Dangerous faces instead use the shared red band, without spikes or a safe light lip. Text keeps 4.5:1 and meaningful UI marks 3:1 contrast.

### Parallax building blocks

Sky, distant skyline and middle-distance scenery are separate repeating images. Architecture that supports a ledge, and every attached door, railing or other prop, stays on the same plane as terrain. All physical surfaces move together, so the art never suggests that a landing slides away from its building.

Every room entrance belongs to a larger building facade outdoors or an opaque themed wall and trim indoors. `art/tools/room_buildings.py` supplies five outdoor `room-building-*` skins, each 180x180, for the blue cityscape, industrial, countryside, woodland and home-city settings. Their local transparent opening at 60,96,60,84 aligns with the unchanged 60x84 door: place the facade at door col minus 5 and row minus 8. Keep it behind the entry on the same 1,1 world plane, with its visible base meeting the actual ground. Distant parallax buildings do not enclose an interactive door. These facades add no collision, safe lip, light or interaction; indoor entrances reuse the existing wall skins rather than an exterior building.

The design starts with horizontal camera factors of 0 for sky, 0.15 for the far skyline, 0.4 for middle scenery and 1 for play. Gameplay owns the runtime values; initial far and middle vertical factors are 0.05 and 0.15. Vertical movement should be weaker on distant layers to keep climbs legible. Windows between near buildings reveal the distant layers; do not fill every opening with foreground decoration. Repeating layers must cover camera travel without exposing an empty edge.

Maintain an interesting backdrop throughout every stage's camera travel; sky and clouds can supply quiet stretches. V1 background sections use an independently seeded stream, separate from terrain and physical motion. Preserve authored scenery and species: append complementary coverage clipped to uncovered spans on the required parallax planes rather than replacing existing scenery. Keep one consistent weather treatment per zone in V1; changing weather and additional weather effects remain parked for V2. Interior wall materials, framed windows and occlusion remain intact, so background motion is not necessarily visible behind opaque walls. Coverage contracts are not a browser visibility check.

Outdoor generated repeated far and middle backdrops opt into `groundAnchor: "start"`, referencing a valid entry in their area. Resolve their vertical offset from the stable entrance-ground baseline: `G - (1 - py) * C0 - artHeight`, where `G` is that entry's ground line, `C0` its existing clamped entry-camera scroll and `py` the layer's vertical parallax factor. Add this to the authored row offset. Preserve horizontal and weak vertical parallax; the reference does not follow individual platforms or use asset-specific corrective offsets. Weather and authored Woodland and Apartment stacks retain their existing placement contracts.

Generated outdoor backdrop spans set `backdropExtendBottom: true`; the resolver requires a static nonphysical exterior span, and rendering requires repeat-X art. A separate native 1px bottom-row cap continues to the viewport's lower edge, preserving RGBA (including transparent gaps), horizontal texture phase and layer depth. The original quad, anchor and parallax factors stay fixed. The texture keeps its default frame, and the cap is destroyed with the base. Interior planes, window objects, fauna and unflagged authored placements retain their existing rendering.

Interior decorative depth planes use `backdropPlane: "interior"`, `backdropSpan: true` and a valid `groundAnchor: "start"` entry. Their authored col, row, cols and rows define a fixed world rectangle: its quad scrolls at 1,1 and draws at depth -3.5, above the opaque base walls and below props and terrain. Only the repeated texture's phase moves with parallax relative to the existing clamped entry-camera reference; do not apply the outdoor ground-anchor position offset. Derive the authored texture top as `textureTop = backdrop.y - backdrop.height`; vertical texture phase is `bounds.y - textureTop + (parallax.y - 1) * (scroll.y - reference.y)`. Clipped subrectangles continue the parent texture coordinates rather than restarting the pattern at each clip edge. Derive these rectangles from actual wall bands and exclude window openings. Preserve the base walls, physical props, terrain and seeded layout; absent the interior opt-in, legacy outdoor and weather rendering is unchanged. Gameplay owns placement and parallax factors.

### Stage scenery identity

Stage cards use captures of actual stage scenery. Keep each zone’s stages inside its zone palette while selecting different existing middle-distance silhouettes and near materials. Interior scenes remain enclosed rooms; exterior silhouettes appear only in exterior sections or through framed depth windows. The bindings below describe appearance, not platform geometry or thumbnail-only illustrations.

| Zone                 | Stage                  | Scenery building blocks                                          |
| -------------------- | ---------------------- | ---------------------------------------------------------------- |
| Blue cityscape       | Depot and streets      | Depot opening, `street-city-mid`, complete street facades        |
| Blue cityscape       | City boundary          | `street-boundary-mid`, sparse street facades, open skyline       |
| Industrial outskirts | Warehouse district     | `warehouse-mid`, warehouse walls and closed loading bays         |
| Industrial outskirts | Freight terminal       | `freight-mid`, service gantries and container materials          |
| Countryside          | Farmland               | `farmland-mid`, complete barn, timber fence and hay materials    |
| Countryside          | River crossing         | `river-mid`, reeds, bank and timber materials                    |
| Woodland             | Forest paths           | `forest-mid`, tonal trees, shrubs and root materials             |
| Woodland             | Ravine                 | `ravine-mid`, rock silhouettes and stone materials               |
| Home city            | City outskirts         | `outskirts-mid`, low masonry boundary walls                      |
| Home city            | Familiar neighbourhood | `neighbourhood-mid`, complete windowed facades and garden crowns |
| Apartment            | Lobby                  | Lobby walls, wood and plaster, sofa and desk                     |
| Apartment            | Restaurant             | Restaurant walls, wood and tile, counter and booth               |
| Apartment            | Pool                   | Pool walls, tile and stone, contained water panel and bench      |
| Apartment            | Spa                    | Spa walls, tile and plaster, folding screen and bench            |
| Apartment            | Residential floors     | Residential walls, wood and plaster, shelf                       |
| Apartment            | Penthouse              | Residential wall skin, stone and wood, lobby sofa                |

`street-boundary-mid` is a 720x600 repeating backdrop, bottom-left anchored at y600, with suggested parallax 0.4,0.15. It replaces only the `mid-background` art binding in the City boundary theme; all other existing assets and bindings retain their contracts.

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

## Export contracts

- Every manifest sprite entry has `once`: the tags that play once and hold their last frame, `[]` when none. Every other tag loops. A script declares them in a `ONCE` dict beside its `sprites()`.
- A sprite with a hit box carries `hitbox` in its manifest entry, `{"x", "y", "width", "height"}` in frame pixels for the facing it is drawn in. A script declares them in a `HITBOX` dict beside `ONCE`; only sprites that declare one have it, and a box outside the frame fails the build.
- A nine-slice texture carries its margins as an Aseprite slice named after its key and as `slice` in its manifest entry.
- `art/tools/fonts.py` rasterizes the bundled SIL OFL Liberation Sans Regular and Bold files in `art/fonts/liberation/` into white, tintable BMFonts in `public/art/fonts/`. Keep the `font-body` and `font-title` keys, native 16px size, base 15 and line height 20. The body PNG is 256x64 and the title PNG 256x128; each font covers printable ASCII and the middle dot (96 glyphs), with grayscale alpha, signed glyph bearings and rounded pair kerning. Retain `art/fonts/liberation/OFL.txt` with the font files.
- Load font PNG/FNT pairs as dedicated bitmap-font textures and keep their raw files in offline precaching. Exclude fonts from shared sprite atlases. Apply linear filtering only to the dedicated font texture sources; artwork keeps nearest-neighbour filtering.
- `art/tools/palette.py` writes `public/art/palette.json`, listed under `data` in the manifest: `colours` maps each palette name to `#rrggbb`, `darker` maps each colour one ramp step down, and `dim2` two steps down for ambient start-screen dimming. Actual modal backdrops apply three `palette.darker` steps through the shared painter. Keys are sorted.
- `art/tools/icons.py` draws the favicon and app icons, the bird on a muted powder-blue sunburst disc (whole from 32px up, her head and back at 16px on flat zone-blue, where the rays do not hold), as plain PNGs, not sprites or manifest entries: `public/favicon.ico` (16 and 32), `public/art/favicon-16.png` and `public/art/favicon.png`, and in `public/icons/` the 180 apple-touch icon on a full-bleed sunburst square, the 192 and 512 icons on a sunburst disc with a transparent outside, and a 512 maskable icon with the subject inside the central 80%. The 16 and 32 are drawn natively; the larger icons are 64 and 90 drawings scaled by whole numbers.
- `art/inventory.md` lists every asset (key, type, size, tags).
- `art/tools/floor<n>.py` draws one zone's tilesets and backdrop pieces as plain PNGs, not Aseprite sprites, so the game builds each zone from stage data instead of a fixed panorama (`floor1.py` draws Zone 1). A chunk theme has its own module, such as `art/tools/park.py`, with the same `build` and `preview OUT.png` commands; each tool merges its own keys into the manifest's `tilesets` and `backdrops` and keeps the others.
- A tileset is `public/art/tilesets/<key>.png`, 12x12 tiles in rows of 8 with no spacing or margin, plus `<key>.json`: `{"tileSize": 12, "columns": 8, "tiles": {"<name>": <index>}, "pieces": {"<name>": [[<index>, ...], ...]}, "hitboxes": {"<name>": {"x", "y", "width", "height"}}}`. An index counts row by row. A piece is a multi-tile unit as rows of indices, top row first. `hitboxes` is optional and written only when a tile has one: a `hazard-*` tile's hit box in pixels within its 12x12 tile, the same shape as a sprite's `hitbox`. A tile without an entry hits its whole cell. `pixel.write_tileset` writes every tileset. A tile named `one-way-*` is a one-way ledge, which stops only a fall onto its top edge. A tile named `door-*` or `exit-*` is a doorway with no collision. A doorway leads only to a room: where the stage gives it one, the game puts a Use zone over its piece. A zone is cleared at its right edge, never through a doorway. A tile named `pit-*` is a pit with no collision, so she falls through it and out of the stage. A tile named `hazard-*` has no collision and is drawn for a hazard instance placed with a width: touching its hit box restarts her. Every other tile with art is solid. The manifest lists each under `tilesets` as `{"key", "png", "json"}`.
- A backdrop piece is `public/art/backdrops/<key>.png`, drawn behind the play layer. The manifest lists each under `backdrops` as `{"key", "png", "width", "height", "anchor": "bottom-left", "y", "repeat"}`: its bottom edge sits at world `y`, at an x the stage data chooses, and `"repeat": "x"` tiles it across a run while `"none"` places it once.

## Style rules

### Palette

- One fixed house palette, plus a few game-specific ramps that each end on a house colour. The house palette is [Endesga 32](https://lospec.com/palette-list/endesga-32); colour names are the `K` names in `art/tools/pixel.py`.
- Raster art pixels are fully opaque or fully transparent. Native font glyphs use grayscale alpha; procedural skill-button circles, live touch-control chrome and filled action-help illustrations use fractional coverage at their edges. Live Move, Use and Jump, including the movement knob, render at 85% opacity; Pause and help illustrations retain opaque painted interiors. Dedicated font, touch and help textures use local linear filtering; world art and shared atlases retain nearest-neighbour sampling.
- Background paint in the six active zones uses `art/tools/background_palette.py` through `art/tools/background_tones.py`. Preserve the flat zone-primary skies. Far, middle and near use OKLab lightness centres 0.035, 0.070 and 0.105 below the sky, with detail half-widths 0.010, 0.014 and 0.018 and OKLCH chroma caps 0.022, 0.030 and 0.038. Retain continuous source lightness differences and source-material colour weights 0.25, 0.40 and 0.60. Apply caps after byte quantisation through the canonical art-kit gamut conversion; do not clip RGB channels.
- Preserve distinct wall panels, joints, window groups, wood, water and birch bark. Local decorative props use the near rank. Keep silhouettes, species, complete buildings, opaque indoor walls and transparent openings unchanged. Functional doors, stair markers, the walk signal and opened parcel retain their authored cues. The inactive Park prototype retains its existing publication policy and two-tone sky.
- The reserved animated-fauna rank uses the zone hue and chroma capped at the smaller of 35% of the zone sky's chroma and 0.028. Choose the lightest quantised paint holding at least 2:1 relative-luminance contrast against every published near-background material, including source-colour residuals and named exceptions. Generators use `bg-<zone>-fauna` tokens. Draw world fauna after the nearest background and before terrain, retaining ordinary world-camera movement and binary alpha. Modal dimming follows existing house ramps to a strictly darker shade, independently of the depth ranks.
- `python3 -I art/tools/background_tones.py build` refreshes background PNGs; individual generators apply the same policy. Room-entrance buildings use the named near ramps directly. Publish the regenerated palette with the approved background and fauna outputs. Foreground tiles, physical actors, portraits, UI and protected opening artwork retain their own paint.
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
- Progress: loading fill uses the same primary on a dslate track. The in-play stage strip uses its separate yellow/amber palette. Standard primary buttons remain dslate with white text. Hazard red remains the existing saturated `red`; muted `zone-red` is the apartment interior colour and never signals lethal contact.
- Ramps: every zone primary has one muted `-shade` colour, then joins a house ramp. The six bases and six shades extend the house palette without changing any existing colour. `palette.py` exports their darker and two-step dim mappings with every other palette colour.
- Planned stage use: backgrounds follow the destination's primary family, with far silhouettes low in contrast and nearer layers using its shade. Quiet secondary colours provide restrained highlights. Far scenery scrolls more slowly than the gameplay plane; attached ledges, doors and props stay with terrain. This is an art plan for later themes, not a claim that those stages exist.

### Outlines

- Characters and essential interactive marks use coloured outlines: two ramp steps darker than their fill. Natural scenery uses tonal silhouettes without a dark contour around the whole object. Architecture keeps complete wall planes and restrained material seams. Indoor scenes use enclosing room walls, partitions and furnishings; exterior roofs, skylines and facades appear only outdoors or through an explicit window.
- Against the play ground, keep stepping down the ramp until the outline holds 3:1 contrast on every ground it can appear on.
- A dark area takes a light rim on its top-left-facing edges, so it separates from dark ground.
- Faces and portraits take one ink outer line.
- Effects take a fixed 1px rim instead of a ramp outline, except for the flat procedural strokes of [dash wind](#dash-wind).

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

The typography scale below owns in-game role sizes, weights and line heights. All sizes are logical pixels in the 720x360 base view. The role names are design tokens; their presence here does not imply matching source constants already exist. Consumer geometry sections record the measured current implementation.

#### Typography scale

| Token                  | Family / font key              | Weight  | Font size | Line height | Application                                      | Status / source                                                                                      |
| ---------------------- | ------------------------------ | ------- | --------- | ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `type-heading`         | Liberation Sans / `font-title` | Bold    | 24        | 28          | Primary page, screen and modal headings          | Design target defined by `FONT_METRICS.mainHeading`; the summary uses the explicit compact exception |
| `type-heading-compact` | Liberation Sans / `font-title` | Bold    | 17        | 20          | Stage-summary zone heading only                  | Implemented by `FONT_METRICS.compactMainHeading`; uniform across all summary headings                |
| `type-subheading`      | Liberation Sans / `font-title` | Bold    | 20        | 24          | Section headings and secondary titles            | Design target pending consumer alignment; current source has no separate subheading alias            |
| `type-body`            | Liberation Sans / `font-body`  | Regular | 16        | 20          | Dialogue, descriptions, quips and ordinary prose | Current native size, weight and exported pitch: `FONT_ROLES.body`                                    |
| `type-action`          | Liberation Sans / `font-title` | Bold    | 16        | 20          | Button and action labels                         | Current native size, weight and exported pitch: `FONT_ROLES.action`                                  |
| `type-stat`            | Liberation Sans / `font-body`  | Regular | 16        | 20          | Statistic labels and numeric values              | Current native body font and metric-row pitch; consumers use the body alias                          |
| `type-meta`            | Liberation Sans / `font-body`  | Regular | 16        | 20          | Supporting labels, Stage numbers and status copy | Default role; verify each consumer's weight and application during alignment                         |

[Font roles](../src/layout/fontRoles.ts) retain the native 16px family aliases and scale 1 for body and action text. `FONT_METRICS.mainHeading` defines the 24px/28px design target; primary-heading consumers and the 20px subheading role remain pending alignment. Stage summaries use the explicit 17px/20px compact main-heading exception so separate Stage and Progress rows, the complete preview, statistics and footer clearance fit together. Apply that compact role uniformly across all zone names, rather than shrinking individual labels. Both secondary rows retain Regular body text.

Font size and line height describe the displayed role, separately from the 16px font-page size, base 15 and exported 20px pitch. Larger roles retain the two family keys and the isolated antialiased font path. Their consumers must measure the selected display size and apply the role's line height explicitly rather than deriving it from a global atlas scale. [Card fitting](../src/layout/contentCard.ts) measures signed glyph ink and kerning; preserve those bearings and fractional text positions. Visible ink boxes are content-fitted and can differ from line height. Scaling the current 16px page to 24px gives a natural 30px atlas pitch, so the main-heading target needs explicit 28px line-height alignment. The summary’s compact 17px role similarly has a natural 21.25px atlas pitch; its consumer corrects line spacing to the declared 20px advance. Preserve this distinction when aligning other heading consumers.

Keep the same role's size and weight consistent across screens. Wrap text, grow its region or reflow surrounding content when it does not fit. Metadata defaults to 16px; a smaller size requires an existing explicitly approved compact exception with a concrete reason. The compact 28px Install action retains the full-size action font, and navigation glyphs retain their icon geometry. Sprites keep their native pixel detail.

- Text holds 4.5:1 against what it sits on; essential icons and marks hold 3:1. A state never relies on colour alone.
- Text never shrinks to fit: reword it or grow the box. Each text role keeps one size and one font.
- Words in effects and labels are set in a font, never baked into sprites.
- A backdrop never shows its own place's name; the HUD names it.

## Chibi

Chibi is the male protagonist, a wide, round, cream-coloured bird drawn facing right and mirrored for left. `art/tools/bird.py` draws his; its docstring gives every frame's pose, timing and squash and stretch table.

- Shape: a wide, round blob of a body with a small round head set into its top at the front, a square ink dot eye and a short, plain orange bill. His back dips at the nape, so his round head sits up above the back line, and ends in a short tail tip at the rear. No bow.
- Colour: cream, with tan cel crescents and a white rim light. The wing is a flat tan patch, the feet tiny orange stubs. Dark-slate outline.
- Every jump flutters (a slow, steerable fall), so the flutter is his signature: the wing raised up and back from the top of his back, the body 2px higher, and the feet tucked under his belly.
- Dash appends three once-only frames after death, with 60, 130 and 60ms durations. The wing lifts up and back with a rounded tip, then recovers; the head, torso and feet retain the resting pose. The runtime selects this tag only during the active dash. Bird alpha does not supply collision silhouettes.
- Double jump appends four 60ms once-only frames after dash. The broad rounded wing makes a quick upstroke, downstroke and recovery while the head, torso and tucked feet hold the existing airborne pose. Play it only for an accepted second-jump launch; landing ends it and an active dash takes priority.
- Frame 48x42, feet on rows 39 and 40 and the outline on row 41.
- Collision body 24x36 (2x3 tiles), anchored bottom-centre: the frame's bottom edge sits on the body's bottom edge, and his body-centre x, 24 (the frame's centre line, between columns 23 and 24), sits on the body's centre, so mirroring him does not move it.
- Overhang of the 24x36 body at rest: his back and tail 8px on the left, his head and bill 10px on the right, and 2px of the body's height above his head left empty. The raised wing reaches 5px above the body, and the jump crouch and land squash push his tail out to 12px on the left.
- Portrait: 64x64, his head set into the top of his body, facing right, cut off by the bottom edge, with one ink outer line on a transparent ground. The dialogue box's 68x68 frame supplies the backing.

## Logo

The logo uses a full canonical cream bird standing on a simple platform above a flat dark-steel sign carrying the Chibi's Way Home wordmark. `art/tools/logo.py` draws three transparent PNGs with declared canvases: `logo` (558x239) for the title screen, `logo-nav` (226x30) for the site's nav bar, and `logo-icon` (53x41) for the /play/ nav column. The nav mark has one line of lettering beside the bird; the icon shows the bird and platform without lettering.

- The stacked title keeps `Chibi's` at 11px per glyph cell and enlarges `Way Home` to 9px, giving the lines comparable widths without distorting the font. The taller sign preserves clear spacing between lines.
- The dominant lettering and platform colour is `zone-blue`. The flat dark-steel sign, quiet light edge and ink outline separate the wordmark on pale steel and dark navy. There is no extrusion, bright cyan highlight or drop shadow.
- The bird retains the protagonist's cream body, tan wing, orange bill and ink dot eye, redrawn from the canonical sprite shapes with a one-pixel outline.
- The homepage image uses its intrinsic 558:239 ratio and natural height, without a fixed aspect-ratio box.
- The title is supplied by `WORDMARK`; the 5x7 alphabet in `GLYPHS` provides its letters. All three image keys, paths and canvas sizes stay fixed so navigation and title-screen placements remain compatible.

## Homepage

Approved layout target for paired page implementation: reuse the existing logo and city backdrop assets with a quiet powder-blue hero field. Extend the skyline across that field rather than confining it to a rectangular tile directly behind the logo. Keep its contrast low enough that copy and controls remain the focus. The muted zone palette, natural 558:239 logo aspect ratio and nearest-neighbour image sampling remain unchanged; no new illustration is required.

- Actions: retain Install on the left and primary Play on the right, with an 8px gap, 48px minimum height and at least 16px horizontal content padding. Preserve installation availability and existing interaction semantics. Play uses dark steel with a white label; secondary actions retain the shared grey treatment and disabled controls retain pale steel.
- Copy: retain the existing game description, subline and input instructions. Use the existing full-size page type, with a 20px pitch and 16px body text. Reflow or allow vertical scrolling rather than shrinking text.
- Layout: on wide views, place the logo beside one coherent text column containing the pitch, subline, actions and input instructions. Keep the actions with the copy rather than below the logo. On narrow views, stack logo, copy, actions and instructions in that reading order. Retain at least 16px safe-area page padding, 16px between content groups and clear space around the logo. Keep short landscape screens scrollable when their full-size content exceeds the available height.
- Navigation: preserve the existing logo, Home and Play navigation links and their behaviour. Page headers and hero content remain distinct from modal framing.

## Opening presentation

The runtime opening uses four single-shot beats on a plain `ink` field. Each shot has `background: null`, so it performs no background-image lookup. It uses the actual `bird`, `ferret-antagonist` and `ferret-parcel` sprites at native 1x in their `idle` poses; Fert is mirrored through `flipX` metadata while Chibi and the parcel are not. The authored anchors are 24,42 for Chibi, 24,48 for Fert and 12,24 for the parcel, all placed at y240. Existing captions, manual Continue, whole-opening Skip and save acknowledgment remain unchanged. The [painted opening pack](opening/README.md) and its originals remain retained separately; they are not the current runtime presentation.

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

### Skills and room rewards

`art/tools/skill_icons.py` exports three transparent 16x16 glyphs. Each has one static `ready` frame at index 0 and one `muted` frame at index 1, both 100ms and looping. The alpha geometry is identical; `ready` uses cream and `muted` uses grey. These assets have no contact box or baked background.

| Skill       | Art key                | 48x48 HUD target origin |
| ----------- | ---------------------- | ----------------------- |
| Dash        | icon-skill-dash        | 552,8                   |
| Double jump | icon-skill-double-jump | 608,8                   |
| Speedy      | icon-skill-speedy      | 664,8                   |

The base 720x360 view places these targets left to right in one horizontal top row, with 8px between targets and 8px from the top and right edges. [The source layout](../src/layout/skillHud.ts) adapts the positions to the view. [Button composition](../src/scenes/skillButton.ts) draws smooth procedural circles centred at target-local 24,24: every skill and state uses the same 16.5px outer radius (33px diameter) within its existing 48x48 target, matching Pause's resting visible disc (a 35px canvas with a 1px transparent inset). The selected skill draws a 4px dark `ink` annulus inside that fixed circle, leaving a 12.5px face radius (25px diameter). An unselected face fills the complete circle. Selection, recharge and disablement never enlarge or scale either the circle or glyph. There are no light-coloured rings or reused `ui-pause` chrome. Place the unchanged native 16x16 glyph at target-local 16,16; its centre anchor remains 8,8.

Cache the circle chrome in a 192x192 CanvasTexture at 4x resolution and display it at 48x48 with local linear filtering. Fractional RGBA coverage smooths only the circle boundaries; face and ring interiors remain opaque. Preserve the global pixel-art renderer and nearest-neighbour glyph sampling. Do not bake selection, circle chrome or target coordinates into the glyph exports.

Locked icons are hidden. Unlocked icons remain visible, including when muted. Only one selected power-up affects play at a time. During play, tap selects that power-up without performing its movement action; a 400ms hold pauses and opens details without selecting the held skill. Selection and recharge produce three visual states:

- Enabled and ready: the selected skill has the dark ink ring and a bright `yellow` (`#fee761`) face throughout, with its native `ready` glyph rendered in `ink` (`#181425`). The glyph holds 14.43:1 contrast against the face.
- Enabled and recharging: the selected skill retains the dark ink ring, with an opaque `navy` (`#262b44`) face and its native `grey` (`#8b9bb4`) `muted` glyph, holding 4.93:1 contrast.
- Disabled by another selected power-up: the unselected skill fills the complete fixed circle with flat opaque navy and retains its grey `muted` glyph, without the dark enabled ring.

Double jump recharges when support resets its spent air jump. Being grounded or holding Jump alone does not mute it. Dash is recharging during its burst, cooldown or spent airborne charge. Speedy is passive and ready whenever selected. [Ownership and development overrides](../src/rules/skills.ts) determine availability; a false development override falls back to saved ownership and does not erase it.

The world HUD is hidden and blocked beneath dialogue and all modals except Pause. While Pause is open, the same HUD icons remain visible and a tap opens details, replacing Pause without changing the selection. There is no duplicate skill row inside the Pause card. Details use the standard centred, content-fitted pale-steel card, full-size fonts, three-step scene dim and [ordinary close control](controls.md#modal-content-fitting), with a 24x24 X inset 6px and its 48x48 target. Closing details resumes play with fresh input; it does not return to the Pause stack.

Secret-room entry grants a permanent skill; repeated grants do not stack. The first gift becomes selected automatically, while later gifts keep the current selection. The room reuses the top dialogue rectangle at 40,8,640,96 with the harmless `dog-pug` idle image at native 44x32, centred in the existing 68x68 portrait frame. Supportive text, descriptions and grant placement belong to gameplay data. The separate in-room details card is nonmodal: reuse native card and icon artwork without a close X, modal dim or additional pause behaviour. [Its measured layout](../src/layout/skillDetails.ts) fits between the dialogue and the bottom-right primary Continue action, retaining the existing fonts and complete press-target clearances. Continue uses `ui-button-primary`, dslate with a white label and no play mark, at the standard 48px height with a content-fitted width and 16px bottom and right insets. Ordinary rooms retain their secondary Leave control at 640,10,72,28. Room lifecycle remains source-owned; do not hardcode the illustrative mock's card dimensions.

### Dialogue box

- The dialogue panel is at the top, 40,8,640,96. One paragraph of at most three lines shows at a time; advancing replaces that paragraph rather than adding a chat history. Play is frozen and touch controls hide while the conversation is open.
- The bird's portrait is on the left. Other speakers' portraits are on the right; consecutive paragraphs from the same speaker keep that side. Reposition the 68x68 portrait frame and 64x64 portrait without mirroring either artwork.
- Name tabs sit inside the panel. Their fill is the speaker's colour: amber, green, pink or tan. Ink text holds at least 6.6:1 on each, and each holds at least 5:1 on the panel's navy.
- Continue is the primary `ui-button-primary`, 488,112,192,48, with a white label. Skip is the secondary `ui-button`, 288,112,192,48, with an ink label. Both remain visible below the panel, separated by 8px; labels centre by visible ink within each state’s drawn face, using the shared [button measurements](controls.md#sizing-and-spacing). Primary actions omit the dark play mark.
- Continue advances the current conversation. Skip skips its remaining paragraphs but opens any required terminal choice without selecting an answer. A required choice uses a modal card with ordinary form buttons; while it shows, Continue and Skip underneath cannot activate. No live conversation currently configures a choice.

| Speaker | Portrait frame | Portrait origin | Name origin | Paragraph origin and width |
| ------- | -------------- | --------------- | ----------- | -------------------------- |
| Bird    | 48,22,68,68    | 50,24           | 124,13      | 128,42, width 504          |
| Other   | 604,22,68,68   | 606,24          | 84,13       | 88,42, width 504           |

Both paragraph regions use the [body role and line height](#typography-scale). Labels, portraits and text move as layout elements; their textures keep their authored orientation and scale.

### Modal backdrops

All actual modals use the canonical shared-kit backdrop painter to dim the underlying scene by three `palette.darker` steps and block its controls. Apply this without exceptions to update notices, settings, pause, install, restart, death/retry, stage selection, stage clear, zone clear and modal dialogue or choices. Keep the existing palette treatment and standard text contrast. Draw one canonical modal backdrop pass for the visible layer. Death/retry passes its ordinary frozen snapshot to the painter once, without the `alreadyDimmed` bypass. Use that identity bypass only for an image that is genuinely already dimmed. The remapped image receives no alpha overlay; the opaque ink fallback remains unchanged. Ambient start-screen `dimColour` retains its separate two-step treatment. Modal dismissal rules remain specific to each screen, and dismissing one never activates controls underneath.

Live zone foreshadow dialogue remains nonmodal and interactive during active play. Page headers are ordinary page content. Approved title target for the same paired integration: centre every actual modal title across the whole modal, including framed death/retry, long install instructions and stage selection. Reserve the full positioned close target plus the normal gap equally on both sides. The current close geometry gives 50px clearance per side. Wrap titles at full font size and grow the measured header or modal when needed; never shrink text. Full-page headers, button styles, body padding, the half-viewport width floor and close-control geometry remain unchanged.

### Stage progress and retry

Approved target for paired runtime integration. The rulebook owns failure behaviour, timing, progress calculation and time accumulation; the game supplies every label and value.

- Stage progress is a 4px strip at the bottom of the canvas, spanning the 720px play view. Its rows are 1px `ink` on top, 1px `yellow` and 1px `amber` fill over a `dslate` track, then 1px `ink` on the bottom. At 720x360 it occupies 0,356,720,4; wider and taller canvases retain the existing horizontal play-view anchoring and bottom shift. Its filled length continues to show percentage through the stage, with the existing visibility, cameras and depth. Keep it separate from UI buttons, with no glow or pulse. Boot and death loading indicators retain their separate 2px top strips.
- On failure, show a small recoil, a pronounced falling tilt to support, a brief impact squash and a small rebound into a round grounded sit. Its belly has a short flat centre and rounded contact ends. Feet remain visible during recoil and fall, and are hidden during impact and seated rest. The sprite has no baked world movement. Before the first death pose, visibly pan the paused world to the final bottom-centre framing described below. Show the retry card as soon as the seated pose is reached, holding that pose beneath it without an extra timed pause or automatic retry.
- Before the first death pose, visibly scroll the camera to place the final sprite frame centred horizontally at x360 with frame bottom y348, leaving the configured 12px bottom inset in the logical 720x360 view. Derive pan duration from actual camera distance at 360px/s, clamped to 0.5 through 2 seconds, using shared `sineInOut` easing; an exactly zero-distance pan completes immediately. Keep simulation, input and active-play statistics frozen throughout the pan, then play the death sequence once before opening the modal. Cancel pending pan completion on shutdown so it cannot start a late animation. Preserve the authored 48x42 frame and its transparent padding. For a void fall, begin the presentation 96px above the final floor so the whole fall remains visible. Resolve the presentation floor once at the planned post-recoil position; only the presentation sprite moves while the rules state stays frozen. Keep the same camera framing through recoil, fall, impact, bounce, seated rest and the centred modal snapshot. Play the death sequence once; opening the modal neither reframes the camera nor replays the animation.
- Dim the frozen environment once through the canonical shared-kit modal backdrop painter with three `palette.darker` steps. Pass the ordinary snapshot without the `alreadyDimmed` bypass or another dim pass. Centre the measured modal on both axes of the full logical viewport. The world owns idempotent camera scroll and bounds restoration on retry, title return or shutdown; cancel contact-feedback offsets before restoring the original camera. Physics and retry behaviour remain unchanged.
- Reuse the content-fitted `ui-settings-card`, with no close X or title bar. Centre the identity/progress group: zone name, `Stage <number>: <stage name>` and Progress. After a 16px group gap, place Last time, Best time and Attempts in the left column, and Stage total, Zone total and Run total in the right column. Use equal measured column widths, with left-aligned labels and right-aligned values in each column. A 2px ink vertical divider remains at the card centre, with 16px clearance on each side. The title retains symmetric 50px clearance without adding a close X. Stage numbers are 1 through 6 within Apartment and 1 through 3 within the other zones. Keep standard fonts and sizes; wrap measured headings rather than shrinking text.
- Apply the [shared modal content-fitting rule](controls.md#modal-content-fitting): 16px outer padding, measured line boxes of at least 16px with 4px row gaps, a 16px gap between the metric columns and the 48px action row, and a minimum of half the full logical viewport capped by actual safe available width. Inset the metric columns horizontally by at least 24px from the card edges. Three identity/progress rows and two parallel three-row metric columns form separate measured groups; the metric region’s height is the taller column. Derive the card height from the actual full-size text, padding, gaps and actions rather than a fixed canvas; wrapped lines increase measured height.
- Inside the centred retry card, show one current-antagonist statement as a single 16px body-text line, without a separate speaker name, portrait or top overlay. Measure its full visible ink before wrapping and allow the content-fitted card to widen within the existing safe cap. Measure each statement and both statistics columns with the native fonts; widen the card within its safe cap rather than reducing text size. Insert the statement between identity/progress and metrics, with an 8px gap after identity/progress and a 16px gap before the metric columns. Derive its height from those measured groups; taller ink and wrapped text grow the card. Preserve full fonts, symmetric 50px title reservation, 48px actions and the existing death-camera sequence.
- Last time measures the current attempt. Best time is the fastest successful attempt and excludes failures. Attempts includes the current attempt. Stage total accumulates active play across attempts in this generated stage run. Zone total covers the current visit, including retries and backtracking. Run total covers the whole playthrough, including retries, and saved Continue preserves it. Death/retry preserves the generated stage run; a freshly generated stage run resets its stage counts. Live foreshadow dialogue counts as active play, while paused dialogue, interstitials and menus do not.
- Place the secondary Back to title action on the left and primary Try again on the right, using the standard faces, equal sizes, label font and focus treatment in [the form control guide](controls.md#retry-actions). Neither an outside tap nor an elapsed timer retries the stage.

### Live barks

Live antagonist barks use `ui-dialogue-box` at 0.75 alpha; text and portraits remain opaque. Present a bark only while its owning actor's rendered sprite bounds intersect the viewport, and hide the current bark if that actor leaves. Keep offscreen or unowned scheduled lines pending and unheard; mark a line heard only when it actually starts with an eligible visible owner. Ordinary paused dialogue retains its existing presentation.

### Quip

A one-line strip at the top centre (x 360), y 8, height 24, sized to its text and at most 452 wide (x 138 to 590), led by the speaker's name in their name-tab colour. It never pauses play and never reaches the lower corners.

### Touch controls

Two round buttons for the right thumb, Use above and to the left of Jump. Each is the move hint's open ring, 73px across with no face: a 3px cream band between 1px ink lines, with its icon centred and fringed in ink, so it holds 3:1 on any ground, the sky and any character. No label. Hidden on desktop and when the setting is off.

| Control | Centre, as drawn | Frame | Ring      | Icon       |
| ------- | ---------------- | ----- | --------- | ---------- |
| Use     | 592,210          | 75x75 | 73px wide | three dots |
| Jump    | 667,307          | 75x75 | 73px wide | caret      |

- Centres are the base 720x360 layout, as drawn. At runtime the game anchors Jump, Use and the pause button to the screen's corners, so on a wide or tall screen they sit in the spare space outside the game.
- Live Move, Use and Jump chrome is drawn procedurally at 4x into four cached texture sheets, including the separate 11x11 movement knob. Keep the 75x75 control frames and 73px rest diameter, centred at 37.5,37.5. The open ring has a 3px cream core between 1px ink edges, extending 5px inward from radius 36.5. Jump uses a 3px caret stroke; Move uses 4px chevrons; Use has three 8px cream dots. Symbols retain 1px ink borders. Render live Move, Use and Jump, including the knob, at 85% opacity in every state without changing stroke widths. Analytic edge coverage and local linear filtering smooth these textures without smoothing world art or shared atlases. Help illustrations use the same procedural geometry with the filled treatment below.
- Press: the band and icon turn white and the outer radius grows 1px for the first frame, then returns to its rest radius (frame 0, then frame 1, 60ms each). White holds until release, which snaps back to rest. Existing asset tags supply animation timing.
- Movement: a touch anywhere off a button sets its own neutral point. The move hint (`ui-move-hint`, 75x75) shows where to put the left thumb: an open ring 73px across with no face, a 3px cream band between 1px ink lines and an ink-fringed chevron each side, so it reads on any ground, the sky and any character. It is a drawing only, with no press area. At rest its centre is level with Jump's and its ring as far in from the view's left as Use's is from its right: 121,303 at 720 wide. While a touch moves her, the game draws it on that touch's neutral point, anywhere on screen, lights the dragged side's chevron (`held-left`, `held-right`) and slides its knob (`ui-move-knob`, 11x11) up to 12px left or right; on release it returns to rest.

### Action-help illustrations

Inline Move, Use and Jump illustrations in help and skill descriptions use opaque `navy` circular faces, with `cream` rings and symbols edged in `ink`. Reuse the live controls' rest geometry uniformly at 40/75 scale within a reserved 40x40 frame, including the centred movement knob. Do not add a separate help stroke weight or fill live control interiors. Phaser uses cached 4x canvas textures with local linear filtering; the homepage uses static SVGs with automatic image rendering. These illustrations add no raster assets or shared-atlas filtering changes.

Keep the action label and illustration together when wrapping. Reserve the label's complete bitmap advance plus any positive centring offset on both sides, then a 4px gap and the full 40px icon frame. Following text retains its measured space advance (4px with the current body font). Centre the label and icon within the 48px action row, with 4px between rows; text never overlaps the icon reservation. Preserve the existing strings and full font sizes.

### Dash wind

Dash wind uses three horizontal cream cores behind Chibi, each 2px thick with a 1px ink border (4px total height). Core base lengths are 36, 27 and 18px at local rows 14, 23 and 32 of the unchanged 48x42 frame. The nearest outer border pixels leave gaps of 4, 8 and 5px beyond the rear frame edge; cores start 1px farther away. Mirror placement with the committed dash direction so no stroke appears ahead of or inside the frame. Draw all borders before all cores. The first six core columns retain the head strength, which decreases from full opacity towards 75% over the active phase; the remaining columns fade towards the distant tip with exponent 1.35. Lengths shorten by up to 25%, rounded to whole pixels, as the effect ages. Age follows the configured active dash phase, with no separate lifetime or post-dash tail; the strokes disappear completely when the phase ends. The effect draws on the world plane behind the bird, outside the controls camera, and clears for pause, modal, room, death and retry views. This procedural effect adds no texture, contact mask, body pose, invincibility cue or cooldown icon.

### Double-jump cue

An accepted second-jump launch that survives its step in the same area emits two upward open cream carets matching `icon-skill-double-jump`, with a 1-world-pixel ink border. Attach the cue to the current 48x42 presentation frame's centre on every draw, using the same frame as dash wind. [Cue values](../src/data/airJumpCue.ts) set scale 1.5 and offset 0,32, placing the upper ink apex 1px below the full frame's bottom. Add a 4px horizontal lead in the sign of actual horizontal velocity, with no lead at zero velocity. Only the linear fade depends on elapsed time over the 240ms duration; there is no fixed launch origin, independent rise or trailing emission. Round the attachment anchor once before placing the scaled caret pixels, keeping the bordered cue at 17x22 world pixels even at fractional frame positions. The paired once-only `double-jump` body tag uses frames 21 through 24 for 240ms; pose priority is active dash, double jump, then ordinary movement. Clear the cue and bounded body pose on landing, cover, death, area change or shutdown. Ordinary and refused jumps emit no cue. This presentation changes no physics or contacts; Chibi retains the fixed 24x36 collision body. Dash retains its separate three horizontal wind lines and matching `icon-skill-dash` glyph.

### Start screen

The game boots into the start screen; Start goes to the map. A nav bar runs across the top with icon buttons at its right, and Start sits below the logo.

`start-background` is an opaque 720x360 static image at origin 0,0, drawn by `art/tools/start.py`: pale steel sky, seven low outer skyline silhouettes and one ground band. Its three existing palette colours leave the logo and actions clear. Use it directly without ambient dimming; it has no repeat, animation, collision or lights. The responsive homepage retains its separate composition.

- Nav bar `ui-nav-bar`, 0,0,720,48.
- Icon buttons `ui-icon-button`, 36x36 at y 6, each with a 20x20 icon 8 in and 6 down (8 down while pressed). With Exit: Settings at x 632 and Exit at x 676, so Exit is at the far right. Supported Chromium app windows retain Exit when launched with single-entry history and a CloseWatcher. Other installed app windows hide Exit and retain Settings alone at x 676. Browser tabs retain Exit and return to the homepage.
- Logo (`logo`, intrinsic 558x239) is proportionally contained in the available horizontal and vertical space above the action row. Its top remains y 60; derive its display size from the texture ratio and available space. At the default 720x360 view it displays about 450.6x193, centred horizontally, leaving 15px to the drawn actions and 3px to their expanded hit areas. Start (`ui-button-primary`, 192x48, dslate with a white label) remains at 264,268. With saved progress, Restart uses the secondary `ui-button` (grey with an ink label) at 164,268 on the left, and Continue the primary style at 364,268 on the right: both 192x48, with an 8px gap, centred under the logo. Continue remains the default action for keyboard activation. Nav and icon controls keep their separate styles.
- Icons share their shapes with Archie's: the cog (8 square teeth round a ring with a round hole), the exit (a doorway in 2px strokes, open on the right, with a solid arrow leaving it) and the home (a solid house with a 1:1 pitched roof, a chimney on the right slope and a door gap). Each comes as a 20x20 nav icon and a 16x16 row icon.
- Button labels centre horizontally and vertically by their actual visible ink, including font bearings, within each state's drawn face. Use the shared [button measurements](controls.md#sizing-and-spacing), press handling and focus handling. Start and Continue on this screen omit the play mark. The map uses the same standard primary and secondary button styles.

### Pause, settings and install cards

A pause button at the top left opens the pause card over the game, dimmed through the canonical shared-kit modal backdrop painter. The pause card offers Resume, Settings and Back to title, stacked in that order with Resume primary. Settings replaces it over the same dim, and Install opens the browser-specific steps. One card shows at a time.

Every ordinary modal uses the [shared content-fitting rule](controls.md#modal-content-fitting): its actual title, full positioned close press target, body rows and actions determine its size. Ordinary body content keeps 16px clear padding and a minimum panel width of 50% of the full logical viewport, capped at the safe available view. The shared `MODAL_CONTENT` and `modalWidth` rule in the control guide add outer padding once; height remains content-fitted without a minimum. This is not a fixed modal canvas. A 24x24 close face sits exactly 6px from the panel's top and right edges and retains its 48x48 press target. Reserve the full positioned close target plus an 8px gap symmetrically around the centred title. Keep every other interactive control's expanded press rectangle below that target plus the same gap; never clamp or shift the close target to fit the panel. The pale steel `ui-settings-card` frame has an ink border, no title bar, an ink title and an ink close X where closing is allowed. Text remains at its normal size. Settings rows have no box: a dslate icon, ink label and switch or compact action form a measured group, and the complete 48px row responds.

- Pause button: a smooth procedural disc, rendered at 4x into one cached sheet with local linear filtering and full opacity. Keep its 35x35 logical frame and existing placement. The resting disc is 33px across (an ink edge, a 2px cream ring and a navy face, the ring white and 1px thicker and the face a step lighter while pressed), with two 4x13 rectangular pause bars separated by 3px and no label, centred at 24,24 as drawn (35x35 frame, top-left 7,7), its edge 8px in from the game view's top and left. Every control stays inside the view across; Use, Jump and the move hint sit at the screen's bottom, so on a screen taller than 2:1 they move into the bar below, with Jump's ring 8px in from the view's right and 20px up from the bottom, and no drawn edge closer than 8px to the edge it is placed against. It is a touch control: hidden on desktop and while a dialogue box is open. Its press area remains the existing 52.5x52.5 rectangle, derived from the 35px frame by the shared press-area rule. Preserve the canvas-camera routing and top-shift anchor. Press plays the existing two 60ms frames once, swelling to 35px across only in the first frame, then holds at rest size until release.

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

The update notice is an ordinary modal offered only on the game's own Start screen. It has the title Update available, secondary Cancel on the left, primary Update now on the right and the ordinary close X. Only Update now accepts. Cancel, X, outside taps, Escape and Back all defer through the shared dismissal flow without reloading or discarding the waiting service worker. Dismissal lasts for the same Start visit; only a newly created Start scene resets it, not resuming Start or closing settings. Settings, restart and nested install cards suppress the offer while covering Start. The game supplies the words and behaviour.

- Assets: existing `ui-settings-card`, secondary `ui-button`, primary `ui-button-primary` and `ui-close`, with the shared [typography roles](#typography-scale) and their current implementation status. Preserve the canonical three-step dim backdrop, exclusive modal input and ordinary focus, press and dismissal guards, without new art or palette colours.
- Fit: apply the [shared modal sizing rule](controls.md#modal-content-fitting), centred on both axes, with a minimum width of 50% of the full logical viewport capped at the safe available view, 16px ordinary body padding and the close face's separate 6px top-right inset. Height remains content-fitted. The header accounts for the entire positioned 48px close press target, not only its face. Keep at least an 8px gap between the close target's bottom and each action's own expanded press target, not merely its 48px drawn face. Centre the title across the card, reserving the full target and its clearance symmetrically.
- Measurement: derive the header from the actual title ink plus the mirrored 50px close-target reservations. Fit equal-width actions to the widest visible label with standard content padding and an 8px action gap, and place their complete expanded press targets below the y50 clearance. Apply the shared minimum-width rule to the measured content width, excluding outer padding from its input. Derive the card height from the actual bounds and ordinary body padding, without a minimum height. Longer copy grows the frame rather than shrinking the font or forcing a shared modal size.

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
- Labels: names use native 16px `font-title` at 1x, ink, centred below the markers. The 212x16 lgrey knock-out begins at cx-106,cy+17 and leaves at least 16px between adjacent 228px-spaced centres. Centre actual visible ink within it, correcting for signed bearings and kerning rather than subtracting a fixed amount from the advance width. Optional availability text, when supplied, uses native `font-body`, dslate, with strings and placement supplied by gameplay.
- Footer: Back to title uses secondary `ui-button` at 164,300,192,48, with an ink label; Continue uses `ui-button-primary` at 364,300,192,48, with a white label. Neither uses a play mark. Continue is the default keyboard action; a tap on an open zone marker selects that destination.
- Legacy assets: `map-fork`, `map-hill`, `map-wave` and `map-compass` remain available. The six-destination layout does not require fork or pen-mark decorations.

### Stage picker

Map Continue opens the selected zone's stage cards, with three full-size cards per page. Apartment has six floors across two pages; the other zones have three stages. Selection immediately starts an available stage; there is no extra confirmation action.

- Frame: content-fitted `ui-settings-card`, centred, with 16px padding, a minimum width of half the full logical viewport and the 6px top-right close-face inset with its full 48px press target. The three-card group uses a 688px-wide panel in the 720x360 view. Derive its height from the measured native title, stage faces and optional pager. Centre the title across x360 and vertically within its measured header.
- Cards: three 208x162 faces, with 16px gaps. Each displays an actual 168x84 stage capture, a top-right Stage number in native 16px Regular and its main name in native 16px Bold, both at 1x. Wrap the name to at most two lines. Keep image and label positions fixed across the cards: previews begin 26px below each face top; the 36px name block begins 114px below the face top, leaving 12px below it. Derive the row position from the measured header and full press targets, retaining exactly 8px between the close target and stage-row targets. Neither the number nor the main label shrinks to fit.
- States: the latest available stage uses the primary dark-steel face with white name and Stage number; other available stages use secondary grey faces with ink names and Stage numbers. All available labels and numbers remain fully opaque, regardless of progress. Only locked stages use muted labels, numbers and greyed scene images. They cannot activate. Approved target for paired runtime integration: a refused activation animates the entire card, including its screenshot, with the shared 320ms disabled-control feedback. Normal motion uses 3px horizontal yoyo movement and red/original label alternation; reduced motion uses steady red labels without motion or flashing. Restore positions and colours after feedback. Retain the disabled palette, standard focus treatment, keyboard skipping and complete press targets.
- Return: close, back and outside taps return to the map. Normal modal input isolation and keyboard focus apply.
- Images: `stage-preview-zone-N-stage-M`, N 1 through 6 and M 1 through 3 (M 1 through 6 for Apartment), are opaque 168x84 PNGs registered as manifest images. Capture the actual seeded stage at 720x360, then resize once with nearest-neighbour sampling. Preserve its full 2:1 view and actual captured stage area; do not replace scenery with a concept illustration. Apartment floor previews use frozen final-cap views with their framed depth windows and local wall materials. Optional-room doors outside the capture are not added to the thumbnail. Capture mode freezes the scene at time zero with explicit layout/motion seeds and camera coordinates, hides overlays and does not step physics or write progress.

### Stage and zone summaries

Stage-clear interstitials reuse the exact `STAGE_PREVIEWS[stage]` image displayed by that stage's selector card. Preserve its complete 2:1 scene and resize with nearest-neighbour sampling; do not capture the death or end position or generate another screenshot. A cleared stage shows one current-antagonist statement and the primary Continue action, without Skip, a close X or automatic dismissal. Fresh Continue activation or a guarded statement-line tap follows the existing continuation route. Turning back retains its summary route but shows no clear statement. Gameplay supplies the statement and values.

Use the centred preview-first full-page summary layout. In the 720x360 view, centre the zone heading, Stage and Progress on three separate rows above the preview. The zone uses `type-heading-compact`: uniform 17px Bold with 20px line height, `lgrey`, and visible ink beginning at y16. Stage and Progress keep the Regular body role; stage text is `cream` and Progress is `lgrey`. Derive each row, then the preview and statistics, from the preceding measured ink bounds with 4px vertical gaps. The selector image remains 240x120, centred horizontally with its left edge at x240; derive its top from the separate Progress row. Preserve its complete 2:1 scene with nearest-neighbour sampling. Below it, centre one 336px-wide statistics group at x192..528: two equal 152px columns separated by 32px. Labels align left at x192 and x376; values align right at x344 and x528. Three metric rows use a 20px pitch. Metric labels are `lgrey` and values `white`. Keep both columns unboxed, without section headings, top rules or a vertical divider.

The left column shows `Last time`, `Best time` and `Attempts`; the right shows `Stage total`, `Zone total` and `Run total`, using the same timing meanings as retry. Centre the clear statement below the metrics as one unboxed line: the speaker name in its supplied colour, an 8px gap and the statement in `cream`, without a portrait or dialogue panel. Place its measured ink 8px below the metrics and retain at least 8px before the footer press target begins at y284. Preserve the shared 16px page inset and the existing Continue action at 512,296,192,48. Omit the Whole run row, death and completed-stage counts and redundant zone stage-count line; the saved ledger and counters remain unchanged. Death/retry retains its separate compact modal.

Zone total covers only the actual visit and never mixes in historic stages. The rulebook and runtime data own metric meanings and timing.

## Animation

- Motion is in whole pixels. Tag names are the animation names. New tags go after existing ones so frame indices hold.
- Squash and stretch are per-frame tables of height, squash, stretch and shadow size. Volume stays roughly constant during normal locomotion; the death squat deliberately deflates it. The contact frame's shadow is the largest. Effects have a clear peak frame.
- Short reactions run 60 to 80ms per frame (shake 60ms, tap burst 4 x 60ms). Anything that opens a modal waits for the tap burst to finish.

### Failure poses

The bird's 48x42 `death` tag is appended after `land`, leaving all earlier frames and tags unchanged. Relative frame 0 is the small recoil with visible feet, frame 1 a pronounced falling tilt with visible tucked soles, frame 2 a brief stronger impact squash and frame 3 a full, round seated rest. The last two poses hide the feet completely. The seated body is 34x21 with a nearly full-height head, a short flat belly centre and rounded contact ends resting at the frame bottom; it springs slightly up from the 38x16 impact pose rather than holding a flattened body. `death` plays once and holds its last frame. Its authored durations are 100, 120, 80 and 400ms; these are art playback defaults, not gameplay state durations. Runtime holds frame 1 until support is reached, then plays frames 2 and 3 once. The retry card opens when frame 3 is reached, with that seated pose held underneath it. Keep the body-centre and frame-bottom anchor fixed across the poses; world movement belongs to the runtime. Existing `jump` and `land` do not supply the seated terminal pose.

### Enemy contact silhouettes

The six antagonist body sprites declare `contact: "silhouette"` in the manifest. Their drawn opaque pixels, including coloured outlines, define body contact; transparent space does not. Portraits, projectiles, traps and separate effects such as `bear-growl-wave` are excluded. Existing hit boxes retain their physical reach role; body contact uses the full rendered frame as its broad phase.

Run `python3 -I art/tools/contact_silhouettes.py build` after changing body exports or contact registration. Each opted-in actor build also refreshes this shared export. `public/art/contact-silhouettes.json`, registered as the `contact-silhouettes` data key, contains version 1 and a `sprites` object keyed by art key. Each sprite contains `width`, `height` and `frames`; each exact Aseprite frame name maps to sorted `[y, left, rightExclusive]` runs in untrimmed frame coordinates. Adjacent occupied pixels merge into one run; an empty frame has an empty array. Alpha greater than zero is occupied, and partial alpha fails export. No animation tags or timings are duplicated.

The runtime caches these runs and applies the sprite's current frame, facing, anchor and scale. This export changes no artwork, layout, motion or animation metadata.

### Enemy attack warning

For all six antagonists, during an attack sequence's tell or grounded jump takeoff preparation, including pursuit and idle recovery, draw a temporary outline around the current animated frame's alpha silhouette, accounting for facing, origin and scale. A 1px muted red `warning-red` (`#d45253`) band directly adjoins the opaque sprite pixels, with a 1px outer `ink` (`#181425`) border. Both remain fully opaque, adding 2px outside the sprite silhouette. Draw only in exterior transparency, leaving body pixels and enclosed transparent holes unchanged. Keep the cue on the world plane behind the actor, following both grounded and airborne poses. The outline warns of an upcoming attack or jump; it is not a contact boundary, damage indicator or permanent enemy outline. Show it only while either preparation is active. Keep it steady, including in reduced motion, without strobing or pulsing. Reuse the preparation pose without changing body pixels, contact masks, animation metadata or raster assets; gameplay owns preparation durations.

### Enemy anticipation movement

The six registered antagonists append `anticipate-lift`: load 120ms, lift 160ms and return-brace 200ms. This 480ms tag plays once and holds its final prepared pose until the existing gameplay tell ends. Archie, Fert and Kiwi use a small in-frame visual hop; Bini stays grounded through four-paw shoulder compression; Trixi raises a wing with her feet planted; Pebble lifts his wings and returns to the established airborne tuck. World positions, path origins, frame sizes, anchors and physical movement remain unchanged. The new exact alpha silhouettes join the contact export; no contact is clipped to the reach box. Existing frames, tag indices and timings stay unchanged.

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

Hazard contact causes death; Try again returns to the stage checkpoint. Approved target for paired runtime integration: hazard contact also shakes the world while Chibi enters the existing death sequence. The render-only camera effect lasts 280ms with up to 5px diagonal offset, 5px overscan and a fixed HUD; elapsed time comes from the render loop, not physics. Restore the camera on completion, restart or shutdown. Reduced motion uses a static border cue without shaking. Retain Chibi’s 1px border keyline and 0.12 tint alpha. Actor motion does not itself trigger this effect; explicit retry behaviour is unchanged. `art/tools/hazards.py` draws the hazard sprites and `art/tools/floor1.py` the hazard tiles; their docstrings give every frame and tile.

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

`dog-antagonist` represents Archie, modelled on the Australian Shepherd in Archie: brown and white patches, a white blaze, muzzle, ruff and paws, high folded rose ears, a compact white-tipped bobtail and a red bandana. The right-facing 60x40 sprite has the visible sky-blue eye; the 64x64 portrait also shows the amber iris. The pug remains a separate asset. Frustration compresses before takeoff, lifts the sprite 3px and then 5px within its unchanged canvas, and returns to a planted stomp; its runtime position and contact box do not move with the drawn hop.

The contact box is fixed across all poses: x 2, y 2, width 56, height 38, in frame pixels. The contact box is collision data, not a visible red rectangle or silhouette outline. The sprite has no baked red danger line. All drawn body parts remain inside the contact envelope, which does not shrink when the dog crouches or rests. Contact is always lethal; a crouch or rest is a movement cue, never a safe state.

| State  | Tag      | Art cycle               | Pose                                     |
| ------ | -------- | ----------------------- | ---------------------------------------- |
| Crouch | `crouch` | one frame, 400ms        | body low and legs tucked before the rush |
| Idle   | `idle`   | two frames, 400ms each  | breathing with feet planted              |
| Patrol | `walk`   | four frames, 120ms each | alternating legs and a small passing bob |
| Rest   | `rest`   | two frames, 400ms each  | settled body after the rush              |
| Rush   | `rush`   | two frames, 80ms each   | stretched body and reaching legs         |

These animation tags are available as loops. The runtime selects a tag for each active gameplay state. Gameplay data owns the duration and transition of patrol, crouch, committed rush and rest; art cycle durations do not set encounter timing. The five-column by four-row placement (60x48) bottom-anchors the 60x40 frame, putting the contact box ten pixels below the placement's top and ending at its bottom.

`portrait-dog` is Archie's 64x64 right-facing portrait, with the matching brown-and-white coat, folded ears, white blaze, red bandana and sky/amber eyes. It retains its ink outline and transparent ground, cut off at the bottom. Its `neutral` tag remains one frame at 1000ms, using the existing dialogue portrait frame.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

The looping `pounce` tag appends four 100ms frames after frustration: crouched takeoff, two extended airborne poses and compressed landing. Existing frames, timings, canvas, anchor and contact box remain unchanged. Gameplay controls the actual arc and phase; the artwork supplies silhouettes inside the fixed frame. The leaping pounce supplements Archie's ground charge, and contact remains lethal throughout.

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

For a dangerous top, use a plain solid face under the hazard instead of a safe white-lipped top. Approved target for paired art and runtime integration: the six zones share continuous four-pixel solid bright-red panels (`#e43b44`) on dangerous surfaces and edges, with no ink pixel inside the contact band and no spikes. Contact causes death; explicit Try again returns to the stage checkpoint. The approved white `pigeon-poop` exception remains white. This shared panel change does not redraw legacy park hazards, other projectiles or actor costumes. These tiles are hazards with no solid collision; place them in the cell immediately outside the supporting solid, which retains its ordinary collision. Repeat horizontally for floors and ceilings, vertically for walls. The orientation names describe the face of the supporting solid, not the edge of the hazard's own cell.

| Tile            | Placement relative to solid | Hit box within its 12x12 cell (x, y, width, height) |
| --------------- | --------------------------- | --------------------------------------------------- |
| `hazard-bottom` | below                       | 0, 0, 12, 4                                         |
| `hazard-left`   | left                        | 8, 0, 4, 12                                         |
| `hazard-right`  | right                       | 0, 0, 4, 12                                         |
| `hazard-top`    | above                       | 0, 8, 12, 4                                         |

Red strips never carry the bright safe lip. Red is a consistent danger cue across zones; all four pixels of the approved contact band are bright red. Gameplay chooses the placement and clearance, including dangerous ceilings over short-jump routes and dangerous sides beside landings.

## Zone 1: parcel depot and New York street

The first Blue cityscape stage has fixed start and finish sections with a seeded street middle. Its opening preserves the opened parcel, depot movement lessons and first dog introduction; the middle assembles reusable street chunks in randomized order. It is two screens tall: the sidewalk runs along the bottom and the buildings support climbs into the upper screen. `art/tools/depot.py` draws the depot modules and `art/tools/floor1.py` the street pieces. Their docstrings specify each reusable asset; gameplay data defines their arrangement.

- Depot: blue-grey ribbed wall modules, roller loading bays and cream parcel icons, with warm cardboard reserved for the opened parcel. No labels are baked into the art. The three modules are static backdrops with no collision, animation or interaction; gameplay places solid surfaces separately. All stay on the play plane, with parallax factors 1,1.
- Outdoor scale: the street is drawn as if zoomed out 4x while the bird and the 12px tiles keep their size. A storey is 180px and an ordinary room door is 84px, twice Chibi's 42px frame height.
- The street is 720px (60 tiles) tall: the sidewalk's top is y 600 (row 50), with sidewalk and road filling rows 50 to 59 below it so the camera can hold her feet two thirds down the screen. The ground storey runs from y 420 to the sidewalk, and storeys stack every 180px above: a two-storey roof is at y 240 (row 20) and a three-storey roof at y 60 (row 5), the tallest that fits. A water tower (its tank top 6 tiles above its roof) fits on a two-storey roof, not a three-storey one. Every street piece's bottom y below is in that frame.
- Street tiles (`tiles-street`): a pale concrete sidewalk (tops alternating with a 2px joint every 24px, ends, a slate face), a pale stone kerb where it meets a cross street, the road one tile lower, an ochre-and-cream one-way shop awning, a dark-brown one-way canopy with a white lip, a 2-tile planter with a hedge top, the cellar hatch and its pit, and the ordinary room door as a 5x7 piece (60x84): a muted blue glazed leaf enclosed by complete grey jambs, with a small amber handle. `art/tools/room_doors.py` supplies the shared geometry. Existing non-door tile indices stay fixed; the added door cells follow the existing tiles.
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

`art/tools/apartment.py`, `art/tools/apartment_props.py` and `art/tools/apartment_wayfinding.py` provide reusable building blocks for the six Apartment floors: Lobby, Restaurant, Pool, Spa, Residential floors and Penthouse. The canonical dusty-rose `zone-red` ties together the entrance, restaurant, pool, spa, residential sections and exterior fire escapes. Wood, sage and muted blue are secondary accents. Saturated hazard red retains its separate meaning.

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
| apartment-room-door          | 60x84 | none   |
| apartment-spa-bench          | 72x36 | none   |
| apartment-spa-screen         | 72x96 | none   |
| apartment-stairwell          | 48x72 | none   |
| apartment-stairwell-door     | 48x72 | none   |
| apartment-stairwell-down     | 48x72 | none   |

The marked stairwells retain their 48x72 canvases. Their ascending or descending silhouettes and white directional arrows on dark signs identify the reversible main route. `apartment-stairwell` is the up marker; `apartment-stairwell-down` is the down marker. `apartment-stairwell-door` is a separate closed warm-panelled 48x72 skin for stair scenery. The optional room door is 60x84, with a 48px-wide leaf matching Chibi's frame width, sharing the street entrance's complete grey jambs and small amber handle around muted peach panels, without an up arrow. Ordinary room doors align their bottom to the local floor, retain Use interaction and have no collision. These images contain no input prompt or text; the runtime owns their interaction. The approved stair trigger activates when walked into. It is distinct from an optional room entrance.

Props are decorative, with no collision, continuous white safe lip or hazard band. Place actual platforms independently using the common structures. Pool water does not imply lethal contact; only an explicitly marked red hazard does. Room scenery contains no foreground friendly animals, people or new story details. The existing ferret story sprite and portrait remain available; his obstacle skin does not decide the friendship's outcome.

### Ferret obstacle skin

`art/tools/ferret_antagonist.py` draws `ferret-antagonist`, a compact encounter skin for the familiar patrol and charge pattern. It retains the champagne coat, small wedge head, plum stovepipe hat, red band and bow tie, and warm brown legs and tail. The original 64x80 story sprite and dialogue portrait remain unchanged. Costume accents do not replace the shared red terrain hazard markings, and the enemy has no red outline.

The frame is 48x48, bottom-centre anchor 24,48, with constant contact box x 2, y 2, width 44, height 46. All visible poses fit this box, including mirrored versions. Every state remains lethal; this is a regular obstacle using the existing generic behaviour graph. Gameplay owns movement, warning and recovery durations.

The looping `throw` tag appends after existing frames. Its release paw is at local offset 39,26 in the right-facing frame. `art/tools/ferret_parcel.py` draws `ferret-parcel`: 24x24 canvas with a 16x16 parcel at x 4, y 8, bottom-centre anchor 12,24 and visible-shape hit box 4,8,16,16, one 400ms looping `idle` frame. An ink one-pixel edge surrounds a two-pixel red danger band and warm cardboard with cream tape. The runtime owns the thrown arc, spawn timing and lifetime; no travel or new collision behaviour is baked into the art.

| Tag    | Art cycle               | Pose                       |
| ------ | ----------------------- | -------------------------- |
| crouch | Two frames, 140ms each  | Preparation for the charge |
| idle   | Two frames, 400ms each  | Quiet standing             |
| rest   | Two frames, 400ms each  | Recovery pause             |
| rush   | Four frames, 80ms each  | Committed charge           |
| throw  | Four frames, 100ms each | Parcel wind-up and release |
| walk   | Four frames, 120ms each | Patrol steps               |

The earlier motion tags loop. These are art playback defaults, not gameplay state durations. There is no boss-specific visual system or new ending artwork.

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

`art/tools/goose.py` draws Trixi as the countryside's `goose-antagonist`. A long neck, small head, pale body and oversized ink-rimmed glasses distinguish her from Chibi; a warm beak and feet keep her silhouette readable against the muted scenery. Its warning raises its wing and neck before the short committed charge. It has no red outline. `art/tools/speaker_portraits.py` supplies `portrait-goose`: a transparent right-facing 64x64 portrait retaining the long cream neck, grey wing, orange bill and oversized glasses. Its single `neutral` frame loops at 1000ms in the standard dialogue portrait slot.

The frame is 48x48 with bottom-centre anchor 24,48. Its constant contact box is x 2, y 2, width 44, height 46, containing every pose and its mirrored version. The skin uses the shared enemy state graph; gameplay owns warning, charge and recovery durations. Contact remains lethal in every state.

| Tag  | Art cycle               | Pose                            |
| ---- | ----------------------- | ------------------------------- |
| idle | Two frames, 400ms each  | Quiet standing                  |
| rest | Two frames, 400ms each  | Recovery pause                  |
| rush | Four frames, 80ms each  | Neck extended during the charge |
| walk | Four frames, 120ms each | Alternating steps               |
| warn | Two frames, 160ms each  | Raised wing and neck signal     |

The earlier motion tags loop; state transitions belong to the runtime. These art timings do not define the charge's distance or duration.

This sprite also uses the [shared enemy frustration cycle](#enemy-frustration).

The appended `set-trap` tag contains four looping 120ms placement frames. Existing poses and all prior frame indices and timings remain unchanged apart from the glasses overlay.

`goose-trap` is a 24x12 floor overlay, bottom-centre anchor 12,12, with approved contact box x 0, y 8, width 24, height 4. Its `warning` tag loops four 120ms frames: an amber two-pixel edge, moving two-pixel yellow tick and ink rim provide the visible arming interval. Its `armed` tag loops one 400ms frame. Approved target for paired art and runtime integration: the armed edge uses the same four-pixel solid bright-red panel as ordinary floor hazards; the nonlethal warning artwork remains unchanged. The red pixels derive from the same `hazard-top` geometry as ordinary floor hazards, repeated twice. In the armed frame, rows 0 through 7 remain transparent, with no spikes, teeth or safe white lip. Gameplay owns the delay and collision activation: warning is nonlethal; only the armed state uses the declared contact box. Retry and lifetime cleanup belong to the runtime. Both actor and trap retain empty `once` lists.

## Bini bear

`art/tools/bear.py` draws `bear-antagonist`: Bini, a dark-brown quadruped with high broad shoulders, a compact barrel body, short round ears, a broad short muzzle, a compact tail and four heavy plantigrade paws. His shorter body, taller shoulders and solid dark coat distinguish him from Archie. The world body has no held phone; the recoloured dialogue portrait retains the existing phone and its road-and-dog motif.

The frame remains 48x48, bottom-centre anchor 24,48, with fixed reach box x 2, y 2, width 44, height 46. Idle, preparation, growl, maul, rest, frustration and anticipation keep all four paws planted; walk and rush alternate diagonal contacts naturally. `anticipate-lift` uses grounded load, shoulder compression and a planted brace with its existing once-only 120/160/200ms cadence. Its frame indices and all other tags and art timings remain unchanged. The exact alpha silhouettes define contact independently of the reach box. Gameplay owns physical movement and state durations.

| Tag            | Art cycle                | Pose                            |
| -------------- | ------------------------ | ------------------------------- |
| frustration    | Shared four-frame loop   | Blocked-route reaction          |
| growl          | Four frames, 120ms each  | Mouth opens for the sonic push  |
| idle           | Two frames, 400ms each   | Four planted paws, quiet breath |
| maul           | Three frames, 100ms each | Planted head and shoulder press |
| prepare        | Two frames, 160ms each   | Grounded head and shoulder load |
| prepare-attack | Two frames, 160ms each   | Four-paw shoulder compression   |
| rest           | Two frames, 400ms each   | Settled recovery                |
| rush           | Four frames, 80ms each   | Grounded four-foot charge       |
| walk           | Four frames, 120ms each  | Alternating four-foot steps     |

The earlier actor tags loop. `portrait-bear` is 64x64, authored facing right, with the matching dark coat and retained phone. Its `neutral` and `annoyed` tags have one 1000ms frame each. Dialogue text belongs to gameplay data.

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

| Tag         | Art cycle               | Pose                         |
| ----------- | ----------------------- | ---------------------------- |
| drop        | Two frames, 100ms each  | Airborne release gesture     |
| fly         | Four frames, 100ms each | Wingbeat during flight       |
| frustration | Shared four-frame loop  | Blocked-route wing gesture   |
| idle        | Two frames, 400ms each  | Perched breathing            |
| prepare     | Two frames, 160ms each  | Notices Chibi                |
| prepare-air | Two frames, 160ms each  | Airborne attack anticipation |
| rest        | Two frames, 400ms each  | Perched recovery             |
| swoop       | Four frames, 100ms each | Head-down contact dive       |

The earlier motion tags loop. `prepare-air` appends after `swoop`, preserving the preceding 20 frames. Its tucked feet, drawn-back wings and aimed head signal an airborne attack. The 320ms art cycle does not trigger the action; gameplay data owns the anticipation duration for each action. Gameplay owns the occasional swoop trajectory, flight, spotting and release timing. `pigeon-poop` is a 12x12 white block with a one-pixel ink border and full-frame contact box, tag `idle`, one 400ms looping frame. It is the approved white projectile exception to the shared red terrain-contact rule. The code supplies its straight downward motion, lethal contact and removal on landing; none is baked into the drawing. There is no new dialogue portrait or story artwork.

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

| Tag     | Art cycle               | Pose                                       |
| ------- | ----------------------- | ------------------------------------------ |
| climb   | Four frames, 120ms each | Alternate grips and feet on the climb      |
| drop    | Two frames, 100ms each  | Splayed and tucked falling poses           |
| idle    | Two frames, 400ms each  | Standing breathing fallback                |
| prepare | One frame, 400ms        | Compressed body before the drop            |
| rest    | Two frames, 400ms each  | Settled pause after landing                |
| rush    | Four frames, 80ms each  | Low forward head, longer grounded strides  |
| walk    | Four frames, 120ms each | Alternate steps and opposite swinging paws |

The earlier motion tags loop; gameplay data owns state durations, motion and transitions through the shared behaviour graph. A skin supplies compatible artwork without changing the canonical footprint or contact box. The body sprite supplies no new conversation.

Kiwi, the female raccoon, reuses the existing identity without added gender accessories. `art/tools/speaker_portraits.py` supplies `portrait-raccoon`: a transparent right-facing 64x64 portrait with rounded ears, paired ink masks, grey fur and a cream muzzle. Its single `neutral` frame loops at 1000ms in the standard dialogue portrait slot. Ground walk and rush cycles append after frustration, retaining every earlier frame index. They provide the contact-attempt charge alongside the vertical drop; artwork has no baked world displacement. Contact remains lethal in every state.

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

## Woodland species and background fauna

`art/tools/large_wildlife.py` draws `background-deer-large` at 216x144 with bottom-centre anchor 108,144. Its four-frame `idle` uses 1000,180,180,1000ms; its eight-frame `graze` uses 350,300,300,650,650,350,300,350ms. Both tags loop. Export with the pinned art-kit release in six columns and two rows (1296x288), keeping the native frame dimensions. The naturalistic compact silhouette uses the flat `bg-woodland-fauna` paint, binary alpha and four fixed hoof patches. Use this large sprite for production ground fauna; retain the 32x24 deer as reference art rather than a default placement. Render at native dimensions with a fixed world origin and ordinary camera movement. It has no contact mask, hitbox, interaction, portrait or dialogue.

Woodland can mix broadleaf, conifer and birch depth layers between appropriate chunks. The existing broadleaf `woodland-far` and `forest-mid` remain the default. `woodland-far-conifers`, `forest-mid-conifers`, `woodland-far-birch` and `forest-mid-birch` retain 720x600, bottom-left y600 and repeat x. Far layers use the existing 0.15,0.05 parallax contract; middle layers use 0.4,0.15. Gameplay owns their chunk bindings and placement, including keeping exterior depth out of enclosed interiors.

`art/tools/woodland_fauna.py` retains the reference `background-deer` (32x24, bottom-centre 16,24; `idle` two 900ms frames, `graze` four 300ms frames) and draws production `background-swallow` at 144x96, centre 72,48. Its `flight` uses four 120ms frames, loops and retains pointed wings, a streamlined body and forked tail. Production deer and swallows use `bg-woodland-fauna`; they have no contact mask, hitbox, interaction or dialogue. Ground fauna stay planted through idle and graze. The swallow follows a finite linear or hop traversal: its first viewport intersection starts an independent local active-world clock; it finishes without returning or ping-ponging, then its render object is disposed without changing stable object indices. Pause stops that clock; Retry and area entry reset playback. World fauna use ordinary 1,1 camera movement at depth -2.5, between placed backgrounds at -3 and terrain at -2. Gameplay owns supported ground fitting, chunk bindings, placement, motion and timing. Keep fauna subdued and separate from lethal enemies and points of interest.

## Animated distant flora

`art/tools/background_flora.py` draws `background-reeds`, a naturalistic 24x24 decorative sprite with bottom-centre anchor 12,24 and a four-frame 300ms looping `sway` tag. Its narrow seedheads and lanceolate leaves bend while the roots stay fixed. It has no hitbox, contact mask or interaction. Use the existing scenery animation contract, subdued background depth and a real supporting ground plane; parallax alone is not foliage animation.
