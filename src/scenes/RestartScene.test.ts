// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({
  progress: { at: "beginning" as "beginning" | "map", openingSeen: false },
}));
const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), capture: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", () => ({ coverZone: vi.fn() }));
vi.mock("./save.ts", () => ({
  clearProgress: vi.fn(),
  resetWholeRunStats: vi.fn(),
  savedProgress: () => saved.progress,
}));
vi.mock("./modalInput.ts", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: Promise.resolve() }) }));
vi.mock("./domUi.ts", () => ({
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { createUiLayer, startScreenLayout, type UiLayer } from "../ui/index.ts";
import { CelebrationScene } from "./CelebrationScene.ts";
import { RestartScene } from "./RestartScene.ts";
import { clearProgress, resetWholeRunStats } from "./save.ts";
import { StartScene } from "./StartScene.ts";

let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  layer.dispose();
});

// The restart card opened over opener, once its dim is ready.
async function openCard(opener = "start") {
  const events = new EventEmitter();
  const restartClosed = vi.fn(),
    start = vi.fn(),
    stop = vi.fn();
  const scene = Object.assign(new RestartScene(), {
    events,
    scene: { get: () => ({ restartClosed }), start, stop },
    sys: { isActive: () => true },
  });
  scene.init({ opener });
  scene.create();
  await Promise.resolve();
  await Promise.resolve();
  const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
  const button = (name: string) =>
    [...dialog.querySelectorAll("button")].find(
      (element) => (element.getAttribute("aria-label") ?? element.textContent) === name,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  return { button, dialog, events, key, restartClosed, scene, start, stop };
}

it("shows the question as a dialog named from TEXT, focused on the card with nothing chosen", async () => {
  const { dialog } = await openCard();
  const named = (id: string | null) => document.getElementById(id ?? "")?.textContent;
  expect({
    buttons: [...dialog.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    ),
    description: named(dialog.getAttribute("aria-describedby")),
    focused: document.activeElement === dialog,
    modal: dialog.getAttribute("aria-modal"),
    name: named(dialog.getAttribute("aria-labelledby")),
  }).toEqual({
    buttons: [TEXT.restart.cancel, TEXT.restart.restart, TEXT.update.close],
    description: TEXT.restart.question,
    focused: true,
    modal: "true",
    name: TEXT.restart.title,
  });
});

it("moves the keyboard's focus through Cancel, Restart and the X, wrapping, both ways", async () => {
  const { button, key } = await openCard();
  const steps = (["Tab", "ArrowRight", "Tab", "ArrowDown", "ArrowLeft", "ArrowUp"] as const).map(
    (value) => {
      key(value);
      const focused = document.activeElement;
      return focused?.getAttribute("aria-label") ?? focused?.textContent;
    },
  );
  const { cancel, restart } = TEXT.restart;
  const close = TEXT.update.close;
  expect(steps).toEqual([cancel, restart, close, cancel, close, restart]);
  key("Tab", { shiftKey: true });
  expect(document.activeElement).toBe(button(cancel));
});

it("closes without clearing from the close X", async () => {
  const { button, key, restartClosed, stop } = await openCard();
  button(TEXT.update.close).focus();
  key("Enter");
  button(TEXT.update.close).click();
  expect(restartClosed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith();
  expect(clearProgress).not.toHaveBeenCalled();
});

it("never defaults to clearing, and Cancel closes without clearing", async () => {
  const { button, key, restartClosed, stop } = await openCard();
  key("Enter");
  gate.accepts.mockReturnValue(false);
  key("Tab");
  key("Enter");
  expect(restartClosed).not.toHaveBeenCalled();
  gate.accepts.mockReturnValue(true);
  expect(document.activeElement).toBe(button(TEXT.restart.cancel));
  key("Enter");
  key("Enter");
  expect(restartClosed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith();
  expect(clearProgress).not.toHaveBeenCalled();
});

it("commits a confirmed restart only once", async () => {
  const { button, key, start, stop } = await openCard();
  button(TEXT.restart.restart).focus();
  key("Enter");
  key(" ");
  button(TEXT.restart.restart).click();
  expect(clearProgress).toHaveBeenCalledOnce();
  expect(resetWholeRunStats).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith("start");
  expect(start).toHaveBeenCalledExactlyOnceWith("opening");
});

it.each(["Escape", "P", "p"])("closes on %s", async (value) => {
  const { key, restartClosed } = await openCard();
  key(value);
  key(value, { repeat: true });
  expect(restartClosed).toHaveBeenCalledOnce();
  expect(clearProgress).not.toHaveBeenCalled();
});

it("closes on a tap outside the card, never on one that lands on it or travels", async () => {
  const { dialog, restartClosed } = await openCard();
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const tap = (target: HTMLElement, travel: number) => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 5 + travel,
        clientY: 5,
        pointerId: 1,
      }),
    );
  };
  tap(dialog, 0);
  tap(backdrop, 40);
  expect(restartClosed).not.toHaveBeenCalled();
  tap(backdrop, 0);
  expect(restartClosed).toHaveBeenCalledOnce();
});

it("removes the card and gives back the keys when the scene shuts down", async () => {
  const { events } = await openCard();
  events.emit("shutdown");
  expect(document.querySelector("[role=dialog]")).toBeNull();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

it.each([
  { kind: "start", make: () => new StartScene() },
  { kind: "celebration", make: () => new CelebrationScene() },
])("requires the Restart scene before $kind can clear anything", ({ kind, make }) => {
  const launch = vi.fn(),
    start = vi.fn();
  const scene = Object.assign(make(), {
    drawFocus: vi.fn(),
    render: vi.fn(),
    scene: { key: kind, launch, start },
  }) as unknown as { act(control: "restart"): void };
  scene.act("restart");
  expect(launch).toHaveBeenCalledExactlyOnceWith("restart", { opener: kind });
  expect(start).not.toHaveBeenCalled();
  expect(clearProgress).not.toHaveBeenCalled();
});

it.each([
  { hasContinue: false, name: "Start with beginning progress", progress: "beginning" },
  { hasContinue: true, name: "Continue", progress: "map" },
  {
    hasContinue: true,
    name: "Continue context with beginning progress",
    progress: "beginning",
  },
] as const)("preserves saved totals for $name", ({ hasContinue, progress }) => {
  saved.progress = { at: progress, openingSeen: true };
  const start = vi.fn();
  const scene = Object.assign(new StartScene(), {
    layout: startScreenLayout({ height: 239, width: 558 }, false, hasContinue),
    scene: { start },
  }) as unknown as { act(control: "start"): void };
  scene.act("start");
  scene.act("start");
  expect(resetWholeRunStats).not.toHaveBeenCalled();
  expect(clearProgress).not.toHaveBeenCalled();
  expect(start).toHaveBeenCalledExactlyOnceWith("map");
});
