import { expect, it } from "vitest";

import type { ArtManifest } from "../view/aseprite";
import { galleryCatalogue } from "./catalogue";

it("keeps every manifest category and sprite metadata while resolving public source links", () => {
  const manifest: ArtManifest = {
    backdrops: [
      { height: 20, key: "sky", png: "backdrops/sky.png", repeat: "x", width: 40, y: 720 },
    ],
    data: [{ json: "palette.json", key: "palette" }],
    fonts: [{ fnt: "fonts/body.fnt", key: "body", png: "fonts/body.png" }],
    images: [{ height: 10, key: "logo", png: "logo.png", width: 20 }],
    sprites: [
      {
        contact: "silhouette",
        hitbox: { height: 4, width: 6, x: 1, y: 2 },
        json: "sprites/actor.json",
        key: "actor",
        once: ["death"],
        png: "sprites/actor.png",
      },
    ],
    tilesets: [{ json: "tilesets/floor.json", key: "floor", png: "tilesets/floor.png" }],
  };
  const sections = galleryCatalogue(manifest);
  expect(sections.flatMap(({ items }) => items.map(({ key }) => key))).toEqual([
    "sky",
    "palette",
    "body",
    "logo",
    "actor",
    "floor",
  ]);
  expect(sections.find(({ id }) => id === "sprites")!.items[0]).toEqual({
    ...manifest.sprites[0],
    json: "/art/sprites/actor.json",
    kind: "sprite",
    png: "/art/sprites/actor.png",
  });
  expect(sections.find(({ id }) => id === "fonts")!.items[0]).toMatchObject({
    fnt: "/art/fonts/body.fnt",
    png: "/art/fonts/body.png",
  });
  expect(sections.find(({ id }) => id === "tilesets")!.items[0]).toMatchObject({
    json: "/art/tilesets/floor.json",
    kind: "image",
  });
  expect(manifest.sprites[0]!.png).toBe("sprites/actor.png");
});
