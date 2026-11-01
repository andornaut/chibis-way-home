import { describe, expect, it } from "vitest";

import type { ObjectLayout } from "../data/types";
import type { ArtManifest } from "./aseprite";
import { type ArtKind, artKind, artScrollFactor, sceneryParallax } from "./objectArt";
import type { Tileset } from "./tiles";

const MANIFEST = {
  backdrops: [
    { key: "sky", repeat: "x" },
    { key: "tower", repeat: "none" },
  ],
  sprites: [{ key: "pigeon" }],
} as unknown as ArtManifest;
const TILESET: Tileset = { columns: 1, pieces: {}, tileSize: 12, tiles: { planter: 0 } };

describe("artKind", () => {
  it.each([
    ["a tile of the area's tileset", TILESET, "planter", "tiles"],
    ["a repeated backdrop", TILESET, "sky", "repeated-backdrop"],
    ["a backdrop", TILESET, "tower", "backdrop"],
    ["a sprite", TILESET, "pigeon", "sprite"],
    ["placeholder art", TILESET, "placeholder-park-bench", "placeholder"],
    ["art the game does not have", TILESET, "park-bench", "placeholder"],
    [
      "a tile name in an area whose tileset art does not have yet",
      undefined,
      "planter",
      "placeholder",
    ],
  ])("draws %s as %s", (_, tileset, art, kind) => {
    expect(artKind(MANIFEST, tileset, art)).toBe(kind);
  });
});

describe("artScrollFactor", () => {
  it.each<ArtKind>(["backdrop", "placeholder", "repeated-backdrop", "sprite", "tiles"])(
    "keeps %s at world speed by default",
    (kind) => {
      expect(artScrollFactor(kind)).toEqual({ x: 1, y: 1 });
    },
  );

  it.each<ArtKind>(["backdrop", "repeated-backdrop"])("applies both axes to %s", (kind) => {
    expect(artScrollFactor(kind, { x: 0.2, y: 0 })).toEqual({ x: 0.2, y: 0 });
  });

  it.each<ArtKind>(["placeholder", "sprite", "tiles"])(
    "rejects detached parallax for %s",
    (kind) => {
      expect(() => artScrollFactor(kind, { x: 0, y: 1 })).toThrow("requires backdrop art");
    },
  );
});

describe("scenery sprite eligibility", () => {
  const object = {
    collision: "none",
    interaction: { kind: "none" },
    motion: { algorithm: "static" },
    parallax: { x: 0.4, y: 0.15 },
    reaction: { kind: "none" },
  } as ObjectLayout;

  it("accepts static animation and wait-only animation graphs behind the world", () => {
    expect(sceneryParallax(object)).toEqual(object.parallax);
    const behaviour: NonNullable<ObjectLayout["behaviour"]> = {
      axis: "x",
      distance: 0,
      initial: "grazing",
      states: { grazing: { animation: "graze", motion: { kind: "wait" }, transitions: [] } },
    };
    expect(sceneryParallax({ ...object, behaviour })).toEqual(object.parallax);
  });

  it.each([
    { collision: "hazard" },
    { interaction: { kind: "talk" } },
    { motion: { algorithm: "linear" } },
    { reaction: { kind: "approach" } },
    { contact: {} },
    { quirks: ["blink"] },
    {
      behaviour: {
        states: { waiting: { motion: { kind: "wait" }, onEnter: [{ kind: "spawn" }] } },
      },
    },
    {
      behaviour: {
        states: { waiting: { motion: { kind: "wait" }, onEnter: [{ kind: "force-pulse" }] } },
      },
    },
    { behaviour: { states: { moving: { motion: { kind: "move" } } } } },
  ])("retains sprite parallax rejection for physical or interactive state %j", (change) => {
    const invalid = { ...object, ...change } as ObjectLayout;
    expect(sceneryParallax(invalid)).toBeUndefined();
    expect(() => artScrollFactor("sprite", invalid.parallax)).toThrow("requires backdrop art");
  });

  it("keeps ordinary world sprites on their existing rendering path", () => {
    const ordinary = { ...object };
    delete ordinary.parallax;
    expect(sceneryParallax(ordinary)).toBeUndefined();
    expect(sceneryParallax({ ...object, parallax: { x: 1, y: 1 } })).toBeUndefined();
  });
});
