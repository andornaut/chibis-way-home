import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json" with { type: "json" };
import { BOSS_WARNING } from "../data/bossWarning.ts";
import type { SpriteContact } from "../data/types/index.ts";
import type { BehaviourState } from "../rules/behaviour.ts";
import { mountBossWarning } from "./bossWarning.ts";

it("outlines the actual frame with origin, flip and scale, clears only a drawn outline, disposes once", () => {
  let colour = 0;
  const painted: { colour: number; rect: number[] }[] = [];
  const graphics = {
    clear: vi.fn(),
    destroy: vi.fn(),
    fillRect: vi.fn((...rect: number[]) => {
      painted.push({ colour, rect });
    }),
    fillStyle: vi.fn((value: number) => {
      colour = value;
    }),
    setDepth: vi.fn(),
    setScrollFactor: vi.fn(),
  };
  graphics.setDepth.mockReturnValue(graphics);
  graphics.setScrollFactor.mockReturnValue(graphics);
  const events = new EventEmitter();
  const scene = { add: { graphics: () => graphics }, events } as unknown as Scene;
  const warning = mountBossWarning(
    BOSS_WARNING,
    -0.5,
    (name) => Number.parseInt(palette.colours[name as keyof typeof palette.colours].slice(1), 16),
    scene,
  );
  const sprite = {
    flipX: false,
    flipY: false,
    frame: { name: "first", realHeight: 3, realWidth: 4 },
    originX: 0.5,
    originY: 1,
    scaleX: 2,
    scaleY: 2,
    visible: true,
    x: 100,
    y: 80,
  } as unknown as GameObjects.Sprite;
  const contact: SpriteContact = {
    frame: { height: 3, width: 4 },
    frames: { first: [[1, 0, 1]], second: [[1, 3, 4]] },
    tags: {},
  };
  const tell: BehaviourState = {
    active: true,
    activeAttack: { id: "attack", phase: "tell" },
    elapsed: 0,
    facing: 1,
    stateKey: "tell",
  };
  warning.draw(tell, sprite, contact);
  expect(painted).toContainEqual({
    colour: Number.parseInt(palette.colours[BOSS_WARNING.colour].slice(1), 16),
    rect: [94, 76, 2, 2],
  });
  const first = painted.splice(0);
  sprite.flipX = true;
  warning.draw(tell, sprite, contact);
  expect(painted).toEqual(
    first.map(({ colour, rect: [x, y, width, height] }) => ({
      colour,
      rect: [200 - x! - width!, y, width, height],
    })),
  );
  painted.length = 0;
  sprite.flipX = false;
  Object.assign(sprite.frame, { name: "second" });
  warning.draw(tell, sprite, contact);
  expect(painted).not.toEqual(first);
  warning.clear();
  const count = graphics.fillRect.mock.calls.length;
  warning.draw({ ...tell, activeAttack: { id: "attack", phase: "committed" } }, sprite, contact);
  expect(graphics.fillRect).toHaveBeenCalledTimes(count);
  warning.clear();
  expect(graphics.setDepth).toHaveBeenCalledWith(-0.5);
  expect(graphics.setScrollFactor).toHaveBeenCalledWith(1);
  expect(graphics.clear).toHaveBeenCalledOnce();
  events.emit("shutdown");
  warning.draw(tell, sprite, contact);
  warning.clear();
  events.emit("destroy");
  expect(graphics.destroy).toHaveBeenCalledOnce();
  expect(graphics.fillRect).toHaveBeenCalledTimes(count);
});
