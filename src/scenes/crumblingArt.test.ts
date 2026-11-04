import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import type { AreaLayout, ObjectLayout } from "../data/types";
import { initialCrumblingWorld } from "../rules/crumbling";
import type { ZoneCrumblingWorld } from "../rules/zoneCrumbling";
import { CRUMBLING_CRACK } from "../view/crumblingPresentation";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));

import { ZoneScene } from "./ZoneScene";

const tileset: unknown = JSON.parse(
  readFileSync(
    new URL("../../public/art/tilesets/tiles-platforming.json", import.meta.url),
    "utf8",
  ),
);

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
  const painted: { colour: number; x: number; y: number }[] = [];
  let fill = 0;
  const cracks = {
    clear: vi.fn(() => {
      painted.length = 0;
      return cracks;
    }),
    destroy: vi.fn(),
    fillRect: vi.fn((x: number, y: number) => painted.push({ colour: fill, x, y })),
    fillStyle: vi.fn((value: number) => {
      fill = value;
      return cracks;
    }),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  const skin = { setPosition: vi.fn(), setVisible: vi.fn(), x: 288, y: 576 };
  const zone: { crumbling: ZoneCrumblingWorld; objects: { x: number; y: number }[] } = {
    crumbling: initialCrumblingWorld(area.crumbling!),
    objects: [ledge.origin],
  };
  const scene = Object.assign(Object.create(ZoneScene.prototype), {
    add: { graphics: vi.fn(() => cracks) },
    cache: { json: { get: (key: string) => (key === "tiles-platforming" ? tileset : palette) } },
    drawPulses: vi.fn(),
    drawTransients: vi.fn(),
    layout: { areas: { main: area } },
    objectArt: [{ item: skin, offset: { x: 0, y: 0 }, sprite: undefined }],
    zone: { ...zone, area: "main", behaviours: [], bird: { x: 0, y: 0 } },
  });
  scene.crumblingArt = scene.drawCrumbling(area);
  return { area, cracks, ledge, painted, scene, skin };
}

it("draws the live phase over the unchanged ledge skin: cracks while warned, hidden while absent", () => {
  const { ledge, painted, scene, skin } = fixture();
  const ink = Number.parseInt(palette.colours[CRUMBLING_CRACK].slice(1), 16);
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
  };
  phase("intact");
  expect(skin.setVisible).toHaveBeenLastCalledWith(true);
  expect(painted).toEqual([]);
  phase("warning");
  expect(skin.setVisible).toHaveBeenLastCalledWith(true);
  expect(painted.length).toBeGreaterThan(0);
  // Cracks stay on the skin's one-pixel opaque body row inside the side outlines.
  expect(
    painted.every(({ colour, x, y }) => colour === ink && y === 581 && x >= 289 && x < 359),
  ).toBe(true);
  phase("absent");
  expect(skin.setVisible).toHaveBeenLastCalledWith(false);
  expect(painted).toEqual([]);
  phase("intact");
  expect(skin.setVisible).toHaveBeenLastCalledWith(true);
});

it("rejects crumbling terrain until its skin has a registered face", () => {
  const { area, scene } = fixture();
  const terrain = { height: 12, width: 12, x: 0, y: 0 };
  expect(() =>
    scene.drawCrumbling({
      ...area,
      crumbling: [
        { profile: { absentSeconds: 2, warningSeconds: 0.8 }, supportId: terrain, volume: terrain },
      ],
    }),
  ).toThrow("Crumbling terrain has no registered skin face");
});
