import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { SCREEN, TILE } from "../data/screen";
import type { ZoneEntryIntroduction } from "../data/types";

const calls = vi.hoisted(() => ({ departing: vi.fn(), heard: vi.fn() }));
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
    // The view's camera at a fractional zoom: its viewport is device pixels wide.
    readonly cameras = { main: { width: 1560, zoom: 390 / 180 } };
    readonly events = new EventEmitter();
    readonly game = {};
    readonly scene = {
      get: () => ({
        introductionDepartureStarted: calls.departing,
        introductionHeard: calls.heard,
      }),
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
  calls.departing.mockClear();
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
    const { width } = SCREEN;
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
    expect(calls.departing).not.toHaveBeenCalled();
    scene.dialogueClosed();
    scene.dialogueClosed();
    expect(calls.heard).toHaveBeenCalledOnce();
    expect(calls.departing).toHaveBeenCalledOnce();
    expect(calls.heard.mock.invocationCallOrder[0]).toBeLessThan(
      calls.departing.mock.invocationCallOrder[0]!,
    );
    expect(actor.play.mock.invocationCallOrder.at(-1)).toBeLessThan(
      calls.departing.mock.invocationCallOrder[0]!,
    );
    expect(actor.setFlipX).toHaveBeenLastCalledWith(false);
    scene.update(22000, 1000);
    expect(actor.x).toBe(width / 2 + entry.escapeTilesPerSecond * TILE);
    expect(calls.departing).toHaveBeenCalledOnce();
    scene.update(32000, 10000);
    expect(actor.x - actor.displayWidth / 2).toBeGreaterThan(width);
    expect(actor.destroy).toHaveBeenCalledOnce();
    expect(calls.departing).toHaveBeenCalledOnce();
    scene.update(33000, 1000);
    expect(calls.departing).toHaveBeenCalledOnce();
  });

  it("releases only its input scope at departure and cannot reopen gameplay through a later pause", () => {
    const { actor, scene } = introduction();
    const world = { events: new EventEmitter(), game: scene.game } as unknown as typeof scene;
    const pause = { events: new EventEmitter(), game: scene.game } as unknown as typeof scene;
    const duringApproach = modalInput(world).capture();
    expect(modalInput(world).accepts()).toBe(false);
    scene.update(10000, 10000);
    const duringDialogue = modalInput(scene).capture();
    scene.dialogueClosed();
    expect(modalInput(world).accepts()).toBe(true);
    expect(duringApproach()).toBe(false);
    expect(duringDialogue()).toBe(false);
    expect(actor.destroy).not.toHaveBeenCalled();
    expect(calls.departing).toHaveBeenCalledOnce();
    const beforePause = modalInput(world).capture();
    modalInput(pause).open();
    scene.update(20000, 10000);
    scene.events.emit("shutdown");
    scene.dialogueClosed();
    expect(calls.departing).toHaveBeenCalledOnce();
    expect(modalInput(world).accepts()).toBe(false);
    expect(modalInput(pause).accepts()).toBe(true);
    expect(beforePause()).toBe(false);
    pause.events.emit("shutdown");
    expect(modalInput(world).accepts()).toBe(true);
    expect(beforePause()).toBe(false);
  });

  it.each(["approach", "dialogue"])("cleans interrupted %s without releasing gameplay", (phase) => {
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
    expect(calls.departing).not.toHaveBeenCalled();
    expect(calls.heard).not.toHaveBeenCalled();
  });
});
