import { EventEmitter } from "node:events";

import type { Input, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { modalInput, onScenePointer } from "./modalInput.ts";

const scene = (game: object) =>
  ({ events: new EventEmitter(), game, input: new EventEmitter() }) as unknown as Scene;
const pointer = { id: 1 } as Input.Pointer;

describe("modal input routes", () => {
  it("accepts only the top scope, clears held controls and rejects gestures spanning a stack change", () => {
    const game = {};
    const world = scene(game);
    const pause = scene(game);
    const settings = scene(game);
    const clear = vi.fn();
    modalInput(world).subscribe(clear);
    const oldWorldPress = modalInput(world).capture();
    modalInput(pause).open();
    const oldPausePress = modalInput(pause).capture();
    modalInput(settings).open();
    expect([
      modalInput(world).accepts(),
      modalInput(pause).accepts(),
      modalInput(settings).accepts(),
    ]).toEqual([false, false, true]);
    settings.events.emit("shutdown");
    expect(modalInput(pause).accepts()).toBe(true);
    expect(oldPausePress()).toBe(false);
    pause.events.emit("shutdown");
    expect(modalInput(world).accepts()).toBe(true);
    expect(oldWorldPress()).toBe(false);
    expect(clear).toHaveBeenCalledTimes(5);
  });

  it("keeps DOM progress behind nested modal canvases until the final close and cleans up on game destruction", () => {
    const host = { removeAttribute: vi.fn(), toggleAttribute: vi.fn() };
    const events = new EventEmitter();
    const game = { canvas: { parentElement: host }, events };
    const pause = scene(game);
    const settings = scene(game);
    const pauseInput = modalInput(pause);
    expect(host.toggleAttribute).toHaveBeenLastCalledWith("data-modal-open", false);
    pauseInput.open();
    expect(host.toggleAttribute).toHaveBeenLastCalledWith("data-modal-open", true);
    modalInput(settings).open();
    settings.events.emit("shutdown");
    expect(host.toggleAttribute).toHaveBeenLastCalledWith("data-modal-open", true);
    pauseInput.close();
    expect(host.toggleAttribute).toHaveBeenLastCalledWith("data-modal-open", false);
    pauseInput.open();
    events.emit("destroy");
    expect(host.removeAttribute).toHaveBeenCalledWith("data-modal-open");
    host.toggleAttribute.mockClear();
    pause.events.emit("shutdown");
    expect(host.toggleAttribute).not.toHaveBeenCalled();
  });

  it("unsubscribes disposed card controls before closing its scope on scene shutdown", () => {
    const game = {};
    const world = scene(game);
    const card = scene(game);
    const clearWorld = vi.fn();
    let disposed = false;
    modalInput(world).subscribe(clearWorld);
    modalInput(card).open();
    modalInput(card).subscribe(() => {
      if (disposed) {
        throw new Error("Cannot redraw destroyed card sprites");
      }
    });
    const beforeClose = clearWorld.mock.calls.length;
    disposed = true;
    expect(() => card.events.emit("shutdown")).not.toThrow();
    expect(modalInput(world).accepts()).toBe(true);
    expect(clearWorld).toHaveBeenCalledTimes(beforeClose + 1);
  });

  it("does not release a held pointer into the world or a newly opened card", () => {
    const game = {};
    const world = scene(game);
    const card = scene(game);
    const releaseWorld = vi.fn();
    const releaseCard = vi.fn();
    onScenePointer(world, "pointerdown", vi.fn());
    onScenePointer(world, "pointerup", releaseWorld);
    onScenePointer(card, "pointerup", releaseCard);
    world.input.emit("pointerdown", pointer);
    modalInput(card).open();
    card.input.emit("pointerup", pointer);
    modalInput(card).close();
    world.input.emit("pointerup", pointer);
    expect(releaseWorld).not.toHaveBeenCalled();
    expect(releaseCard).not.toHaveBeenCalled();
    world.input.emit("pointerdown", pointer);
    world.input.emit("pointerup", pointer);
    expect(releaseWorld).toHaveBeenCalledOnce();
  });

  it("does not deliver the dismissing window/key event to an underlying control", () => {
    const game = {};
    const world = scene(game);
    const card = scene(game);
    const event = {};
    expect(modalInput(world).accepts(event)).toBe(true);
    expect(modalInput(card).accepts(event)).toBe(true);
    modalInput(card).open();
    expect(modalInput(card).accepts(event)).toBe(true);
    modalInput(card).close();
    expect(modalInput(world).accepts(event)).toBe(false);
    expect(modalInput(world).accepts({})).toBe(true);
  });
});
