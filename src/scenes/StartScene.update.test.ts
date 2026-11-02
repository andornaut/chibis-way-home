import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ begin: vi.fn(), cover: vi.fn(), shown: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa", () => ({
  PHONE_EVENTS: { backPressed: "back-pressed" },
  beginStartUpdateVisit: lifecycle.begin,
  coverZone: lifecycle.cover,
  exitShown: () => false,
  startScreenShown: lifecycle.shown,
}));
vi.mock("../save", () => ({ savedProgress: () => ({ at: "map" }) }));
vi.mock("./cardParts", () => ({
  PRIMARY_BUTTON: { art: "ui-button-primary", label: "white" },
  addSlice: vi.fn(),
  addTextButton: vi.fn(),
  captureTab: vi.fn(),
  paletteColour: () => 0,
}));
vi.mock("./playCamera", () => ({ fitPlayCamera: vi.fn() }));

import { startScreenLayout } from "../layout/startScreen";
import { StartScene } from "./StartScene";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("begins one offer visit per Start create, retains it on resume, and covers it before opening cards", () => {
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
  expect(lifecycle.begin).toHaveBeenCalledOnce();
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
  expect(lifecycle.begin).toHaveBeenCalledOnce();
  events.emit("shutdown");
  expect(lifecycle.shown).toHaveBeenLastCalledWith(false);
  scene.create();
  expect(lifecycle.begin).toHaveBeenCalledTimes(2);
  expect(lifecycle.shown).toHaveBeenLastCalledWith(true);
  events.emit("shutdown");
  expect(lifecycle.shown).toHaveBeenLastCalledWith(false);
});

it("draws the native start background before controls without launching or capturing a zone", () => {
  const node = { setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis() };
  const image = vi.fn(() => node);
  const launch = vi.fn();
  const snapshotArea = vi.fn();
  const scene = Object.assign(new StartScene(), {
    add: { image, sprite: () => node },
    cameras: { main: { setBackgroundColor: vi.fn() } },
    game: { renderer: { snapshotArea } },
    layout: startScreenLayout({ height: 239, width: 558 }, false, true),
    scene: { launch },
  }) as unknown as { draw(): void };
  scene.draw();
  expect(image).toHaveBeenNthCalledWith(1, 0, 0, "start-background");
  expect(image).toHaveBeenNthCalledWith(2, expect.any(Number), expect.any(Number), "logo");
  expect(node.setDisplaySize).toHaveBeenCalledOnce();
  expect(launch).not.toHaveBeenCalled();
  expect(snapshotArea).not.toHaveBeenCalled();
});
