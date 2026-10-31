import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { SCREEN } from "../data/screen";
import type { ZoneEntryIntroduction } from "../data/types";

const calls = vi.hoisted(() => ({ closed: vi.fn(), heard: vi.fn() }));
vi.mock("../data/characters", () => ({ CHARACTERS: { actor: { art: "actor-art" } } }));
vi.mock("./playCamera", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("phaser", () => ({
  Scene: class {
    readonly add = {
      sprite: (x: number) => ({
        destroy: vi.fn(),
        displayWidth: 48,
        play: vi.fn().mockReturnThis(),
        setFlipX: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        x,
      }),
    };
    readonly anims = { exists: () => true };
    readonly events = new EventEmitter();
    readonly game = {};
    readonly scene = {
      get: () => ({ introductionClosed: calls.closed, introductionHeard: calls.heard }),
      key: "zoneIntroduction",
      launch: vi.fn(),
      stop: vi.fn(),
    };
  },
}));

import { modalInput } from "./modalInput";
import { ZoneIntroductionScene } from "./ZoneIntroductionScene";

const entry: ZoneEntryIntroduction = {
  character: "actor",
  escapeTilesPerSecond: 12,
  idleAnimation: "idle",
  offsetTiles: 6,
  runAnimation: "walk",
};

function introduction() {
  calls.closed.mockClear();
  calls.heard.mockClear();
  const scene = new ZoneIntroductionScene();
  const add = vi.spyOn(scene.add, "sprite");
  scene.init({ entry, feet: { x: 40, y: 300 }, scene: "conversation" });
  scene.create();
  return { actor: add.mock.results[0]!.value, scene };
}

describe("stage entry introduction", () => {
  it("waits for manual dialogue, then runs offscreen and resumes once after cleaning up", () => {
    const { actor, scene } = introduction();
    expect(scene.scene.launch).toHaveBeenCalledExactlyOnceWith("dialogue", {
      linear: true,
      opener: "zoneIntroduction",
      scene: "conversation",
    });
    const initialX = actor.x;
    scene.update(10000, 10000);
    expect(actor.x).toBe(initialX);
    expect(calls.heard).not.toHaveBeenCalled();
    expect(calls.closed).not.toHaveBeenCalled();
    scene.dialogueClosed();
    scene.dialogueClosed();
    expect(calls.heard).toHaveBeenCalledOnce();
    expect(actor.setFlipX).toHaveBeenLastCalledWith(false);
    scene.update(11000, 1000);
    expect(actor.x).toBeGreaterThan(initialX);
    expect(calls.closed).not.toHaveBeenCalled();
    scene.update(21000, 10000);
    expect(actor.x - actor.displayWidth / 2).toBeGreaterThan(SCREEN.width);
    expect(actor.destroy).toHaveBeenCalledOnce();
    expect(calls.closed).toHaveBeenCalledOnce();
    scene.update(22000, 1000);
    expect(calls.closed).toHaveBeenCalledOnce();
  });

  it("stops an interrupted child conversation and releases the cinematic input scope", () => {
    const { actor, scene } = introduction();
    const world = { events: new EventEmitter(), game: scene.game } as unknown as typeof scene;
    expect(modalInput(world).accepts()).toBe(false);
    scene.events.emit("shutdown");
    expect(scene.scene.stop).toHaveBeenCalledWith("dialogue");
    expect(actor.destroy).toHaveBeenCalledOnce();
    expect(modalInput(world).accepts()).toBe(true);
    scene.dialogueClosed();
    scene.update(20000, 20000);
    expect(calls.closed).not.toHaveBeenCalled();
    expect(calls.heard).not.toHaveBeenCalled();
  });
});
