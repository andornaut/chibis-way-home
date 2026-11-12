// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { fillNames } from "@andornaut/game-kit/lines";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), capture: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
vi.mock("phaser", () => ({ Scene: class {} }));
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
vi.mock("../ui/dialogue/statsStatement.ts", async (original) => {
  const { statsStatement } = await original<typeof import("../ui/dialogue/statsStatement.ts")>();
  return { statsStatement: vi.fn(statsStatement) };
});

import { ZONE_MAP } from "../data/map.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text.ts";
import { deathLabels } from "../presentation/index.ts";
import { createUiLayer, statsStatement, type UiLayer } from "../ui/index.ts";
import { DeathScene } from "./DeathScene.ts";

const STAGE = ZONE_MAP.destinations[0]!.stages[0]!;
const LABELS = deathLabels(ZONE_MAP, TEXT.map, "1", STAGE);
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

// The death card over the zone, once its dim is ready.
async function openCard() {
  const events = new EventEmitter();
  const opener = { leaveDeath: vi.fn(), retryDeath: vi.fn() };
  const stop = vi.fn();
  const scene = Object.assign(new DeathScene(), {
    events,
    scene: { get: (key: string) => (key === "zone" ? opener : undefined), stop },
    sys: { isActive: () => true },
  });
  scene.init({
    ...LABELS,
    activeSeconds: 65,
    percent: 0.5,
    runStats: { attemptSeconds: 65, attempts: 2, bestSeconds: 45, runSeconds: 130 },
    stage: STAGE,
    totals: { runSeconds: 610, stageSeconds: 130, zoneSeconds: 290 },
  });
  scene.create();
  const root = document.querySelector<HTMLElement>(".ui-death-scene")!;
  const waiting = root.hidden;
  await Promise.resolve();
  await Promise.resolve();
  const dialog = document.querySelector<HTMLElement>("[role=alertdialog]")!;
  const button = (name: string) =>
    [...dialog.querySelectorAll("button")].find((element) => element.textContent === name)!;
  const key = (value: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: value,
      ...options,
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  };
  return { button, dialog, events, key, opener, stop, waiting };
}

it("shows the required card as an alert dialog worded from data, focused on the card", async () => {
  const { dialog, waiting } = await openCard();
  expect(statsStatement).toHaveBeenCalledExactlyOnceWith("retry", STAGE);
  const text = (id: string) => document.getElementById(id)?.textContent;
  const row = (list: Element) =>
    [...list.querySelectorAll(".ui-run-stats-row")].map((entry) => [
      entry.querySelector("dt")?.textContent,
      entry.querySelector("dd")?.textContent,
    ]);
  const label = (template: string) => fillNames(template, { count: "", time: "" }).trimEnd();
  expect({
    buttons: [...dialog.querySelectorAll("button")].map(({ textContent }) => textContent),
    columns: [...dialog.querySelectorAll("dl")].map(row),
    description: dialog.getAttribute("aria-describedby")!.split(" ").map(text),
    focused: document.activeElement === dialog,
    modal: dialog.getAttribute("aria-modal"),
    name: dialog.getAttribute("aria-label"),
    title: dialog.querySelector("h2")?.textContent,
    waiting,
  }).toEqual({
    buttons: [TEXT.death.retry, TEXT.pause.home],
    columns: [
      [
        [label(TEXT.stats.lastAttempt), "1:05"],
        [label(TEXT.stats.best), "0:45"],
        [label(TEXT.stats.attempts), "2"],
      ],
      [
        [label(STATS_SCOPE_TEXT.stageTotal), "2:10"],
        [label(STATS_SCOPE_TEXT.zoneTotal), "4:50"],
        [label(TEXT.stats.runTotal), "10:10"],
      ],
    ],
    description: [
      fillNames(TEXT.death.stage, { name: LABELS.stageLabel, number: LABELS.stageNumber }),
      fillNames(TEXT.death.progress, { percent: "50" }),
      statsStatement("retry", STAGE)!.text,
    ],
    focused: true,
    modal: "true",
    name: fillNames(TEXT.death.label, { zone: LABELS.zoneLabel }),
    title: fillNames(TEXT.death.title, { zone: LABELS.zoneLabel }),
    waiting: true,
  });
});

it("retries once for a fresh Enter on the card, or a press that lands and lifts on Try again", async () => {
  const first = await openCard();
  first.key("Enter", { repeat: true });
  expect(first.opener.retryDeath).not.toHaveBeenCalled();
  first.key("Enter");
  first.key(" ");
  first.button(TEXT.death.retry).click();
  expect(first.opener.retryDeath).toHaveBeenCalledOnce();
  expect(first.stop).toHaveBeenCalledExactlyOnceWith();
  first.events.emit("shutdown");
  const { button, opener } = await openCard();
  const retry = button(TEXT.death.retry);
  const pointer = { bubbles: true, pointerId: 1 };
  retry.dispatchEvent(new PointerEvent("pointerdown", pointer));
  retry.dispatchEvent(new PointerEvent("pointerup", pointer));
  retry.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(opener.retryDeath).toHaveBeenCalledOnce();
  expect(opener.leaveDeath).not.toHaveBeenCalled();
});

it("moves the focus through Try again then Back to title, wrapping, and presses the focused one", async () => {
  const { key, opener } = await openCard();
  const steps = (["Tab", "Tab", "ArrowRight", "ArrowLeft"] as const).map((value) => {
    key(value);
    return document.activeElement?.textContent;
  });
  const { home } = TEXT.pause;
  const { retry } = TEXT.death;
  expect(steps).toEqual([retry, home, retry, home]);
  key("Enter");
  expect(opener.leaveDeath).toHaveBeenCalledOnce();
  expect(opener.retryDeath).not.toHaveBeenCalled();
});

it("stays open for back, Escape, P and taps outside or on the card", async () => {
  const { dialog, key, opener, stop } = await openCard();
  expect(layer.modals.back()).toBe(true);
  for (const value of ["Escape", "P", "p"]) {
    key(value);
  }
  const backdrop = document.querySelector<HTMLElement>(".ui-death-scene .ui-backdrop")!;
  for (const target of [backdrop, dialog]) {
    const pointer = { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 };
    target.dispatchEvent(new PointerEvent("pointerdown", pointer));
    target.dispatchEvent(new PointerEvent("pointerup", pointer));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  }
  expect([opener.leaveDeath, opener.retryDeath, stop].map((spy) => spy.mock.calls.length)).toEqual([
    0, 0, 0,
  ]);
  expect(dialog.isConnected).toBe(true);
});

it("acts on no key or press the modal gate refuses", async () => {
  const { button, key, opener } = await openCard();
  gate.accepts.mockReturnValue(false);
  key("Enter");
  button(TEXT.death.retry).click();
  button(TEXT.pause.home).click();
  expect(opener.retryDeath).not.toHaveBeenCalled();
  expect(opener.leaveDeath).not.toHaveBeenCalled();
});

it("removes the card and gives back the keys when the scene shuts down", async () => {
  const { events } = await openCard();
  events.emit("shutdown");
  expect(document.querySelector("[role=alertdialog]")).toBeNull();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
