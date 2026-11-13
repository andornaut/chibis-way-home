// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ cover: vi.fn(), shown: vi.fn() }));
const native = vi.hoisted(() => ({ cancel: vi.fn(), layer: vi.fn(), reveal: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "back-pressed" },
  coverZone: lifecycle.cover,
  exitShown: () => false,
  startScreenShown: lifecycle.shown,
}));
vi.mock("./save.ts", () => ({ savedProgress: () => ({ at: "map" }) }));
vi.mock("./keyboardCapture.ts", () => ({ captureTab: vi.fn() }));
vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 0 }));
vi.mock("./playCamera.ts", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: async () => "blob:art",
  mountSceneView: (_scene: unknown, view: HTMLElement) => document.body.append(view),
  revealSceneView: native.reveal,
  sceneDomUi: native.layer,
}));

import { StartScene } from "./StartScene.ts";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("shows Start on each create, not again on resume, and covers it before opening cards", () => {
  vi.stubGlobal("window", new EventTarget());
  const events = new EventEmitter();
  const launch = vi.fn();
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    drawFocus: vi.fn(),
    events,
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start", launch },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  }) as unknown as {
    act(control: "achievements" | "restart"): void;
    create(): void;
    restartClosed(): void;
    achievementsClosed(): void;
  };
  scene.create();
  expect(launch).not.toHaveBeenCalled();
  expect(lifecycle.shown).toHaveBeenCalledExactlyOnceWith(true);
  events.emit("resume");
  for (const card of ["achievements", "restart"] as const) {
    scene.act(card);
    expect(lifecycle.cover).toHaveBeenLastCalledWith("startCard", true);
    expect(lifecycle.cover.mock.invocationCallOrder.at(-1)).toBeLessThan(
      launch.mock.invocationCallOrder.at(-1)!,
    );
    scene[card === "achievements" ? "achievementsClosed" : "restartClosed"]();
    expect(lifecycle.cover).toHaveBeenLastCalledWith("startCard", false);
  }
  expect(lifecycle.shown).toHaveBeenCalledOnce();
  events.emit("shutdown");
  expect(lifecycle.shown).toHaveBeenLastCalledWith(false);
  scene.create();
  expect(lifecycle.shown).toHaveBeenLastCalledWith(true);
  events.emit("shutdown");
  expect(lifecycle.shown).toHaveBeenLastCalledWith(false);
});

it("keeps only the static background on the Start canvas", () => {
  const node = { setOrigin: vi.fn().mockReturnThis() };
  const image = vi.fn(() => node);
  const scene = Object.assign(new StartScene(), {
    add: { image },
    cameras: { main: { setBackgroundColor: vi.fn() } },
  }) as unknown as { draw(): void };
  scene.draw();
  expect(image).toHaveBeenCalledExactlyOnceWith(0, 0, "start-background");
});

it("enables Start input only after the native view decodes, then cancels on shutdown", async () => {
  let reveal!: (ready: boolean) => void;
  native.layer.mockReturnValue({ element: document.body });
  native.reveal.mockImplementation((_scene, root: HTMLElement) => {
    root.hidden = true;
    return {
      cancel: native.cancel,
      revealed: new Promise<boolean>((resolve) => {
        reveal = resolve;
      }),
    };
  });
  const events = new EventEmitter();
  const start = vi.fn();
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    events,
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start", start },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  }) as unknown as Pick<StartScene, "create">;
  scene.create();
  const root = document.querySelector<HTMLElement>(".start-scene")!;
  const button = root.querySelector<HTMLButtonElement>('[data-control="start"]')!;
  button.click();
  expect(start).not.toHaveBeenCalled();
  reveal(true);
  await Promise.resolve();
  const repeat = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    repeat: true,
  });
  button.dispatchEvent(repeat);
  expect(repeat.defaultPrevented).toBe(true);
  expect(start).not.toHaveBeenCalled();
  root.style.setProperty("--ui-unit", "1");
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  button.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
  button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  expect(start).not.toHaveBeenCalled();
  root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(start).toHaveBeenCalledExactlyOnceWith("map");
  button.click();
  expect(start).toHaveBeenCalledOnce();
  events.emit("shutdown");
  expect(native.cancel).toHaveBeenCalledOnce();
  root.remove();
  native.layer.mockReset();
});

it("does not hand off a cancelled reveal after Start shuts down", async () => {
  let reveal!: (ready: boolean) => void;
  native.layer.mockReturnValue({ element: document.body });
  native.reveal.mockReturnValue({
    cancel: native.cancel,
    revealed: new Promise<boolean>((resolve) => {
      reveal = resolve;
    }),
  });
  const events = new EventEmitter();
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    events,
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start" },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  }) as unknown as Pick<StartScene, "create">;
  scene.create();
  events.emit("shutdown");
  reveal(true);
  await Promise.resolve();
  document.querySelector(".start-scene")?.remove();
  native.layer.mockReset();
});
