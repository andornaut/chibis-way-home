// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTROL_REFUSAL } from "../data/feedback.ts";
import { ZONE_MAP } from "../data/map.ts";

const APARTMENT = ZONE_MAP.destinations.find(({ id }) => id === "apartment")!;
// Every stage before the apartment's fourth is complete, so its first four are unlocked.
const COMPLETED = ZONE_MAP.destinations
  .flatMap(({ stages }) => stages)
  .slice(0, ZONE_MAP.destinations.flatMap(({ stages }) => stages).indexOf(APARTMENT.stages[3]!));
const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
  subscribe: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./save.ts", () => ({ savedMap: () => ({ completed: COMPLETED }) }));
vi.mock("./modalInput.ts", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: Promise.resolve() }) }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:preview"),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { createUiLayer, setReducedMotion, type UiLayer } from "../ui/index.ts";
import { StageSelectScene } from "./StageSelectScene.ts";

let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
  setReducedMotion(window, false);
});

afterEach(() => {
  layer.dispose();
  vi.useRealTimers();
});

const [lobby, restaurant, pool, spa, residential] = APARTMENT.stages as [
  string,
  string,
  string,
  string,
  string,
];
const stageName = (id: string) =>
  `${TEXT.map.stageNumber.replace("{number}", String(APARTMENT.stages.indexOf(id) + 1))}${TEXT.map.stages[id]}`;

// Lets ticks microtasks run: the dim and the screenshots resolve over a few.
async function settle(ticks: number): Promise<void> {
  if (ticks > 0) {
    await Promise.resolve();
    await settle(ticks - 1);
  }
}

// The apartment's stage picker over the map, once its dim is ready.
async function openPicker() {
  const events = new EventEmitter();
  const stageSelected = vi.fn(),
    stageSelectionClosed = vi.fn(),
    stop = vi.fn();
  const scene = Object.assign(new StageSelectScene(), {
    events,
    scene: { get: () => ({ stageSelected, stageSelectionClosed }), stop },
    textures: { exists: () => true },
  });
  scene.init({ destination: APARTMENT.id });
  scene.create();
  await settle(10);
  const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
  const stage = (id: string) => dialog.querySelector<HTMLButtonElement>(`[data-stage="${id}"]`)!;
  const button = (name: string) =>
    [...dialog.querySelectorAll("button")].find((element) => element.textContent === name)!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  // The focused control's name and the stages its page shows.
  const at = () => ({
    focus:
      document.activeElement === dialog
        ? "card"
        : (document.activeElement?.getAttribute("aria-label") ??
          document.activeElement?.textContent),
    page: [...dialog.querySelectorAll<HTMLElement>(".stage-select-page:not([hidden]) button")].map(
      ({ dataset }) => dataset.stage,
    ),
  });
  return { at, button, dialog, events, key, stage, stageSelected, stageSelectionClosed, stop };
}

it("opens on the latest stage's page, named by the destination, with nothing focused", async () => {
  const { at, button, dialog, stage } = await openPicker();
  const named = (id: string | null) => document.getElementById(id ?? "")?.textContent;
  expect({
    ...at(),
    close: dialog.querySelector(".ui-close-button")?.getAttribute("aria-label"),
    count: dialog.querySelector("[aria-live=polite]")?.textContent,
    modal: dialog.getAttribute("aria-modal"),
    name: named(dialog.getAttribute("aria-labelledby")),
    next: button(TEXT.map.stagePages.next).getAttribute("aria-disabled"),
    previews: [...dialog.querySelectorAll("img")].map(({ src }) => src),
    previous: button(TEXT.map.stagePages.previous).getAttribute("aria-disabled"),
    stageNames: [spa, residential].map((id) => stage(id).textContent),
    states: [spa, residential].map((id) => ({
      description: named(stage(id).getAttribute("aria-describedby")),
      disabled: stage(id).getAttribute("aria-disabled"),
      tabIndex: stage(id).tabIndex,
    })),
  }).toEqual({
    close: TEXT.map.stageClose,
    count: TEXT.map.stagePages.page.replace("{page}", "2").replace("{pages}", "2"),
    focus: "card",
    modal: "true",
    name: TEXT.map.zones[APARTMENT.id],
    next: "true",
    page: APARTMENT.stages.slice(3),
    previews: APARTMENT.stages.map(() => "blob:preview"),
    previous: null,
    stageNames: [spa, residential].map(stageName),
    states: [
      { description: undefined, disabled: null, tabIndex: 0 },
      { description: TEXT.map.stageLocked, disabled: "true", tabIndex: -1 },
    ],
  });
});

