import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import type { SpriteContact } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";
import { mountBossWarning } from "./bossWarning";

it("registers the actual frame outline with origin, flip and scale, and disposes once", () => {
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
    { colour: "red", inkColour: "ink", inkWidth: 1, strokeWidth: 2 },
    -0.5,
    (name) => (name === "red" ? 2 : 1),
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
  expect(painted).toContainEqual({ colour: 2, rect: [92, 76, 4, 2] });
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
