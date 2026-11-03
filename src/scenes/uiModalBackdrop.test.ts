import { EventEmitter } from "node:events";

import type { UiSnapshotResult } from "@andornaut/game-kit/view/phaser/uiCommands";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

const legacy = vi.hoisted(() => vi.fn());
vi.mock("@andornaut/game-kit/view/phaser/modalBackdrop", () => ({ mountModalBackdrop: legacy }));
vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 0 } } }));

import { mountUiModalBackdrop } from "./uiModalBackdrop";
import { bindGameUiPresentation } from "./uiPresentationPort";

const area = { height: 2, width: 3, x: 0, y: 0 };
function fixture() {
  let resolve!: (result: UiSnapshotResult) => void;
  const ready = new Promise<UiSnapshotResult>((done) => {
    resolve = done;
  });
  const destroy = vi.fn(),
    fallback = vi.fn();
  const pixels = { data: new Uint8Array(24), height: 4, width: 6 };
  const target = {
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: vi.fn(),
  };
  const texture = { getContext: () => target, refresh: vi.fn(), setFilter: vi.fn() };
  const image = {
    destroy: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { image: vi.fn(() => image) },
    events: new EventEmitter(),
    game: {},
    textures: { createCanvas: vi.fn(() => texture), exists: () => false, remove: vi.fn() },
  } as unknown as Scene;
  const unbind = bindGameUiPresentation(scene.game, {
    capture: () => ({ destroy, ready }),
    fallback,
  });
  const context = { depth: -100, fallbackColour: 0, remap: (colour: number) => colour, scene };
  return { context, destroy, fallback, image, pixels, resolve, scene, target, texture, unbind };
}
it("keeps snapshot backing pixels high-density while using the original logical backdrop rectangle", async () => {
  const { context, destroy, image, pixels, resolve, scene, target, texture, unbind } = fixture();
  pixels.data[0] = 73;
  const result = mountUiModalBackdrop(context, area)!;
  resolve({ captureArea: area, frameId: 1, pixels, status: "captured" });
  await result.ready;
  expect(scene.textures.createCanvas).toHaveBeenCalledWith(expect.any(String), 6, 4);
  expect(target.putImageData.mock.calls[0]![0].data[0]).toBe(73);
  expect(image.setDisplaySize).toHaveBeenCalledExactlyOnceWith(3, 2);
  expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(0);
  result.destroy();
  result.destroy();
  expect(destroy).toHaveBeenCalledOnce();
  expect(image.destroy).toHaveBeenCalledOnce();
  unbind();
});
it("does not publish a late snapshot after the owning scene shuts down", async () => {
  const { context, destroy, pixels, resolve, scene, unbind } = fixture();
  const result = mountUiModalBackdrop(context, area)!;
  scene.events.emit("shutdown");
  resolve({ captureArea: area, frameId: 1, pixels, status: "captured" });
  await result.ready;
  expect(scene.textures.createCanvas).not.toHaveBeenCalled();
  expect(destroy).toHaveBeenCalledOnce();
  unbind();
});
it("restores the whole domain before requesting a legacy snapshot when capture is unavailable", async () => {
  const { context, fallback, resolve, unbind } = fixture();
  const order: string[] = [];
  fallback.mockImplementation(() => {
    order.push("restore-domain");
  });
  legacy.mockImplementation(() => {
    order.push("legacy-capture");
    return { destroy: vi.fn(), ready: Promise.resolve(false) };
  });
  const result = mountUiModalBackdrop(context, area)!;
  resolve({ reason: "frame", status: "unavailable" });
  await result.ready;
  expect(order).toEqual(["restore-domain", "legacy-capture"]);
  result.destroy();
  unbind();
});
