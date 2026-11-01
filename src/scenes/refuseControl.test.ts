import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { CONTROL_REFUSAL } from "../data/feedback";
import { refuseControl } from "./refuseControl";

vi.mock("./cardParts", () => ({ paletteColour: () => 99 }));

function fixture() {
  const part = {
    active: true,
    setX(x: number) {
      this.x = x;
    },
    x: 20,
  };
  const label = {
    active: true,
    setTint: vi.fn(),
    tintBottomLeft: 3,
    tintBottomRight: 4,
    tintTopLeft: 1,
    tintTopRight: 2,
  };
  const timer = { remove: vi.fn() };
  const tween = { stop: vi.fn() };
  let tick = () => {};
  let delayed = () => {};
  const scene = {
    events: new EventEmitter(),
    time: {
      addEvent: vi.fn((options: { callback(): void }) => {
        tick = options.callback;
        return timer;
      }),
      delayedCall: vi.fn((_ms: number, callback: () => void) => {
        delayed = callback;
        return timer;
      }),
    },
    tweens: { add: vi.fn(() => tween) },
  } as unknown as Scene;
  return { delayed: () => delayed(), label, part, scene, tick: () => tick(), timer, tween };
}

describe("disabled control refusal", () => {
  it("uses the existing timed whole-control nudge and alternating label cue, then restores every original", () => {
    const f = fixture();
    const complete = vi.fn();
    refuseControl(
      f.scene,
      false,
      [f.part],
      [f.label as unknown as GameObjects.BitmapText],
      complete,
    );
    expect(f.scene.tweens.add).toHaveBeenCalledWith({
      duration: CONTROL_REFUSAL.shakeMs,
      repeat: CONTROL_REFUSAL.flashes - 1,
      targets: [f.part],
      x: `+=${CONTROL_REFUSAL.shake}`,
      yoyo: true,
    });
    expect(f.scene.time.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: CONTROL_REFUSAL.flashMs,
        repeat: CONTROL_REFUSAL.flashes - 1,
      }),
    );
    f.part.x += CONTROL_REFUSAL.shake;
    f.tick();
    expect(f.label.setTint).toHaveBeenLastCalledWith(99);
    for (let tick = 1; tick < CONTROL_REFUSAL.flashes; tick++) {
      f.tick();
    }
    expect(f.part.x).toBe(20);
    expect(f.label.setTint).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(complete).toHaveBeenCalledOnce();
    expect(f.timer.remove).toHaveBeenCalledWith(false);
    expect(f.tween.stop).toHaveBeenCalledOnce();
    f.tick();
    expect(complete).toHaveBeenCalledOnce();
  });

  it("uses steady red with reduced motion and cancels cleanly on stack change or shutdown", () => {
    const f = fixture();
    const complete = vi.fn();
    const cancel = refuseControl(
      f.scene,
      true,
      [f.part],
      [f.label as unknown as GameObjects.BitmapText],
      complete,
    );
    expect(f.scene.tweens.add).not.toHaveBeenCalled();
    expect(f.scene.time.addEvent).not.toHaveBeenCalled();
    expect(f.scene.time.delayedCall).toHaveBeenCalledWith(
      CONTROL_REFUSAL.flashMs * CONTROL_REFUSAL.flashes,
      expect.any(Function),
    );
    expect(f.label.setTint).toHaveBeenCalledExactlyOnceWith(99);
    cancel();
    f.scene.events.emit("shutdown");
    f.delayed();
    expect(f.part.x).toBe(20);
    expect(f.label.setTint).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(complete).toHaveBeenCalledOnce();
  });
});
