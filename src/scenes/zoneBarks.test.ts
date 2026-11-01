import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { bindZoneBarks } from "./zoneBarks";

it("keeps notices with the paused world beneath modal layers and resets them for retry", () => {
  const bark = { enqueue: vi.fn(), reset: vi.fn() };
  const scene = {
    events: new EventEmitter(),
    scene: { get: () => bark, launch: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn() },
  } as unknown as Scene;
  const notices = bindZoneBarks(scene);
  expect(scene.scene.launch).toHaveBeenCalledExactlyOnceWith("zoneBark");
  const line = { line: "spotted", speaker: "speaker" };
  notices.enqueue([line]);
  expect(bark.enqueue).toHaveBeenCalledWith(line);
  scene.events.emit("pause");
  expect(scene.scene.pause).toHaveBeenCalledWith("zoneBark");
  scene.events.emit("resume");
  expect(scene.scene.resume).toHaveBeenCalledWith("zoneBark");
  notices.reset();
  expect(bark.reset).toHaveBeenCalledOnce();
  scene.events.emit("shutdown");
  expect(scene.scene.stop).toHaveBeenCalledWith("zoneBark");
  expect(scene.events.listenerCount("pause")).toBe(0);
  expect(scene.events.listenerCount("resume")).toBe(0);
});
