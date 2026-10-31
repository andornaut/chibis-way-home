import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { SCREEN } from "../data/screen";
import { CARD_CONTENT } from "../layout/contentCard";
import { frameDeathBackdrop } from "./deathCamera";

const card = { height: 224, width: 360, x: (SCREEN.width - 360) / 2, y: (SCREEN.height - 224) / 2 };

describe("death backdrop camera", () => {
  it.each([0, SCREEN.width - 48])(
    "frames a seated bird at x=%i without moving it, restoring bounds and scroll on shutdown",
    (x) => {
      const bird = Object.freeze({ height: 42, width: 48, x, y: 40 });
      const events = new EventEmitter();
      const camera = {
        scrollX: 0,
        scrollY: 100,
        setScroll: vi.fn<(x: number, y: number) => void>(),
        useBounds: true,
      };
      const scene = {
        events,
        scene: { get: () => ({ cameras: { main: camera } }) },
      } as unknown as Scene;
      const restore = frameDeathBackdrop(scene, card, bird);
      expect(camera.useBounds).toBe(false);
      const [scrollX, scrollY] = camera.setScroll.mock.calls[0]!;
      expect(bird.x - scrollX + bird.width / 2).toBe(SCREEN.width / 2);
      expect(100 + bird.y - scrollY).toBe(card.y + card.height + CARD_CONTENT.gap);
      expect(100 + bird.y - scrollY + bird.height).toBeLessThanOrEqual(SCREEN.height);
      expect(bird).toEqual({ height: 42, width: 48, x, y: 40 });
      restore();
      expect(camera.useBounds).toBe(true);
      expect(camera.setScroll).toHaveBeenLastCalledWith(0, 100);
      // A queued scene stop must not overwrite the camera after retry has repositioned it.
      camera.setScroll.mockClear();
      events.emit("shutdown");
      expect(camera.setScroll).not.toHaveBeenCalled();
    },
  );
});
