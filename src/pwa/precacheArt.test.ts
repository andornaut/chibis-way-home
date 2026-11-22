import { describe, expect, it } from "vitest";

import { ART_PATH, type ArtManifest, CRASH_BIRD_URL } from "../assets/index.ts";
import { UI_FONT_RESOURCES } from "../ui/index.ts";
import { artUrls, bootArtUrls } from "./precacheArt.ts";

const EMPTY: ArtManifest = {
  backdrops: [],
  data: [],
  fonts: [],
  images: [],
  sprites: [],
  tilesets: [],
};

describe("artUrls", () => {
  it.each([
    ["nothing", EMPTY, []],
    [
      "a sprite",
      { ...EMPTY, sprites: [{ json: "s/a.json", key: "a", once: [], png: "s/a.png" }] },
      [],
    ],
    [
      "a preview bitmap font",
      { ...EMPTY, fonts: [{ fnt: "f/b.fnt", key: "b", png: "f/b.png" }] },
      [],
    ],
    ["a data file", { ...EMPTY, data: [{ json: "c.json", key: "c" }] }, ["c.json"]],
    [
      "a data file the code bundles",
      { ...EMPTY, data: [{ json: "palette.json", key: "palette" }] },
      [],
    ],
    [
      "a tileset",
      { ...EMPTY, tilesets: [{ json: "t/d.json", key: "d", png: "t/d.png" }] },
      ["t/d.json"],
    ],
    [
      "a backdrop",
      {
        ...EMPTY,
        backdrops: [{ height: 9, key: "e", png: "b/e.png", repeat: "x", width: 4, y: 9 } as const],
      },
      [],
    ],
    [
      "an image",
      { ...EMPTY, images: [{ height: 2, key: "f", png: "f.png", width: 3 }] },
      ["f.png"],
    ],
  ])("lists what a build loads from art's files for %s", (_, manifest, files) => {
    const boot = files.map((file) => ART_PATH + file);
    expect(bootArtUrls(new Set(), manifest)).toEqual(boot);
    expect(artUrls(boot)).toEqual([
      ...boot,
      CRASH_BIRD_URL,
      ...UI_FONT_RESOURCES.map(({ url }) => url),
    ]);
  });
});

it("keeps only the images the atlas does not supply in the standalone boot list", () => {
  const manifest: ArtManifest = {
    ...EMPTY,
    images: [
      { height: 84, key: "preview", png: "images/preview.png", width: 168 },
      { height: 360, key: "start-background", png: "images/start-background.png", width: 720 },
    ],
  };
  const boot = bootArtUrls(new Set(["preview"]), manifest);
  expect(boot).toEqual(["/art/images/start-background.png"]);
  expect(artUrls(boot)).not.toContain("/art/images/preview.png");
});

it("includes the native crash bird and both UI font files in the fingerprinted art emission list", () => {
  const urls = artUrls(bootArtUrls(new Set(), EMPTY));
  for (const url of [
    CRASH_BIRD_URL,
    "/art/fonts/chibi-sans/ChibiSans-Regular.woff2",
    "/art/fonts/chibi-sans/ChibiSans-Bold.woff2",
  ]) {
    expect(urls.filter((entry) => entry === url)).toHaveLength(1);
  }
  expect(urls).not.toContain("/art/sprites/bird.png");
  expect(urls.some((url) => url.endsWith(".ttf"))).toBe(false);
});
