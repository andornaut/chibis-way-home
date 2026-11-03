import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { expect, it } from "vitest";

import { sceneUiRoots, uiObject } from "./uiRoots";

it("keeps a complete Retry sibling group without reparenting its panel or labels", () => {
  const roots = [{ type: "NineSlice" }, { type: "BitmapText" }, { type: "Rectangle" }];
  const scene = {
    children: { list: roots },
    sys: { settings: { key: "death" } },
  } as unknown as Scene;
  expect(sceneUiRoots(scene)).toBe(roots);
  expect(roots.some((root) => "parentContainer" in root)).toBe(false);
});
it("registers only explicitly declared mixed-world UI and releases destroyed controls", () => {
  const bird = new EventEmitter() as unknown as GameObjects.GameObject;
  const control = new EventEmitter() as unknown as GameObjects.GameObject;
  const scene = {
    children: { list: [bird, control] },
    sys: { settings: { key: "zone" } },
  } as unknown as Scene;
  expect(uiObject(scene, control)).toBe(control);
  expect(sceneUiRoots(scene)).toEqual([control]);
  control.emit("destroy");
  expect(sceneUiRoots(scene)).toEqual([]);
});
