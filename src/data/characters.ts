import {
  ANIMAL_INTERACTION_RANGE,
  BEAR_BEHAVIOUR,
  BOAT_BEHAVIOUR,
  CITY_GROUND_HAZARD_BEHAVIOUR,
  CITY_LIFT_BEHAVIOUR,
  CITY_SHUTTLE_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  OWL_BEHAVIOUR,
  PIGEON_BEHAVIOUR,
  RABBIT_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "./behaviours";
import type { Character } from "./types";
import { WOODLAND_SCENERY_CHARACTERS } from "./woodlandScenery";

// Who or what each placed thing is, by name: its archetype, art, size and tuning. art is a piece
// or tile name from art/README.md, a backdrop or sprite, or placeholder-<name> where art has none
// yet. Tiled pieces (awnings, the canopy, planters and pit openings) take their width from each
// placement.
export const CHARACTERS: Readonly<Record<string, Character>> = {
  ...WOODLAND_SCENERY_CHARACTERS,
  "apartment-room-door": {
    archetype: "door",
    art: "apartment-room-door",
    cols: 5,
    rows: 7,
  },
  "apartment-stairwell": {
    archetype: "scenery",
    art: "apartment-stairwell",
    cols: 4,
    rows: 6,
  },
  "apartment-stairwell-down": {
    archetype: "scenery",
    art: "apartment-stairwell-down",
    cols: 4,
    rows: 6,
  },
  "apartment-wall-panel": {
    archetype: "scenery",
    art: "apartment-wall-lobby",
    cols: 4,
    rows: 12,
  },
  // A shop awning: one-way, laid 6 above the sidewalk across a storefront.
  awning: {
    archetype: "ledge",
    art: "one-way-awning",
    cols: 3,
    rows: 1,
  },
  "bear-antagonist": {
    archetype: "hazard",
    art: "bear-antagonist",
    behaviour: BEAR_BEHAVIOUR,
    cols: 4,
    rows: 4,
    tuning: { interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE } },
  },
  // A canopy: one-way, 6 above the sidewalk.
  canopy: {
    archetype: "ledge",
    art: "one-way-canopy",
    cols: 3,
    rows: 1,
  },
  "city-ground-hazard": {
    archetype: "hazard",
    art: "hazard-top",
    behaviour: CITY_GROUND_HAZARD_BEHAVIOUR,
    cols: 4,
    contactCue: "red-hazard",
    rows: 1,
    tileset: "tiles-platforming",
  },
  "city-lift": {
    archetype: "ledge",
    art: "one-way-ledge",
    behaviour: CITY_LIFT_BEHAVIOUR,
    cols: 6,
    rows: 1,
    tileset: "tiles-platforming",
  },
  "city-shuttle": {
    archetype: "ledge",
    art: "one-way-ledge",
    behaviour: CITY_SHUTTLE_BEHAVIOUR,
    cols: 6,
    rows: 1,
    tileset: "tiles-platforming",
  },
  // A roof's cornice: one-way, along the top of its roofline.
  cornice: {
    archetype: "ledge",
    art: "one-way-cornice",
    cols: 3,
    rows: 1,
  },
  "cross-street": {
    archetype: "scenery",
    art: "cross-street",
    cols: 10,
    rows: 2,
  },
  "depot-loading-bay": {
    archetype: "scenery",
    art: "depot-loading-bay",
    cols: 10,
    rows: 10,
  },
  "depot-wall": {
    archetype: "scenery",
    art: "depot-wall",
    cols: 4,
    rows: 15,
  },
  "dog-antagonist": {
    archetype: "hazard",
    art: "dog-antagonist",
    behaviour: DOG_BEHAVIOUR,
    cols: 5,
    rows: 4,
    tuning: {
      interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE },
    },
  },
  // A harmless pug that trots up to her.
  "dog-pug": {
    animations: { idle: "idle", move: "walk", react: "perk", talk: "talk" },
    archetype: "approacher",
    art: "dog-pug",
    cols: 4,
    rows: 3,
  },
  // Facades, each a backdrop repeated across its run: the ground and second storeys standing on
  // the sidewalk line, and a walk-up's upper storey stacked above.
  "facade-brownstone": {
    archetype: "scenery",
    art: "facade-brownstone",
    cols: 4,
    rows: 26,
  },
  "facade-one-storey": {
    archetype: "scenery",
    art: "facade-one-storey",
    cols: 4,
    rows: 16,
  },
  "facade-walkup": {
    archetype: "scenery",
    art: "facade-walkup",
    cols: 4,
    rows: 26,
  },
  "facade-walkup-upper": {
    archetype: "scenery",
    art: "facade-walkup-upper",
    cols: 4,
    rows: 15,
  },
  "ferret-antagonist": {
    archetype: "hazard",
    art: "ferret-antagonist",
    behaviour: FERRET_BEHAVIOUR,
    cols: 4,
    rows: 4,
    tuning: { interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE } },
  },
  "ferret-parcel": {
    archetype: "hazard",
    art: "ferret-parcel",
    cols: 2,
    contactCue: "red-hazard",
    rows: 2,
  },
  // The ferret's first trap, set near zone 1's end.
  "ferret-trap-snap": {
    animations: { idle: "set", move: "set", react: "set", talk: "set" },
    archetype: "hazard",
    art: "ferret-trap-snap",
    cols: 4,
    rows: 2,
  },
  // A fire escape's ladder between its landings, one piece per spacing in rows (8 for the plain
  // one), and the railing standing on each landing.
  "fire-escape-ladder": {
    archetype: "scenery",
    art: "fire-escape-ladder",
    cols: 2,
    rows: 8,
  },
  "fire-escape-ladder-4": {
    archetype: "scenery",
    art: "fire-escape-ladder-4",
    cols: 2,
    rows: 4,
  },
  "fire-escape-ladder-5": {
    archetype: "scenery",
    art: "fire-escape-ladder-5",
    cols: 2,
    rows: 5,
  },
  "fire-escape-ladder-6": {
    archetype: "scenery",
    art: "fire-escape-ladder-6",
    cols: 2,
    rows: 6,
  },
  "fire-escape-ladder-7": {
    archetype: "scenery",
    art: "fire-escape-ladder-7",
    cols: 2,
    rows: 7,
  },
  // A fire escape's landing: one-way, on a walk-up.
  "fire-escape-landing": {
    archetype: "ledge",
    art: "one-way-fire-escape",
    cols: 3,
    rows: 1,
  },
  "fire-escape-railing": {
    archetype: "scenery",
    art: "fire-escape-railing",
    cols: 4,
    rows: 2,
  },
  // The rolling traffic: a frog courier on a delivery bike, back and forth along the sidewalk.
  // 3 tall, so a full jump clears it.
  "frog-courier": {
    animations: { idle: "idle", move: "ride", react: "idle", talk: "idle" },
    archetype: "hazard-patroller",
    art: "frog-courier",
    cols: 5,
    rows: 3,
  },
  "goose-antagonist": {
    archetype: "hazard",
    art: "goose-antagonist",
    behaviour: GOOSE_BEHAVIOUR,
    cols: 4,
    rows: 4,
    tuning: { interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE } },
  },
  "goose-trap": {
    animations: { idle: "armed" },
    archetype: "hazard",
    art: "goose-trap",
    cols: 2,
    contactCue: "red-hazard",
    rows: 1,
  },
  // A cellar hatch's edges: the sidewalk's edge tile with an open steel leaf standing 2 above it.
  "hatch-left": {
    archetype: "solid",
    art: "hatch-left",
    cols: 1,
    rows: 3,
  },
  "hatch-right": {
    archetype: "solid",
    art: "hatch-right",
    cols: 1,
    rows: 3,
  },
  "hot-dog-cart": {
    archetype: "solid",
    art: "hot-dog-cart",
    cols: 3,
    rows: 6,
  },
  "owl-antagonist": {
    archetype: "hazard",
    art: "owl-antagonist",
    behaviour: OWL_BEHAVIOUR,
    cols: 4,
    rows: 4,
  },
  // Pedestrians walking past, back and forth, paying her no attention. React and talk fall back
  // to idle.
  // The park's pieces. The bandstand, 7 tall, with its roof a one-way ledge 6 above its base.
  "parcel-open": {
    archetype: "scenery",
    art: "parcel-open",
    cols: 6,
    rows: 3,
  },
  "park-bandstand": {
    archetype: "scenery",
    art: "park-bandstand",
    cols: 10,
    rows: 7,
  },
  "park-bandstand-roof": {
    archetype: "ledge",
    art: "one-way-bandstand",
    cols: 10,
    rows: 1,
  },
  // A bench: its seat a one-way ledge 2 above the ground, and its frame below it.
  "park-bench": {
    archetype: "ledge",
    art: "one-way-bench",
    cols: 3,
    rows: 1,
  },
  "park-bench-frame": {
    archetype: "scenery",
    art: "park-bench",
    cols: 3,
    rows: 2,
  },
  // A boat follows the shared crossing behaviour. Its deck is the sprite's top; the hull dips
  // below it.
  "park-boat": {
    archetype: "platform",
    art: "park-boat",
    behaviour: BOAT_BEHAVIOUR,
    cols: 6,
    rows: 1,
  },
  // A tree's branch: a one-way ledge 6 above the ground.
  "park-branch": {
    archetype: "ledge",
    art: "one-way-branch",
    cols: 4,
    rows: 1,
  },
  // The park's backdrops, each repeated across a whole zone.
  "park-city": {
    archetype: "scenery",
    art: "park-city",
    cols: 30,
    rows: 17,
  },
  "park-clouds": {
    archetype: "scenery",
    art: "park-clouds",
    cols: 30,
    rows: 14,
  },
  "park-far-trees": {
    archetype: "scenery",
    art: "park-far-trees",
    cols: 20,
    rows: 10,
  },
  // The park's door to a room: a gate that opens when she uses it.
  "park-gate": {
    archetype: "door",
    art: "park-gate",
    cols: 3,
    rows: 5,
  },
  "park-lamp": {
    archetype: "scenery",
    art: "park-lamp",
    cols: 2,
    rows: 7,
  },
  "park-sky": {
    archetype: "scenery",
    art: "park-sky",
    cols: 4,
    rows: 50,
  },
  "park-tree": {
    archetype: "scenery",
    art: "park-tree",
    cols: 8,
    rows: 13,
  },
  "park-treetops": {
    archetype: "scenery",
    art: "park-treetops",
    cols: 30,
    rows: 35,
  },
  "pedestrian-cat": {
    animations: { idle: "idle", move: "walk", react: "idle", talk: "idle" },
    archetype: "walker",
    art: "pedestrian-cat",
    cols: 3,
    rows: 5,
  },
  "pedestrian-raccoon": {
    animations: { idle: "idle", move: "walk", react: "idle", talk: "idle" },
    archetype: "walker",
    art: "pedestrian-raccoon",
    cols: 3,
    rows: 5,
  },
  // Pigeons pecking about in flocks, which flee as she comes near: react plays flee once, then
  // move's fly. Talk falls back to idle.
  pigeon: {
    animations: { idle: "idle", move: "fly", react: "flee", talk: "idle" },
    archetype: "hopper-avoider",
    art: "pigeon",
    cols: 2,
    rows: 2,
  },
  "pigeon-antagonist": {
    archetype: "hazard",
    art: "pigeon-antagonist",
    behaviour: PIGEON_BEHAVIOUR,
    cols: 4,
    rows: 4,
    tuning: { interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE } },
  },
  "pigeon-poop": {
    archetype: "hazard",
    art: "pigeon-poop",
    cols: 1,
    rows: 1,
  },
  // The dark floor of a pit, 4 below the sidewalk's top: a quick restart for a fall into an
  // opening.
  "pit-floor": {
    archetype: "hazard",
    art: "placeholder-pit-floor",
    cols: 1,
    rows: 1,
  },
  // The open cellar between a hatch's edges: drawn only, over a gap in the sidewalk she falls
  // through.
  "pit-opening": {
    archetype: "scenery",
    art: "pit-opening",
    cols: 1,
    rows: 1,
  },
  // A 2-tile step.
  planter: {
    archetype: "solid",
    art: "planter",
    cols: 2,
    rows: 2,
  },
  "platform-ledge": {
    archetype: "ledge",
    art: "one-way-ledge",
    cols: 1,
    rows: 1,
    tileset: "tiles-platforming",
  },
  // A roofline capping a facade, repeated across its run: a cornice goes along its top.
  // A shallow pond, two rows deep: touching the water restarts her. Placed with a width, between
  // solid banks.
  pond: {
    archetype: "hazard",
    art: "hazard-pond",
    cols: 3,
    rows: 2,
  },
  "rabbit-antagonist": {
    archetype: "hazard",
    art: "rabbit-antagonist",
    behaviour: RABBIT_BEHAVIOUR,
    cols: 4,
    rows: 4,
  },
  "raccoon-antagonist": {
    archetype: "hazard",
    art: "raccoon-antagonist",
    behaviour: RACCOON_BEHAVIOUR,
    cols: 4,
    rows: 4,
    tuning: { interaction: { kind: "talk", range: ANIMAL_INTERACTION_RANGE } },
  },
  "red-edge-bottom": {
    archetype: "hazard",
    art: "hazard-bottom",
    cols: 1,
    contactCue: "red-hazard",
    rows: 1,
    tileset: "tiles-platforming",
  },
  "red-edge-left": {
    archetype: "hazard",
    art: "hazard-left",
    cols: 1,
    contactCue: "red-hazard",
    rows: 1,
    tileset: "tiles-platforming",
  },
  "red-edge-right": {
    archetype: "hazard",
    art: "hazard-right",
    cols: 1,
    contactCue: "red-hazard",
    rows: 1,
    tileset: "tiles-platforming",
  },
  "red-edge-support": {
    archetype: "solid",
    art: "platform-face",
    cols: 1,
    rows: 1,
    tileset: "tiles-platforming",
  },
  "red-edge-top": {
    archetype: "hazard",
    art: "hazard-top",
    cols: 1,
    contactCue: "red-hazard",
    rows: 1,
    tileset: "tiles-platforming",
  },
  "roofline-brownstone": {
    archetype: "scenery",
    art: "roofline-brownstone",
    cols: 4,
    rows: 4,
  },
  "roofline-walkup": {
    archetype: "scenery",
    art: "roofline-walkup",
    cols: 4,
    rows: 4,
  },
  "storefront-cafe": {
    archetype: "scenery",
    art: "storefront-cafe",
    cols: 7,
    rows: 10,
  },
  "storefront-diner": {
    archetype: "scenery",
    art: "storefront-diner",
    cols: 9,
    rows: 10,
  },
  "storefront-florist": {
    archetype: "scenery",
    art: "storefront-florist",
    cols: 7,
    rows: 10,
  },
  "storefront-gift-shop": {
    archetype: "scenery",
    art: "storefront-gift-shop",
    cols: 8,
    rows: 10,
  },
  "storefront-makeup-store": {
    archetype: "scenery",
    art: "storefront-makeup-store",
    cols: 8,
    rows: 10,
  },
  "storefront-noodle-bar": {
    archetype: "scenery",
    art: "storefront-noodle-bar",
    cols: 10,
    rows: 10,
  },
  "storefront-pet-shop": {
    archetype: "scenery",
    art: "storefront-pet-shop",
    cols: 9,
    rows: 10,
  },
  "street-city-far": {
    archetype: "scenery",
    art: "street-city-far",
    cols: 60,
    rows: 50,
  },
  "street-city-mid": {
    archetype: "scenery",
    art: "street-city-mid",
    cols: 60,
    rows: 50,
  },
  // A street door to a room, drawn with the street's door art.
  "street-door": {
    archetype: "door",
    art: "door",
    cols: 5,
    rows: 7,
  },
  // The street's sky and far skyline, backdrops repeated across the street.
  "street-sky": {
    archetype: "scenery",
    art: "street-sky",
    cols: 4,
    rows: 50,
  },
  "street-skyline": {
    archetype: "scenery",
    art: "street-skyline",
    cols: 28,
    rows: 50,
  },
  "street-tree": {
    archetype: "scenery",
    art: "street-tree",
    cols: 5,
    rows: 11,
  },
  "subway-railing": {
    archetype: "scenery",
    art: "subway-railing",
    cols: 6,
    rows: 5,
  },
  // PLACEHOLDER: the test zones' objects, drawn as flat rectangles: a door (a Use zone),
  // hazards, moving platforms whose motion each placement sets, a wandering cart and a pigeon
  // that hops about and flies from her.
  "test-cart": {
    archetype: "hazard-wanderer",
    art: "test-cart",
    cols: 3,
    rows: 2,
  },
  "test-door": {
    archetype: "door",
    art: "test-door",
    cols: 3,
    rows: 4,
  },
  "test-hazard": {
    archetype: "hazard",
    art: "test-hazard",
    cols: 1,
    rows: 1,
  },
  "test-mover": {
    archetype: "platform",
    art: "test-mover",
    cols: 4,
    rows: 1,
  },
  "test-pigeon": {
    archetype: "hopper-avoider",
    art: "test-pigeon",
    cols: 2,
    rows: 2,
    tuning: {
      motion: { direction: "right", distance: 8, speed: 3, variance: 0.3 },
      reaction: { range: 8, speed: 10 },
    },
  },
  // A thorny hedge, one row tall: a hazard, not solid, placed with a width.
  "thorn-hedge": {
    archetype: "hazard",
    art: "hazard-thorn",
    cols: 3,
    rows: 1,
  },
  "walk-signal": {
    archetype: "scenery",
    art: "walk-signal",
    cols: 1,
    rows: 7,
  },
  // A water tower on a brownstone's roof, and its tank's flat top: one-way, 6 above the roof.
  "water-tank": {
    archetype: "ledge",
    art: "one-way-tank",
    cols: 4,
    rows: 1,
  },
  "water-tower": {
    archetype: "scenery",
    art: "water-tower",
    cols: 4,
    rows: 7,
  },
  // A window sill: one-way, on a brownstone.
  "window-sill": {
    archetype: "ledge",
    art: "one-way-sill",
    cols: 3,
    rows: 1,
  },
};
