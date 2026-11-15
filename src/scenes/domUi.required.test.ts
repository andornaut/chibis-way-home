// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { RequiredLoadingResource } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { Game, Scene } from "phaser";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const resources = vi.hoisted(() => ({
  dimmed: vi.fn(),
  fonts: vi.fn<() => readonly RequiredLoadingResource[]>(),
  optionalFonts: vi.fn(),
  skin: vi.fn(),
}));
vi.mock("phaser", () => ({
  Core: { Events: { READY: "ready" } },
  Scale: { Events: { RESIZE: "resize" } },
}));
vi.mock("../ui/index.ts", () => ({
  UI_FRAMES: [],
  applySkin: resources.skin,
  createUiLayer: (_edges: readonly number[], document: Document) => ({
    dispose: vi.fn(),
    element: document.createElement("div"),
    fit: vi.fn(),
    setDimmedSkin: resources.dimmed,
  }),
  filledFrame: vi.fn(),
  loadUiFonts: resources.optionalFonts,
  modalColour: vi.fn(),
  remappedFrame: vi.fn(),
  requiredUiFonts: resources.fonts,
}));

import palette from "../../public/art/palette.json" with { type: "json" };
import { mountDomUi, prepareDomUi } from "./domUi.ts";

const cleanups: (() => void)[] = [];
beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
});
function fixture(): Scene {
  const host = document.createElement("div");
  const game = { events: new EventEmitter(), scale: new EventEmitter() } as unknown as Game;
  cleanups.push(mountDomUi(game, host));
  return { cache: { json: { get: () => palette } }, game } as unknown as Scene;
}

it("settles only rescue presentation after required UI failure without changing failed providers", async () => {
  const scene = fixture();
  const font = {
    retry: vi.fn().mockRejectedValue(new Error("font failed")),
    status: () => "failed" as const,
  };
  const skin = new Error("skin failed");
  resources.fonts.mockReturnValue([font]);
  resources.skin.mockRejectedValue(skin);
  resources.optionalFonts.mockRejectedValue(new Error("fallback font failed"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(prepareDomUi(scene)).rejects.toBe(skin);
  await expect(prepareDomUi(scene, { required: false })).resolves.toBeUndefined();
  expect(font.status()).toBe("failed");
  expect(font.retry).toHaveBeenCalledOnce();
  expect(resources.optionalFonts).toHaveBeenCalledOnce();
  expect(resources.dimmed).not.toHaveBeenCalled();
  expect(warning).toHaveBeenCalledWith("The recovery UI failed to load", skin);
});

it("retains successful skin preparation when the failed required font is retried", async () => {
  const scene = fixture();
  const retry = vi
    .fn()
    .mockRejectedValueOnce(new Error("font failed"))
    .mockResolvedValue(undefined);
  resources.fonts.mockReturnValue([{ retry, status: () => "loading" }]);
  resources.skin.mockResolvedValue({});
  await expect(prepareDomUi(scene)).rejects.toThrow("font failed");
  await expect(prepareDomUi(scene)).resolves.toBeUndefined();
  expect(resources.skin).toHaveBeenCalledOnce();
  expect(resources.dimmed).toHaveBeenCalledOnce();
  expect(retry).toHaveBeenCalledTimes(2);
});
