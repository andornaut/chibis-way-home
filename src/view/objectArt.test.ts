import { describe, expect, it } from "vitest";

import type { ObjectLayout } from "../data/types";
import type { ArtManifest } from "./aseprite";
import { type ArtKind, artKind, artScrollFactor, sceneryParallax, worldScenery } from "./objectArt";
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
  it("keeps art at world speed when no parallax is configured", () => {
    expect(artScrollFactor("sprite")).toEqual({ x: 1, y: 1 });
  });

  it.each<ArtKind>(["backdrop", "repeated-backdrop"])("applies both axes to %s", (kind) => {
    expect(artScrollFactor(kind, { x: 0.2, y: 0 })).toEqual({ x: 0.2, y: 0 });
  });

  it("rejects detached sprite parallax", () => {
    expect(() => artScrollFactor("sprite", { x: 0, y: 1 })).toThrow("requires backdrop art");
  });
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
    { behaviour: { states: { moving: { motion: { kind: "move" } } } } },
  ])("retains sprite parallax rejection for physical or interactive state %j", (change) => {
    const invalid = { ...object, ...change } as ObjectLayout;
    expect(sceneryParallax(invalid)).toBeUndefined();
    expect(() => artScrollFactor("sprite", invalid.parallax)).toThrow("requires backdrop art");
  });

  it("rejects a static orbiter whose position belongs to its host relationship", () => {
    const orbit: NonNullable<ObjectLayout["orbit"]> = {
      angularSpeed: 1,
      host: 0,
      phase: 0,
      radius: 24,
    };
    expect(sceneryParallax({ ...object, orbit })).toBeUndefined();
  });

  it("keeps ordinary world sprites on their existing rendering path", () => {
    const ordinary = { ...object };
    delete ordinary.parallax;
    expect(sceneryParallax(ordinary)).toBeUndefined();
    expect(sceneryParallax({ ...object, parallax: { x: 1, y: 1 } })).toBeUndefined();
  });
});

describe("assembly-proven world scenery", () => {
  const object = {
    collision: "none",
    interaction: { kind: "none" },
    motion: { algorithm: "static" },
    parallax: { x: 1, y: 1 },
    quirks: [],
    reaction: { kind: "none" },
    scenerySource: "chunk",
  } as unknown as ObjectLayout;
  it.each(["static", "linear", "hop"] as const)(
    "allows the existing time-only %s track without inferring provenance",
    (algorithm) => {
      expect(worldScenery({ ...object, motion: { ...object.motion, algorithm } })).toBe(true);
      const ordinary = { ...object };
      delete ordinary.scenerySource;
      expect(worldScenery(ordinary)).toBe(false);
      const legacy = { ...object, parallax: { x: 0.4, y: 0.15 } };
      expect(worldScenery(legacy)).toBe(false);
      expect(sceneryParallax(legacy)).toEqual(legacy.parallax);
    },
  );
  it("allows only wait/elapsed animation graphs in the initial world mode", () => {
    const behaviour: NonNullable<ObjectLayout["behaviour"]> = {
      axis: "x",
      distance: 0,
      initial: "graze",
      states: {
        graze: {
          animation: "graze",
          motion: { kind: "wait" },
          transitions: [{ to: "graze", when: [{ kind: "elapsed", seconds: 1 }] }],
        },
      },
    };
    expect(worldScenery({ ...object, behaviour })).toBe(true);
    const sensing = {
      ...behaviour,
      states: {
        graze: {
          ...behaviour.states.graze!,
          transitions: [{ to: "graze", when: [{ kind: "visible" as const }] }],
        },
      },
    };
    expect(worldScenery({ ...object, behaviour: sensing })).toBe(false);
  });
  it.each([
    { collision: "hazard" },
    { interaction: { kind: "talk" } },
    { reaction: { kind: "avoid" } },
    { contact: {} },
    { quirks: ["blink"] },
    { orbit: {} },
    { scene: "intro" },
    { behaviour: { pursuit: {} } },
    {
      behaviour: { states: { attack: { motion: { kind: "wait" }, onEnter: [{ kind: "spawn" }] } } },
    },
    { behaviour: { states: { jump: { motion: { kind: "hop" } } } } },
    { behaviour: { states: { target: { motion: { kind: "pursue" } } } } },
  ])("rejects unsafe world decoration %j", (change) => {
    expect(worldScenery({ ...object, ...change } as ObjectLayout)).toBe(false);
  });
});
