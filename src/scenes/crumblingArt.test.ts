import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import type { AreaLayout, ObjectLayout } from "../data/types";
import { initialCrumblingWorld } from "../rules/crumbling";
import type { ZoneCrumblingWorld } from "../rules/zoneCrumbling";
import type { Tileset } from "../view/tiles";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));

import { ZoneScene } from "./ZoneScene";

const tileset = JSON.parse(
  readFileSync(
    new URL("../../public/art/tilesets/tiles-platforming.json", import.meta.url),
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
  const container = { setDepth: vi.fn().mockReturnThis(), setPosition: vi.fn(), x: 288, y: 576 };
  const zone: { crumbling: ZoneCrumblingWorld; objects: { x: number; y: number }[] } = {
    crumbling: initialCrumblingWorld(area.crumbling!),
    objects: [ledge.origin],
  };
  const scene = Object.assign(Object.create(ZoneScene.prototype), {
    add: { container: vi.fn(() => container), image },
    drawPulses: vi.fn(),
    drawTransients: vi.fn(),
    layout: { areas: { main: area } },
    zone: { ...zone, area: "main", behaviours: [], bird: { x: 0, y: 0 } },
  });
  scene.objectArt = [scene.drawObject("tiles-platforming", tileset, ledge, 0)];
  scene.crumblingArt = scene.drawCrumbling(area);
  // Visible tile indices, left to right.
  const shown = () => images.filter(({ visible }) => visible).map(({ frame }) => frame);
  return { area, ledge, scene, shown };
}

it("swaps the ledge onto its dedicated intact and warning skins and hides it while absent", () => {
  const { ledge, scene, shown } = fixture();
  const run = (key: string) =>
    [`${key}-left`, ...Array(4).fill(`${key}-middle`), `${key}-right`].map(
      (name) => tileset.tiles[name],
    );
  const phase = (kind: "intact" | "warning" | "absent") => {
    scene.zone.crumbling = {
      ...scene.zone.crumbling,
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
    scene.drawObjects();
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
  const { area, ledge, scene } = fixture();
  expect(() =>
    scene.drawObject("tiles-platforming", tileset, { ...ledge, art: "platform-top" }, 0),
  ).toThrow("No crumbling skin for platform-top");
  const terrain = { height: 12, width: 12, x: 0, y: 0 };
  expect(() =>
    scene.drawCrumbling({
      ...area,
      crumbling: [
        { profile: { absentSeconds: 2, warningSeconds: 0.8 }, supportId: terrain, volume: terrain },
      ],
    }),
  ).toThrow("Crumbling terrain has no registered skin");
});
