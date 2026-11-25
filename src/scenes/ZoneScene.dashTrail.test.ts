import { afterEach, expect, it, vi } from "vitest";

import { type ArtManifest, BIRD_FRAME } from "../assets/index.ts";
import { BIRD } from "../data/bird.ts";
import type { ObjectLayout, ZoneLayout } from "../data/types/index.ts";
import { startBird } from "../rules/bird/bird.ts";
import type { SceneryPlaybackState } from "../rules/bird/sceneryPlayback.ts";
import type { ZoneState } from "../rules/zone/zone.ts";

const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true) }));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ frameTurn: () => ({}) }));
vi.mock("./modalInput.ts", () => ({ modalInput: () => gate }));

import { createZoneObjectArt } from "./zoneObjectArt.ts";
import { ZoneScene } from "./ZoneScene.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
});
it("passes the full authored frame and active duration, then clears wind under modal, room and death covers", () => {
  vi.stubGlobal("window", { location: { search: "" } });
  const wind = { clear: vi.fn(), draw: vi.fn() };
  const cue = { clear: vi.fn(), draw: vi.fn() };
  const actor = {
    anims: {},
    frame: BIRD_FRAME,
    play: vi.fn(),
    setFlipX: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    texture: { key: "bird" },
    visible: true,
  };
  const dash = {
    airUsed: false,
    cooldownRemainingSeconds: 1,
    direction: 1,
    ordinaryVx: 0,
    remainingSeconds: 0.25,
  } as const;
  const bird = { ...startBird(BIRD, { x: 200, y: 200 }), dash, facing: -1 };
  const world = { area: "main", bird, death: undefined as unknown };
  const scene = Object.assign(new ZoneScene(), {
    airCue: cue,
    bird: actor,
    cameras: { main: { setScroll: vi.fn() } },
    dashWind: wind,
    layout: { areas: { main: { height: 720, solids: [], width: 2000 } } },
    loading: false,
    movementTuning: () => ({
      ...BIRD,
      dash: { cooldownSeconds: 1, durationSeconds: 0.25, speed: 480 },
    }),
    zone: world,
  }) as unknown as { drawBird(): void; inRoom: boolean };
  scene.drawBird();
  expect(wind.draw).toHaveBeenCalledOnce();
  expect(cue.draw).toHaveBeenCalledOnce();
  const [duration, frame, state] = wind.draw.mock.calls[0]!;
  expect(cue.draw).toHaveBeenCalledExactlyOnceWith(frame, bird.vx);
  expect(duration).toBe(0.25);
  expect(frame).toMatchObject(BIRD_FRAME);
  expect(state.direction).toBe(1);
  expect(actor.setPosition).toHaveBeenLastCalledWith(frame.x, frame.y);
  gate.accepts.mockReturnValue(false);
  scene.drawBird();
  gate.accepts.mockReturnValue(true);
  scene.inRoom = true;
  scene.drawBird();
  scene.inRoom = false;
  world.death = {};
  scene.drawBird();
  expect(wind.draw).toHaveBeenCalledOnce();
  expect(wind.clear).toHaveBeenCalledTimes(3);
  expect(cue.clear).toHaveBeenCalledTimes(3);
  expect(cue.draw).toHaveBeenCalledOnce();
});

it("draws proven world scenery at actual positions without camera compensation or chunk clipping", () => {
  const sprite = {
    anims: {},
    destroy: vi.fn(),
    frame: { height: 24, width: 32 },
    height: 24,
    play: vi.fn(),
    setCrop: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    texture: { key: "fixture" },
    width: 32,
    x: 0,
    y: 0,
  };
  const object = {
    animations: { idle: "idle" },
    art: "fixture",
    collision: "none",
    height: 24,
    interaction: { kind: "none" },
    motion: { algorithm: "linear" },
    origin: { x: 200, y: 140 },
    parallax: { x: 1, y: 1 },
    quirks: [],
    reaction: { kind: "none" },
    scenerySource: "chunk",
    width: 32,
  } as unknown as ObjectLayout;
  const world = {
    area: "main",
    attempt: 0,
    behaviours: [undefined],
    bird: { x: 0, y: 0 },
    objects: [{ x: 200, y: 140 }],
    sceneryPlayback: undefined as readonly (SceneryPlaybackState | undefined)[] | undefined,
    seed: 1,
  };
  const camera = { scrollX: 0, scrollY: 0 };
  const layout = { areas: { main: { objects: [object] } } } as unknown as ZoneLayout;
  const state = world as unknown as ZoneState;
  const scene = Object.assign(
    createZoneObjectArt(
      { add: { sprite: () => sprite }, cameras: { main: camera } } as unknown as Parameters<
        typeof createZoneObjectArt
      >[0],
      {
        manifest: { backdrops: [], sprites: [{ key: "fixture" }] } as unknown as ArtManifest,
        sheet: () => new Map(),
        warning: undefined,
      },
    ),
    { animate: vi.fn(), drawPulses: vi.fn(), drawTransients: vi.fn() },
  ) as unknown as {
    drawObject(
      layout: ZoneLayout,
      zone: ZoneState,
      key: undefined,
      tileset: undefined,
      object: ObjectLayout,
      index: number,
    ): unknown;
    draw(layout: ZoneLayout, openingIndex: number | undefined, zone: ZoneState): void;
    renderBackdrops(): void;
    objectArt: unknown[];
    scenerySprites: unknown[];
  };
  scene.objectArt = [scene.drawObject(layout, state, undefined, undefined, object, 0)];
  expect(sprite.setDepth).toHaveBeenLastCalledWith(-2.5);
  expect(sprite.setScrollFactor).toHaveBeenLastCalledWith(1, 1);
  expect(scene.scenerySprites).toEqual([]);
  scene.draw(layout, undefined, state);
  sprite.setFlipX.mockClear();
  for (const x of [720, -100]) {
    camera.scrollX = x;
    camera.scrollY = 360;
    scene.renderBackdrops();
    scene.draw(layout, undefined, state);
    expect(sprite.setPosition).toHaveBeenLastCalledWith(200, 140);
  }
  expect(sprite.setCrop).not.toHaveBeenCalled();
  expect(sprite.setFlipX).not.toHaveBeenCalled();
  world.objects[0]!.x = 180;
  scene.draw(layout, undefined, state);
  expect(sprite.setPosition).toHaveBeenLastCalledWith(180, 140);
  expect(sprite.setFlipX).toHaveBeenLastCalledWith(true);
  scene.drawObject(layout, state, undefined, undefined, { ...object, collision: "hazard" }, 0);
  expect(sprite.setDepth).toHaveBeenLastCalledWith(0);
  const ordinary = { ...object };
  delete ordinary.scenerySource;
  scene.drawObject(layout, state, undefined, undefined, ordinary, 0);
  expect(sprite.setDepth).toHaveBeenLastCalledWith(0);
  const finite = { ...object, motion: { ...object.motion, playback: "once-visible" as const } };
  scene.objectArt = [scene.drawObject(layout, state, undefined, undefined, finite, 0)];
  expect(sprite.setVisible).toHaveBeenLastCalledWith(false);
  Object.assign(object, { motion: finite.motion });
  world.sceneryPlayback = [{ elapsedSeconds: 1, status: "active" }];
  scene.draw(layout, undefined, state);
  expect(sprite.setVisible).toHaveBeenLastCalledWith(true);
  world.sceneryPlayback = [{ elapsedSeconds: 8, status: "completed" }];
  scene.draw(layout, undefined, state);
  scene.draw(layout, undefined, state);
  expect(sprite.destroy).toHaveBeenCalledOnce();
});
