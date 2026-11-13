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
vi.mock("./cardParts.ts", () => ({
  PRIMARY_BUTTON: { art: "ui-button-primary", label: "white" },
  addSlice: vi.fn(),
  addTextButton: vi.fn(),
  captureTab: vi.fn(),
  paletteColour: () => 0,
}));
vi.mock("./playCamera.ts", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: async () => "blob:art",
  mountSceneView: (_scene: unknown, view: HTMLElement) => document.body.append(view),
  revealSceneView: native.reveal,
  sceneDomUi: native.layer,
}));

import { startScreenLayout } from "../ui/index.ts";
import { addSlice } from "./cardParts.ts";
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
    watchPresses: vi.fn(),
  }) as unknown as {
    act(control: "restart" | "settings"): void;
    create(): void;
    restartClosed(): void;
    settingsClosed(): void;
  };
  scene.create();
  expect(launch).not.toHaveBeenCalled();
  expect(lifecycle.shown).toHaveBeenCalledExactlyOnceWith(true);
  events.emit("resume");
  for (const card of ["settings", "restart"] as const) {
    scene.act(card);
    expect(lifecycle.cover).toHaveBeenLastCalledWith("startCard", true);
    expect(lifecycle.cover.mock.invocationCallOrder.at(-1)).toBeLessThan(
      launch.mock.invocationCallOrder.at(-1)!,
    );
    scene[card === "settings" ? "settingsClosed" : "restartClosed"]();
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

it.each([false, true])(
  "retains the Start header, Achievements and Settings when Exit is shown=%s",
  (exitShown) => {
    const node = { setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis() };
    const image = vi.fn<(x: number, y: number, key: string) => typeof node>(() => node);
    const launch = vi.fn();
    const sprite = vi.fn(() => node);
    const snapshotArea = vi.fn();
    const scene = Object.assign(new StartScene(), {
      add: { image, sprite },
      cameras: { main: { setBackgroundColor: vi.fn() } },
      children: { list: [] },
      game: { renderer: { snapshotArea } },
      layout: startScreenLayout({ height: 239, width: 558 }, exitShown, true),
      scene: { launch },
    }) as unknown as { draw(): void };
    scene.draw();
    expect(image).toHaveBeenNthCalledWith(1, 0, 0, "start-background");
    expect(image).toHaveBeenNthCalledWith(2, expect.any(Number), expect.any(Number), "logo");
    expect(node.setDisplaySize).toHaveBeenCalledOnce();
    expect(addSlice).toHaveBeenCalledWith(scene, "ui-nav-bar", {
      height: 48,
      width: 720,
      x: 0,
      y: 0,
    });
    expect(image).toHaveBeenCalledWith(expect.any(Number), 12, "icon-settings-nav");
    expect(image).toHaveBeenCalledWith(expect.any(Number), 12, "icon-achievements");
    expect(image.mock.calls.some(([, , key]) => key === "ui-quit")).toBe(exitShown);
    expect(sprite).toHaveBeenCalledTimes(exitShown ? 3 : 2);
    expect(launch).not.toHaveBeenCalled();
    expect(snapshotArea).not.toHaveBeenCalled();
  },
);

it("hands Start input and only the canvas UI to the decoded native view, then cancels on shutdown", async () => {
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
  const fallback = { setVisible: vi.fn() };
  const start = vi.fn();
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    events,
    fallback: [fallback],
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start", start },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
    watchPresses: vi.fn(),
  }) as unknown as Pick<StartScene, "create">;
  scene.create();
  const root = document.querySelector<HTMLElement>(".start-scene")!;
  const button = root.querySelector<HTMLButtonElement>('[data-control="start"]')!;
  button.click();
  expect(start).not.toHaveBeenCalled();
  expect(fallback.setVisible).not.toHaveBeenCalled();
  reveal(true);
  await Promise.resolve();
  expect(fallback.setVisible).toHaveBeenCalledExactlyOnceWith(false);
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
  const fallback = { setVisible: vi.fn() };
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    events,
    fallback: [fallback],
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start" },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
    watchPresses: vi.fn(),
  }) as unknown as Pick<StartScene, "create">;
  scene.create();
  events.emit("shutdown");
  reveal(true);
  await Promise.resolve();
  expect(fallback.setVisible).not.toHaveBeenCalled();
  document.querySelector(".start-scene")?.remove();
  native.layer.mockReset();
});
