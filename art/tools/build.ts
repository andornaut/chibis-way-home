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
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { buildCommand, buildOrder, type BuildSets } from "@andornaut/art-kit/build";

import * as pixel from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any file the rebuild changed, removed or added
                                               under art/ or the paths the builds write
                                               (public/art/, public/favicon.ico, public/icons/)`;

// Every set with a build command. Declaration order breaks ties in the build order.
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
const NOT_SETS = new Set([
  "backgroundPalette",
  "build",
  "cli",
  "imageArt",
  "nature",
  "pixel",
  "previewText",
]);

// The manifest's sections, in their served order.
const SECTIONS = ["fonts", "sprites", "data", "tilesets", "backdrops", "images"] as const;
// Image entries registered by hand, which no set writes: the hand-captured stage previews.
const HAND_IMAGES = /^stage-preview-zone-\d+-stage-\d+$/;

// art/, which no build writes, and every path a build writes.
const CHECK_PATHS = ["art", "public/art", "public/favicon.ico", "public/icons"];

// The modules in dir that are neither a set nor listed in NOT_SETS.
function unlisted(dir: string): string[] {
  const known = new Set<string>([...SETS, ...NOT_SETS]);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !known.has(name.replace(/\.ts$/, "")))
    .map((name) => `${name} is not in SETS or NOT_SETS`);
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

// Run the set's generator build in its own node process; a nonzero exit fails the set.
function spawnBuild(set: ArtSet): void {
  const result = spawnSync(process.execPath, [`art/tools/${set}.ts`, "build"], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${set} build failed (exit ${result.status ?? result.signal})`);
  }
}

// Every set, with the manifest reset ahead of the first set's build when full is set.
function sets(full: boolean): BuildSets {
  const all: BuildSets = Object.fromEntries(
    SETS.map((set) => [set, { build: () => spawnBuild(set), needs: NEEDS[set] ?? [] }]),
  );
  if (!full) {
    return all;
  }
  const first = buildOrder(all)[0] as ArtSet;
  return {
    ...all,
    [first]: {
      ...all[first],
      build: () => {
        resetManifest();
        spawnBuild(first);
      },
    },
  };
}

// `--help`, `-h` or `help` prints the usage; otherwise art-kit parses `[--check] [SET...]` and returns
// the exit status: 0, 1 for a failing build, check differences or a module missing from SETS and
// NOT_SETS, or 2 for a usage error.
async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 1 && ["--help", "-h", "help"].includes(argv[0] as string)) {
    console.log(USAGE);
    return 0;
  }
  const problems = unlisted("art/tools");
  if (problems.length) {
    console.error(problems.join("\n"));
    return 1;
  }
  const full = argv.every((arg) => arg === "--check");
  return buildCommand({ sets: sets(full), check: { paths: CHECK_PATHS }, usage: USAGE }, argv);
}

process.exitCode = await main(process.argv.slice(2));
