// @vitest-environment happy-dom
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { foregroundInput } from "../ui/binding/index.ts";
import { captureTab } from "./keyboardCapture.ts";
import { palette, paletteColour } from "./scenePalette.ts";

it("reads named palette tints and rejects an unknown colour", () => {
  const colours = { colours: { ink: "#181425" } };
  const get = vi.fn(() => colours);
  const scene = { cache: { json: { get } } } as unknown as Pick<Scene, "cache">;
  expect(palette(scene)).toBe(colours);
  expect(paletteColour(scene, "ink")).toBe(0x181425);
  expect(get).toHaveBeenCalledWith("palette");
  expect(() => paletteColour(scene, "unknown")).toThrow("The palette has no unknown");
});

it("captures and releases Tab through the scene's existing keyboard manager", () => {
  const keyboard = { addCapture: vi.fn(), removeCapture: vi.fn() };
  const scene = { input: { keyboard } } as unknown as Pick<Scene, "input">;
  captureTab(scene, true);
  captureTab(scene, false);
  expect(keyboard.addCapture).toHaveBeenCalledExactlyOnceWith("TAB");
  expect(keyboard.removeCapture).toHaveBeenCalledExactlyOnceWith("TAB");
});

it("leaves native Tab to the installed document owner instead of Phaser capture", () => {
  foregroundInput(document);
  const keyboard = { addCapture: vi.fn(), removeCapture: vi.fn() };
  const scene = {
    game: { canvas: document.createElement("canvas") },
    input: { keyboard },
  } as unknown as Pick<Scene, "game" | "input">;
  captureTab(scene, true);
  captureTab(scene, false);
  expect(keyboard.addCapture).not.toHaveBeenCalled();
  expect(keyboard.removeCapture).toHaveBeenCalledTimes(2);
  expect(keyboard.removeCapture).toHaveBeenCalledWith("TAB");
});
