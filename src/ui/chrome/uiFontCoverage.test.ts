import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { UNKNOWN_COMMIT } from "@andornaut/game-kit/build/buildVersion";
import { buildLabel } from "@andornaut/game-kit/runtime/web/buildLabel";
import { Blob, Face } from "harfbuzzjs";
import { expect, it } from "vitest";

import * as achievements from "../../data/achievements.ts";
import * as characters from "../../data/characters.ts";
import * as crashText from "../../data/crashText.ts";
import * as dialogues from "../../data/dialogues.ts";
import * as text from "../../data/text.ts";
import * as zones from "../../data/zones.ts";
import { timeText } from "../../progress/index.ts";
import { UI_FONT_RESOURCES } from "./uiFonts.ts";

// Every exported value of these modules is walked. src/data/dev.ts is left out: the developer
// panel sets its own sans-serif font (src/dev/panel.css), not the served faces.
const STRING_SOURCES = { achievements, characters, crashText, dialogues, text, zones };

// The crash screen declares its own @font-face rules for the served faces.
const CRASH_THEME = "src/crash/theme.css";

// Placeholders are filled at runtime; their values are counted separately below.
const PLACEHOLDER = /\{[^{}]+\}/gu;
// C0 and C1 controls, such as newline, are layout, not glyphs.
const CONTROL = /^\p{Cc}$/u;

const decompress = createRequire(import.meta.url)("wawoff2/decompress.js") as (
  font: Uint8Array,
) => Promise<Uint8Array>;

function addCodePoints(target: Set<number>, value: string): void {
  for (const character of value.replace(PLACEHOLDER, "")) {
    if (!CONTROL.test(character)) {
      target.add(character.codePointAt(0)!);
    }
  }
}

function collectStrings(target: Set<number>, value: unknown, seen = new Set<object>()): void {
  if (typeof value === "string") {
    addCodePoints(target, value);
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    collectStrings(target, child, seen);
  }
}

// Characters the game composes at runtime: counts, percentages and stage numbers, timer text and
// the build label, whose version comes from package.json and whose commit is eight lowercase hex
// digits of a commit hash or the kit's unknown-commit word.
function runtimeCodePoints(): Set<number> {
  const target = new Set<number>();
  addCodePoints(target, "0123456789");
  for (let seconds = 0; seconds < 3600; seconds += 1) {
    addCodePoints(target, timeText(seconds));
  }
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  addCodePoints(target, buildLabel(version, "0123456789abcdef"));
  addCodePoints(target, buildLabel(version, UNKNOWN_COMMIT));
  return target;
}

function servedFacePaths(): string[] {
  const crashUrls = [...readFileSync(CRASH_THEME, "utf8").matchAll(/url\("([^"]+\.woff2)"\)/gu)];
  const urls = [...UI_FONT_RESOURCES.map(({ url }) => url), ...crashUrls.map((match) => match[1]!)];
  return [...new Set(urls)].map((url) => `public${url}`);
}

// The decoder returns a view of its WASM memory, so each face is copied before the next decode
// starts.
async function faceCoverages(paths: readonly string[]): Promise<Set<number>[]> {
  const coverages: Set<number>[] = [];
  await paths.reduce(async (previous, path) => {
    await previous;
    const font = new Uint8Array(await decompress(new Uint8Array(readFileSync(path))));
    coverages.push(new Set(new Face(new Blob(font)).collectUnicodes()));
  }, Promise.resolve());
  return coverages;
}

function codePointName(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

it("maps every player-visible code point in every served face", async () => {
  const needed = runtimeCodePoints();
  collectStrings(needed, STRING_SOURCES);
  const paths = servedFacePaths();
  expect(paths.length).toBeGreaterThan(0);
  const coverages = await faceCoverages(paths);
  const missing = paths.map((path, index) => {
    const absent = [...needed].filter((codePoint) => !coverages[index]!.has(codePoint));
    return [path, absent.sort((a, b) => a - b).map(codePointName)] as const;
  });
  expect(Object.fromEntries(missing)).toEqual(Object.fromEntries(paths.map((path) => [path, []])));
});
