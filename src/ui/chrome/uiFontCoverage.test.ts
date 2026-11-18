import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { Blob, Face } from "harfbuzzjs";
import { expect, it } from "vitest";

import { playerCodePoints } from "./uiFontCodePoints.ts";
import { UI_FONT_RESOURCES } from "./uiFonts.ts";

// The crash screen declares its own @font-face rules for the served faces.
const CRASH_THEME = "src/crash/theme.css";

const decompress = createRequire(import.meta.url)("wawoff2/decompress.js") as (
  font: Uint8Array,
) => Promise<Uint8Array>;

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
  const needed = playerCodePoints();
  const paths = servedFacePaths();
  expect(paths.length).toBeGreaterThan(0);
  const coverages = await faceCoverages(paths);
  const missing = paths.map((path, index) => {
    const absent = [...needed].filter((codePoint) => !coverages[index]!.has(codePoint));
    return [path, absent.sort((a, b) => a - b).map(codePointName)] as const;
  });
  expect(Object.fromEntries(missing)).toEqual(Object.fromEntries(paths.map((path) => [path, []])));
});
