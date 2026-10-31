import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { TILE } from "../data/screen";
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
    readonly cameras = { main: { width: 900 } };
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
  it("approaches the viewport centre before manual dialogue, then departs at the same maximum speed", () => {
    const { actor, scene } = introduction();
    const width = scene.cameras.main.width;
    const initialX = actor.x;
    expect(initialX - actor.displayWidth / 2).toBeGreaterThanOrEqual(width);
    expect(scene.scene.launch).not.toHaveBeenCalled();
    scene.dialogueClosed();
    scene.update(1000, 1000);
    expect(actor.x).toBe(initialX - entry.escapeTilesPerSecond * TILE);
    expect(scene.scene.launch).not.toHaveBeenCalled();
    expect(calls.heard).not.toHaveBeenCalled();
    scene.update(11000, 10000);
    expect(actor.x).toBe(width / 2);
    expect(scene.scene.launch).toHaveBeenCalledExactlyOnceWith("dialogue", {
      linear: true,
      opener: "zoneIntroduction",
      scene: "conversation",
    });
    scene.update(21000, 10000);
    expect(actor.x).toBe(width / 2);
    expect(calls.closed).not.toHaveBeenCalled();
    scene.dialogueClosed();
    scene.dialogueClosed();
    expect(calls.heard).toHaveBeenCalledOnce();
    expect(actor.setFlipX).toHaveBeenLastCalledWith(false);
    scene.update(22000, 1000);
    expect(actor.x).toBe(width / 2 + entry.escapeTilesPerSecond * TILE);
    expect(calls.closed).not.toHaveBeenCalled();
    scene.update(32000, 10000);
    expect(actor.x - actor.displayWidth / 2).toBeGreaterThan(width);
    expect(actor.destroy).toHaveBeenCalledOnce();
    expect(calls.closed).toHaveBeenCalledOnce();
    scene.update(33000, 1000);
    expect(calls.closed).toHaveBeenCalledOnce();
  });

  it.each(["approach", "dialogue"])(
    "cleans interrupted %s and releases its cinematic input scope",
    (phase) => {
      const { actor, scene } = introduction();
      if (phase === "dialogue") {
        scene.update(10000, 10000);
      }
      const world = { events: new EventEmitter(), game: scene.game } as unknown as typeof scene;
      expect(modalInput(world).accepts()).toBe(false);
      scene.events.emit("shutdown");
      if (phase === "dialogue") {
        expect(scene.scene.stop).toHaveBeenCalledWith("dialogue");
      } else {
        expect(scene.scene.stop).not.toHaveBeenCalled();
      }
      expect(actor.destroy).toHaveBeenCalledOnce();
      expect(modalInput(world).accepts()).toBe(true);
      scene.dialogueClosed();
      scene.update(20000, 20000);
      expect(calls.closed).not.toHaveBeenCalled();
      expect(calls.heard).not.toHaveBeenCalled();
    },
  );
});
