import { describe, expect, it } from "vitest";

import { ART_PATH, type ArtManifest } from "../assets";
import { UI_FONT_RESOURCES } from "../ui";
import { ART_MANIFEST_URL, artUrls } from "./precacheArt";

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
      "a font",
      { ...EMPTY, fonts: [{ fnt: "f/b.fnt", key: "b", png: "f/b.png" }] },
      ["f/b.png", "f/b.fnt"],
    ],
    ["a data file", { ...EMPTY, data: [{ json: "c.json", key: "c" }] }, ["c.json"]],
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
  ])("lists the manifest and what a build loads from its files for %s", (_, manifest, files) => {
    expect(artUrls(manifest)).toEqual([
      ART_MANIFEST_URL,
      ...files.map((file) => ART_PATH + file),
      ...UI_FONT_RESOURCES.map(({ url }) => url),
    ]);
  });
});

it("includes both self-hosted UI font files in the fingerprinted art emission list", () => {
  const urls = artUrls(EMPTY);
  for (const url of [
    "/art/fonts/liberation/LiberationSans-Regular.ttf",
    "/art/fonts/liberation/LiberationSans-Bold.ttf",
  ]) {
    expect(urls.filter((entry) => entry === url)).toHaveLength(1);
  }
});
