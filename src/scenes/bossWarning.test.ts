import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { BOSS_WARNING } from "../data/bossWarning";
import type { BehaviourState } from "../rules/behaviour";
import { mountBossWarning } from "./bossWarning";

it("draws steady ink/red strokes in world space, clears between frames and disposes once", () => {
  const graphics = {
    clear: vi.fn(),
    destroy: vi.fn(),
    lineStyle: vi.fn(),
    setDepth: vi.fn(),
    setScrollFactor: vi.fn(),
    strokeCircle: vi.fn(),
  };
  for (const method of [
    graphics.lineStyle,
    graphics.setDepth,
    graphics.setScrollFactor,
    graphics.strokeCircle,
  ]) {
    method.mockReturnValue(graphics);
  }
  const events = new EventEmitter();
  const scene = { add: { graphics: () => graphics }, events } as unknown as Scene;
  const colours: Readonly<Record<string, number>> = { ink: 1, red: 2 };
  const warning = mountBossWarning(BOSS_WARNING, -0.5, (name) => colours[name]!, scene);
  const sprite = {
    frame: { realHeight: 48, realWidth: 48 },
    originX: 0.5,
    originY: 1,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    x: 100,
    y: 80,
  } as GameObjects.Sprite;
  const tell: BehaviourState = {
    active: true,
    activeAttack: { id: "attack", phase: "tell" },
    elapsed: 0,
    facing: 1,
    stateKey: "tell",
  };
  warning.clear();
  warning.draw(tell, sprite);
  warning.draw({ ...tell, elapsed: 0.5 }, sprite);
  expect(graphics.setScrollFactor).toHaveBeenCalledWith(1);
  expect(graphics.setDepth).toHaveBeenCalledWith(-0.5);
  expect(graphics.lineStyle.mock.calls).toEqual([
    [BOSS_WARNING.inkWidth, colours.ink],
    [BOSS_WARNING.strokeWidth, colours.red],
    [BOSS_WARNING.inkWidth, colours.ink],
    [BOSS_WARNING.strokeWidth, colours.red],
  ]);
  expect(graphics.strokeCircle.mock.calls).toEqual(Array.from({ length: 4 }, () => [100, 56, 40]));
  warning.clear();
  warning.draw({ ...tell, activeAttack: { id: "attack", phase: "committed" } }, sprite);
  expect(graphics.clear).toHaveBeenCalledTimes(2);
  expect(graphics.strokeCircle).toHaveBeenCalledTimes(4);
  events.emit("shutdown");
  warning.clear();
  warning.draw(tell, sprite);
  events.emit("destroy");
  expect(graphics.destroy).toHaveBeenCalledOnce();
  expect(graphics.strokeCircle).toHaveBeenCalledTimes(4);
});
