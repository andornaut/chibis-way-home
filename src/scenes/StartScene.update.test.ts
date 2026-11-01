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
vi.mock("./cardParts", () => ({ captureTab: vi.fn() }));
vi.mock("./playCamera", () => ({ fitPlayCamera: vi.fn() }));

import { StartScene } from "./StartScene";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("begins one offer visit per Start create, retains it on resume, and covers it before opening cards", async () => {
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
    showStreet: async () => undefined,
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
  expect(lifecycle.begin).toHaveBeenCalledOnce();
  expect(lifecycle.shown).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(lifecycle.shown).toHaveBeenLastCalledWith(true);
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
  let backdropReady!: () => void;
  Object.assign(scene, {
    showStreet: () =>
      new Promise<void>((resolve) => {
        backdropReady = resolve;
      }),
  });
  scene.create();
  expect(lifecycle.begin).toHaveBeenCalledTimes(2);
  events.emit("shutdown");
  const shownCalls = lifecycle.shown.mock.calls.length;
  backdropReady();
  await Promise.resolve();
  expect(lifecycle.shown).toHaveBeenCalledTimes(shownCalls);
});
