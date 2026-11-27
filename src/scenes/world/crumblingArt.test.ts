import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import type { ArtManifest } from "../../assets/index.ts";
import type { AreaLayout, ObjectLayout, ZoneLayout } from "../../data/types/index.ts";
import { initialCrumblingWorld } from "../../rules/bird/crumbling.ts";
import type { ZoneCrumblingWorld } from "../../rules/zone/zoneCrumbling.ts";
import type { Tileset } from "../../stage/index.ts";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("../../ui/input/frameTurn.ts", () => ({ frameTurn: () => ({}) }));

import type { ZoneState } from "../../rules/zone/zone.ts";
import { createZoneObjectArt } from "./zoneObjectArt.ts";

const tileset = JSON.parse(
  readFileSync(
    new URL("../../../public/art/tilesets/tiles-platforming.json", import.meta.url),
    "utf8",
  ),
) as Tileset;

function fixture() {
  const ledge = {
    art: "one-way-ledge",
    collision: "ledge",
    crumbling: { absentSeconds: 2, warningSeconds: 0.8 },
    height: 12,
    motion: { algorithm: "static", playback: undefined },
    origin: { x: 288, y: 576 },
    tileset: "tiles-platforming",
    width: 72,
  } as unknown as ObjectLayout;
  const area = {
    crumbling: [
      {
        profile: ledge.crumbling!,
        supportId: ledge,
        volume: { ...ledge.origin, height: 12, width: 72 },
      },
    ],
    objects: [ledge],
    tileset: "tiles-platforming",
  } as unknown as AreaLayout;
  const images: { frame: number; visible: boolean }[] = [];
  const image = (_x: number, _y: number, _key: string, frame: number) => {
    const shown = { frame, visible: true };
    images.push(shown);
    const handle = {
      setOrigin: () => handle,
      setVisible: (visible: boolean) => {
        shown.visible = visible;
        return handle;
      },
    };
    return handle;
  };
  const container = {
    destroy: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn(),
    x: 288,
    y: 576,
  };
  const zone: { crumbling: ZoneCrumblingWorld; objects: { x: number; y: number }[] } = {
    crumbling: initialCrumblingWorld(area.crumbling!),
    objects: [ledge.origin],
  };
  const layout = { areas: { main: area } } as unknown as ZoneLayout;
  const state = {
    ...zone,
    area: "main",
    behaviours: [],
    bird: { x: 0, y: 0 },
    pulses: [],
    transients: [],
  };
  const host = {
    add: { container: vi.fn(() => container), image },
    cache: { json: { get: () => tileset } },
  };
  const scene = createZoneObjectArt(host as unknown as Parameters<typeof createZoneObjectArt>[0], {
    manifest: {} as ArtManifest,
    sheet: () => new Map(),
    warning: undefined,
  });
  scene.reset(layout, state as unknown as ZoneState);
  // Visible tile indices, left to right.
  const shown = () => images.filter(({ visible }) => visible).map(({ frame }) => frame);
  return { area, layout, ledge, scene, shown, state };
}

it("swaps the ledge onto its dedicated intact and warning skins and hides it while absent", () => {
  const { layout, ledge, scene, shown, state } = fixture();
  const run = (key: string) =>
    [`${key}-left`, ...Array(4).fill(`${key}-middle`), `${key}-right`].map(
      (name) => tileset.tiles[name],
    );
  const phase = (kind: "intact" | "warning" | "absent") => {
    state.crumbling = {
      ...state.crumbling,
      supports: [
        {
          phase:
            kind === "warning"
              ? { kind, removeAtSeconds: 1 }
              : kind === "absent"
                ? { kind, restoreAfterSeconds: 3 }
                : { kind },
          supportId: ledge,
        },
      ],
    };
    scene.draw(layout, undefined, state as unknown as ZoneState);
    return shown();
  };
  // Before the first live draw the intact skin already shows; the base skin never does.
  expect(shown()).toEqual(run("crumbling-ledge"));
  expect(phase("intact")).toEqual(run("crumbling-ledge"));
  expect(phase("warning")).toEqual(run("crumbling-ledge-warn"));
  expect(phase("absent")).toEqual([]);
  expect(phase("intact")).toEqual(run("crumbling-ledge"));
});

it("fails at load for a crumbling object without a mapped skin, and for crumbling terrain", () => {
  const { area, ledge, scene, state } = fixture();
  expect(() =>
    scene.reset(
      {
        areas: { main: { ...area, objects: [{ ...ledge, art: "platform-top" }] } },
      } as unknown as ZoneLayout,
      state as unknown as ZoneState,
    ),
  ).toThrow("No crumbling skin for platform-top");
  const terrain = { height: 12, width: 12, x: 0, y: 0 };
  expect(() =>
    scene.reset(
      {
        areas: {
          main: {
            ...area,
            crumbling: [
              {
                profile: { absentSeconds: 2, warningSeconds: 0.8 },
                supportId: terrain,
                volume: terrain,
              },
            ],
          },
        },
      } as unknown as ZoneLayout,
      state as unknown as ZoneState,
    ),
  ).toThrow("Crumbling terrain has no registered skin");
});
