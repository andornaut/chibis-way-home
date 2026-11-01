import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { SCREEN } from "../data/screen";
import type { ZoneDeath } from "../data/types";
import { STEP_MS } from "../rules/step";
import { BIRD_FRAME } from "../view/bird";
import * as deathPresentation from "../view/death";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn(), startWakeLock: vi.fn(), stopWakeLock: vi.fn() }));
vi.mock("../save", () => ({
  activeStageTime: () => 0,
  flushStats: vi.fn(),
  stageRunStats: () => ({}),
}));
vi.mock("../settings/touchControls", () => ({ touchSettings: () => ({}) }));
vi.mock("./contactFeedback", () => ({
  cancelContactFeedback: vi.fn(),
  playContactFeedback: vi.fn(),
}));

import { cancelContactFeedback } from "./contactFeedback";
import { ZoneScene } from "./ZoneScene";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("one death presentation per attempt", () => {
  it.each(["hazard", "fall"] as const)(
    "frames %s before animation, then opens one modal without reframing",
    (reason) => {
      vi.stubGlobal("window", { location: { search: "" } });
      const start = vi.spyOn(deathPresentation, "startDeathPresentation");
      const camera = {
        scrollX: 80,
        scrollY: 100,
        setScroll: vi.fn(function (
          this: { scrollX: number; scrollY: number },
          x: number,
          y: number,
        ) {
          this.scrollX = x;
          this.scrollY = y;
        }),
        useBounds: true,
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
        drawObjects: vi.fn(),
        drawProgress: vi.fn(),
        events: new EventEmitter(),
        input: { enabled: true },
        layout: { areas: { main: { objects: [], solids: reason === "fall" ? [] : [ground] } } },
        progressFraction: () => 0,
        scene: { launch: vi.fn(), pause: vi.fn(), start: vi.fn() },
        sheet: () => new Map([["death", [0, 1, 2, 3].map((frame) => ({ frame }))]]),
        showTouchControls: vi.fn(),
        stageKey: () => "street",
        zone: { area: "main", bird: { ...death.position, facing: 1 }, death, objects: [] },
      }) as unknown as {
        beginDeath(): void;
        updateDeath(time: number): void;
        leaveDeath(): void;
        zone: unknown;
        deathView: deathPresentation.DeathView;
        dying: deathPresentation.DeathPresentation;
        scene: { launch: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };
        events: EventEmitter;
      };
      const frozenWorld = JSON.stringify(scene.zone);
      scene.beginDeath();
      const framed = [camera.scrollX, camera.scrollY];
      expect(camera.setScroll.mock.invocationCallOrder[0]).toBeLessThan(
        start.mock.invocationCallOrder[0]!,
      );
      expect(scene.scene.launch).not.toHaveBeenCalled();
      scene.beginDeath();
      expect(start).toHaveBeenCalledOnce();
      for (let tick = 0; tick < 300 && scene.dying.phase !== "seated"; tick++) {
        scene.updateDeath(tick * STEP_MS);
      }
      expect(scene.dying.phase).toBe("seated");
      expect(JSON.stringify(scene.zone)).toBe(frozenWorld);
      expect(actor.x - camera.scrollX + BIRD_FRAME.width / 2).toBe(SCREEN.width / 2);
      expect(actor.y - camera.scrollY + BIRD_FRAME.height).toBe(SCREEN.height);
      expect(scene.scene.launch).toHaveBeenCalledOnce();
      expect(scene.scene.pause).toHaveBeenCalledOnce();
      scene.updateDeath(10000);
      expect(scene.scene.launch).toHaveBeenCalledOnce();
      expect(start).toHaveBeenCalledOnce();
      expect([camera.scrollX, camera.scrollY]).toEqual(framed);
      expect(camera.setScroll).toHaveBeenCalledOnce();
      const cancellations = vi.mocked(cancelContactFeedback).mock.calls.length;
      scene.leaveDeath();
      expect(cancelContactFeedback).toHaveBeenCalledTimes(cancellations + 1);
      expect(vi.mocked(cancelContactFeedback).mock.invocationCallOrder.at(-1)).toBeLessThan(
        camera.setScroll.mock.invocationCallOrder.at(-1)!,
      );
      expect([camera.scrollX, camera.scrollY, camera.useBounds]).toEqual([80, 100, true]);
      camera.setScroll.mockClear();
      scene.events.emit("shutdown");
      expect(camera.setScroll).not.toHaveBeenCalled();
    },
  );
});
