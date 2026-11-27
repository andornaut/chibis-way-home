// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

import { mountFixtureForeground } from "./foregroundFixture.ts";

const native = vi.hoisted(() => ({ cancel: vi.fn(), layer: vi.fn(), reveal: vi.fn() }));
const requestUpdateCheck = vi.hoisted(() => vi.fn());
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "back-pressed" },
  canLeavePlatformBack: () => false,
  closeApp: vi.fn(),
  exitShown: () => false,
  leavePlatformBack: vi.fn(async () => false),
  requestUpdateCheck,
}));
vi.mock("./save.ts", () => ({
  savedProgress: () => ({ at: "map" }),
}));
vi.mock("./keyboardCapture.ts", () => ({ captureTab: vi.fn() }));
vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 0 }));
vi.mock("./playCamera.ts", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: async () => "blob:art",
  mountSceneView: (scene: StartScene, view: HTMLElement) => {
    document.body.append(view);
    mountFixtureForeground(scene, "start", view);
  },
  revealSceneView: native.reveal,
  sceneDomUi: native.layer,
}));

import { START_EXIT_TEXT } from "../data/text.ts";
import { modalInput } from "./modalInput.ts";
import { type StartData, StartScene } from "./StartScene.ts";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([false, true])("asks once for platform Back on bare Start (returned %s)", (returned) => {
  vi.stubGlobal("window", new EventTarget());
  const events = new EventEmitter();
  const launch = vi.fn();
  const back = vi.fn();
  const game = { events: new EventEmitter() };
  const card = { back, events: new EventEmitter(), game };
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    drawFocus: vi.fn(),
    events,
    game,
    input: { keyboard: new EventEmitter() },
    scene: { get: () => card, key: "start", launch },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  }) as unknown as StartScene;
  scene.create(returned ? { returnedToTitle: true } : undefined);
  const input = modalInput(scene);
  window.dispatchEvent(new Event("back-pressed"));
  expect(launch).not.toHaveBeenCalled();
  input.ready(true);
  window.dispatchEvent(new Event("back-pressed"));
  expect(launch).toHaveBeenCalledOnce();
  const [key, request] = launch.mock.calls[0]!;
  expect(key).toBe("exit");
  expect(request.words).toEqual(START_EXIT_TEXT);
  window.dispatchEvent(new Event("back-pressed"));
  expect(back).toHaveBeenCalledOnce();
  expect(launch).toHaveBeenCalledOnce();
  request.cancelled();
  window.dispatchEvent(new Event("back-pressed"));
  expect(launch).toHaveBeenCalledTimes(2);
  events.emit("shutdown");
  window.dispatchEvent(new Event("back-pressed"));
  expect(launch).toHaveBeenCalledTimes(2);
});

it("opens the restart card from Restart and takes focus back when it closes", () => {
  vi.stubGlobal("window", new EventTarget());
  const events = new EventEmitter();
  const launch = vi.fn();
  const drawFocus = vi.fn();
  const scene = Object.assign(new StartScene(), {
    draw: vi.fn(),
    drawFocus,
    events,
    game: {},
    input: { keyboard: new EventEmitter() },
    scene: { key: "start", launch },
    showPressed: vi.fn(),
    sys: { isActive: () => true },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  }) as unknown as {
    act(control: "restart"): void;
    create(): void;
    restartClosed(): void;
  };
  scene.create();
  expect(launch).not.toHaveBeenCalled();
  scene.act("restart");
  expect(launch).toHaveBeenCalledExactlyOnceWith("restart", { opener: "start" });
  expect(requestUpdateCheck).not.toHaveBeenCalled();
  drawFocus.mockClear();
  scene.restartClosed();
  expect(drawFocus).toHaveBeenCalledOnce();
  events.emit("shutdown");
});

it("requests discovery once per actual return to Start, excluding boot and title redraws", () => {
  vi.stubGlobal("window", new EventTarget());
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
  const visit = (data?: StartData) => {
    scene.create(data);
    events.emit("shutdown");
  };
  visit();
  expect(requestUpdateCheck).not.toHaveBeenCalled();
  const returned = { returnedToTitle: true } satisfies StartData;
  visit(returned);
  expect(requestUpdateCheck).toHaveBeenCalledOnce();
  visit(returned);
  visit({});
  expect(requestUpdateCheck).toHaveBeenCalledOnce();
  visit({ returnedToTitle: true });
  expect(requestUpdateCheck).toHaveBeenCalledTimes(2);
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
        reveal = (shown) => {
          root.hidden = !shown;
          resolve(shown);
        };
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
  expect(requestUpdateCheck).not.toHaveBeenCalled();
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
  button.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  button.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  button.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  expect(start).not.toHaveBeenCalled();
  expect(requestUpdateCheck).not.toHaveBeenCalled();
  root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(start).toHaveBeenCalledExactlyOnceWith("map");
  button.click();
  expect(start).toHaveBeenCalledOnce();
  expect(requestUpdateCheck).toHaveBeenCalledOnce();
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
