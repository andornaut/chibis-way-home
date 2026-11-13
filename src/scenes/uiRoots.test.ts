import { EventEmitter } from "node:events";

import type { GameObjects, Scene } from "phaser";
import { expect, it } from "vitest";

import { sceneUiRoots, uiObject } from "./uiRoots.ts";

it("keeps a complete Retry sibling group without reparenting its panel or labels", () => {
  const roots = [{ type: "NineSlice" }, { type: "BitmapText" }, { type: "Rectangle" }];
  const scene = {
    children: { list: roots },
    sys: { settings: { key: "death" } },
  } as unknown as Scene;
  expect(sceneUiRoots(scene)).toBe(roots);
  expect(roots.some((root) => "parentContainer" in root)).toBe(false);
});
it("registers mixed-world UI once and releases destroyed controls without capturing world art", () => {
  for (const key of ["celebration", "map", "opening", "room", "start", "zone"]) {
    const bird = new EventEmitter() as unknown as GameObjects.GameObject;
    const control = new EventEmitter() as unknown as GameObjects.GameObject;
    const scene = {
      children: { list: [bird, control] },
      sys: { settings: { key } },
    } as unknown as Scene;
    expect(uiObject(scene, control), key).toBe(control);
    expect(uiObject(scene, control), key).toBe(control);
    expect(control.listenerCount("destroy"), key).toBe(1);
    expect(sceneUiRoots(scene), key).toEqual([control]);
    control.emit("destroy");
    expect(sceneUiRoots(scene), key).toEqual([]);
  }
});
