import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { DASH_TRAIL } from "../data/dashTrail";
import { BIRD_FRAME } from "../view/bird";
import { mountDashTrail } from "./dashTrail";

it("clears on pause, draws only active dash time and ignores all calls after shutdown", () => {
  const graphics = {
    clear: vi.fn(),
    destroy: vi.fn(),
    fillRect: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
  };
  const events = new EventEmitter();
  let active = true;
  const scene = {
    add: { graphics: () => graphics },
    events,
    sys: { isActive: () => active },
  } as unknown as Scene;
  const wind = mountDashTrail(DASH_TRAIL, 1, () => 0xead4aa, scene);
  const frame = { ...BIRD_FRAME, x: 100, y: 100 };
  const dash = {
    airUsed: false,
    cooldownRemainingSeconds: 1,
    direction: 1,
    ordinaryVx: 0,
    remainingSeconds: 0.25,
  } as const;
  wind.draw(0.25, frame, dash);
  expect(graphics.fillRect).toHaveBeenCalled();
  const before = graphics.clear.mock.calls.length;
  active = false;
  events.emit("pause");
  expect(graphics.clear).toHaveBeenCalledTimes(before + 1);
  graphics.fillRect.mockClear();
  wind.draw(0.25, frame, dash);
  expect(graphics.fillRect).not.toHaveBeenCalled();
  active = true;
  wind.draw(0.25, frame, { ...dash, remainingSeconds: 0 });
  expect(graphics.fillRect).not.toHaveBeenCalled();
  events.emit("shutdown");
  events.emit("destroy");
  expect(graphics.destroy).toHaveBeenCalledOnce();
  const cleared = graphics.clear.mock.calls.length;
  wind.draw(0.25, frame, dash);
  wind.clear();
  expect(graphics.fillRect).not.toHaveBeenCalled();
  expect(graphics.clear).toHaveBeenCalledTimes(cleared);
});