it("focuses the latest stage first, then the unlocked stages, turning pages, the page button and close", async () => {
  const { at, key } = await openPicker();
  const steps = (
    ["Tab", "Tab", "Tab", "Tab", "ArrowLeft", "ArrowRight", "ArrowRight"] as const
  ).map((value) => {
    key(value);
    return at();
  });
  const first = APARTMENT.stages.slice(0, 3);
  const last = APARTMENT.stages.slice(3);
  expect(steps).toEqual([
    { focus: stageName(spa), page: last },
    { focus: TEXT.map.stagePages.previous, page: last },
    { focus: TEXT.map.stageClose, page: last },
    { focus: stageName(lobby), page: first },
    { focus: TEXT.map.stageClose, page: first },
    { focus: stageName(lobby), page: first },
    { focus: stageName(restaurant), page: first },
  ]);
  key("Tab", { shiftKey: true });
  expect(at().focus).toBe(stageName(lobby));
});

it("never chooses on the key that opened it, and plays the focused stage once", async () => {
  const { key, stageSelected, stop } = await openPicker();
  key("Enter");
  key(" ");
  expect(stageSelected).not.toHaveBeenCalled();
  key("ArrowUp");
  key("Enter");
  key("Enter");
  expect(stop).toHaveBeenCalledExactlyOnceWith();
  expect(stageSelected).toHaveBeenCalledExactlyOnceWith(spa);
});

it("turns the page from a focused page button and refocuses on the new page's first unlocked stage", async () => {
  const { at, key } = await openPicker();
  key("Tab");
  key("Tab");
  key("Enter");
  expect(at()).toEqual({ focus: stageName(lobby), page: APARTMENT.stages.slice(0, 3) });
  expect(gate.invalidate).toHaveBeenCalledOnce();
});

describe("refusals", () => {
  it("shakes a pressed locked stage and flashes its labels red without playing it or restarting", async () => {
    vi.useFakeTimers();
    const { stage, stageSelected } = await openPicker();
    const locked = stage(residential);
    locked.click();
    const shaking = locked.getAttribute("data-ui-refusal-shake");
    vi.advanceTimersByTime(CONTROL_REFUSAL.flashMs);
    locked.click();
    const redAfterStep = locked.hasAttribute("data-ui-refusal-red");
    vi.advanceTimersByTime(CONTROL_REFUSAL.flashMs * (CONTROL_REFUSAL.flashes - 1));
    expect({
      labels: locked.querySelectorAll("[data-ui-refusal-label]").length,
      redAfterStep,
      shaking,
      stopped: locked.hasAttribute("data-ui-refusal-shake"),
    }).toEqual({ labels: 2, redAfterStep: false, shaking: "out", stopped: false });
    expect(stageSelected).not.toHaveBeenCalled();
  });

  it("holds steady red without a shake under the Reduced motion setting", async () => {
    setReducedMotion(window, true);
    const { stage } = await openPicker();
    stage(residential).click();
    expect({
      red: stage(residential).hasAttribute("data-ui-refusal-red"),
      shake: stage(residential).hasAttribute("data-ui-refusal-shake"),
    }).toEqual({ red: true, shake: false });
  });

  it("refuses a press on the page button that has no page to turn to", async () => {
    const { at, button } = await openPicker();
    button(TEXT.map.stagePages.next).click();
    expect(button(TEXT.map.stagePages.next).hasAttribute("data-ui-refusal-shake")).toBe(true);
    expect(at().page).toEqual(APARTMENT.stages.slice(3));
  });

  it("ignores presses and keys while a modal covers it", async () => {
    const { key, stage, stageSelected, stageSelectionClosed } = await openPicker();
    gate.accepts.mockReturnValue(false);
    stage(residential).click();
    stage(spa).click();
    key("Escape");
    expect(stage(residential).hasAttribute("data-ui-refusal-shake")).toBe(false);
    expect(stageSelected).not.toHaveBeenCalled();
    expect(stageSelectionClosed).not.toHaveBeenCalled();
  });
});

it("plays a pressed unlocked stage", async () => {
  const { stage, stageSelected } = await openPicker();
  stage(spa).click();
  stage(pool).click();
  expect(stageSelected).toHaveBeenCalledExactlyOnceWith(spa);
});

it.each(["Escape", "close"])("closes on %s but not on P", async (how) => {
  const { dialog, key, stageSelectionClosed } = await openPicker();
  key("p");
  expect(stageSelectionClosed).not.toHaveBeenCalled();
  if (how === "close") {
    dialog.querySelector<HTMLButtonElement>(".ui-close-button")!.click();
  } else {
    key("Escape");
    key("Escape", { repeat: true });
  }
  expect(stageSelectionClosed).toHaveBeenCalledOnce();
});

it("closes on a tap outside the card, never on one that lands on it", async () => {
  const { dialog, stageSelectionClosed } = await openPicker();
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const tap = (target: HTMLElement) => {
    for (const type of ["pointerdown", "pointerup"]) {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1 }));
    }
  };
  tap(dialog);
  expect(stageSelectionClosed).not.toHaveBeenCalled();
  tap(backdrop);
  expect(stageSelectionClosed).toHaveBeenCalledOnce();
});

it("removes the card when the scene shuts down", async () => {
  const { events } = await openPicker();
  events.emit("shutdown");
  expect(document.querySelector("[role=dialog]")).toBeNull();
});
