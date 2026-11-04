# Opening story art

The current runtime opening uses four single-shot beats on a plain `ink` field, with `background: null`
and no background-image lookup. It reuses the native `bird`, `ferret-antagonist` and `ferret-parcel` sprites
at 1x in `idle` poses. Fert uses `flipX: true`; Chibi and the parcel use `false`. Their anchors are
24,42; 24,48; and 12,24 respectively, at y240. Captions, manual Continue, whole-opening Skip and save
acknowledgment retain their existing behaviour.

The following asset contracts and motion recipes describe the retained painted storybook pack, not the
current runtime data. Preserve this pack and its originals. Painted source images live in `source/`;
`node art/tools/opening.ts build`, run from the repository root, deterministically exports that pack's
backgrounds and pose sheets.

## Assets

| Key                        | Type                   | Size    | Purpose                                     |
| -------------------------- | ---------------------- | ------- | ------------------------------------------- |
| opening-chibi              | Four-pose sprite sheet | 512x512 | Rest, blink, sleep and wake                 |
| opening-depot-background   | Opaque image           | 720x360 | Waking far from home                        |
| opening-ferret             | Four-pose sprite sheet | 512x512 | Friendly, gesture, argument and pack        |
| opening-home-background    | Opaque image           | 720x360 | Friendship, argument and packing            |
| opening-parcel             | Four-pose sprite sheet | 512x512 | Open, half-closed, sealed and opened carton |
| opening-parcel-front       | Four-pose sprite sheet | 512x512 | Matching carton foreground occlusion        |
| opening-transit-background | Opaque image           | 720x360 | Abstract postal transit montage             |

The sprite sheets use four 256x256 cells in row-major order. The common canvas anchor is x128,y232.
`contract.json` records the pose indices, anchors, viewport and parcel-front edges. Sprite JSON tags each
static pose independently. Its 1000ms frame metadata is a static art default, not a gameplay duration.
`manifest-entries.json` supplies the registration objects for paired integration.

The source cutouts are reduced to binary alpha during export, retaining their painted interior colours.
No opening layer has collision or a hit box. Backgrounds are fully opaque; important scene content stays
above the quiet bottom 80px. No words, character names, input controls or dialogue are baked into artwork.

## Layered motion

The retained painted recipe uses five shots because packing and abstract transit share one story beat:

1. Friendship in the shared apartment: breathing, a blink and a small paw gesture.
2. The argument in the same room: a distinct disagreement pose, slight lean and small backward step.
3. Packing while Chibi sleeps: a sleeping pose transfers towards the open carton, then the lid closes.
4. Postal transit: the sealed parcel travels across an abstract backdrop without inventing a route or vehicle.
5. Waking far from home: the carton opens and Chibi moves from sleep through a waking stretch to rest.

For packing and waking, draw the complete parcel behind Chibi, then `opening-parcel-front` above him.
This keeps his lower body inside the carton. The sealed parcel hides him completely. The renderer handles
pose selection, graphic translation, rotation, scale and any camera movement; there is no physics simulation.

The argument's cause and the friendship's outcome are undecided. No object, caption or expression explains
the cause, and the sequence contains no final reconciliation, combat or boss reveal.

## Normalized motion recipe

`motion-recipe.json` supplies the art-authored layers for four beats, with shot counts `1, 1, 2, 1`.
It deliberately omits the gameplay-owned beat `text` and shot `seconds`; supply those fields before using
the recipe as runtime opening data. Packing and transit are consecutive shots of the third beat.

Each layer uses the pixel anchor `{ "x": 128, "y": 232 }`. Keyframe positions place that anchor in the
720x360 viewport. Pose strings select the tags in `contract.json`; progress runs from zero to one per shot.
Interpolate position, scale and angle linearly, and change pose and visibility at each keyframe boundary.
Angles are clockwise degrees, opposite the preview's counter-clockwise rotation convention. Curved preview motion
is sampled into linear segments; the recipe does not change the preview's illustrative cadence.

Parcel and parcel-front keyframes are identical, including during transit. Draw parcel-front last.
Chibi is invisible before the packing lid seals and remains hidden until the waking carton opens.
The seated carton anchor remains fixed while Chibi's waking pose rises inside it.

## Preview and integration

`node art/tools/opening.ts preview OUT.gif` renders a short motion study. `node art/tools/opening.ts board OUT.png` renders five sampled shots.
The preview demonstrates actual pose changes and layer motion, not only pans over still illustrations.
Its cadence is illustrative and does not prescribe runtime durations, controls, skipping, replay or saves.
Gameplay owns those decisions and player text; tech owns scene integration.
