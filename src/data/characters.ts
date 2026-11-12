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
  PIGEON_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "./behaviours.ts";
import { OBSTACLE_CHARACTERS } from "./obstacleCharacters.ts";
import type { Character } from "./types/index.ts";
import { WOODLAND_SCENERY_CHARACTERS } from "./woodlandScenery.ts";

// Who or what each placed thing is, by name: its archetype, art, size and tuning. art is a piece
// or tile name from art/README.md, a backdrop or sprite, or placeholder-<name> where art has none
// yet. Tiled pieces (awnings, the canopy, planters and pit openings) take their width from each
// placement.
export const CHARACTERS: Readonly<Record<string, Character>> = {
  ...OBSTACLE_CHARACTERS,
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
  // A harmless pug that trots up to him.
  "dog-pug": {
    animations: { idle: "idle", move: "walk", react: "perk", talk: "talk" },
    archetype: "approacher",
    art: "dog-pug",
    cols: 4,
    rows: 3,
  },
  // Facades, each a backdrop repeated across its run: the ground and second storeys standing on
  // the sidewalk line.
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
  // A fire escape's railing, standing on each landing.
  "fire-escape-railing": {
    archetype: "scenery",
    art: "fire-escape-railing",
    cols: 4,
    rows: 2,
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
  // The park's door to a room: a gate that opens when he uses it.
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
  // Pigeons pecking about in flocks, which flee as he comes near: react plays flee once, then
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
  // The open cellar between a hatch's edges: drawn only, over a gap in the sidewalk he falls
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
  // A shallow pond, two rows deep: touching the water restarts him. Placed with a width, between
  // solid banks.
  pond: {
    archetype: "hazard",
    art: "hazard-pond",
    cols: 3,
    rows: 2,
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
  // A roofline capping a facade, repeated across its run.
  "roofline-brownstone": {
    archetype: "scenery",
    art: "roofline-brownstone",
    cols: 4,
    rows: 4,
  },
  "room-building-blue-cityscape": {
    archetype: "scenery",
    art: "room-building-blue-cityscape",
    cols: 15,
    rows: 15,
  },
  "room-building-countryside": {
    archetype: "scenery",
    art: "room-building-countryside",
    cols: 15,
    rows: 15,
  },
  "room-building-home-city": {
    archetype: "scenery",
    art: "room-building-home-city",
    cols: 15,
    rows: 15,
  },
  "room-building-industrial": {
    archetype: "scenery",
    art: "room-building-industrial",
    cols: 15,
    rows: 15,
  },
  "room-building-woodland": {
    archetype: "scenery",
    art: "room-building-woodland",
    cols: 15,
    rows: 15,
  },
  "storefront-cafe": {
    archetype: "scenery",
    art: "storefront-cafe",
    cols: 7,
    rows: 10,
  },
  "storefront-noodle-bar": {
    archetype: "scenery",
    art: "storefront-noodle-bar",
    cols: 10,
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
  // The street's sky, a backdrop repeated across the street.
  "street-sky": {
    archetype: "scenery",
    art: "street-sky",
    cols: 4,
    rows: 50,
  },
  // PLACEHOLDER: the test fixtures' objects, drawn as flat rectangles: a door (a Use zone),
  // hazards, moving platforms whose motion each placement sets and a wandering cart.
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
  "walk-signal": {
    archetype: "scenery",
    art: "walk-signal",
    cols: 1,
    rows: 7,
  },
};
