import { EventEmitter } from "node:events";

import { frameSteps, startStepClock } from "@andornaut/game-kit/clock/fixedStep";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_MS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { DEATH } from "../data/death.ts";
import { SCREEN } from "../data/screen.ts";
import type { ZoneDeath } from "../data/types/index.ts";
import * as deathPresentation from "../presentation/index.ts";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa/index.ts", () => ({
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
}));
vi.mock("./save.ts", () => ({
  activeStageTime: () => 0,
  flushStats: vi.fn(),
  stageRunStats: () => ({ runSeconds: 13 }),
  wholeRunStats: () => ({ activeSeconds: 47, deaths: 2 }),
  zoneVisitStats: () => ({ runSeconds: 29 }),
}));
vi.mock("../ui/settings/touchControls.ts", () => ({ touchSettings: () => ({}) }));
vi.mock("./contactFeedback.ts", () => ({
  cancelContactFeedback: vi.fn(),
  playContactFeedback: vi.fn(),
}));

import { cancelContactFeedback } from "./contactFeedback.ts";
import { ZoneScene } from "./ZoneScene.ts";

type PanCallback = (camera: unknown, progress: number) => void;
function fixture(reason: "fall" | "hazard") {
  vi.stubGlobal("window", { location: { search: "" } });
  const start = vi.spyOn(deathPresentation, "startDeathPresentation");
  const camera = {
    height: SCREEN.height,
    pan: vi.fn<
      (
        x: number,
        y: number,
        duration: number,
        ease: (progress: number) => number,
        force: boolean,
        callback: PanCallback,
      ) => void
    >(),
    panEffect: { reset: vi.fn() },
    scrollX: 80,
    scrollY: 100,
    setScroll: vi.fn(function (this: { scrollX: number; scrollY: number }, x: number, y: number) {
      this.scrollX = x;
      this.scrollY = y;
    }),
    width: SCREEN.width,
  };
  const feet = reason === "fall" ? 1500 : 240;
  const ground = { height: 120, width: 5000, x: 0, y: feet };
  const death: ZoneDeath = {
    position: { x: 2400, y: feet - BIRD.height },
    reason,
    support: reason === "hazard" ? ground : undefined,
    velocity: { x: 0, y: 0 },
  };
  const actor = {
    anims: { stop: vi.fn() },
    frame: BIRD_FRAME,
    setFlipX: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }),
    x: 0,
    y: 0,
  };
  const scene = Object.assign(new ZoneScene(), {
    bird: actor,
    cameras: { main: camera },
    clearControls: vi.fn(),
    clock: frameSteps({ maxFrameMs: 100, stepMs: STEP_MS }, 100, startStepClock).clock,
    drawObjects: vi.fn(),
    drawProgress: vi.fn(),
    events: new EventEmitter(),
    input: { enabled: true },
    layout: { areas: { main: { objects: [], solids: reason === "fall" ? [] : [ground] } } },
    loading: false,
    progressFraction: () => 0,
    scene: { launch: vi.fn(), pause: vi.fn(), start: vi.fn() },
    sheet: () => new Map([["death", [0, 1, 2, 3].map((frame) => ({ frame }))]]),
    showTouchControls: vi.fn(),
    stageKey: () => "street",
    zone: { area: "main", bird: { ...death.position, facing: 1 }, death, objects: [] },
  }) as unknown as {
    beginDeath(): void;
    update(time: number): void;
    updateDeath(time: number): void;
    leaveDeath(): void;
    deathFraming: boolean;
    dying: deathPresentation.DeathPresentation | undefined;
    events: EventEmitter;
    input: { enabled: boolean };
    scene: { launch: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };
    zone: unknown;
  };
  const completePan = () => {
    const [x, y, , , , callback] = camera.pan.mock.calls[0]!;
    camera.setScroll(x - camera.width / 2, y - camera.height / 2);
    callback(camera, 1);
  };
  return { actor, camera, completePan, scene, start };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("one death presentation per attempt", () => {
  it.each(["hazard", "fall"] as const)(
    "pans first for %s, then animates and opens one modal",
    (reason) => {
      const { actor, camera, completePan, scene, start } = fixture(reason);
      const world = JSON.stringify(scene.zone);
      scene.beginDeath();
      expect(camera.pan).toHaveBeenCalledOnce();
      expect(scene.deathFraming).toBe(true);
      expect(scene.input.enabled).toBe(false);
      expect(actor.anims.stop).toHaveBeenCalledOnce();
      scene.beginDeath();
      scene.update(1000);
      scene.update(3000);
      expect(camera.pan).toHaveBeenCalledOnce();
      expect(camera.setScroll).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(actor.setFrame).not.toHaveBeenCalled();
      expect(scene.scene.launch).not.toHaveBeenCalled();
      expect(JSON.stringify(scene.zone)).toBe(world);
      completePan();
      expect(scene.deathFraming).toBe(false);
      expect(start).toHaveBeenCalledOnce();
      const framed = [camera.scrollX, camera.scrollY];
      scene.updateDeath(10000);
      expect(scene.dying?.phase).toBe(reason === "fall" ? "fall" : "recoil");
      expect(scene.dying?.elapsed).toBe(0);
      for (let tick = 1; tick < 300 && scene.dying?.phase !== "seated"; tick++) {
        scene.updateDeath(10000 + tick * STEP_MS);
      }
      expect(scene.dying?.phase).toBe("seated");
      expect(actor.x - camera.scrollX + BIRD_FRAME.width / 2).toBe(SCREEN.width / 2);
      expect(actor.y - camera.scrollY + BIRD_FRAME.height).toBe(
        SCREEN.height - DEATH.cameraPan.bottomInset,
      );
      expect(JSON.stringify(scene.zone)).toBe(world);
      scene.updateDeath(20000);
      camera.pan.mock.calls[0]![5](camera, 1);
      expect(start).toHaveBeenCalledOnce();
      expect(scene.scene.launch).toHaveBeenCalledOnce();
      expect(scene.scene.launch).toHaveBeenCalledWith(
        "death",
        expect.objectContaining({
          totals: { runSeconds: 47, stageSeconds: 13, zoneSeconds: 29 },
        }),
      );
      expect(scene.scene.pause).toHaveBeenCalledOnce();
      expect([camera.scrollX, camera.scrollY]).toEqual(framed);
      expect(camera.setScroll).toHaveBeenCalledOnce();
      const cancellations = vi.mocked(cancelContactFeedback).mock.calls.length;
      scene.leaveDeath();
      expect(cancelContactFeedback).toHaveBeenCalledTimes(cancellations + 1);
      expect(vi.mocked(cancelContactFeedback).mock.invocationCallOrder.at(-1)).toBeLessThan(
        camera.setScroll.mock.invocationCallOrder.at(-1)!,
      );
      expect([camera.scrollX, camera.scrollY]).toEqual([80, 100]);
      camera.setScroll.mockClear();
      scene.events.emit("shutdown");
      expect(camera.setScroll).not.toHaveBeenCalled();
    },
  );

  it("never starts an animation or modal from a mid-pan completion queued after shutdown", () => {
    const { camera, scene, start } = fixture("fall");
    scene.beginDeath();
    const completion = camera.pan.mock.calls[0]![5];
    scene.events.emit("shutdown");
    completion(camera, 1);
    scene.updateDeath(10000);
    expect(camera.panEffect.reset).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(scene.scene.launch).not.toHaveBeenCalled();
    expect([camera.scrollX, camera.scrollY]).toEqual([80, 100]);
  });
});
