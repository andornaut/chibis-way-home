import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import { AIR_JUMP_CUE } from "../data/airJumpCue.ts";
import { BIRD } from "../data/bird.ts";
import { startBird, stepBird } from "../rules/bird.ts";
import { mountAirJumpCue } from "./airJumpCue.ts";

it("clears on pause and disposes once, without advancing or replaying a covered cue", () => {
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
  const cue = mountAirJumpCue(AIR_JUMP_CUE, 1, () => 0, scene);
  const before = startBird(BIRD, { x: 100, y: 100 });
  const after = stepBird(BIRD, [], [], STEP_SECONDS, { jumpHeld: true, move: 0 }, before);
  const frame = { height: 42, width: 48, x: 100, y: 100 };
  cue.step(STEP_SECONDS, before, after);
  cue.draw(frame, 0);
  expect(graphics.fillRect).toHaveBeenCalled();
  graphics.fillRect.mockClear();
  active = false;
  events.emit("pause");
  cue.step(STEP_SECONDS, before, after);
  active = true;
  cue.draw(frame, 0);
  expect(graphics.fillRect).not.toHaveBeenCalled();
  cue.step(STEP_SECONDS, before, after);
  cue.step(AIR_JUMP_CUE.durationSeconds, after, after);
  cue.draw(frame, 0);
  expect(graphics.fillRect).not.toHaveBeenCalled();
  events.emit("shutdown");
  events.emit("destroy");
  cue.step(STEP_SECONDS, before, after);
  cue.draw(frame, 0);
  cue.clear();
  expect(graphics.destroy).toHaveBeenCalledOnce();
  expect(graphics.fillRect).not.toHaveBeenCalled();
});
