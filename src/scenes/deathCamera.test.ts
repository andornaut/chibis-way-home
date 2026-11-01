import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { SCREEN } from "../data/screen";
import { frameDeathCamera } from "./deathCamera";

describe("death presentation camera", () => {
  it.each([
    { x: 0, y: 40 },
    { x: 2400, y: 1400 },
  ])("frames the final world pose at $x,$y before animation and restores only once", ({ x, y }) => {
    const bird = Object.freeze({ height: 42, width: 48, x, y });
    const events = new EventEmitter();
    const camera = {
      scrollX: 80,
      scrollY: 100,
      setScroll: vi.fn<(x: number, y: number) => void>(),
      useBounds: true,
    };
    const scene = { cameras: { main: camera }, events } as unknown as Scene;
    const restore = frameDeathCamera(scene, bird);
    expect(camera.useBounds).toBe(false);
    const [scrollX, scrollY] = camera.setScroll.mock.calls[0]!;
    expect(bird.x - scrollX + bird.width / 2).toBe(SCREEN.width / 2);
    expect(bird.y - scrollY + bird.height).toBe(SCREEN.height);
    expect(bird).toEqual({ height: 42, width: 48, x, y });
    restore();
    expect(camera.useBounds).toBe(true);
    expect(camera.setScroll).toHaveBeenLastCalledWith(80, 100);
    camera.setScroll.mockClear();
    restore();
    events.emit("shutdown");
    expect(camera.setScroll).not.toHaveBeenCalled();
  });
});
