// Rebuild the art: run `node art/tools/<set>.ts build` for every set, in an order where each set runs
// after the sets in NEEDS, and stop at the first failure.
//
// A full rebuild first resets the manifest to its SECTIONS in order, holding only the entries
// registered by hand (HAND_IMAGES), so a key that no set draws any longer leaves the manifest
// without a hand edit. Named sets rebuild those sets and every set downstream of them over the
// committed manifest.
//
// --check then fails when a path under TREES (art/ and every path the builds write) differs from the
// index or holds an untracked file, and lists those paths. Builds are deterministic, so on a clean
// checkout every difference is a generator change.
//
// Run from the repository root in the node:24.21.0 check container. It spawns only node and git,
// and reaches no network.
//
// CLEANUP (added 2026-11-04): replace with art-kit's shared build runner once released.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { run as runMain } from "./cli.ts";
import * as pixel from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/build.ts [--check] [SET...]   rebuild every set, or each SET and the sets that read
                                               its exports, in dependency order; --check then fails
                                               on any changed or untracked file under art/ or
                                               the paths the builds write (public/art/,
                                               public/favicon.ico, public/icons/)`;

// Every set with a build command, in build order: the sets that need no other set (alphabetical),
// then the sets that do (alphabetical, which meets every entry in NEEDS).
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
const TREES = ["art", "public/art", "public/favicon.ico", "public/icons"];

class UsageError extends Error {}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Problems with SETS and NEEDS: a module in dir that is neither a set nor listed in NOT_SETS, or a set
// ordered before one it needs.
function problems(dir: string): string[] {
  const out: string[] = [];
  const known = new Set<string>([...SETS, ...NOT_SETS]);
  for (const name of readdirSync(dir)) {
    const stem = name.replace(/\.ts$/, "");
    if (name.endsWith(".ts") && !known.has(stem)) {
      out.push(`${name} is not in SETS or NOT_SETS`);
    }
  }
  for (const [set, needs] of Object.entries(NEEDS)) {
    for (const need of needs) {
      if (SETS.indexOf(need) > SETS.indexOf(set as ArtSet)) {
        out.push(`${set} runs before ${need}, which it needs`);
      }
    }
  }
  return out;
}

// The named sets and every set that needs them, directly or through another, in build order; every
// set when none is named.
function selected(named: readonly ArtSet[]): ArtSet[] {
  if (!named.length) {
    return [...SETS];
  }
  const chosen = new Set<ArtSet>(named);
  for (const set of SETS) {
    if (NEEDS[set]?.some((need) => chosen.has(need))) {
      chosen.add(set);
    }
  }
  return SETS.filter((set) => chosen.has(set));
}

// The committed manifest's hand-registered entries, every section present and in order.
function handRegistered(): Record<string, pixel.ManifestEntry[]> {
  const previous = pixel.readManifest();
  return Object.fromEntries(
    SECTIONS.map((section) => [
      section,
      ((previous[section] as pixel.ManifestEntry[] | undefined) ?? []).filter(
        ({ key }) => section === "images" && HAND_IMAGES.test(key),
      ),
    ]),
  );
}

function spawn(command: string, args: readonly string[]): number {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    fail(`${command}: ${result.error.message}`);
  }
  return result.status ?? 1;
}

// The changed and untracked paths under TREES, printed; true when there are none.
function unchanged(): boolean {
  const diff = spawn("git", ["diff", "--exit-code", "--name-status", "--", ...TREES]);
  const others = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...TREES],
    { encoding: "utf8" },
  );
  if (others.status !== 0) {
    fail(`git ls-files: ${others.stderr || others.error?.message}`);
  }
  const untracked = others.stdout.split("\0").filter(Boolean);
  for (const path of untracked) {
    console.log(`?\t${path}`);
  }
  return diff === 0 && !untracked.length;
}

// Rebuild the named sets and those downstream, or every set from a reset manifest, then check the
// trees if check is set.
function rebuild(check: boolean, named: readonly string[]): void {
  const unknown = named.filter((arg) => !(SETS as readonly string[]).includes(arg));
  if (unknown.length) {
    console.error(`unknown set ${unknown.join(", ")}`);
    throw new UsageError();
  }
  const found = problems("art/tools");
  if (found.length) {
    fail(found.join("\n"));
  }
  const started = performance.now();
  if (!named.length) {
    pixel.writeJson({}, pixel.MANIFEST, handRegistered());
  }
  for (const set of selected(named as ArtSet[])) {
    console.log(`build ${set}`);
    const status = spawn(process.execPath, [`art/tools/${set}.ts`, "build"]);
    if (status !== 0) {
      fail(`${set} build failed (exit ${status})`);
    }
  }
  console.log(`built in ${((performance.now() - started) / 1000).toFixed(0)}s`);
  if (check && !unchanged()) {
    fail(`the rebuild differs from the committed ${TREES.join(", ")}`);
  }
}

// Parse argv: `--help`, `-h` or `help` prints the usage; `--check` may lead the set names.
function main(argv: readonly string[]): void {
  if (argv.length === 1 && ["--help", "-h", "help"].includes(argv[0] as string)) {
    console.log(USAGE);
    return;
  }
  const check = argv[0] === "--check";
  const named = check ? argv.slice(1) : argv;
  try {
    if (named.some((arg) => arg.startsWith("-"))) {
      throw new UsageError();
    }
    rebuild(check, named);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    console.error(USAGE);
    process.exit(2);
  }
}

if (import.meta.main) {
  runMain(() => main(process.argv.slice(2)));
}
