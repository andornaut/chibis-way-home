import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { easeProgress } from "@andornaut/game-kit/motion";
import type { Cameras, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { DEATH } from "../data/death.ts";
import { SCREEN } from "../data/screen.ts";
import { frameDeathCamera } from "./deathCamera.ts";

const tuning = { bottomInset: 0, maxSeconds: 3, minSeconds: 1, pixelsPerSecond: 100 };
type PanCallback = (camera: unknown, progress: number) => void;

function fixture() {
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
    setScroll: vi.fn(),
    width: SCREEN.width,
  };
  const events = new EventEmitter();
  const scene = { cameras: { main: camera }, events } as unknown as Scene;
  return { camera, events, scene };
}

describe("death presentation camera", () => {
  it.each([
    { distance: 20, duration: 1000, name: "minimum duration" },
    { distance: 200, duration: 2000, name: "distance-based duration" },
    { distance: 800, duration: 3000, name: "maximum duration" },
  ])("requests an eased pan with $name before framing completes", ({ distance, duration }) => {
    const { camera, scene } = fixture();
    const done = vi.fn();
    const bird = Object.freeze({ height: 42, width: 48, x: 416 + distance, y: 418 });
    const restore = frameDeathCamera(tuning, done, scene, bird);
    expect(camera.setScroll).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    const [x, y, ms, easing, force, callback] = camera.pan.mock.calls[0]!;
    expect([x, y, ms, force]).toEqual([440 + distance, 280, duration, true]);
    expect(bird.x - (x - camera.width / 2) + bird.width / 2).toBe(SCREEN.width / 2);
    expect(bird.y - (y - camera.height / 2) + bird.height).toBe(SCREEN.height);
    expect(easing(0.25)).toBe(easeProgress("sineInOut", 0.25));
    callback(camera, 0.5);
    expect(done).not.toHaveBeenCalled();
    callback(camera, 1);
    callback(camera, 1);
    expect(done).toHaveBeenCalledOnce();
    restore();
    expect(camera.panEffect.reset).not.toHaveBeenCalled();
    expect(camera.setScroll).toHaveBeenLastCalledWith(80, 100);
  });

  it("leaves the requested logical context below the full sprite without delaying pan start", () => {
    const { camera, scene } = fixture();
    const done = vi.fn();
    const inset = 24;
    const bird = { height: 42, width: 48, x: 616, y: 418 };
    frameDeathCamera({ ...tuning, bottomInset: inset }, done, scene, bird);
    expect(camera.pan).toHaveBeenCalledOnce();
    const [x, y] = camera.pan.mock.calls[0]!;
    expect(bird.x - (x - camera.width / 2) + bird.width / 2).toBe(SCREEN.width / 2);
    expect(bird.y - (y - camera.height / 2) + bird.height).toBe(SCREEN.height - inset);
    expect(done).not.toHaveBeenCalled();
  });

  it.each([-1, Infinity, NaN])(
    "rejects invalid bottom context %s before changing the camera",
    (bottomInset) => {
      const { camera, scene } = fixture();
      expect(() =>
        frameDeathCamera({ ...tuning, bottomInset }, vi.fn(), scene, {
          height: 42,
          width: 48,
          x: 616,
          y: 418,
        }),
      ).toThrow("Invalid death camera pan tuning");
      expect(camera.pan).not.toHaveBeenCalled();
    },
  );

  it("reaches the requested scroll without an end snap using native pan with a different viewport and zoom", () => {
    const require = createRequire(import.meta.url);
    const phaser = dirname(require.resolve("phaser/package.json"));
    const BaseCamera = require(
      join(phaser, "src/cameras/2d/BaseCamera.js"),
    ) as typeof Cameras.Scene2D.BaseCamera;
    const Pan = require(
      join(phaser, "src/cameras/2d/effects/Pan.js"),
    ) as typeof Cameras.Scene2D.Effects.Pan;
    const base = new BaseCamera(32, 16, 1000, 500).setOrigin(0, 0).setScroll(80, 100).setZoom(2);
    const panEffect = new Pan(base as Cameras.Scene2D.Camera);
    const camera = Object.assign(base, {
      pan: (...args: Parameters<Cameras.Scene2D.Effects.Pan["start"]>) => panEffect.start(...args),
      panEffect,
    });
    const events = new EventEmitter();
    const scene = { cameras: { main: camera }, events } as unknown as Scene;
    const done = vi.fn(() => [camera.scrollX, camera.scrollY]);
    frameDeathCamera({ ...tuning, bottomInset: DEATH.cameraPan.bottomInset }, done, scene, {
      height: 42,
      width: 48,
      x: 1216,
      y: 1018,
    });
    expect([camera.scrollX, camera.scrollY]).toEqual([80, 100]);
    panEffect.update(0, panEffect.duration / 2);
    expect(camera.scrollX).toBeGreaterThan(80);
    expect(camera.scrollX).toBeLessThan(880);
    expect(done).not.toHaveBeenCalled();
    panEffect.update(0, panEffect.duration / 2 - 1);
    const near = [camera.scrollX, camera.scrollY];
    panEffect.update(0, 1);
    expect(done).toHaveReturnedWith([880, 700 + DEATH.cameraPan.bottomInset]);
    expect(Math.hypot(camera.scrollX - near[0]!, camera.scrollY - near[1]!)).toBeLessThan(0.01);
  });

  it("does not add a pan or wait when the final pose is already correctly framed", () => {
    const { camera, scene } = fixture();
    const done = vi.fn();
    frameDeathCamera(tuning, done, scene, { height: 42, width: 48, x: 416, y: 418 });
    expect(done).toHaveBeenCalledOnce();
    expect(camera.pan).not.toHaveBeenCalled();
    expect(camera.setScroll).not.toHaveBeenCalled();
  });

  it("cancels an unfinished pan on shutdown before restoring and ignores a queued completion", () => {
    const { camera, events, scene } = fixture();
    const done = vi.fn();
    const restore = frameDeathCamera(tuning, done, scene, {
      height: 42,
      width: 48,
      x: 2400,
      y: 1400,
    });
    const callback = camera.pan.mock.calls[0]![5];
    events.emit("shutdown");
    expect(camera.panEffect.reset).toHaveBeenCalledOnce();
    expect(camera.panEffect.reset.mock.invocationCallOrder[0]).toBeLessThan(
      camera.setScroll.mock.invocationCallOrder[0]!,
    );
    expect(camera.setScroll).toHaveBeenCalledExactlyOnceWith(80, 100);
    callback(camera, 1);
    restore();
    events.emit("shutdown");
    expect(done).not.toHaveBeenCalled();
    expect(camera.setScroll).toHaveBeenCalledOnce();
  });
});
