// Rebuild the art on art-kit's build runner: run `node art/tools/<set>.ts build` for every set, each
// after the sets in NEEDS, and stop at the first failure.
//
// A full rebuild first resets the manifest to its SECTIONS in order, holding only the entries
// registered by hand (HAND_IMAGES), so a key that no set draws any longer leaves the manifest
// without a hand edit. The reset runs as part of the first set's build, after --check has taken its
// snapshot. Named sets rebuild those sets and every set downstream of them over the committed
// manifest.
//
// --check fails when the rebuild changes, removes or adds a file under CHECK_PATHS (art/ and every
// path the builds write), and lists those paths. It also fails on any file there that no set's
// OUTPUTS and no STATIC entry claims, such as a file a set no longer writes, and lists it as
// `!\tpath`; every set's outputs count, selected or not. It needs no git, so it runs in a copy of
// the checkout without .git. Builds are deterministic, so on a clean checkout every difference is a
// generator change.
//
// Run from the repository root in the node:24.22.2 check container. It spawns only node and reaches
// no network.
import {
  buildCommand,
  buildOrder,
  type BuildSets,
  nodeBuild,
} from "@andornaut/art-kit/build/build";

import { BACKDROPS_DIR } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any file the rebuild changed, removed or added
                                               under art/ or the paths the builds write
                                               (public/art/, public/favicon.ico, public/icons/),
                                               and on any file there that no set's outputs and no
                                               static entry claims`;

// Every set with a build command, each declared after the sets it needs. Declaration order breaks
// ties in the build order.
const SETS = [
  "achievementIcons",
  "antagonists",
  "apartment",
  "apartmentProps",
  "apartmentWayfinding",
  "backgroundFlora",
  "bear",
  "bird",
  "bossRemoval",
  "cast",
  "countryside",
  "depot",
  "ferret",
  "ferretAntagonist",
  "ferretParcel",
  "floor1",
  "fonts",
  "goose",
  "homecity",
  "icons",
  "industrial",
  "largeWildlife",
  "logo",
  "map",
  "obstacles",
  "palette",
  "park",
  "pigeonAntagonist",
  "pigeonPortrait",
  "raccoon",
  "roomBuildings",
  "roomDoors",
  "skillIcons",
  "speakerPortraits",
  "ui",
  "woodland",
  "woodlandFauna",
  "zoneThemes",
  "backgroundTones",
  "contactSilhouettes",
  "start",
] as const;

type ArtSet = (typeof SETS)[number];

// The sets each set runs after.
const NEEDS: Readonly<Partial<Record<ArtSet, readonly ArtSet[]>>> = {
  // Rewrites these sets' backdrops through the same muted-tone policy.
  backgroundTones: [
    "apartment",
    "apartmentProps",
    "countryside",
    "depot",
    "floor1",
    "homecity",
    "industrial",
    "park",
    "woodland",
  ],
  // Reads the exported sheets and manifest entries of every sprite marked contact="silhouette".
  contactSilhouettes: [
    "antagonists",
    "bear",
    "ferretAntagonist",
    "goose",
    "pigeonAntagonist",
    "raccoon",
  ],
  // Reads palette.json.
  start: ["palette"],
};

// The modules in art/tools/ that are not sets: shared drawing code, the command line and this file.
const NOT_SETS = [
  "backgroundPalette",
  "build",
  "cli",
  "imageArt",
  "nature",
  "pixel",
  "previewText",
];

// art/, which no build writes, and every path a build writes.
const CHECK_PATHS = ["art", "public/art", "public/favicon.ico", "public/icons"];

// Served file paths for the given keys: one PNG per backdrop, and a PNG sheet and its json data
// per sprite or tileset.
const backdrops = (...keys: readonly string[]): string[] =>
  keys.map((key) => `${BACKDROPS_DIR}/${key}.png`);
const sheets = (directory: string, keys: readonly string[]): string[] =>
  keys.flatMap((key) => [`${directory}/${key}.json`, `${directory}/${key}.png`]);
const sprites = (...keys: readonly string[]): string[] => sheets(pixel.SPRITES, keys);
const tilesets = (...keys: readonly string[]): string[] => sheets(pixel.TILESETS, keys);

const CONTACT_SILHOUETTES = "public/art/contact-silhouettes.json";

// Every file each set's build writes under CHECK_PATHS, including files another set also writes,
// such as the manifest, the contact metadata and the backdrops backgroundTones repaints. --check
// fails on any file under CHECK_PATHS that no set's outputs and no STATIC entry claims.
const OUTPUTS: Readonly<Record<ArtSet, readonly string[]>> = {
  achievementIcons: [pixel.MANIFEST, ...sprites("icon-achievement", "icon-achievements")],
  antagonists: [pixel.MANIFEST, CONTACT_SILHOUETTES, ...sprites("dog-antagonist", "portrait-dog")],
  apartment: [
    pixel.MANIFEST,
    ...backdrops(
      "apartment-exterior-mid",
      "apartment-facade",
      "apartment-far",
      "apartment-sky",
      "apartment-wall-lobby",
      "apartment-wall-penthouse",
      "apartment-wall-pool",
      "apartment-wall-residential",
      "apartment-wall-restaurant",
      "apartment-wall-spa",
    ),
    ...sprites("apartment-chandelier", "apartment-chandelier-chain", "apartment-chandelier-mount"),
    ...tilesets("tiles-apartment"),
  ],
  apartmentProps: [
    pixel.MANIFEST,
    ...backdrops(
      "apartment-lobby-sofa",
      "apartment-pool-water",
      "apartment-residential-shelf",
      "apartment-restaurant-counter",
      "apartment-spa-screen",
    ),
  ],
  apartmentWayfinding: [
    pixel.MANIFEST,
    ...backdrops(
      "apartment-room-door",
      "apartment-stairwell",
      "apartment-stairwell-door",
      "apartment-stairwell-down",
    ),
  ],
  backgroundFlora: [pixel.MANIFEST, ...sprites("background-reeds")],
  backgroundTones: [
    ...backdrops(
      "apartment-exterior-mid",
      "apartment-facade",
      "apartment-far",
      "apartment-lobby-sofa",
      "apartment-pool-water",
      "apartment-residential-shelf",
      "apartment-restaurant-counter",
      "apartment-sky",
      "apartment-spa-screen",
      "apartment-wall-lobby",
      "apartment-wall-penthouse",
      "apartment-wall-pool",
      "apartment-wall-residential",
      "apartment-wall-restaurant",
      "apartment-wall-spa",
      "countryside-far",
      "countryside-sky",
      "countryside-windmill",
      "depot-loading-bay",
      "depot-wall",
      "facade-brownstone",
      "facade-one-storey",
      "farmland-barn",
      "farmland-fence",
      "farmland-mid",
      "fire-escape-railing",
      "forest-mid",
      "forest-mid-birch",
      "forest-mid-conifers",
      "forest-shrub",
      "forest-tree",
      "freight-gantry",
      "freight-gantry-rail",
      "freight-mid",
      "homecity-awning",
      "homecity-far",
      "homecity-sky",
      "industrial-far",
      "industrial-sky",
      "neighbourhood-mid",
      "neighbourhood-wall",
      "outskirts-mid",
      "outskirts-wall",
      "park-bandstand",
      "park-bench",
      "park-city",
      "park-clouds",
      "park-far-trees",
      "park-lamp",
      "park-sky",
      "park-tree",
      "park-treetops",
      "ravine-mid",
      "ravine-rock",
      "river-mid",
      "river-reeds",
      "roofline-brownstone",
      "storefront-cafe",
      "storefront-noodle-bar",
      "street-boundary-mid",
      "street-city-far",
      "street-city-mid",
      "street-sky",
      "warehouse-loading-bay",
      "warehouse-mid",
      "warehouse-wall",
      "woodland-far",
      "woodland-far-conifers",
      "woodland-sky",
    ),
  ],
  bear: [
    pixel.MANIFEST,
    CONTACT_SILHOUETTES,
    ...sprites("bear-antagonist", "bear-growl-wave", "portrait-bear"),
  ],
  bird: [pixel.MANIFEST, ...sprites("bird", "portrait-bird")],
  bossRemoval: [pixel.MANIFEST, ...sprites("boss-removal")],
  cast: [pixel.MANIFEST, ...sprites("dog-pug", "pigeon")],
  contactSilhouettes: [pixel.MANIFEST, CONTACT_SILHOUETTES],
  countryside: [
    pixel.MANIFEST,
    ...backdrops(
      "countryside-far",
      "countryside-sky",
      "countryside-windmill",
      "farmland-barn",
      "farmland-fence",
      "farmland-mid",
      "river-mid",
      "river-reeds",
    ),
    ...sprites("windmill-sail-ledge", "windmill-spoke"),
    ...tilesets("tiles-countryside"),
  ],
  depot: [pixel.MANIFEST, ...backdrops("depot-loading-bay", "depot-wall", "parcel-open")],
  ferret: [pixel.MANIFEST, ...sprites("ferret", "portrait-ferret")],
  ferretAntagonist: [pixel.MANIFEST, CONTACT_SILHOUETTES, ...sprites("ferret-antagonist")],
  ferretParcel: [pixel.MANIFEST, ...sprites("ferret-parcel")],
  floor1: [
    pixel.MANIFEST,
    ...backdrops(
      "facade-brownstone",
      "facade-one-storey",
      "fire-escape-railing",
      "roofline-brownstone",
      "storefront-cafe",
      "storefront-noodle-bar",
      "street-boundary-mid",
      "street-city-far",
      "street-city-mid",
      "street-sky",
      "walk-signal",
    ),
    ...sprites("crosswalk-signal"),
    ...tilesets("tiles-lobby", "tiles-street"),
  ],
  fonts: [
    pixel.MANIFEST,
    "art/generated/fonts/font-body.fnt",
    "art/generated/fonts/font-body.png",
    "public/art/fonts/chibi-sans/ChibiSans-Bold.woff2",
    "public/art/fonts/chibi-sans/ChibiSans-Regular.woff2",
    "public/art/fonts/chibi-sans/OFL.txt",
  ],
  goose: [pixel.MANIFEST, CONTACT_SILHOUETTES, ...sprites("goose-antagonist", "goose-trap")],
  homecity: [
    pixel.MANIFEST,
    ...backdrops(
      "homecity-awning",
      "homecity-far",
      "homecity-sky",
      "neighbourhood-mid",
      "neighbourhood-wall",
      "outskirts-mid",
      "outskirts-wall",
    ),
    ...sprites("homecity-awning-ledge"),
    ...tilesets("tiles-homecity"),
  ],
  icons: [
    "public/art/favicon-16.png",
    "public/art/favicon.png",
    "public/favicon.ico",
    "public/icons/apple-touch-icon.png",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/icon-maskable-512.png",
  ],
  industrial: [
    pixel.MANIFEST,
    ...backdrops(
      "freight-gantry",
      "freight-gantry-rail",
      "freight-mid",
      "industrial-far",
      "industrial-sky",
      "warehouse-loading-bay",
      "warehouse-mid",
      "warehouse-wall",
    ),
    ...sprites("freight-crane-cable", "freight-crane-container"),
    ...tilesets("tiles-industrial"),
  ],
  largeWildlife: [pixel.MANIFEST, ...sprites("background-deer-large")],
  logo: [
    pixel.MANIFEST,
    "public/art/logo-icon.png",
    "public/art/logo-nav.png",
    "public/art/logo.png",
  ],
  map: [
    pixel.MANIFEST,
    ...sprites(
      "map-bird",
      "map-icon-apartment",
      "map-icon-blue-cityscape",
      "map-icon-countryside",
      "map-icon-home-city",
      "map-icon-industrial",
      "map-icon-woodland",
      "map-icon-zone",
      "map-paper",
      "map-region-apartment",
      "map-region-blue-cityscape",
      "map-region-countryside",
      "map-region-home-city",
      "map-region-industrial",
      "map-region-woodland",
      "map-zone",
    ),
  ],
  obstacles: [pixel.MANIFEST, ...tilesets("tiles-platforming")],
  palette: [pixel.MANIFEST, "public/art/palette.json"],
  park: [
    pixel.MANIFEST,
    ...backdrops(
      "park-bandstand",
      "park-bench",
      "park-city",
      "park-clouds",
      "park-far-trees",
      "park-lamp",
      "park-sky",
      "park-tree",
      "park-treetops",
    ),
    ...sprites("park-boat", "park-gate"),
    ...tilesets("tiles-park"),
  ],
  pigeonAntagonist: [
    pixel.MANIFEST,
    CONTACT_SILHOUETTES,
    ...sprites("pigeon-antagonist", "pigeon-poop"),
  ],
  pigeonPortrait: [pixel.MANIFEST, ...sprites("portrait-pigeon")],
  raccoon: [pixel.MANIFEST, CONTACT_SILHOUETTES, ...sprites("raccoon-antagonist")],
  roomBuildings: [
    pixel.MANIFEST,
    ...backdrops(
      "room-building-blue-cityscape",
      "room-building-countryside",
      "room-building-home-city",
      "room-building-industrial",
      "room-building-woodland",
    ),
  ],
  roomDoors: [
    pixel.MANIFEST,
    ...backdrops("apartment-room-door", "apartment-stairwell-door"),
    ...tilesets("tiles-street"),
  ],
  skillIcons: [
    pixel.MANIFEST,
    ...sprites("icon-skill-dash", "icon-skill-double-jump", "icon-skill-speedy"),
  ],
  speakerPortraits: [
    pixel.MANIFEST,
    ...sprites("portrait-goose", "portrait-raccoon", "portrait-tip"),
  ],
  start: [pixel.MANIFEST, "public/art/images/start-background.png"],
  ui: [
    pixel.MANIFEST,
    ...sprites(
      "icon-browser-menu",
      "icon-install",
      "icon-ios-share",
      "icon-reduced-motion",
      "icon-settings-nav",
      "ui-button",
      "ui-button-primary",
      "ui-close",
      "ui-dialogue-box",
      "ui-focus",
      "ui-icon-button",
      "ui-menu",
      "ui-move-hint",
      "ui-move-knob",
      "ui-name-tab",
      "ui-nav-bar",
      "ui-pause",
      "ui-play-mark",
      "ui-portrait-frame",
      "ui-quit",
      "ui-resume",
      "ui-settings-card",
      "ui-switch",
      "ui-touch-jump",
      "ui-touch-use",
    ),
  ],
  woodland: [
    pixel.MANIFEST,
    ...backdrops(
      "forest-mid",
      "forest-mid-birch",
      "forest-mid-conifers",
      "forest-shrub",
      "forest-tree",
      "ravine-mid",
      "ravine-rock",
      "woodland-far",
      "woodland-far-conifers",
      "woodland-sky",
    ),
    ...sprites("woodland-gust-emitter", "woodland-gust-stream"),
    ...tilesets("tiles-woodland"),
  ],
  woodlandFauna: [pixel.MANIFEST, ...sprites("background-deer", "background-swallow")],
  zoneThemes: [pixel.MANIFEST, "public/art/zone-themes.json"],
};

// Hand-kept paths under CHECK_PATHS that no set writes: documentation, font sources and generator
// sources. The hand-captured stage previews registered in the committed manifest are added at run
// time (handImages).
const STATIC = [
  "art/README.md",
  "art/controls.md",
  "art/fonts",
  "art/inventory.md",
  "art/layout.md",
  "art/style-guide.md",
  "art/tools",
];

const TOOLS = { directory: "art/tools" };

const BUILD_SETS: BuildSets = Object.fromEntries(
  SETS.map((set) => [
    set,
    { build: nodeBuild(TOOLS, set), needs: NEEDS[set] ?? [], outputs: OUTPUTS[set] },
  ]),
);

// The manifest's sections, in their served order.
const SECTIONS = ["fonts", "sprites", "data", "tilesets", "backdrops", "images"] as const;
// Image entries registered by hand, which no set writes: the hand-captured stage previews.
const HAND_IMAGES = /^stage-preview-zone-\d+-stage-\d+$/;

// The served paths of the committed manifest's hand-registered images, read before any build.
function handImages(): string[] {
  return ((pixel.readManifest().images as pixel.ManifestEntry[] | undefined) ?? [])
    .filter(({ key }) => HAND_IMAGES.test(key))
    .map(({ png }) => `public/art/${png as string}`);
}

// Reset the manifest to the committed manifest's hand-registered entries, every section present
// and in order.
function resetManifest(): void {
  const previous = pixel.readManifest();
  pixel.writeJson(
    {},
    pixel.MANIFEST,
    Object.fromEntries(
      SECTIONS.map((section) => [
        section,
        ((previous[section] as pixel.ManifestEntry[] | undefined) ?? []).filter(
          ({ key }) => section === "images" && HAND_IMAGES.test(key),
        ),
      ]),
    ),
  );
}

// The sets with the manifest reset ahead of the first set's build, for a full rebuild.
function withManifestReset(sets: BuildSets): BuildSets {
  const first = buildOrder(sets)[0] as ArtSet;
  const build = nodeBuild(TOOLS, first);
  return {
    ...sets,
    [first]: {
      ...sets[first],
      build: () => {
        resetManifest();
        build();
      },
    },
  };
}

// art-kit checks every module in art/tools/ is a set or in NOT_SETS and that SETS meets NEEDS,
// then parses `[--check] [SET...]` (or prints USAGE for --help or -h) and returns the exit status.
// A run with no SET is a full rebuild.
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const full = argv.every((arg) => arg === "--check");
  process.exitCode = await buildCommand(
    {
      check: { outputs: true, paths: CHECK_PATHS, static: [...STATIC, ...handImages()] },
      modules: { ...TOOLS, nonSets: NOT_SETS },
      sets: full ? withManifestReset(BUILD_SETS) : BUILD_SETS,
      strictOrder: true,
      usage: USAGE,
    },
    argv,
  );
}
