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
// path the builds write), and lists those paths. It needs no git, so it runs in a copy of the
// checkout without .git. Builds are deterministic, so on a clean checkout every difference is a
// generator change.
//
// Run from the repository root in the node:24.21.0 check container. It spawns only node and reaches
// no network.
import { buildCommand, buildOrder, type BuildSets, nodeBuild } from "@andornaut/art-kit/build";

import * as pixel from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any file the rebuild changed, removed or added
                                               under art/ or the paths the builds write
                                               (public/art/, public/favicon.ico, public/icons/)`;

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
  "hazards",
  "homecity",
  "icons",
  "industrial",
  "largeWildlife",
  "logo",
  "map",
  "obstacles",
  "owl",
  "palette",
  "park",
  "pigeonAntagonist",
  "pigeonPortrait",
  "rabbit",
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

const TOOLS = { directory: "art/tools" };

const BUILD_SETS: BuildSets = Object.fromEntries(
  SETS.map((set) => [set, { build: nodeBuild(TOOLS, set), needs: NEEDS[set] ?? [] }]),
);

// The manifest's sections, in their served order.
const SECTIONS = ["fonts", "sprites", "data", "tilesets", "backdrops", "images"] as const;
// Image entries registered by hand, which no set writes: the hand-captured stage previews.
const HAND_IMAGES = /^stage-preview-zone-\d+-stage-\d+$/;

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
      check: { paths: CHECK_PATHS },
      modules: { ...TOOLS, nonSets: NOT_SETS },
      sets: full ? withManifestReset(BUILD_SETS) : BUILD_SETS,
      strictOrder: true,
      usage: USAGE,
    },
    argv,
  );
}
